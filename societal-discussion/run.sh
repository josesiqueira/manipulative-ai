#!/bin/bash
set -e

cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Societal Discussion Platform ===${NC}"

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${GREEN}Creating .env from template...${NC}"
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env and add your ANTHROPIC_API_KEY"
    echo "   Then run this script again."
    echo ""
    exit 1
fi

# Check if ANTHROPIC_API_KEY is set
if grep -q "ANTHROPIC_API_KEY=sk-ant-xxxxx" .env; then
    echo ""
    echo "⚠️  Please edit .env and add your real ANTHROPIC_API_KEY"
    echo ""
    exit 1
fi

# Install backend dependencies with uv
echo -e "${GREEN}Installing backend dependencies...${NC}"
cd apps/api
uv sync --dev
cd ../..

# Install frontend dependencies
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd apps/web
npm install
cd ../..

# Run database migrations
echo -e "${GREEN}Running database migrations...${NC}"
cd apps/api
uv run alembic upgrade head
cd ../..

# Import dataset if database is empty
echo -e "${GREEN}Importing dataset...${NC}"
uv run python scripts/import_dataset.py --file data/raw/persuasion_dataset_Unified_EN-3_CLEANED.xlsx 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Starting servers..."
echo "  API:   http://localhost:8000"
echo "  Web:   http://localhost:3000"
echo "  Admin: http://localhost:3000/en/admin"
echo ""

# Start both servers
trap 'kill $(jobs -p) 2>/dev/null' EXIT

cd apps/api && uv run uvicorn src.main:app --reload --port 8000 &
cd apps/web && npm run dev &

wait
