# Black Box backend

Serves every registered disease model and computes Grad-CAM overlays for the
`/upload` page in the frontend.

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate           # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

> The `venv/` folder currently checked in came from a macOS zip (it has `bin/`,
> not `Scripts/`) and won't run on Windows. Delete it and recreate it with the
> command above.

## Running

```bash
uvicorn main:app --reload --port 8000
```

The server starts with **zero weights present**. `GET /health` reports what it
found; models with no checkpoint on disk are advertised as
`"available": false` and `/predict` refuses them with a 503 naming the exact
file it wants.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness, device, how many models have weights |
| `GET` | `/models` | Catalogue grouped by detection type — drives the frontend picker |
| `GET` | `/models/{id}` | One model's card |
| `POST` | `/predict` | multipart `file=<image>`, `model=<model id>` |

`/predict` returns the prediction, a plain-language diagnosis, per-class
probabilities, the Grad-CAM overlay as base64 PNG, and inference latency.

## Registered models

One model per detection type.

| id | Detection type | Architecture | Input | Weights file |
| --- | --- | --- | --- | --- |
| `pneumonia-resnet50` | Pneumonia | ResNet-50 | 224px, ImageNet norm | `weights/pneumonia_resnet50.pth` |
| `glaucoma-cnn` | Glaucoma | custom 2-conv CNN | 128px, 0.5/0.5 norm | `weights/glaucoma_cnn.pth` |
| `organ-resnet18` | Organ localisation | ResNet-18 | 224px, 0.5/0.5 norm | `model.pth` (backend root) |

See [`weights/README.md`](weights/README.md) for how to export these
checkpoints out of the notebooks.

Note the glaucoma model's class order is `('glaucoma', 'normal')` — index **0**
is the positive finding, the reverse of the pneumonia model. That is what
`ImageFolder` produces (alphabetical), and `positive_class=0` on its spec keeps
the diagnosis banner the right way round.

## Adding another detection type

Append one `ModelSpec` to `REGISTRY` in [`registry.py`](registry.py) and drop
its weights in `weights/`. The catalogue, the picker and `/predict` all read
from that list — no other file needs touching.

The spec's `builder`, `classes`, `input_size`, `mean` and `std` must match the
training notebook exactly. Weights load with `strict=True`, so a mismatched
head raises at load time instead of quietly producing garbage predictions.

`target_layer` selects what Grad-CAM hooks. It defaults to a ResNet's
`layer4[-1]`; a custom architecture needs its own, e.g. `lambda m: m.conv2`.

Two settings fail *silently* rather than loudly, so check them against the
notebook by hand:

- **`classes` order** — wrong order inverts every prediction. A model scoring
  ~15% instead of ~85% is this, not a bad model.
- **`mean`/`std`** — wrong normalisation degrades accuracy toward chance
  without raising anything.

## Notes

- Models load **lazily** on first request and are then cached for the process
  lifetime. A ResNet-50 is ~100 MB in RAM, so eagerly loading all of them at
  startup would waste memory on a box that may only serve one.
- Inference runs in a threadpool so a slow forward pass doesn't block the event
  loop. Grad-CAM holds a per-model lock — its hooks stash tensors on the
  instance, and two concurrent requests would otherwise swap them.
- If the frontend runs somewhere other than the origins in `FRONTEND_ORIGINS`
  (in `main.py`), add it there or CORS will silently block every browser
  request. `*.vercel.app` is already allowed via regex.
