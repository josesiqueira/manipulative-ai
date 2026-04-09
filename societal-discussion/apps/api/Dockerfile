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

# Copy application code
COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini ./

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

# Run the application directly (no uv run - dependencies already installed)
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
