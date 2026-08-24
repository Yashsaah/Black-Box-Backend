# Black Box backend

Serves every registered disease model and computes Grad-CAM overlays for the
`/upload` page in the frontend.

## Setup

```bash
cd project/backend
python -m venv venv
venv\Scripts\activate           # macOS/Linux: source venv/bin/activate

# CPU-only torch — the default PyPI wheel is the CUDA build and pulls
# several GB of nvidia-* packages this never uses.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

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
| `GET` | `/` | Service card — what a Space or uptime check hits |
| `GET` | `/health` | Liveness, device, how many models have weights, which are resident |
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

## Memory

Measured in the container from the repo-root `Dockerfile` (CPU-only torch,
Linux, python 3.11) under a hard 512 MiB cgroup limit and 0.5 CPU: ~250 MiB
idle, ~340–395 MiB serving, **459 MiB peak** over a 12-request soak that
included a 3000x3000 upload — and **460 MiB** with eight of those concurrent.
No OOM kill.

Five things keep it there instead of climbing:

- **Lazy load, LRU evict.** Nothing touches disk until the first request for a
  given id, and at most `MAX_LOADED_MODELS` (default `1`) stay resident. Serving
  pneumonia then glaucoma evicts the first rather than holding ~160 MB of both.
  Set `MAX_LOADED_MODELS=2` on a host with room to trade the reload latency back.
- **mmap + `assign=True`.** A plain `torch.load` materialises the state_dict on
  the heap and `load_state_dict` then copies it into the module — a ~190 MB peak
  for a 94 MB checkpoint. Mapping the file and assigning in place keeps the peak
  at ~1x, and the pages stay file-backed so the kernel can reclaim them under
  pressure instead of the process being killed.
- **Frozen parameters.** Grad-CAM is d(logit)/d(activations); it never needs
  d(logit)/d(weights). With `requires_grad` left on, autograd allocates a full
  gradient buffer for the whole network on every request.
- **The tape is cut at the target layer.** The forward hook detaches the
  activation, re-enters it as a leaf that requires grad, and returns it — which
  replaces the layer's output. Everything upstream of `layer4[-1]` records
  nothing at all; only the avgpool -> fc tail is taped. That took the per-request
  cost from ~210 MB to ~150 MB and stopped RSS drifting upward across requests.
- **`INFERENCE_CONCURRENCY`** (default `1`). Uploads are probed from their header
  for dimensions but not decoded until a slot is held — a 3000x3000 PNG is 27 MB
  decoded, and eight arriving at once used to push the container to its ceiling.
  With the gate, eight concurrent requests cost what one does.

`TORCH_NUM_THREADS` (default `1`) caps the thread pool. One thread is faster on
a fractional-CPU box, where the default pool just thrashes; raise it on a host
with real cores.

Latency, not RAM, is what rules out Render's free tier: 2.2–2.9 s per request at
0.5 CPU, so roughly 10–15 s at the 0.1 CPU free tier, plus a 40–90 s cold start.

## Notes

- No OpenCV. Resize, Gaussian blur and the JET colour map are a dozen lines of
  numpy in `inference.py`; `opencv-python-headless` cost ~65 MB of RSS and a
  `libGL` system package in the container for those three calls.
- Grad-CAM overlays are capped at `MAX_OVERLAY_DIM` (1024 px). Blending a
  4000x4000 upload at full resolution costs ~200 MB of transient float buffers
  and produces a base64 payload nobody wants over the wire.
- Inference runs in a threadpool so a slow forward pass doesn't block the event
  loop. Grad-CAM holds a per-model lock — its hooks stash tensors on the
  instance, and two concurrent requests would otherwise swap them.
- If the frontend runs somewhere other than the origins in `FRONTEND_ORIGINS`
  (in `main.py`), add it there or CORS will silently block every browser
  request. `*.vercel.app` and `*.hf.space` are already allowed via regex.
