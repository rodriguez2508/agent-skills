# Agency Skills — Backend API

Plataforma de gestión de agencias de agentes con sistema multi-agente, recursos personalizados (skills, rules, agentes, workflows) y protocolo MCP (Model Context Protocol) para integración con herramientas CLI.

---

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS 11 (Arquitectura Hexagonal + CQRS)
- **Base de datos**: PostgreSQL (TypeORM 0.3)
- **Cache/Sesiones**: Redis (ioredis)
- **Auth**: Google OAuth 2.0 + JWT (access + refresh tokens)
- **API Docs**: Swagger UI (`/api`)
- **MCP**: `@modelcontextprotocol/sdk` (stdio + SSE)

---

## Quick Start

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales (DB, JWT secrets, Google OAuth)

# Docker (PostgreSQL + Redis)
pnpm run docker:up

# Ejecutar migraciones
pnpm run db:migrate

# Desarrollo
pnpm run start:dev
```

El servidor arranca en `http://localhost:8004`.

---

## Estructura

```
src/
├── core/                           # Domain + Ports (Clean Architecture)
│   ├── agents/                     # 17 agentes especializados
│   ├── domain/                     # Interfaces, entidades, tokens
│   ├── infrastructure/             # DB, adapters, MCP controller
│   ├── presentation/               # Controllers REST (health, rules, mcp, agents, sessions)
│   └── skills/                     # Sistema de skills Hermes
├── modules/
│   ├── auth/                       # Google OAuth + JWT (access/refresh)
│   ├── agencies/                   # CRUD de agencias
│   ├── agency-resources/           # Skills, rules, agents, workflows por agencia
│   ├── users/                      # Usuarios (lookup por IP)
│   ├── sessions/                   # Sesiones MCP
│   ├── issues/                     # Gestión de issues
│   ├── projects/                   # Detección de proyectos
│   ├── contexts/                   # Contextos de proyecto
│   ├── plans/                      # Planes de trabajo
│   ├── memory/                     # Sistema de memoria
│   └── agency-agents/              # Catálogo de agentes
├── agents/                         # Implementaciones de agentes
├── rules/                          # Reglas de código (archivos .rule.ts)
├── shared/                         # Middleware, utils, constantes
├── mcp-server.ts                   # Servidor MCP stdio
├── mcp-http-server.ts              # Servidor MCP HTTP
└── main.ts                         # Bootstrap NestJS
```

---

## Variables de entorno

```env
# Server
PORT=8004
CORS_ORIGIN=http://localhost:4200

# Database
DB_URL=postgres://user:password@localhost:5432/agent_skills?sslmode=disable
DB_SYNCHRONIZE=false

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-other-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Ver `.env.example` para todas las variables disponibles (Exa AI, Context7, ChromaDB, etc.).

---

## Scripts

```bash
# Desarrollo
pnpm run start:dev              # Hot-reload
pnpm run start:debug            # Debug mode

# Producción
pnpm run build                  # Build completo
pnpm run start:prod             # Ejecutar dist/main

# Base de datos
pnpm run db:migrate             # Ejecutar migraciones pendientes
pnpm run db:migrate:revert      # Revertir última migración
pnpm run db:generate            # Generar migración desde cambios en entidades

# MCP
pnpm run start:mcp              # MCP stdio server
pnpm run start:mcp-http         # MCP HTTP server
pnpm run build:mcp              # Build MCP stdio
pnpm run build:mcp-http         # Build MCP HTTP

# Tests
pnpm run test                   # Unit tests
pnpm run test:e2e               # E2E tests
pnpm run test:cov               # Coverage

# Docker
pnpm run docker:up              # Levantar servicios
pnpm run docker:down            # Parar servicios
pnpm run docker:logs            # Ver logs

# Lint
pnpm run lint                   # ESLint + auto-fix
pnpm run typecheck              # Type-check sin emitir

# Agentes CLI
pnpm run agent:setup-gemini     # Configurar Gemini MCP
pnpm run mcp:update-claude      # Actualizar config Claude Code
```

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api` | Swagger UI |
| `GET` | `/mcp/sse` | MCP SSE endpoint |
| `POST` | `/mcp/message` | MCP message endpoint |

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/auth/login/google` | Login con Google |
| `GET` | `/api/auth/refresh` | Renovar access token |
| `POST` | `/api/auth/logout` | Cerrar sesión |

### Agencies
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/v1/agency` | Crear agencia |
| `GET` | `/v1/agency/by-user/:userId` | Obtener agencia del usuario |
| `GET` | `/v1/agency/:id` | Obtener agencia por ID |
| `PATCH` | `/v1/agency/:id` | Actualizar agencia |
| `DELETE` | `/v1/agency/:id` | Eliminar agencia |

### Agency Resources
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/v1/agency/:agencyId/skills` | Crear skill |
| `GET` | `/v1/agency/:agencyId/skills` | Listar skills |
| `GET` | `/v1/agency/:agencyId/skills/:id` | Obtener skill |
| `PUT` | `/v1/agency/:agencyId/skills/:id` | Actualizar skill |
| `DELETE` | `/v1/agency/:agencyId/skills/:id` | Eliminar skill |
| | | *(ídem para `/rules`, `/agents`, `/workflows`)* |

### Agency Members
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/v1/agency/:id/members` | Listar miembros |
| `POST` | `/v1/agency/:id/members` | Agregar miembro |
| `DELETE` | `/v1/agency/:id/members/:userId` | Remover miembro |

### Users
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/v1/users/search?q=` | Buscar usuarios por email/nombre |
| `GET` | `/v1/users/:id` | Obtener usuario por ID |

---

## Agentes (17)

| Agente | Responsabilidad |
|--------|----------------|
| **RouterAgent** | Orquestador principal, detecta intención y delega |
| **SearchAgent** | Búsqueda BM25 de reglas |
| **IdentityAgent** | Identidad MCP y prefijos |
| **RulesAgent** | Listado y gestión de reglas |
| **CodeAgent** | Generación de código |
| **ArchitectureAgent** | Validación arquitectónica |
| **AnalysisAgent** | Análisis de código |
| **MetricsAgent** | Métricas y tracking |
| **PMAgent** | Gestión de proyecto |
| **IssueWorkflowAgent** | Workflow de issues |
| **GitHubAgent** | Integración GitHub |
| **FrontendArchitectureAgent** | Arquitectura frontend |
| **WebSearchAgent** | Búsqueda web (Exa AI) |
| **Context7Agent** | Documentación de librerías |
| **ContextAgent** | Contexto de proyecto |
| **ProjectHistoryAgent** | Historial de proyecto |
| **GraphifyAgent** | Visualización de código |
| **ObsidianAgent** | Integración Obsidian |

---

## MCP (Model Context Protocol)

El servidor MCP expone herramientas a través de dos transportes:

- **stdio** (`pnpm run start:mcp`): para integración con CLI locales (Claude Code, Gemini, OpenCode)
- **SSE** (`/mcp/sse` + `/mcp/message`): para integración web y remota

### Herramientas MCP

| Tool | Descripción |
|------|-------------|
| `session_init_auto` | Inicializa sesión MCP con contexto del proyecto |
| `list_agency_skills` | Lista skills de la agencia activa |
| `get_skill_detail` | Detalle de un skill específico |
| `invoke_skill` | Ejecuta un skill |

---

## Arquitectura

- **Hexagonal (Ports & Adapters)**: lógica de negocio aislada de infraestructura
- **CQRS**: comandos y queries separados con `@nestjs/cqrs`
- **Repository Pattern**: interfaces en domain, implementaciones en infrastructure
- **JWT dual**: access tokens (15min) en localStorage, refresh tokens (7d) en httpOnly cookie
- **IP-based auth**: para conexiones SSE/MCP donde no hay cookie disponible

---

## Documentación adicional

- `doc/ARCHITECTURE.md` — Arquitectura completa del sistema
- `doc/MCP-CONFIG.md` — Configuración MCP por herramienta
- `doc/IMPLEMENTATION_STATUS.md` — Estado de implementación
