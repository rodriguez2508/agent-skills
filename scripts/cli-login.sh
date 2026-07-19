#!/usr/bin/env bash
set -euo pipefail

API_URL="${AGENCY_API_URL:-http://localhost:8004}"

echo "🔐 Agency Skills CLI — Session Login"
echo "   API: $API_URL"
echo ""

# Get client IP from the API's perspective (what @Ip() would see)
MY_IP=$(curl -s "$API_URL/auth/session/login" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"cli-user"}' \
  2>/dev/null)

if [ -z "$MY_IP" ]; then
  echo "❌ No se pudo conectar a $API_URL"
  exit 1
fi

echo "📋 Response:"
echo "$MY_IP" | python3 -m json.tool 2>/dev/null || echo "$MY_IP"
echo ""

SESSION_ID=$(echo "$MY_IP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessionId',''))" 2>/dev/null || true)
USER_ID=$(echo "$MY_IP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('userId',''))" 2>/dev/null || true)

if [ -n "$SESSION_ID" ]; then
  echo "✅ Session ID: $SESSION_ID"
  echo "✅ User ID:    $USER_ID"
  echo ""
  echo "💡 Usa este sessionId en headers para llamadas API:"
  echo "   curl -H 'X-Session-Id: $SESSION_ID' $API_URL/..."
fi
