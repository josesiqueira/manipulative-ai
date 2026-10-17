#!/bin/sh
# Container start: apply pending migrations, then serve.
# The Rahti volume keeps the SQLite file across deploys, and create_all never
# adds columns to an existing table, so every start runs alembic first.
set -e
cd /app
python -m alembic upgrade head
exec python -m uvicorn src.main:app --host 0.0.0.0 --port 8080
