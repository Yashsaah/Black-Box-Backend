"""
Model registry — the single source of truth about every model the API can serve.

One model per detection type. Adding a detection type is a matter of appending
one ModelSpec below and dropping its weights in `weights/`. Nothing else in the
codebase needs to change: the API, the /models catalogue and the frontend
picker are all driven from here.

Weights are loaded LAZILY (first request for a given model) and then cached for
the process lifetime. A ResNet-50 checkpoint is ~95 MB on disk and ~100 MB in
RAM, so eagerly loading every model at startup would be a waste on a box that
may only ever be asked for one of them.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence

import torch
import torch.nn as nn
from torchvision import models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
HALF_MEAN = (0.5, 0.5, 0.5)
HALF_STD = (0.5, 0.5, 0.5)


# ---------------------------------------------------------------------------
# Architectures — these MUST mirror the notebooks exactly, or load_state_dict
# will reject the checkpoint (which is the behaviour we want: fail loudly).
# ---------------------------------------------------------------------------

def resnet50_dropout_head(num_classes: int, dropout: float = 0.4) -> nn.Module:
    """ResNet-50 with the `Dropout -> Linear` head used in the pneumonia notebook."""
    m = models.resnet50(weights=None)
    m.fc = nn.Sequential(nn.Dropout(p=dropout), nn.Linear(m.fc.in_features, num_classes))
    return m


def resnet18_linear_head(num_classes: int) -> nn.Module:
    """ResNet-18 with a plain linear head — the original OrganAMNIST classifier."""
    m = models.resnet18(weights=None)
    m.fc = nn.Linear(m.fc.in_features, num_classes)
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
    ModelSpec(
        id="organ-resnet18",
        name="Organ ResNet-18",
        disease="Organ localisation",
        task="11-class organ identification from abdominal CT slices",
        architecture="ResNet-18",
        dataset="OrganAMNIST",
        weights_file="model.pth",
        classes=(
            "bladder", "femur-left", "femur-right", "heart", "kidney-left",
            "kidney-right", "liver", "lung-left", "lung-right", "pancreas", "spleen",
        ),
        builder=resnet18_linear_head,
        mean=HALF_MEAN,
        std=HALF_STD,
        summary="Identifies which organ a CT slice shows.",
    ),
]

BY_ID: Dict[str, ModelSpec] = {spec.id: spec for spec in REGISTRY}

# The model /predict uses when the caller doesn't name one.
DEFAULT_MODEL_ID = "pneumonia-resnet50"


# ---------------------------------------------------------------------------
# Loading + caching
# ---------------------------------------------------------------------------

class LoadedModel:
    """A ready-to-serve model: weights on device, Grad-CAM hooks attached."""

    def __init__(self, spec: ModelSpec, module: nn.Module, target_layer: nn.Module):
        self.spec = spec
        self.module = module
        self.target_layer = target_layer


_cache: Dict[str, LoadedModel] = {}
_load_lock = threading.Lock()


def is_available(spec: ModelSpec) -> bool:
    return spec.resolve_weights() is not None


def load(spec: ModelSpec) -> LoadedModel:
    """Return the cached model, loading it on first use. Thread-safe."""
    cached = _cache.get(spec.id)
    if cached is not None:
        return cached

    with _load_lock:
        # Re-check: another thread may have loaded it while we waited.
        cached = _cache.get(spec.id)
        if cached is not None:
            return cached

        path = spec.resolve_weights()
        if path is None:
            raise FileNotFoundError(
                f"No weights for '{spec.id}'. Expected {spec.weights_file} in {WEIGHTS_DIR}."
            )

        module = spec.builder(spec.num_classes)
        state = torch.load(path, map_location=DEVICE)
        if isinstance(state, dict) and "state_dict" in state:
            state = state["state_dict"]
        # strict=True on purpose: a silently mismatched head is worse than a 500.
        module.load_state_dict(state)
        module.to(DEVICE).eval()

        target_layer = spec.target_layer(module)  # what Grad-CAM hooks

        loaded = LoadedModel(spec, module, target_layer)
        _cache[spec.id] = loaded
        print(f"[registry] loaded '{spec.id}' from {path} on {DEVICE}")
        return loaded


def loaded_ids() -> List[str]:
    return sorted(_cache)
