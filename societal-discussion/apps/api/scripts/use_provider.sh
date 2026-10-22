#!/usr/bin/env bash
# Switch the model provider that answers participants, without a restart.
#
#   ADMIN_PASSWORD=... scripts/use_provider.sh anthropic [model]
#   ADMIN_PASSWORD=... scripts/use_provider.sh openai    [model]
#   ADMIN_PASSWORD=... scripts/use_provider.sh gptlab    [model]
#
# It makes the provider active in the admin settings (the same as Settings,
# LLM provider in the admin panel), optionally selects the model, and then
# reads GET /api/provider, which is what the participant pages read to show
# that provider's data protection texts. The keys come from the API's
# environment (OPENAI_API_KEY, ANTHROPIC_API_KEY, GPTLAB_API_KEY).
# API_URL defaults to the Rahti deployment.
set -euo pipefail

provider="${1:?usage: use_provider.sh openai|anthropic|gptlab [model]}"
model="${2:-}"
api="${API_URL:-https://api-vaalikeskustelu.2.rahtiapp.fi}"
: "${ADMIN_PASSWORD:?set ADMIN_PASSWORD}"

if [ -n "$model" ]; then
  curl -fsS -X PUT "$api/api/admin/llm/configs/$provider" \
    -H "X-Admin-Password: $ADMIN_PASSWORD" -H "Content-Type: application/json" \
    -d "{\"selected_model\": \"$model\"}" > /dev/null
fi
curl -fsS -X POST "$api/api/admin/llm/active" \
  -H "X-Admin-Password: $ADMIN_PASSWORD" -H "Content-Type: application/json" \
  -d "{\"provider\": \"$provider\"}" > /dev/null
echo "Now answering: $(curl -fsS "$api/api/provider")"
