# Hugging Face Space (Docker SDK) / Cloud Run / any container host.
#
# The backend lives in project/backend; this file is at the repo root because
# that is where Spaces looks for it.

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/home/user \
    TORCH_NUM_THREADS=1 \
    MAX_LOADED_MODELS=1

# Spaces run the container as uid 1000 with a read-only filesystem outside
# /tmp and /data, so build as that user rather than root.
RUN useradd -m -u 1000 user
USER user
ENV PATH=/home/user/.local/bin:$PATH
WORKDIR /app

COPY --chown=user project/backend/requirements.txt ./requirements.txt

# CPU-only torch. `pip install torch` on Linux resolves to the CUDA build and
# drags in several GB of nvidia-* wheels that never get used here.
RUN pip install --user torch torchvision \
        --index-url https://download.pytorch.org/whl/cpu \
 && pip install --user -r requirements.txt

COPY --chown=user project/backend/ ./

# Spaces expects 7860; override with --port anywhere else.
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
