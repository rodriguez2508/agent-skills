# PMAgent y MCP - Flujo de Trabajo Automatizado

## 🎯 Problema Solucionado

**Antes:**
- Qwen actuaba por su cuenta sin usar el sistema de agentes
- PMAgent no se ejecutaba automáticamente
- No se creaban issues automáticamente
- No había historial de chat persistente

**Ahora:**
- ✅ **PMAgent se ejecuta automáticamente** cuando detecta peticiones de producto
- ✅ **RouterAgent orquesta todo** - detecta intención y enruta al agente correcto
- ✅ **Issues se crean automáticamente** en la base de datos
- ✅ **Historial de chat persistente** en PostgreSQL + Redis
- ✅ **Qwen usa MCP correctamente** - llama a `agent_query` que usa todo el sistema

---

## 🔄 Flujo de Trabajo

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO (Qwen)                           │
│  "Necesito un issue para autenticación con Google"              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (HTTP/SSE)                        │
│  Herramienta: agent_query                                       │
│  - sessionId: session-123456789                                 │
│  - userId: user-abc                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              NestJS API - /mcp/chat endpoint                    │
│  1. Busca reglas relevantes (BM25)                              │
│  2. Guarda mensaje en PostgreSQL                                │
│  3. Almacena contexto en Redis                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RouterAgent (Orquestador)                    │
│  - Detecta intención: "crear issue" → PMAgent                   │
│  - Agrega contexto de reglas                                    │
│  - Enriquece con sessionId, userId                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              PMAgent (Especializado en Producto)                │
│  - Extrae contexto de negocio                                   │
│  - Genera historia de usuario                                   │
│  - Define criterios de aceptación                               │
│  - Estima valor de negocio                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  IssueService (Base de Datos)                   │
│  - Crea issue en PostgreSQL                                     │
│  - Genera issueId automático (ISSUE-xxx)                        │
│  - Asocia con sessionId y userId                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Respuesta a Qwen                             │
│  - Issue creado: ISSUE-1234567890                               │
│  - Historia de usuario                                          │
│  - Criterios de aceptación                                      │
│  - Valor de negocio: HIGH                                       │
│  - Historial guardado en BD                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Herramientas MCP Disponibles

### 1. `agent_query` (PRINCIPAL - Usar siempre)

**Descripción:** Consulta principal con agentes especializados. Auto-detecta intención y enruta.

**Parámetros:**
```json
{
  "input": "Tu consulta o petición",
  "sessionId": "session-123456789 (opcional, para historial)",
  "userId": "user-abc (opcional, para tracking)"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "message": "📋 Issue creado desde perspectiva de Producto:",
    "issue": {
      "id": "uuid-xxx",
      "issueId": "ISSUE-1234567890",
      "title": "Autenticación con Google",
      "userStory": "Como usuario, quiero iniciar sesión con Google...",
      "acceptanceCriteria": [...],
      "businessValue": "🔴 HIGH",
      "priority": "🟠 HIGH"
    },
    "routedBy": "RouterAgent",
    "targetAgent": "PMAgent"
  },
  "metadata": {
    "agentId": "PMAgent",
    "executionTime": 150,
    "role": "Product Manager",
    "issueCreated": true
  }
}
```

### 2. `search_rules` (Legacy - Solo búsqueda directa)

**Descripción:** Busca reglas de código usando BM25.

**Parámetros:**
```json
{
  "query": "CQRS",
  "category": "nestjs (opcional)",
  "limit": 5
}
```

---

## 📋 Ejemplos de Uso

### Ejemplo 1: Crear Issue de Producto

**Usuario dice:**
> "Necesito un issue para autenticación con Google"

**Flujo:**
1. Qwen → MCP `agent_query`
2. MCP → `/mcp/chat`
3. RouterAgent detecta "issue" → PMAgent
4. PMAgent genera issue de producto
5. IssueService crea en BD
6. Respuesta con issue completo

**Respuesta esperada:**
```
📋 Issue creado desde perspectiva de Producto:

---
📋 **Issue Creado**:
**ID**: `ISSUE-1234567890`
**Título**: Autenticación con Google

## 🎯 Problema del Usuario
Los usuarios necesitan iniciar sesión más rápido sin crear nueva cuenta

## 💼 Objetivo de Negocio
Mejorar la experiencia del usuario y aumentar la adopción

## 👥 Usuarios Afectados
Usuarios de la plataforma

**Historia de Usuario**:
**Como** usuario
**Quiero** iniciar sesión con Google
**Para** acceder más rápido sin crear nueva cuenta

**Criterios de Aceptación**:
✅ El usuario puede completar la acción principal
✅ Se validan los datos de entrada correctamente
...

**Valor de Negocio**: 🔴 HIGH
**Prioridad**: 🟠 HIGH

⚠️ Este issue NO incluye detalles técnicos de implementación.

**Siguientes Pasos**:
- Revisar issue con stakeholders
- Priorizar en backlog
- El equipo técnico definirá la implementación

---
🤖 **Agentes involucrados**:
- Router: `RouterAgent`
- Especialista: `PMAgent`
⏱️ **Tiempo de ejecución**: 150ms
🎯 **Rol**: Product Manager
```

### Ejemplo 2: Crear Historia de Usuario

**Usuario dice:**
> "Crea una historia de usuario para exportar reportes a PDF"

**Respuesta esperada:**
```
📖 Historia de Usuario creada:

**Como** usuario
**Quiero** exportar reportes a PDF
**Para** poder usar los datos en otras herramientas

**Criterios de Aceptación**:
✅ El usuario puede seleccionar el formato PDF
✅ Se genera el archivo correctamente
✅ Se mantiene el formato del reporte original
...
```

### Ejemplo 3: Búsqueda de Reglas (automático)

**Usuario dice:**
> "¿Cómo implemento un servicio en NestJS?"

**Flujo:**
1. RouterAgent detecta "servicio" + "NestJS"
2. Busca reglas relevantes automáticamente
3. Enruta a CodeAgent o SearchAgent
4. Devuelve reglas + código de ejemplo

**Respuesta incluye:**
- Reglas aplicadas (Clean Architecture, CQRS)
- Código de ejemplo
- Explicación del agente

---

## 🔧 Configuración en Qwen

### Configuración Recomendada

```json
{
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "preferMcpOverInternalTools": true,
    "defaultTool": "agent_query",
    "toolPriority": {
      "agent_query": "high",
      "search_rules": "medium",
      "get_rule": "low",
      "list_rules": "low"
    }
  },
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high"
    }
  }
}
```

### Instrucciones para Qwen

1. **Usa SIEMPRE `agent_query`** para peticiones de usuarios
2. **Pasa `sessionId`** para mantener historial
3. **No uses herramientas internas** - MCP tiene prioridad
4. **Para issues de producto**, el sistema crea automáticamente en BD

---

## 📊 Endpoints de la API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/mcp/chat` | Chat con agentes (auto-routes) |
| `GET` | `/mcp/sse` | MCP SSE connection |
| `POST` | `/mcp/message` | MCP protocol messages |
| `GET` | `/mcp/logs` | Logs recientes de agentes |
| `GET` | `/mcp/debug` | Debug de sesiones y herramientas |
| `GET` | `/mcp/agents` | Lista de agentes registrados |

---

## 🗄️ Base de Datos

### Tablas Involucradas

1. **sessions** - Historial de sesiones
   - `sessionId`, `userId`, `metadata`

2. **chat_messages** - Mensajes del chat
   - `sessionId`, `role` (USER/ASSISTANT), `content`
   - `metadata` (agentId, executionTime, rulesApplied)

3. **issues** - Issues creados por PMAgent
   - `issueId`, `title`, `description`, `requirements`
   - `userId`, `sessionId`, `status`
   - `currentWorkflowStep`, `completedSteps`
   - `keyDecisions`, `nextSteps`, `metadata`

---

## 🧪 Testing

### Probar el Flujo Completo

```bash
# 1. Iniciar API NestJS
pnpm run start:dev

# 2. Iniciar MCP Server
pnpm run start:mcp-http

# 3. Probar endpoint /mcp/chat
curl -X POST http://localhost:8004/mcp/chat \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Necesito un issue para autenticación con Google",
    "sessionId": "test-session-123"
  }'

# 4. Verificar logs
curl http://localhost:8004/mcp/logs?count=20

# 5. Verificar debug
curl http://localhost:8004/mcp/debug
```

### Verificar Issue Creado

```sql
SELECT * FROM issues 
WHERE title LIKE '%Google%' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 🐛 Troubleshooting

### Qwen no usa `agent_query`

**Síntoma:** Qwen usa herramientas internas en lugar de MCP

**Solución:**
1. Verificar configuración MCP en Qwen
2. Asegurar que `preferMcpOverInternalTools: true`
3. Reiniciar Qwen

### PMAgent no crea issues

**Síntoma:** Respuesta sin issueId

**Posibles causas:**
1. IssueService no está inyectado correctamente
2. Error de base de datos
3. RouterAgent no detecta intención PM

**Debug:**
```bash
curl http://localhost:8004/mcp/logs
```

### Historial no persiste

**Síntoma:** Cada mensaje es independiente

**Verificar:**
1. sessionId se está pasando correctamente
2. Redis está corriendo
3. PostgreSQL está guardando mensajes

---

## 📈 Métricas

### Dashboard de Agentes

```bash
curl http://localhost:8004/mcp/agents
```

Respuesta:
```json
{
  "total": 9,
  "agents": [
    { "id": "RouterAgent", "logs": 150 },
    { "id": "PMAgent", "logs": 45 },
    { "id": "CodeAgent", "logs": 200 },
    ...
  ],
  "usage": { ... }
}
```

---

## 🚀 Próximas Mejoras

- [ ] Integración con GitHub Issues (crear issues reales)
- [ ] Notificaciones webhook cuando se crea issue
- [ ] Dashboard web para ver issues y historial
- [ ] Comandos de voz para crear issues
- [ ] Integración con Jira, Linear, etc.

---

**Para más información, ver:**
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - Arquitectura del sistema
- [`MCP-CONFIG.md`](MCP-CONFIG.md) - Configuración MCP
- [`README.md`](../README.md) - Quick start
