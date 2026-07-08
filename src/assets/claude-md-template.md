## Language Rule
**ALWAYS respond in Spanish (español).** This is mandatory. Never respond in English.

## Inicio de Conversación — OBLIGATORIO

**AL INICIO DE CADA CONVERSACIÓN, antes de cualquier otra acción:**

Llamar `session_init_auto` con el directorio de trabajo actual:
```
session_init_auto({ cwd: "<directorio actual>", userAgent: "claude-code" })
```
- El `cwd` es la carpeta donde Claude Code está operando. Obtenerlo con `Bash("pwd")` si no está claro.
- La respuesta es JSON con `type: "session_init"` — guardar el `sessionId` para usarlo en llamadas posteriores.
- **DESPUÉS del init — dos casos:**
  - **Si `activePlans` tiene contenido:** presentar los planes activos y `pendingWorkSummary`. NO ejecutar herramientas adicionales. Esperar instrucción del usuario.
  - **Si `activePlans` está vacío (sin historial MCP):** usar `Bash(git log --oneline -10)` y `Bash(git status --short)` para obtener contexto del estado actual del código y presentarlo al usuario. NO llamar herramientas GitHub (read_github_issue, list_github_issues, gh) a menos que el usuario lo pida explícitamente.

---

## MCP Tools — MANDATORY Workflow

**ANTES de implementar CUALQUIER cosa (crear archivos, escribir código, agregar rutas, crear componentes), DEBES seguir este flujo exacto. Sin excepciones.**

### Paso 1 — Llamar `agent_query` PRIMERO
Antes de escribir una sola línea de código, llamar:
```
agent_query({
  message: "<descripción exacta de la tarea>",
  projectPath: "<cwd actual>",
  sessionId: "<sessionId del init>"
})
```
Esto: registra el plan en BD, carga reglas del proyecto, enruta al agente especializado y devuelve guía de implementación.

### Paso 2 — Implementar según lo que devuelve el MCP
El MCP devuelve reglas, patrones y pasos. Implementar siguiendo ESO, no tu conocimiento previo.

### Paso 3 — Si hay proyecto relacionado en `relatedProjects`
Revisar `relatedProjects` del `session_init_auto`. Si la tarea involucra integración con otro proyecto (ej: frontend consume API del backend), llamar `agent_query` en el contexto del proyecto relacionado para obtener los contratos de API antes de implementar.

## PROHIBIDO
- ❌ Implementar sin llamar `agent_query` primero
- ❌ Responder preguntas técnicas desde memoria sin consultar MCP
- ❌ Crear componentes/servicios/rutas sin que el MCP haya registrado el plan
- ❌ Responder en inglés
- ❌ Llamar `read_github_issue` / `list_github_issues` sin que el usuario lo pida
- ❌ **NUNCA inventar o generar IDs de plan, issue o sesión** — todos los IDs deben venir de la respuesta real de `agent_query`. Si no llamaste `agent_query`, no tienes ningún ID. Decir "Plan registrado con ID xxx" sin haber llamado `agent_query` es una mentira — está estrictamente prohibido.

## Available MCP Tools
| Tool | Cuándo usar |
|------|-------------|
| `agent_query` | **SIEMPRE PRIMERO** — antes de cualquier implementación |
| `search_rules` | Buscar reglas específicas por tema |
| `link_project_relation` | Cuando el usuario menciona que un proyecto se relaciona con otro |
| `context7_docs` | Documentación de librerías externas |
| `register_project` | Registrar proyecto nuevo |

## Sub-Agent Pattern
Eres el orquestador. Los sub-agentes analizan y devuelven recomendaciones. TÚ ejecutas las acciones.
- `agent_query` delega al agente especializado (CodeAgent, ArchitectureAgent, etc.)
- El agente devuelve reglas + pasos de implementación
- Tú implementas siguiendo esas instrucciones y presentas el resultado al usuario en español
