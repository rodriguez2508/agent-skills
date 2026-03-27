# MCP Configuration for Qwen Code - Complete Setup

## ✅ Configuración Completada

### 1. `~/.qwen/settings.json`

```json
{
  "tools": {
    "approvalMode": "auto-edit",
    "exclude": ["web_fetch", "web_search"],
    "allowed": [
      "mcp__agent-skills-api__chat_with_agents",
      "mcp__agent-skills-api__ask_agent",
      "mcp__agent-skills-api__auto_apply_rules",
      "mcp__agent-skills-api__search_rules",
      "mcp__agent-skills-api__get_rule",
      "mcp__agent-skills-api__list_rules"
    ]
  },
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "autoRunSuggestSkills": false,
    "preferMcpOverInternalTools": true,
    "defaultTool": "mcp__agent-skills-api__chat_with_agents"
  },
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high",
      "timeout": 60000
    }
  },
  "systemPrompt": {
    "enabled": true,
    "file": "/home/aajcr/PROYECTOS/agent-skills-api/.qwen/INSTRUCTIONS.md",
    "priority": "critical",
    "overrideDefaults": true
  }
}
```

### 2. `/home/aajcr/PROYECTOS/agent-skills-api/.qwen/INSTRUCTIONS.md`

Instrucciones actualizadas con:
- Herramientas prohibidas (`web_fetch`, `web_search`)
- Herramientas MCP obligatorias
- Flujo de trabajo para issues de GitHub
- Ejemplos de uso correcto

---

## 🔑 Claves de la Configuración

### `tools.exclude`
Deshabilita explícitamente las herramientas internas de Qwen:
- `web_fetch` - No se usará para URLs
- `web_search` - No se usará para búsquedas web

### `tools.allowed`
Permite que estas herramientas MCP bypassen confirmaciones:
- Todas las herramientas del CodeMentor MCP

### `mcp.preferMcpOverInternalTools`
Indica a Qwen que priorice MCP sobre herramientas internas

### `systemPrompt.file`
Apunta a las instrucciones personalizadas que refuerzan el uso de MCP

---

## 🚀 Pasos para Activar

### 1. Reiniciar Qwen Code

**IMPORTANTE:** Qwen Code necesita reiniciarse completamente para cargar la nueva configuración.

```bash
# Cerrar Qwen Code completamente
# Volver a iniciar Qwen Code
```

### 2. Verificar que MCP está activo

En Qwen, pregunta:
```
¿Qué herramientas MCP tienes disponibles?
```

**Respuesta esperada:**
```
Tengo disponibles estas herramientas MCP:
- mcp__agent-skills-api__chat_with_agents
- mcp__agent-skills-api__ask_agent
- mcp__agent-skills-api__auto_apply_rules
- mcp__agent-skills-api__search_rules
- mcp__agent-skills-api__get_rule
- mcp__agent-skills-api__list_rules
```

### 3. Probar con un issue de GitHub

```
Usa MCP para leer el issue: https://github.com/ThreefacesGroup/general/issues/7234
```

**Flujo esperado:**
1. Qwen ejecuta `mcp__agent-skills-api__auto_apply_rules`
2. Encuentra la regla `dev-read-github-issues`
3. Qwen ejecuta `mcp__agent-skills-api__chat_with_agents`
4. El agente especializado usa `gh issue view` CLI
5. Devuelve el contenido completo del issue

---

## 📊 Herramientas Disponibles

| Herramienta MCP | Descripción | Cuándo Usar |
|-----------------|-------------|-------------|
| `chat_with_agents` | Enruta a agente especializado | TODAS las consultas |
| `ask_agent` | Alias de chat_with_agents | Consultas directas |
| `auto_apply_rules` | Busca y aplica reglas | Automáticamente en cada mensaje |
| `search_rules` | Búsqueda BM25 de reglas | Cuando busques reglas específicas |
| `get_rule` | Obtiene regla por ID | Cuando conozcas el ID |
| `list_rules` | Lista reglas disponibles | Para explorar reglas |

---

## 🧪 Testing

### Test 1: Verificar herramientas
```
¿Qué herramientas tienes disponibles?
```

### Test 2: Verificar que NO usa web_fetch
```
Lee esta URL: https://example.com
```
**Esperado:** Qwen usa MCP, NO web_fetch

### Test 3: Issue de GitHub (CRITICAL)
```
Lee el issue: https://github.com/ThreefacesGroup/general/issues/7234
```

**Flujo esperado:**

1. Qwen ejecuta `mcp__agent-skills-api__auto_apply_rules`
2. Encuentra la regla `dev-read-github-issues` (Impacto: CRITICAL)
3. Qwen ejecuta `mcp__agent-skills-api__chat_with_agents`
4. El agente especializado ejecuta **EXCLUSIVAMENTE**:
   ```bash
   gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
   ```
5. Devuelve el contenido completo del issue

**⚠️ Si Qwen intenta usar web_fetch:**
- La herramienta está excluida en `tools.exclude`
- Debe fallar y mostrar error
- Re-iniciar Qwen si persiste el problema

### Test 4: Búsqueda de reglas
```
Busca reglas sobre Clean Architecture
```
**Esperado:** Qwen usa `search_rules` a través de MCP

---

## 🛠️ Troubleshooting

### Qwen sigue usando web_fetch

1. Verifica que `tools.exclude` incluya `web_fetch` y `web_search`
2. Reinicia Qwen completamente (cerrar y abrir)
3. Verifica logs del servidor MCP

### MCP no responde

1. Verifica que el servidor esté corriendo:
   ```bash
   curl http://localhost:8004/mcp/message
   ```
2. Verifica logs del servidor:
   ```bash
   pnpm run start:dev
   ```

### Herramientas MCP no aparecen

1. Verifica la conexión SSE:
   ```bash
   curl -N http://localhost:8004/mcp/sse
   ```
2. Reinicia el servidor MCP

---

## 📚 Referencias

- [Qwen Code MCP Documentation](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/)
- [Qwen Code Settings Documentation](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/)
- [Model Context Protocol Explained](https://codilime.com/blog/model-context-protocol-explained/)

---

## ✅ Checklist Final

- [ ] `~/.qwen/settings.json` actualizado con `tools.exclude` y `tools.allowed`
- [ ] `.qwen/INSTRUCTIONS.md` actualizado con instrucciones MCP
- [ ] Servidor MCP corriendo en `http://localhost:8004/mcp/sse`
- [ ] Qwen Code reiniciado después de los cambios
- [ ] Herramientas MCP verificadas con "¿Qué herramientas tienes disponibles?"
- [ ] Test de issue de GitHub completado exitosamente

---

**Última actualización:** 25 de marzo de 2026
**Estado:** ✅ Configuración completada, pendiente reinicio de Qwen
