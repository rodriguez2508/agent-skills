#!/usr/bin/env bash
#
# Smoke Test — Ecosystem MCP Tools
#
# Prueba todas las herramientas de ecosistema (Phase 3)
# Requiere: servidor corriendo en http://localhost:8004
#
# Uso:
#   chmod +x scripts/smoke-test-ecosystem.sh
#   ./scripts/smoke-test-ecosystem.sh
#   ./scripts/smoke-test-ecosystem.sh --verbose   # muestra respuestas completas
#

set -euo pipefail

API="${MCP_API_URL:-http://localhost:8004}"
VERBOSE=false
PASS=0
FAIL=0
TOTAL=0

# ─── Colores ─────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── Helpers ──────────────────────────────────────────────────────
banner() {
  echo -e "\n${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
}

check() {
  local tool="$1"
  local label="$2"
  local args="$3"
  local expect_success="${4:-true}"

  TOTAL=$((TOTAL + 1))

  local response
  response=$(curl -s -X POST "$API/mcp/execute-tool" \
    -H "Content-Type: application/json" \
    -d "{\"tool\":\"$tool\",\"args\":$args}" 2>&1)

  local success
  success=$(echo "$response" | grep -o '"success":true' || true)

  if [ "$expect_success" = "true" ] && [ -n "$success" ]; then
    echo -e "  ${GREEN}✅${NC} $label"
    PASS=$((PASS + 1))
    if [ "$VERBOSE" = true ]; then
      echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
  elif [ "$expect_success" = "false" ] && [ -z "$success" ]; then
    echo -e "  ${GREEN}✅${NC} $label (error esperado)"
    PASS=$((PASS + 1))
    if [ "$VERBOSE" = true ]; then
      echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
  else
    echo -e "  ${RED}❌${NC} $label"
    FAIL=$((FAIL + 1))
    echo "     Response: $(echo "$response" | head -c 300)"
    if [ "$VERBOSE" = true ]; then
      echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
  fi
}

# ─── Parse args ──────────────────────────────────────────────────
for arg in "$@"; do
  [ "$arg" = "--verbose" ] && VERBOSE=true
done

# ─── Health check ────────────────────────────────────────────────
banner "🔍 Verificando que el servidor esté vivo"
if ! curl -sf "$API/mcp/message" > /dev/null 2>&1; then
  echo -e "${RED}❌ El servidor no responde en $API${NC}"
  echo "   Asegúrate de ejecutar 'pnpm start:dev' primero"
  exit 1
fi
echo -e "  ${GREEN}✅${NC} Servidor listo en $API"

# ═══════════════════════════════════════════════════════════════════
#  ECOSYSTEM TOOLS — Smoke Tests
# ═══════════════════════════════════════════════════════════════════

banner "🤖 ecosystem_agents_list — Listar agentes soportados"
check "ecosystem_agents_list" "Listar agentes" "{}"

banner "🔎 ecosystem_agent_detect — Detectar agente específico"
check "ecosystem_agent_detect" "Detectar qwen-cli" '{"agentId":"qwen-cli"}'

banner "🔎 ecosystem_agent_detect — Error: agente inexistente"
check "ecosystem_agent_detect" "Detectar agente falso" '{"agentId":"inexistente"}'

banner "🔍 ecosystem_install — Dry run"
check "ecosystem_install" "Instalación dry-run qwen-cli" \
  '{"agents":["qwen-cli"],"dryRun":true}'

banner "🔍 ecosystem_install — Error: sin agentes"
check "ecosystem_install" "Sin agentes (error esperado)" \
  '{"agents":[]}'

banner "🔄 ecosystem_sync — Dry run (agente puede no existir)"
check "ecosystem_sync" "Sync qwen-cli" \
  '{"agents":["qwen-cli"]}'

banner "💾 ecosystem_backup_create — Crear backup"
check "ecosystem_backup_create" "Crear backup de qwen-cli" \
  '{"agents":["qwen-cli"]}'

banner "💾 ecosystem_backup_list — Listar backups"
check "ecosystem_backup_list" "Listar backups" "{}"

banner "♻️ ecosystem_backup_restore — Restaurar con ID falso (error)"
check "ecosystem_backup_restore" "Restaurar backup falso" \
  '{"backupId":"fake-id-12345"}' "false"

banner "📋 ecosystem_presets_list — Listar presets"
check "ecosystem_presets_list" "Listar presets" "{}"

# ═══════════════════════════════════════════════════════════════════
#  RESULTADOS
# ═══════════════════════════════════════════════════════════════════

banner "📊 RESULTADOS"
echo -e "  ${GREEN}✅ Pasaron: $PASS${NC}"
echo -e "  ${RED}❌ Fallaron: $FAIL${NC}"
echo -e "  📝 Total: $TOTAL"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}🎉 ¡Todos los tests pasaron!${NC}"
  exit 0
else
  echo -e "\n${RED}⚠️  $FAIL test(s) fallaron${NC}"
  exit 1
fi
