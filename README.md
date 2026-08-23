---
title: Black Box Inference API
emoji: 🫁
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Black Box — inference backend

FastAPI service that runs the disease-detection models and returns a Grad-CAM
overlay alongside each prediction. The Vercel frontend in `project/blackbox`
talks to it over plain REST.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Service card |
| `GET` | `/health` | Liveness, device, which models have weights, which are resident |
| `GET` | `/models` | Catalogue grouped by detection type — drives the frontend picker |
| `GET` | `/models/{id}` | One model's card |
| `POST` | `/predict` | multipart `file=<image>`, `model=<model id>` |

Full API notes live in [`project/backend/README.md`](project/backend/README.md).

## Run it locally

```bash
cd project/backend
python -m venv venv && source venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Then point the frontend at it with `VITE_API_URL=http://localhost:8000`.

## Memory

Measured in the container from this `Dockerfile` (CPU-only torch, Linux,
python 3.11), under a hard 512 MiB cgroup limit and 0.5 CPU:

| | RSS |
| --- | --- |
| Idle, nothing loaded | ~250 MiB |
| Serving, weights resident | ~340–395 MiB |
| Peak over a 12-request soak incl. a 3000x3000 upload | **459 MiB** |
| Peak with 8 of those concurrent | **460 MiB** |

No OOM kill at 512 MiB. It used to be well over that; five things got it here:

* **`MAX_LOADED_MODELS`** (default `1`) — models load lazily and the least
  recently used is evicted rather than accumulating. Serving pneumonia then
  glaucoma frees the first instead of holding ~160 MB of both. Switching
  detection type costs a reload.
* **mmap + `assign=True`** — the checkpoint is mapped, not materialised then
  copied, so the peak is ~1x the file rather than ~2x. The pages stay
  file-backed, so under pressure the kernel reclaims them instead of killing
  the process.
* **Frozen parameters and a cut autograd tape** — the Grad-CAM forward hook
  detaches the activation and re-enters it as a leaf, so only the few ops
  between the target layer and the logits are recorded. A plain
  `logits.backward()` spent ~210 MB per request retaining the full ResNet
  forward; this spends ~150 MB, and RSS stops drifting upward across requests.
* **No OpenCV** — resize, blur and the JET colour map are numpy now.
  `opencv-python-headless` cost ~65 MB of RSS and a `libGL` system package for
  those three calls.
* **`INFERENCE_CONCURRENCY`** (default `1`) — uploads are decoded only once a
  slot is held. Without it, eight concurrent 3000x3000 PNGs decoded in parallel
  and pushed the container to its ceiling; with it, eight concurrent requests
  cost the same as one.

`TORCH_NUM_THREADS` (default `1`) caps the thread pool; raise it on a host with
real cores.

### So does Render's free tier work?

RAM: yes, now — 460 MiB peak against a 512 MB limit is tight but it survived a
hard cap. **Latency is the problem instead.** At 0.5 CPU a request takes 2.2–2.9
s (6.9 s for a 3000x3000 upload). Render free gives 0.1 CPU, so expect 10–15 s
per request, plus a 40–90 s cold start after the 15-minute idle spin-down — long
enough to trip health checks and time out a browser upload.

## Deploying to a Hugging Face Space

The `Dockerfile` and the YAML front-matter above are all a Docker Space needs —
it builds CPU-only torch and serves on port 7860.

Two things to get right first:

**1. Docker Spaces need a paid plan.** Static Spaces are free for everyone;
Gradio and Docker Spaces run on compute and require PRO on a personal account
(Team/Enterprise for orgs). Free personal accounts can host Gradio Spaces on
ZeroGPU only — which would mean restructuring this repo around a Gradio entry
point at its root. Worth re-checking the current pricing page before paying.

**2. The checkpoints must be in Git LFS.** They are 67 MB and 94 MB, and HF
rejects any non-LFS file over 10 MB. `.gitattributes` handles new commits, but
the ones already in this history are plain blobs, so a push of the existing
history is refused. Convert before pushing:

```bash
git lfs install
git lfs migrate import --include="*.pth" --everything
```

That rewrites history, so it needs a force-push to GitHub too. If you would
rather not, create the Space with a fresh history instead:

```bash
git clone https://huggingface.co/spaces/<user>/<space> /tmp/space
```

then copy `Dockerfile`, `README.md`, `.gitattributes` and `project/backend/`
into it and commit there.

Once it is up, `VITE_API_URL` on Vercel becomes
`https://<user>-<space>.hf.space`. CORS already allows `*.hf.space` and
`*.vercel.app`.
