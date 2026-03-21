# Agent Skills v3

🤖 **Multi-Agent Skills System con Arquitectura Distribuida**

Sistema de skills jerárquico con arquitectura de **sub-agentes especializados** comunicándose vía **gRPC + MCP** para agentes de IA (Qwen, Gemini CLI, Cursor, Claude Code).

---

## 📑 Índice

| Documento | Descripción |
|-----------|-------------|
| **[README.md](#readme)** | Guía principal (este archivo) |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Arquitectura v3: monorepo, gRPC, sub-agentes |
| **[MCP-CONFIG.md](MCP-CONFIG.md)** | Configuración por agente |
| **[CHANGELOG.md](CHANGELOG.md)** | Historial de cambios |

---

## 🚀 Quick Start

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Build del proyecto

```bash
pnpm run build
```

### 3. Iniciar todos los servicios

```bash
# Inicia: MCP Master + 3 sub-agentes (Angular, NestJS, TypeScript)
pnpm run start:all
```

### 4. Verificar health

```bash
curl http://localhost:3003/health
```

---

## 🏗️ Arquitectura v3

### Diagrama

```
┌─────────────────────────────────────────────────────────────┐
│                    Qwen / Gemini / Cursor                   │
│              MCP Client (http://localhost:3003/sse)         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Master Server (puerto 3003)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  - HTTP/SSE Gateway                                   │  │
│  │  - Auto-enrutamiento contextual                       │  │
│  │  - Health check automático (30s)                      │  │
│  │  - Herramientas: auto_route_query, search_skill_rules │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌───────────────────┼───────────────────┐
          │ gRPC              │ gRPC              │ gRPC
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   :50051    │     │   :50052    │     │   :50053    │
   │   Angular   │     │   NestJS    │     │  TypeScript │
   │   Agent     │     │   Agent     │     │   Agent     │
   │  BM25 +     │     │  BM25 +     │     │  BM25 +     │
   │  CQRS       │     │  CQRS       │     │  CQRS       │
   │  1+ reglas  │     │  1+ reglas  │     │  1+ reglas  │
   └─────────────┘     └─────────────┘     └─────────────┘
```

### Componentes

| Componente | Puerto | Protocolo | Responsabilidad |
|------------|--------|-----------|-----------------|
| **MCP Master** | 3003 | HTTP/SSE | Gateway, enrutamiento, health check |
| **Angular Agent** | 50051 | gRPC | Reglas de Angular 17+ |
| **NestJS Agent** | 50052 | gRPC | Reglas de NestJS |
| **TypeScript Agent** | 50053 | gRPC | Reglas de TypeScript |

### Monorepo Structure

```
agent-skills/
├── apps/
│   ├── mcp-master/          # Gateway HTTP/SSE + enrutamiento
│   ├── angular-agent/       # Sub-agente Angular
│   ├── nestjs-agent/        # Sub-agente NestJS
│   └── typescript-agent/    # Sub-agente TypeScript
├── packages/
│   ├── core/                # Tipos compartidos
│   ├── proto/               # Definiciones gRPC (.proto)
│   └── search-engine/       # Motor BM25
├── src/frameworks/
│   ├── angular/rules/       # Reglas de Angular
│   ├── nestjs/rules/        # Reglas de NestJS
│   └── typescript/rules/    # Reglas de TypeScript
├── scripts/
│   └── start-all.sh         # Script de inicio
├── pnpm-workspace.yaml
└── package.json
```

---

## 🛠️ Scripts Disponibles

```bash
# Instalar dependencias
pnpm install

# Build completo
pnpm run build

# Build individual
pnpm run build:master
pnpm run build:agents

# Iniciar servicios
pnpm run start:all        # Todos
pnpm run start:agents     # Solo sub-agentes
pnpm run start:master     # Solo MCP Master

# Health check
pnpm run health           # curl a /health
```

---

## 🔧 Configuración por Agente

### Qwen Code

Edita `~/.qwen/settings.json`:

```json
{
  "mcpServers": {
    "agent-skills": {
      "url": "http://localhost:3003/sse",
      "trust": true
    }
  }
}
```

### Gemini CLI

Crea `~/.gemini/gemini-mcp.json`:

```json
{
  "mcpServers": {
    "agent-skills": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills/dist/mcp-server.js"],
      "env": {
        "SKILLS_PATH": "/home/aajcr/PROYECTOS/agent-skills/src/frameworks"
      }
    }
  }
}
```

### Cursor / Claude Code

Usa la configuración MCP estándar apuntando a `http://localhost:3003/sse`.

---

## 📡 Herramientas MCP Disponibles

| Herramienta | Descripción | Ejemplo |
|-------------|-------------|---------|
| `auto_route_query` | **Auto-detecta framework y carga reglas** | `auto_route_query(message: "crear componente")` |
| `list_skills` | Lista sub-agentes disponibles | `list_skills()` |
| `get_skill` | Info de un sub-agente | `get_skill(skillName: "angular")` |
| `search_skill_rules` | Busca reglas con BM25 | `search_skill_rules(query: "CQRS")` |
| `suggest_skills` | Sugiere agente por contexto | `suggest_skills(message: "nestjs repository")` |
| `get_user_preferences` | Preferencias de usuario | `get_user_preferences()` |

---

## 🤖 Auto-Enrutamiento Inteligente

La herramienta `auto_route_query` detecta automáticamente el framework:

### Por keywords en el mensaje

```
Usuario: "¿Cómo creo un componente standalone con signals?"
         ↓
Keywords detectadas: "standalone", "signals" → ANGULAR
         ↓
MCP carga reglas de angular/rules/
```

### Por estructura del proyecto

```
projectPath/package.json detecta:
  - @angular/core → ANGULAR
  - @nestjs/core → NESTJS
  - angular.json → ANGULAR
  - nest-cli.json → NESTJS
```

### Ejemplo de uso en Qwen

```
Usuario: Necesito crear un servicio en Angular con signals

Qwen (automáticamente):
  1. Llama: auto_route_query({ 
       message: "servicio en Angular con signals",
       projectPath: "/path/to/project"
     })
  
  2. MCP responde con reglas de Angular
  
  3. Qwen responde usando esas reglas
```

---

## 🔍 Health Check

```bash
# Ver estado de todos los agentes
curl http://localhost:3003/health | jq

# Respuesta esperada:
{
  "status": "ok",
  "version": "3.0.1",
  "agents": [
    { "name": "angular", "healthy": true },
    { "name": "nestjs", "healthy": true },
    { "name": "typescript", "healthy": true }
  ]
}
```

---

## 📦 Sub-Agentes y Reglas

### Angular Agent (50051)

| Regla | Descripción |
|-------|-------------|
| `signals-components.md` | Componentes con Signals en Angular 17+ |

### NestJS Agent (50052)

| Regla | Descripción |
|-------|-------------|
| `clean-architecture.md` | Clean Architecture con módulos |

### TypeScript Agent (50053)

| Regla | Descripción |
|-------|-------------|
| `strict-types.md` | Tipos estrictos, evitar `any` |

---

## 🚦 Troubleshooting

### Agentes no responden

```bash
# Verificar puertos
ss -tlnp | grep -E "5005[123]|3003"

# Ver logs
tail -f /tmp/angular.log /tmp/nestjs.log /tmp/typescript.log

# Reiniciar todo
pkill -f "node.*agent" || true
pnpm run start:all
```

### MCP Master no inicia

```bash
# Verificar si el puerto está en uso
lsof -i :3003

# Matar proceso y reiniciar
pkill -f "mcp-master"
pnpm run start:master
```

---

## 📈 Métricas

| Métrica | Valor |
|---------|-------|
| Latencia búsqueda BM25 | < 10ms |
| Health check interval | 30s |
| Sub-agentes máximos | Ilimitado |
| Reglas por agente | Ilimitadas |

---

## 🤔 ¿Migrar a NestJS?

### Situación Actual

El MCP Master está implementado en **Node.js puro** con Express minimalista.

### Ventajas de Migrar a NestJS

| Ventaja | Descripción | Impacto |
|---------|-------------|---------|
| **Arquitectura modular** | Módulos separados para cada sub-agente | 🔴 ALTO |
| **Inyección de dependencias** | Gestión automática de servicios gRPC | 🟡 MEDIO |
| **TypeScript nativo** | Tipado fuerte en todo el proyecto | 🟢 BAJO (ya usas TS) |
| **Guards/Interceptors** | Autenticación, logging, validación | 🟡 MEDIO |
| **Testing integrado** | Unit tests + E2E out-of-the-box | 🔴 ALTO |
| **Documentación OpenAPI** | Swagger automático | 🟢 BAJO |
| **Microservicios** | Transporte híbrido (gRPC + HTTP + Redis) | 🔴 ALTO |
| **Configuración** | ConfigModule con variables de entorno | 🟢 BAJO |

### Desventajas

| Desventaja | Descripción |
|------------|-------------|
| **Complejidad inicial** | Curva de aprendizaje para el equipo |
| **Overhead** | Más boilerplate para funcionalidades simples |
| **Build time** | Compilación más lenta |

### Recomendación

**✅ SÍ migrar a NestJS si:**

1. Planeas agregar **autenticación/autorización** al MCP
2. Quieres **módulos configurables** por sub-agente
3. Necesitas **testing robusto** (unit + integration + E2E)
4. Planeas escalar a **múltiples instancias** del MCP Master
5. Quieres **documentación Swagger** automática

**❌ NO migrar si:**

1. El proyecto es **personal** y funciona bien
2. No necesitas características enterprise
3. Prefieres **simplicidad** sobre flexibilidad

### Arquitectura Propuesta con NestJS

```
apps/
├── mcp-master/              # NestJS Application
│   ├── src/
│   │   ├── agents/          # Módulo de agentes
│   │   │   ├── agents.controller.ts
│   │   │   ├── agents.service.ts
│   │   │   └── agents.module.ts
│   │   ├── grpc/            # Módulo gRPC
│   │   │   ├── grpc.service.ts
│   │   │   └── grpc.module.ts
│   │   ├── health/          # Health check
│   │   │   └── health.controller.ts
│   │   ├── sse/             # SSE Gateway
│   │   │   ├── sse.controller.ts
│   │   │   └── sse.service.ts
│   │   └── app.module.ts
│   └── test/
├── angular-agent/           # NestJS Microservicio
├── nestjs-agent/            # NestJS Microservicio
└── typescript-agent/        # NestJS Microservicio
```

### Migración Paso a Paso

1. **Fase 1**: Migrar MCP Master a NestJS (2-3 días)
2. **Fase 2**: Agregar tests E2E (1-2 días)
3. **Fase 3**: Migrar sub-agentes (opcional, 3-5 días)
4. **Fase 4**: Agregar Swagger + autenticación (1-2 días)

---

## 📝 License

MIT

---

## 🙏 Acknowledgments

- Inspirado por [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills)
- Compatible con [Model Context Protocol](https://modelcontextprotocol.io)
- Motor BM25 basado en [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25)
