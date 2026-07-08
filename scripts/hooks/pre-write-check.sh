#!/usr/bin/env bash
# Claude Code PreToolUse hook — blocks Write/Edit if no active mcp_plan for the session.
# Reads sessionId from /tmp/.mcp-session (written by session_init_auto).
# Exits 0 = allow, exits 2 = block with message.

TOOL_NAME="$1"
MCP_API="http://localhost:8004"
SESSION_FILE="/tmp/.mcp-session"

# Only check Write and Edit tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# If server is not running, allow (don't block work when MCP is offline)
if ! curl -s --max-time 1 "$MCP_API/health" > /dev/null 2>&1; then
  exit 0
fi

# Read sessionId
if [[ ! -f "$SESSION_FILE" ]]; then
  echo "⚠️  MCP: No hay sesión activa. Llama session_init_auto primero, luego agent_query para registrar el plan." >&2
  exit 2
fi

SESSION_ID=$(cat "$SESSION_FILE")

# Check active plan
RESPONSE=$(curl -s --max-time 2 "$MCP_API/mcp/plans/active?sessionId=$SESSION_ID" 2>/dev/null)
HAS_PLAN=$(echo "$RESPONSE" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.exit(d.hasPlan?0:1)}catch{process.exit(1)}" 2>/dev/null; echo $?)

if [[ "$HAS_PLAN" != "0" ]]; then
  echo "🚫 MCP: No hay mcp_plan activo para esta sesión." >&2
  echo "   Llama: agent_query({ message: '<tu tarea>', projectPath: '<cwd>', sessionId: '$SESSION_ID' })" >&2
  echo "   El MCP registrará el plan y habilitará la implementación." >&2
  exit 2
fi

exit 0
