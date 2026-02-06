.PHONY: run install dev test clean

# One command to rule them all
run:
	@chmod +x run.sh && ./run.sh

# Install dependencies only
install:
	cd apps/api && uv sync --dev
	cd apps/web && npm install

# Run dev servers (assumes already installed)
dev:
	@echo "API:   http://localhost:8000"
	@echo "Web:   http://localhost:3000"
	@echo "Admin: http://localhost:3000/en/admin"
	@trap 'kill $$(jobs -p) 2>/dev/null' EXIT; \
	(cd apps/api && uv run uvicorn src.main:app --reload --port 8000) & \
	(cd apps/web && npm run dev) & \
	wait

# Run tests
test:
	cd apps/api && uv run pytest tests/ -v

# Database
migrate:
	cd apps/api && uv run alembic upgrade head

import-data:
	uv run python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx

# Cleanup
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .venv -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -f apps/api/*.db
