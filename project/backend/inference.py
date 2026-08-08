"""
Preprocessing, Grad-CAM and heatmap rendering.

Kept separate from main.py so the request layer stays thin and this stays
testable without spinning up FastAPI.
"""

from __future__ import annotations

import base64
import io
import threading
from functools import lru_cache
from typing import Dict, List, Sequence, Tuple

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

from registry import DEVICE, LoadedModel, ModelSpec


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
    return tf(img.convert("RGB")).unsqueeze(0).to(DEVICE)


# ---------------------------------------------------------------------------
# Grad-CAM
# ---------------------------------------------------------------------------

class GradCAM:
    """Grad-CAM on a ResNet's last conv block.

    One instance per loaded model. Hooks stash activations/gradients on the
    instance, so `explain` holds a lock for the whole forward+backward — two
    concurrent requests against the same model would otherwise interleave and
    hand each other the wrong tensors.
    """

    def __init__(self, loaded: LoadedModel):
        self.module = loaded.module
        self._activations: torch.Tensor | None = None
        self._gradients: torch.Tensor | None = None
        self._lock = threading.Lock()
        loaded.target_layer.register_forward_hook(self._save_activation)
        loaded.target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, inputs, output):
        self._activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self._gradients = grad_output[0].detach()

    def explain(self, x: torch.Tensor) -> Tuple[np.ndarray, np.ndarray, int]:
        """Returns (cam [H',W'] in 0..1, class probabilities, predicted index).

        A single forward pass serves both the prediction and the CAM — the
        activations captured by the hook are reused, so there is no second
        forward like a naive implementation would do.
        """
        with self._lock:
            self.module.zero_grad(set_to_none=True)

            with torch.enable_grad():
                logits = self.module(x)
                probs = torch.softmax(logits.detach().float(), dim=1)[0]
                pred_idx = int(torch.argmax(probs).item())
                logits[0, pred_idx].backward()

            acts = self._activations[0]              # (C, h, w)
            grads = self._gradients[0]               # (C, h, w)
            weights = grads.mean(dim=(1, 2))         # global-average-pooled gradients

            cam = F.relu((weights[:, None, None] * acts).sum(dim=0))
            cam = cam / (cam.max() + 1e-8)

            return cam.cpu().numpy(), probs.cpu().numpy(), pred_idx


_cams: Dict[str, GradCAM] = {}
_cam_lock = threading.Lock()


def grad_cam_for(loaded: LoadedModel) -> GradCAM:
    cam = _cams.get(loaded.spec.id)
    if cam is not None:
        return cam
    with _cam_lock:
        cam = _cams.get(loaded.spec.id)
        if cam is None:
            cam = GradCAM(loaded)
            _cams[loaded.spec.id] = cam
        return cam


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def render_overlay(original: Image.Image, cam: np.ndarray, alpha: float = 0.45) -> str:
    """Upsample the CAM onto the original image and return a base64 PNG.

    The raw CAM comes off a coarse 7×7 feature map; a light Gaussian blur after
    upsampling removes the blocky artefacts without moving what's highlighted.
    """
    w, h = original.size
    cam_resized = cv2.resize(cam.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)

    sigma = max(1.0, min(w, h) / 112.0)          # ~2px at 224px, scaled for larger uploads
    ksize = int(sigma * 4) | 1                   # odd kernel, ~4σ wide
    cam_resized = cv2.GaussianBlur(cam_resized, (ksize, ksize), sigma)

    span = cam_resized.max() - cam_resized.min()
    cam_resized = (cam_resized - cam_resized.min()) / (span + 1e-8)

    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    base = np.array(original.convert("RGB"), dtype=np.float32)
    overlay = ((1 - alpha) * base + alpha * heatmap.astype(np.float32)).astype(np.uint8)

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
