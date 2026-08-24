"""
Model registry — the single source of truth about every model the API can serve.

One model per detection type. Adding a detection type is a matter of appending
one ModelSpec below and dropping its weights in `weights/`. Nothing else in the
codebase needs to change: the API, the /models catalogue and the frontend
picker are all driven from here.

Memory policy (this is the whole reason this file is careful):

  * Weights load LAZILY — nothing touches disk until the first request for a
    given model id.
  * At most MAX_LOADED_MODELS (default 1) stay resident. Serving pneumonia and
    then glaucoma evicts the first instead of holding ~160 MB of both.
  * Checkpoints are mmap'd and installed with `assign=True`, so the weights are
    never materialised twice. Peak is ~1x the file, and the pages stay
    file-backed for the kernel to reclaim under pressure.
  * Every parameter is frozen. Grad-CAM only needs d(logit)/d(activations); with
    requires_grad left on, autograd would allocate a full gradient buffer for
    the entire network on every single request.
"""

from __future__ import annotations

import gc
import os
import pickle
import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence

import torch
import torch.nn as nn
from torchvision import models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")

# On a fractional-CPU box torch's default thread pool just thrashes; one thread
# is measurably faster there. Override with TORCH_NUM_THREADS on a real host.
torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "1")))

# How many models may sit in RAM at once. 1 = single slot, evict on switch.
MAX_LOADED_MODELS = max(1, int(os.environ.get("MAX_LOADED_MODELS", "1")))

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
HALF_MEAN = (0.5, 0.5, 0.5)
HALF_STD = (0.5, 0.5, 0.5)

_device: Optional[torch.device] = None


def device() -> torch.device:
    """Resolved on first use, not at import.

    ZeroGPU (and anything else that attaches an accelerator after the process
    is already up) reports `cuda.is_available() == False` during startup, so
    deciding this at import time would pin us to CPU forever.
    """
    global _device
    if _device is None:
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return _device


# ---------------------------------------------------------------------------
# Architectures — these MUST mirror the notebooks exactly, or load_state_dict
# will reject the checkpoint (which is the behaviour we want: fail loudly).
# ---------------------------------------------------------------------------

def resnet50_dropout_head(num_classes: int, dropout: float = 0.4) -> nn.Module:
    """ResNet-50 with the `Dropout -> Linear` head used in the pneumonia notebook."""
    m = models.resnet50(weights=None)
    m.fc = nn.Sequential(nn.Dropout(p=dropout), nn.Linear(m.fc.in_features, num_classes))
    return m


class GlaucomaCNN(nn.Module):
    """The small custom CNN from the glaucoma notebook (RIM-ONE DL, 128px input).

    Reproduced verbatim — layer names and shapes have to match the checkpoint's
    state_dict keys. `flat` is tied to the 128px input: two 2x2 pools take
    128 -> 64 -> 32, leaving 64 channels x 32 x 32 = 65,536 features.
    """

    def __init__(self, num_classes: int = 2, img_size: int = 128, dropout: float = 0.4):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(32)
        self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm2d(64)

        self.pool = nn.MaxPool2d(2, 2)

        flat = 64 * (img_size // 4) * (img_size // 4)
        self.fc1 = nn.Linear(flat, 256)
        self.fc2 = nn.Linear(256, 64)
        self.fc3 = nn.Linear(64, num_classes)

        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        x = self.pool(torch.relu(self.bn1(self.conv1(x))))   # -> 32 x 64 x 64
        x = self.pool(torch.relu(self.bn2(self.conv2(x))))   # -> 64 x 32 x 32
        x = torch.flatten(x, 1)
        x = self.dropout(torch.relu(self.fc1(x)))
        x = self.dropout(torch.relu(self.fc2(x)))
        return self.fc3(x)


# ---------------------------------------------------------------------------
# Specs
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ModelSpec:
    id: str
    name: str
    disease: str                    # detection type shown in the picker
    task: str
    architecture: str
    dataset: str
    weights_file: str
    classes: Sequence[str]
    builder: Callable[[int], nn.Module]
    input_size: int = 224
    mean: Sequence[float] = IMAGENET_MEAN
    std: Sequence[float] = IMAGENET_STD
    positive_class: Optional[int] = None   # index treated as "finding present"
    summary: str = ""
    # Which module Grad-CAM hooks. Defaults to a ResNet's last conv block; the
    # custom CNN has no `layer4`, so it points at its own last conv instead.
    target_layer: Callable[[nn.Module], nn.Module] = lambda m: m.layer4[-1]
    # Other filenames accepted for the same model, so a checkpoint exported
    # under an older name still resolves instead of silently 503-ing.
    aliases: Sequence[str] = field(default_factory=tuple)

    @property
    def num_classes(self) -> int:
        return len(self.classes)

    def resolve_weights(self) -> Optional[str]:
        """Look in weights/ first, then the backend root (legacy model.pth)."""
        for filename in (self.weights_file, *self.aliases):
            for candidate in (
                os.path.join(WEIGHTS_DIR, filename),
                os.path.join(BASE_DIR, filename),
            ):
                if os.path.isfile(candidate):
                    return candidate
        return None


REGISTRY: List[ModelSpec] = [
    ModelSpec(
        id="pneumonia-resnet50",
        name="Pneumonia ResNet-50",
        disease="Pneumonia",
        task="Binary classification — Normal vs Pneumonia",
        architecture="ResNet-50 (ImageNet-pretrained, fine-tuned)",
        dataset="PneumoniaMNIST 224×224 (MedMNIST+), RGB",
        weights_file="pneumonia_resnet50.pth",
        aliases=("pneumonia_resnet50_valsplit.pth",),
        classes=("normal", "pneumonia"),
        builder=lambda n: resnet50_dropout_head(n, dropout=0.4),
        positive_class=1,
        summary="Detects pneumonia in chest X-rays and shows which regions drove the call.",
    ),
    ModelSpec(
        id="glaucoma-cnn",
        name="Glaucoma CNN",
        disease="Glaucoma",
        task="Binary classification — Glaucoma vs Normal",
        architecture="Custom CNN (2 conv blocks + 3 dense layers)",
        dataset="RIM-ONE DL fundus photographs, 128×128 RGB",
        weights_file="glaucoma_cnn.pth",
        aliases=("glaucoma_cnn_valsplit.pth",),
        # ImageFolder sorts alphabetically, so index 0 is 'glaucoma' here —
        # the opposite of the pneumonia model. positive_class must follow.
        classes=("glaucoma", "normal"),
        builder=lambda n: GlaucomaCNN(n, img_size=128, dropout=0.4),
        input_size=128,
        mean=HALF_MEAN,
        std=HALF_STD,
        positive_class=0,
        target_layer=lambda m: m.conv2,
        summary="Detects glaucoma in retinal fundus photographs and highlights the optic disc region it keyed on.",
    ),
]

BY_ID: Dict[str, ModelSpec] = {spec.id: spec for spec in REGISTRY}

# The model /predict uses when the caller doesn't name one.
DEFAULT_MODEL_ID = "pneumonia-resnet50"


# ---------------------------------------------------------------------------
# Loading + caching
# ---------------------------------------------------------------------------

class LoadedModel:
    """A ready-to-serve model: weights on device, Grad-CAM target picked out.

    `cam` is filled in lazily by inference.grad_cam_for(). Parking it here
    rather than in a module-level dict means eviction actually frees memory —
    a GradCAM holds a reference to the module and a live forward hook on it,
    so a separate cache would pin every model we ever loaded.
    """

    __slots__ = ("spec", "module", "target_layer", "cam", "path")

    def __init__(self, spec: ModelSpec, module: nn.Module, target_layer: nn.Module, path: str):
        self.spec = spec
        self.module = module
        self.target_layer = target_layer
        self.path = path
        self.cam = None


_cache: "OrderedDict[str, LoadedModel]" = OrderedDict()
_load_lock = threading.Lock()


def is_available(spec: ModelSpec) -> bool:
    return spec.resolve_weights() is not None


def _read_state_dict(path: str):
    """mmap the checkpoint so we never hold two copies of the weights.

    Without mmap, torch.load materialises the full state_dict on the heap and
    load_state_dict then *copies* it into the module — a ~190 MB peak for a
    94 MB ResNet. Falls back to a plain load for checkpoints saved in the
    pre-1.6 pickle format, which cannot be mmap'd.
    """
    try:
        return torch.load(path, map_location="cpu", mmap=True, weights_only=True)
    except (RuntimeError, TypeError, ValueError, pickle.UnpicklingError):
        return torch.load(path, map_location="cpu", weights_only=False)


def _evict_to(limit: int) -> None:
    """Drop least-recently-used entries. Caller holds _load_lock."""
    while len(_cache) > limit:
        model_id, dead = _cache.popitem(last=False)
        dead.cam = None
        dead.module = None
        print(f"[registry] evicted '{model_id}' to stay under {MAX_LOADED_MODELS} loaded")
    gc.collect()


def load(spec: ModelSpec) -> LoadedModel:
    """Return the cached model, loading it on first use. Thread-safe."""
    cached = _cache.get(spec.id)
    if cached is not None:
        _cache.move_to_end(spec.id)
        return cached

    with _load_lock:
        # Re-check: another thread may have loaded it while we waited.
        cached = _cache.get(spec.id)
        if cached is not None:
            _cache.move_to_end(spec.id)
            return cached

        path = spec.resolve_weights()
        if path is None:
            raise FileNotFoundError(
                f"No weights for '{spec.id}'. Expected {spec.weights_file} in {WEIGHTS_DIR}."
            )

        # Make room *before* allocating the new one, so the peak is one model
        # and not two.
        _evict_to(MAX_LOADED_MODELS - 1)

        module = spec.builder(spec.num_classes)
        state = _read_state_dict(path)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]

        # strict=True on purpose: a silently mismatched head is worse than a 500.
        # assign=True installs the mmap'd tensors directly instead of copying.
        try:
            module.load_state_dict(state, assign=True)
        except TypeError:            # torch < 2.1 has no `assign`
            module.load_state_dict(state)

        module.to(device()).eval()

        # Grad-CAM differentiates w.r.t. activations, never w.r.t. weights.
        # Leaving these on costs a full gradient buffer (~94 MB for the ResNet)
        # on every request, for nothing.
        for p in module.parameters():
            p.requires_grad_(False)

        target_layer = spec.target_layer(module)  # what Grad-CAM hooks

        loaded = LoadedModel(spec, module, target_layer, path)
        _cache[spec.id] = loaded
        print(f"[registry] loaded '{spec.id}' from {path} on {device()}")
        return loaded


def loaded_ids() -> List[str]:
    return sorted(_cache)
