# Qwen Code - Configuración Global para MCP

## 📋 Resumen

Esta documentación describe cómo configurar Qwen Code para que **todos los subagentes** (especialmente `general-purpose` usado por la herramienta `task`) deleguen el análisis y arquitectura a los agentes MCP de `agent-skills-api`.

---

## 🏗️ Arquitectura de Configuración

### Niveles de Prioridad

| Nivel | Ubicación | Alcance | Prioridad |
|-------|-----------|---------|-----------|
| **Global** | `~/.qwen/INSTRUCTIONS.md` | **Todos los proyectos** | ALTA |
| **Global** | `~/.qwen/settings.json` | **Todos los proyectos** | ALTA |
| **Skill** | `~/.qwen/skills/<name>/SKILL.md` | Subagente específico | MEDIA |
| **Proyecto** | `<proyecto>/.qwen/INSTRUCTIONS.md` | Solo ese proyecto | BAJA |

---

## 📁 Archivos de Configuración

### 1. `~/.qwen/INSTRUCTIONS.md` (Global)

**Propósito:** Instrucciones principales que aplican a TODOS los proyectos.

**Contenido Clave:**
- Usar SIEMPRE MCP `agent-skills-api`
- Flujo obligatorio: `cualquier consulta → agent_query → RouterAgent`
- Herramientas prohibidas cuando MCP está disponible
- Ejemplos de uso correcto e incorrecto

**Ubicación:** `~/.qwen/INSTRUCTIONS.md`

---

### 2. `~/.qwen/settings.json` (Global)

**Propósito:** Configuración técnica de Qwen Code.

**Secciones Críticas:**

```json
{
  "systemPrompt": {
    "enabled": true,
    "file": "~/.qwen/INSTRUCTIONS.md",
    "priority": "critical",
    "overrideDefaults": true
  },
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "autoRunSuggestSkills": true,
    "preferMcpOverInternalTools": true,
    "forceTools": true,
    "defaultTool": "mcp__agent-skills-api__agent_query",
    "taskSubagentBehavior": {
      "requireMcpFirst": true,
      "delegateToAgentQuery": true,
      "skipDirectAnalysis": true
    }
  },
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high",
      "timeout": 60000
    }
  },
  "subagents": {
    "general-purpose": {
      "skill": "~/.qwen/skills/general-purpose/SKILL.md",
      "requireMcpFirst": true,
      "description": "Subagente para tareas complejas que DEBE delegar a MCP"
    }
  }
}
```

---

### 3. `~/.qwen/skills/general-purpose/SKILL.md`

**Propósito:** Instrucciones específicas para el subagente `general-purpose`.

**Contenido Clave:**
- Flujo: `task → agent_query → RouterAgent`
- Lo que NUNCA debe hacer (leer archivos, grep, analizar directo)
- Excepciones y fallbacks
- Lista de agentes especializados disponibles

**Ubicación:** `~/.qwen/skills/general-purpose/SKILL.md`

---

## 🔄 Flujo de Trabajo Esperado

### Antes de la Configuración

```
Usuario → task (general-purpose) → read_file/grep_search → Análisis directo ❌
```

### Después de la Configuración

```
Usuario → task (general-purpose) → agent_query (MCP) → RouterAgent → FrontendArchitectureAgent ✅
```

---

## 🧪 Verificación

### Paso 1: Verificar Archivos

```bash
# Verificar INSTRUCTIONS.md
cat ~/.qwen/INSTRUCTIONS.md | head -20

# Verificar settings.json
cat ~/.qwen/settings.json | grep -A 5 '"mcp"'

# Verificar SKILL.md
cat ~/.qwen/skills/general-purpose/SKILL.md | head -20
```

### Paso 2: Verificar Servidor MCP

```bash
curl http://localhost:8004/mcp/message
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "message": "🎓 CodeMentor MCP is ready",
  "agents": ["RouterAgent", "SearchAgent", "CodeAgent", ...]
}
```

### Paso 3: Probar con Qwen

**Opción A: Usar MCP directamente (RECOMENDADO)**

```typescript
agent_query(input: "Analiza este proyecto", sessionId: "xxx")
```

**Opción B: Usar Task Bridge (si necesitas `task`)**

```typescript
// Dentro del subagente general-purpose
const response = await fetch('http://localhost:8004/api/task/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: "Analiza este proyecto",
    projectPath: "/path/al/proyecto"
  })
});

const result = await response.json();
```

**Comportamiento esperado:**
- Se crea el proyecto en BD automáticamente
- Se detecta la intención (work vs analysis)
- Se enruta al agente especializado (FrontendArchitectureAgent para análisis)
- Se guarda el historial en la sesión

---

## 🌉 Task Bridge: Endpoint para Subagentes

### ¿Qué es Task Bridge?

Es un endpoint HTTP especial (`/api/task/analyze`) diseñado para que el subagente `general-purpose` delegue análisis a los agentes MCP.

### ¿Por qué existe?

El subagente `general-purpose` de Qwen Code:
- ❌ NO respeta completamente las instrucciones del `SKILL.md`
- ❌ NO llama automáticamente a `agent_query`
- ❌ Trabaja directamente con `read_file`, `grep_search`

Task Bridge proporciona una forma **técnica** de forzar la delegación.

### ¿Cómo funciona?

```
Subagente task → POST /api/task/analyze → TaskBridgeController
                                           ↓
                                    McpService.processUserMessage()
                                           ↓
                                    1. Detecta proyecto
                                    2. Crea proyecto (si no existe)
                                    3. Detecta intención
                                    4. Crea issue (si es work)
                                           ↓
                                    RouterAgent → Agente Especializado
                                           ↓
                                    Respuesta con análisis
```

### Endpoints Disponibles

#### 1. `POST /api/task/analyze` (Simplificado)

```json
{
  "input": "Analiza este proyecto frontend",
  "projectPath": "/path/al/proyecto" // opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "message": "## 🏗️ Frontend Architecture Validation...",
    "validation": { ... }
  },
  "metadata": {
    "sessionId": "analyze-xxx",
    "projectId": "uuid-del-proyecto",
    "issueId": null,
    "agentId": "FrontendArchitectureAgent"
  }
}
```

#### 2. `POST /api/task/delegate` (Completo)

```json
{
  "input": "Analiza este proyecto",
  "sessionId": "opcional",
  "userId": "opcional",
  "projectPath": "opcional",
  "options": {}
}
```

**Diferencias:**
- `analyze`: Auto-crea sesión y usuario, más simple
- `delegate`: Permite controlar sesión/usuario, más avanzado

### Ejemplo de Uso desde Subagente

```typescript
// En el código del subagente general-purpose
async analyzeProject(projectPath: string, userInput: string) {
  const response = await fetch('http://localhost:8004/api/task/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: userInput,
      projectPath: projectPath
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    return result.data.message; // Análisis del agente
  } else {
    throw new Error(result.error);
  }
}
```

### Beneficios

1. **Proyecto auto-creado**: No necesitas crear el proyecto manualmente
2. **Intención detectada**: Distingue entre work (crea issue) y analysis
3. **Historial guardado**: La conversación se guarda en la sesión
4. **Agente correcto**: RouterAgent enruta automáticamente

---

## 🔧 Troubleshooting

### Problema: El subagente sigue analizando directamente

**Causas posibles:**
1. Qwen no reinició después de los cambios
2. El servidor MCP no está corriendo
3. La ruta del SKILL.md es incorrecta

**Soluciones:**

1. **Reiniciar Qwen completamente:**
   - Cierra todas las ventanas de Qwen
   - Mata procesos residuales: `pkill -f qwen`
   - Inicia Qwen nuevamente

2. **Verificar servidor MCP:**
   ```bash
   # En el proyecto agent-skills-api
   pnpm run start:mcp
   ```

3. **Verificar rutas:**
   ```bash
   ls -la ~/.qwen/skills/general-purpose/SKILL.md
   ls -la ~/.qwen/INSTRUCTIONS.md
   ```

---

### Problema: MCP no responde

**Verificar logs del servidor:**

```bash
# Ver logs en tiempo real
pnpm run start:mcp 2>&1 | grep -E "MCP|RouterAgent|agent_query"
```

**Logs esperados:**
```
🔌 MCP: Nuevo cliente SSE conectado
✅ MCP: Sesión creada: <uuid>
📥 [ROUTER] Recibida solicitud de enrutamiento
🧠 [ROUTER] Intención detectada: frontend-architecture
🔀 [ROUTER] Enrutando a FrontendArchitectureAgent
```

---

## 📊 Agentes Disponibles

| Agente | Responsabilidad | Cuándo se Activa |
|--------|-----------------|------------------|
| **RouterAgent** | Orquestador principal | Siempre primero |
| **FrontendArchitectureAgent** | Análisis de proyectos frontend | "analiza este proyecto" |
| **CodeAgent** | Generación de código | "crea", "implementa" |
| **SearchAgent** | Búsqueda BM25 | "busca", "encuentra" |
| **PMAgent** | Crear issues | "crear issue", "user story" |
| **ArchitectureAgent** | Validación backend | "arquitectura", "valida" |
| **AnalysisAgent** | Análisis de código | "revisa", "verifica" |

---

## 🎯 Configuración para Otros Asistentes

### Gemini CLI

**Archivo:** `~/.gemini/instructions.md`

```markdown
# Gemini CLI - Instrucciones Globales

USAR SIEMPRE MCP agent-skills-api cuando esté disponible.

Servidor: http://localhost:8004/mcp/sse
Herramienta principal: agent_query
```

### OpenCode

**Archivo:** `~/.opencode/rules.md`

```markdown
# OpenCode - Reglas Globales

Delegar análisis y arquitectura a MCP agent-skills-api.
Endpoint: http://localhost:8004/mcp/sse
```

---

## 📝 Notas Importantes

1. **Reiniciar Qwen** después de cambiar configuración
2. **Servidor MCP debe estar corriendo** antes de usar Qwen
3. **Puerto default:** `8004` para MCP SSE
4. **Idioma:** Español para usuario, Inglés para código

---

## 🔗 Referencias

- [Documentación MCP](./MCP-CONFIG.md)
- [Configuración Qwen](./MCP-QWEN-CONFIG.md)
- [Arquitectura del Sistema](./ARCHITECTURE.md)

---

**Versión:** 1.0.0  
**Última actualización:** 2026-04-02  
**Alcance:** Global (todos los proyectos)
