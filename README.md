# Agent Skills API - CodeMentor MCP

🤖 **Multi-Agent System con Arquitectura Hexagonal + CQRS**

Sistema de agentes especializados para búsqueda y gestión de reglas de código usando el protocolo MCP (Model Context Protocol).

---

## 🚀 Quick Start

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

### 3. Build

```bash
pnpm run build
```

### 4. Iniciar servidor

```bash
pnpm run start:dev
```

### 5. Verificar

```bash
curl http://localhost:8004/health
```

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| **[README.md](doc/README.md)** | Guía principal y quick start |
| **[ARCHITECTURE.md](doc/ARCHITECTURE.md)** | Arquitectura v3: monorepo, gRPC, agentes |
| **[MCP-CONFIG.md](doc/MCP-CONFIG.md)** | Configuración MCP por agente (Qwen, Cursor, Claude) |
| **[MCP-QWEN-CONFIG.md](doc/MCP-QWEN-CONFIG.md)** | Configuración específica para Qwen + reglas |
| **[IMPLEMENTATION_STATUS.md](doc/IMPLEMENTATION_STATUS.md)** | Estado de implementación y métricas |

---

## 🤖 Agentes Disponibles

| Agente | Responsabilidad |
|--------|----------------|
| **RouterAgent** | Orquestador principal, detecta intención |
| **SearchAgent** | Búsqueda BM25 de reglas |
| **IdentityAgent** | Gestiona identidad MCP y prefijos |
| **RulesAgent** | Listado y gestión de reglas |
| **CodeAgent** | Generación de código |
| **ArchitectureAgent** | Validación arquitectónica |
| **AnalysisAgent** | Análisis de código |
| **MetricsAgent** | Métricas y tracking |

---

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
pnpm run start:dev

# Producción
pnpm run start:prod

# Build
pnpm run build

# Tests
pnpm run test

# Lint
pnpm run lint
```

---

## 📡 Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/rules` | Listar reglas |
| `GET` | `/rules/search?q=xxx` | Buscar reglas |
| `GET` | `/mcp/sse` | MCP SSE endpoint |
| `GET` | `/api` | Swagger UI |

---

## 🔧 Configuración Qwen

Para priorizar MCP en Qwen, usa la configuración en `doc/MCP-QWEN-CONFIG.md`:

```json
{
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "preferMcpOverInternalTools": true
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

---

## 📊 Métricas

| Componente | Valor |
|------------|-------|
| **Agentes** | 8 especializados |
| **Reglas** | 20+ reglas de código |
| **Tests** | 17 tests passing |
| **Arquitectura** | Hexagonal + CQRS |

---

## 🎯 Reglas Aplicadas

Todos los agentes siguen estas reglas:

- ✅ Comentarios en **inglés**
- ✅ Logs en **inglés**
- ✅ Respuestas **amigables** (no técnicas)
- ✅ Clean Architecture
- ✅ CQRS pattern
- ✅ Repository pattern

---

## 📝 License

MIT

---

**Para más detalles, visita la carpeta [`doc/`](doc/)**
