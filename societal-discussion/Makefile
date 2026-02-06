.PHONY: install dev test lint build clean docker-up docker-down import-data validate-coverage

# Development setup
install:
	cd apps/api && pip install -e ".[dev]"
	cd apps/web && npm install

# Run development servers
dev:
	@echo "Starting development servers..."
	@echo "API: http://localhost:8000"
	@echo "Web: http://localhost:3000"
	@echo "Admin: http://localhost:3000/en/admin"
	@make -j2 dev-api dev-web

dev-api:
	cd apps/api && uvicorn src.main:app --reload --port 8000

dev-web:
	cd apps/web && npm run dev

# Testing
test:
	cd apps/api && pytest tests/ -v
	cd apps/web && npm run test --if-present

test-api:
	cd apps/api && pytest tests/ -v

test-web:
	cd apps/web && npm run test --if-present

# Linting
lint:
	cd apps/api && ruff check src/
	cd apps/web && npm run lint

# Build
build:
	cd apps/web && npm run build

build-docker:
	docker-compose -f docker/docker-compose.yml build

# Docker
docker-up:
	docker-compose -f docker/docker-compose.yml up -d

docker-down:
	docker-compose -f docker/docker-compose.yml down

docker-logs:
	docker-compose -f docker/docker-compose.yml logs -f

# Database
migrate:
	cd apps/api && alembic upgrade head

migrate-create:
	cd apps/api && alembic revision --autogenerate -m "$(msg)"

# Data management
import-data:
	python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx

validate-coverage:
	python scripts/validate_coverage.py

# Cleanup
clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -type d -name .next -exec rm -rf {} +
	find . -type d -name node_modules -exec rm -rf {} +
	rm -f apps/api/*.db

# Help
help:
	@echo "Available commands:"
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Start development servers"
	@echo "  make test             - Run all tests"
	@echo "  make lint             - Run linters"
	@echo "  make build            - Build frontend"
	@echo "  make docker-up        - Start Docker containers"
	@echo "  make docker-down      - Stop Docker containers"
	@echo "  make migrate          - Run database migrations"
	@echo "  make import-data      - Import dataset into database"
	@echo "  make validate-coverage - Validate dataset coverage"
