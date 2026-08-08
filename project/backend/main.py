"""
Black Box inference API — serves multiple disease models with Grad-CAM.

Endpoints
    GET  /health              liveness + which models have weights on disk
    GET  /models              catalogue that drives the frontend picker
    GET  /models/{id}         one model's card
    POST /predict             multipart: file=<image>, model=<model id>

Models are registered in registry.py and loaded on first use. The server starts
fine with zero weights present — /models reports `available: false` for the
missing ones and /predict returns a 503 naming the exact file it wants.

Run with:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import io
import time
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

import registry
from inference import (
    build_breakdown,
    diagnosis_for,
    grad_cam_for,
    preprocess,
    render_overlay,
)
from registry import BY_ID, DEFAULT_MODEL_ID, DEVICE, REGISTRY, ModelSpec

MAX_UPLOAD_BYTES = 12 * 1024 * 1024  # 12 MB — generous for a chest X-ray

FRONTEND_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:4173",   # vite preview
]

# Vite hops to 5174, 5175, … when its default port is taken, so pin the host
# rather than the port for local dev. Deployed frontends are matched separately.
DEV_ORIGIN_REGEX = r"http://(localhost|127\.0\.0\.1):\d+"
DEPLOYED_ORIGIN_REGEX = r"https://.*\.vercel\.app"

app = FastAPI(title="Black Box inference API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=f"{DEV_ORIGIN_REGEX}|{DEPLOYED_ORIGIN_REGEX}",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Serialisation
# ---------------------------------------------------------------------------

def serialize(spec: ModelSpec) -> dict:
    return {
        "id": spec.id,
        "name": spec.name,
        "disease": spec.disease,
        "task": spec.task,
        "architecture": spec.architecture,
        "dataset": spec.dataset,
        "classes": list(spec.classes),
        "input_size": spec.input_size,
        "summary": spec.summary,
        "available": registry.is_available(spec),
        "loaded": spec.id in registry.loaded_ids(),
        "weights_file": spec.weights_file,
    }


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(DEVICE),
        "models_registered": len(REGISTRY),
        "models_with_weights": sum(1 for s in REGISTRY if registry.is_available(s)),
        "models_loaded": registry.loaded_ids(),
    }


@app.get("/models")
def list_models():
    """Catalogue grouped by detection type — one model per type."""
    diseases: List[str] = []
    for spec in REGISTRY:
        if spec.disease not in diseases:
            diseases.append(spec.disease)

    return {
        "default": DEFAULT_MODEL_ID,
        "diseases": [
            {
                "name": disease,
                "models": [serialize(s) for s in REGISTRY if s.disease == disease],
            }
            for disease in diseases
        ],
        "models": [serialize(s) for s in REGISTRY],
    }


@app.get("/models/{model_id}")
def get_model(model_id: str):
    spec = BY_ID.get(model_id)
    if spec is None:
        raise HTTPException(404, f"Unknown model '{model_id}'.")
    return serialize(spec)


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    model: Optional[str] = Form(default=None),
):
    spec = BY_ID.get(model or DEFAULT_MODEL_ID)
    if spec is None:
        raise HTTPException(
            404, f"Unknown model '{model}'. Call GET /models for the valid ids."
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(400, "Empty upload.")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File too large (max {MAX_UPLOAD_BYTES // 1024 // 1024} MB).")

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "Could not read that file as an image.")

    if spec.resolve_weights() is None:
        raise HTTPException(
            503,
            f"'{spec.id}' has no weights yet — drop {spec.weights_file} into "
            f"{registry.WEIGHTS_DIR}. It is picked up on the next request; no "
            f"restart needed.",
        )

    started = time.perf_counter()
    try:
        # Torch is blocking and releases the GIL in its kernels; the threadpool
        # keeps the event loop free to accept other requests meanwhile.
        payload = await run_in_threadpool(_run_inference, spec, img)
    except FileNotFoundError as exc:
        raise HTTPException(503, str(exc))
    except RuntimeError as exc:
        # Almost always a state_dict/architecture mismatch — surface it, don't mask it.
        raise HTTPException(500, f"Model '{spec.id}' failed to run: {exc}")

    payload["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
    return payload


def _run_inference(spec: ModelSpec, img: Image.Image) -> dict:
    loaded = registry.load(spec)
    cam_engine = grad_cam_for(loaded)

    tensor = preprocess(img, spec)
    cam, probs, pred_idx = cam_engine.explain(tensor)

    confidence = float(probs[pred_idx])
    heatmap = render_overlay(img, cam)

    return {
        "model": {
            "id": spec.id,
            "name": spec.name,
            "disease": spec.disease,
            "architecture": spec.architecture,
        },
        "predicted_class": pred_idx,
        "predicted_label": spec.classes[pred_idx],
        "confidence": confidence,
        "diagnosis": diagnosis_for(spec, pred_idx, confidence),
        "breakdown": build_breakdown(probs, spec.classes),
        "heatmap_base64": heatmap,
        "device": str(DEVICE),
    }
