# FastAPI Backend Dockerfile for Rahti (OpenShift)
# Runs as non-root user on port 8080

FROM python:3.11-slim

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/tmp/.cache/uv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./

# Create virtual environment and install dependencies during build
RUN uv venv /app/.venv && \
    uv sync --frozen --no-dev --no-install-project

# Local speech models (spec V8, V9 emergency tier): faster-whisper small and
# the two Piper voices, fetched at build time so the container never
# downloads at run time. World-readable: OpenShift runs an arbitrary UID.
ENV SPEECH_MODELS_DIR=/app/models \
    HF_HUB_OFFLINE=1
RUN mkdir -p /app/models && \
    HF_HUB_OFFLINE=0 python -c "from faster_whisper.utils import download_model; download_model('small', output_dir='/app/models/whisper-small')" && \
    for v in fi/fi_FI/harri/medium/fi_FI-harri-medium en/en_GB/alan/medium/en_GB-alan-medium; do \
      n=$(basename $v); \
      python -c "import urllib.request,sys; [urllib.request.urlretrieve(f'https://huggingface.co/rhasspy/piper-voices/resolve/main/$v{e}', f'/app/models/$n{e}') for e in ('.onnx', '.onnx.json')]"; \
    done && chmod -R a+rX /app/models

# Copy application code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY start.sh ./

# Create non-root user (OpenShift requirement)
# OpenShift runs containers with arbitrary UIDs, so we need proper permissions
RUN useradd --create-home --uid 1001 appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /tmp/.cache/uv && chmod 777 /tmp/.cache/uv

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R appuser:appuser /app/logs

# Switch to non-root user
USER 1001

# Expose port 8080 (Rahti requirement)
EXPOSE 8080

# Migrations first, then the server (no uv run: dependencies already installed)
CMD ["sh", "./start.sh"]
