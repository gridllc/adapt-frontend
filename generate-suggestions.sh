#!/usr/bin/env bash
set -euo pipefail

# this uses the same env-vars you’ve set in Render:
curl -X POST "$SUPABASE_FUNCTION_URL/functions/v1/generate-suggestions" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"