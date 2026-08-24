"""
Preprocessing, Grad-CAM and heatmap rendering.

Kept separate from main.py so the request layer stays thin and this stays
testable without spinning up FastAPI.

No OpenCV here on purpose. The three things this module needed from it —
resize, Gaussian blur, JET colour map — are a dozen lines of numpy, and
`opencv-python-headless` costs ~65 MB of RSS plus a `libGL` system package in
the container for the privilege.
"""

from __future__ import annotations

import base64
import io
import threading
from functools import lru_cache
from typing import List, Optional, Sequence, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from registry import LoadedModel, ModelSpec, device

# The overlay is a display asset, not a diagnostic one. Blending and
# PNG-encoding a 4000x4000 upload at full resolution costs ~200 MB of transient
# float buffers and produces a base64 payload nobody wants to ship over the
# wire. Cap the long edge; the frontend renders it in a card either way.
MAX_OVERLAY_DIM = 1024

# The CAM comes off a coarse feature map (7x7 for the ResNet, 64x64 for the
# glaucoma CNN). Smooth it at a fixed intermediate size, then scale to the
# image — visually identical to blurring at full resolution and far cheaper.
_SMOOTH_DIM = 256


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------

@lru_cache(maxsize=16)
def _build_preprocess(size: int, mean: Tuple[float, ...], std: Tuple[float, ...]):
    return transforms.Compose(
        [
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(list(mean), list(std)),
        ]
    )


def preprocess(img: Image.Image, spec: ModelSpec) -> torch.Tensor:
    """PIL image -> normalised NCHW tensor on the right device.

    `.convert("RGB")` on a grayscale X-ray replicates the single channel three
    times, which is exactly what MedMNIST's `as_rgb=True` does during training.
    """
    tf = _build_preprocess(spec.input_size, tuple(spec.mean), tuple(spec.std))
    return tf(img.convert("RGB")).unsqueeze(0).to(device())


# ---------------------------------------------------------------------------
# Grad-CAM
# ---------------------------------------------------------------------------

class GradCAM:
    """Grad-CAM on a model's last convolutional block.

    One instance per loaded model, parked on the LoadedModel so it dies with it.
    The forward hook stashes activations on the instance, so `explain` holds a
    lock for the whole forward+backward — two concurrent requests against the
    same model would otherwise interleave and hand each other the wrong tensors.

    The forward runs with *no autograd graph at all* up to the target layer.
    Every parameter is frozen at load time (see registry.load) and the input
    does not require grad, so nothing upstream records anything. The hook then
    detaches the activation, marks it as a leaf that requires grad, and returns
    it — which replaces the module's output — so only the short tail from the
    target layer to the logits is ever taped.

    That is the entire gradient we need (Grad-CAM is d(logit)/d(activations)),
    and it is why this costs ~30 MB of transient buffers instead of the ~210 MB
    a plain `logits.backward()` spends retaining the full ResNet forward.
    """

    def __init__(self, loaded: LoadedModel):
        self.module = loaded.module
        self._activations: Optional[torch.Tensor] = None
        self._lock = threading.Lock()
        self._handle = loaded.target_layer.register_forward_hook(self._save_activation)

    def _save_activation(self, module, inputs, output):
        # Cut the tape here: detach, then re-enter the graph as a leaf. Returning
        # it replaces the layer's output, so everything downstream is recorded
        # against *this* tensor and everything upstream is recorded against
        # nothing at all.
        acts = output.detach().requires_grad_(True)
        self._activations = acts
        return acts

    def explain(self, x: torch.Tensor) -> Tuple[np.ndarray, np.ndarray, int]:
        """Returns (cam [h,w] in 0..1, class probabilities, predicted index).

        A single forward pass serves both the prediction and the CAM — the
        activations captured by the hook are reused, so there is no second
        forward like a naive implementation would do.
        """
        with self._lock:
            self._activations = None
            try:
                # enable_grad (not no_grad) so the *tail* after the hook is taped;
                # the head tapes nothing because no tensor going into it requires
                # grad. x is left as-is — making it require grad would tape the
                # whole network again.
                with torch.enable_grad():
                    logits = self.module(x)
                    probs = torch.softmax(logits.detach().float(), dim=1)[0]
                    pred_idx = int(torch.argmax(probs).item())

                    acts = self._activations
                    if acts is None:
                        raise RuntimeError(
                            "Grad-CAM forward hook never fired — target_layer for "
                            f"'{type(self.module).__name__}' is not on the forward path."
                        )
                    grads = torch.autograd.grad(logits[0, pred_idx], acts)[0]

                acts = acts.detach()[0]                  # (C, h, w)
                grads = grads[0]                         # (C, h, w)
                weights = grads.mean(dim=(1, 2))         # global-average-pooled gradients

                cam = F.relu((weights[:, None, None] * acts).sum(dim=0))
                cam = cam / (cam.max() + 1e-8)

                return cam.cpu().numpy(), probs.cpu().numpy(), pred_idx
            finally:
                # Drop the reference to the graph even if we raised.
                self._activations = None


_cam_lock = threading.Lock()


def grad_cam_for(loaded: LoadedModel) -> GradCAM:
    """Lazily attach a GradCAM to this LoadedModel and reuse it.

    Keyed on the LoadedModel, not on the spec id: a model that was evicted and
    reloaded is a *different* module, and a cam still hooked to the old one
    would silently read stale activations.
    """
    if loaded.cam is not None:
        return loaded.cam
    with _cam_lock:
        if loaded.cam is None:
            loaded.cam = GradCAM(loaded)
        return loaded.cam


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def _resize_map(a: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Bilinear resize of a single-channel float map. size is (w, h)."""
    return np.asarray(
        Image.fromarray(a.astype(np.float32), mode="F").resize(size, Image.BILINEAR),
        dtype=np.float32,
    )


def _gaussian_blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Separable Gaussian on a 2-D float array, edge-padded."""
    radius = max(1, int(round(sigma * 2)))
    taps = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(taps ** 2) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()

    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (radius, radius)
        padded = np.pad(a, pad, mode="edge")
        out = np.zeros_like(a)
        for i, w in enumerate(kernel):
            sl = [slice(None), slice(None)]
            sl[axis] = slice(i, i + a.shape[axis])
            out += w * padded[tuple(sl)]
        a = out
    return a


def _jet(x: np.ndarray) -> np.ndarray:
    """The classic JET ramp (blue -> cyan -> yellow -> red), x in 0..1 -> uint8 RGB."""
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255.0).astype(np.float32)


def render_overlay(original: Image.Image, cam: np.ndarray, alpha: float = 0.45) -> str:
    """Upsample the CAM onto the original image and return a base64 PNG."""
    base_img = original.convert("RGB")
    if max(base_img.size) > MAX_OVERLAY_DIM:
        base_img = base_img.copy()
        base_img.thumbnail((MAX_OVERLAY_DIM, MAX_OVERLAY_DIM), Image.LANCZOS)
    w, h = base_img.size

    # Coarse CAM -> fixed intermediate -> blur -> target size.
    smooth = _resize_map(cam, (_SMOOTH_DIM, _SMOOTH_DIM))
    smooth = _gaussian_blur(smooth, sigma=_SMOOTH_DIM / 112.0)
    cam_resized = _resize_map(smooth, (w, h))

    span = float(cam_resized.max() - cam_resized.min())
    cam_resized = (cam_resized - cam_resized.min()) / (span + 1e-8)

    heatmap = _jet(cam_resized)
    base = np.asarray(base_img, dtype=np.float32)
    overlay = ((1 - alpha) * base + alpha * heatmap).astype(np.uint8)

    buf = io.BytesIO()
    Image.fromarray(overlay).save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ---------------------------------------------------------------------------
# Result shaping
# ---------------------------------------------------------------------------

def build_breakdown(probs: np.ndarray, classes: Sequence[str]) -> List[dict]:
    """Every class with its probability, most likely first."""
    pairs = [
        {"label": label, "probability": float(p)}
        for label, p in zip(classes, probs.tolist())
    ]
    return sorted(pairs, key=lambda d: d["probability"], reverse=True)


def diagnosis_for(spec: ModelSpec, pred_idx: int, confidence: float) -> dict:
    """Plain-language verdict — this is what a non-ML user actually reads."""
    label = spec.classes[pred_idx]

    if spec.positive_class is None:
        return {"headline": label.upper(), "tone": "neutral", "finding": None}

    positive = pred_idx == spec.positive_class
    if confidence >= 0.90:
        certainty = "high confidence"
    elif confidence >= 0.70:
        certainty = "moderate confidence"
    else:
        certainty = "low confidence — treat as inconclusive"

    return {
        "headline": label.upper(),
        "tone": "alert" if positive else "clear",
        "finding": positive,
        "certainty": certainty,
    }
