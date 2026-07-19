# Agency Skills MCP — Business Idea

## Overview

**Agency Skills** is a platform that allows teams to create, manage and share custom AI agent resources (skills, rules, agents, workflows) grouped under an "agency." Each agency exposes its resources through MCP (Model Context Protocol) so any compatible CLI tool (OpenCode, Claude Code, Gemini CLI, Qwen CLI) can invoke them automatically within a project context.

### Value Proposition

> "A team creates its own AI agent resources, publishes them under an agency, and any developer on the team gets those resources automatically through their CLI — zero manual configuration."

---

## User Flow

```
1. DEVELOPER OPENS CLI IN A PROJECT
   $ cd /home/dev/my-project
   $ opencode
   (CLI auto-detects project and connects to Agency Skills MCP)

2. MCP SESSION INITIALIZATION
   - Session ID generated
   - Agency ID loaded from Redis (CLI-assigned)
   - Skill count loaded from DB
   - 17 built-in agents available + agency-specific skills

3. DEVELOPER INVOKES A SKILL
   $ list_agency_skills       → lists all skills for the active agency
   $ get_skill_detail(id)     → shows prompt template, domain, agent type
   $ invoke_skill(id, input)  → executes the skill with user input

4. SKILL EXECUTION
   - Skill prompt template injected into CLI context
   - CLI agent uses the template to generate domain-specific output
   - Response returned to developer
```

---

## Architecture

### Data Model

```
┌──────────────────────────────────────────────────┐
│ AGENCY                                           │
│ id, name, slug, description, logoUrl, ownerId    │
│ + OneToMany: skills, rules, agents, workflows    │
└──────────────────────────────────────────────────┘
         │
         │ 1:N
         ├──────────────┬────────────────┬──────────────────┐
         ▼              ▼                ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ SKILLS       │ │ RULES        │ │ AGENTS       │ │ WORKFLOWS    │
│ promptTmpl   │ │ content      │ │ systemPrompt │ │ steps        │
│ domain       │ │ category     │ │ capabilities │ │ triggerCond  │
│ agentType    │ │ tags         │ │ tools        │ │ stepsConfig  │
│ isPublic     │ │ priority     │ │ config       │ │ isPublic     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Entities (all snake_case in DB, camelCase in TS)

**agency_skills**: `id`, `agency_id`, `name`, `description`, `prompt_template`, `domain`, `agent_type`, `parameters_schema`, `output_schema`, `is_active`, `is_public`, `usage_count`, `created_at`, `updated_at`

**agency_rules**: `id`, `agency_id`, `name`, `description`, `content`, `category`, `priority`, `tags`, `is_active`, `is_public`, `created_at`, `updated_at`

**agency_agents**: `id`, `agency_id`, `name`, `description`, `system_prompt`, `capabilities`, `tools`, `config`, `is_active`, `is_public`, `created_at`, `updated_at`

**agency_workflows**: `id`, `agency_id`, `name`, `description`, `steps`, `trigger_condition`, `steps_config`, `is_active`, `is_public`, `created_at`, `updated_at`

---

## Agents (17 built-in)

| Agent | Responsibility |
|-------|----------------|
| RouterAgent | Orchestrator — detects intent and delegates |
| SearchAgent | BM25 search across rules |
| IdentityAgent | MCP identity and response prefixes |
| RulesAgent | Rule listing and management |
| CodeAgent | Code generation following project patterns |
| ArchitectureAgent | Architectural validation |
| AnalysisAgent | Code analysis and code smells |
| MetricsAgent | Metrics and usage tracking |
| PMAgent | Issue and user story creation |
| IssueWorkflowAgent | Step-by-step issue workflow (READ → ANALYZE → PLAN → CODE → TEST → COMMIT → PR) |
| GitHubAgent | GitHub integration |
| FrontendArchitectureAgent | Frontend-specific architecture |
| WebSearchAgent | Web search via Exa AI |
| Context7Agent | External library documentation |
| ContextAgent | Project context management |
| ProjectHistoryAgent | Project history tracking |
| GraphifyAgent | Code visualization |
| ObsidianAgent | Obsidian vault integration |

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `session_init_auto` | Initialize MCP session with project context (loads agency, skill count, available agents) |
| `list_agency_skills` | List all skills for the active agency |
| `get_skill_detail` | Get detailed info for a specific skill |
| `invoke_skill` | Execute a skill with input parameters |

---

## CLI Integration

Works with any MCP-compatible CLI:

| CLI | Transport | Config |
|-----|-----------|--------|
| OpenCode | stdio | `opencode.json` |
| Claude Code | stdio | `~/.claude/mcp.json` |
| Gemini CLI | stdio | `~/.gemini/mcp.json` |
| Qwen CLI | SSE | `~/.qwen/settings.json` |
| Cursor | stdio | `.cursor/settings.json` |

For SSE transport (Qwen, remote), the MCP server runs inside NestJS at `http://localhost:8004/mcp/sse`.

For stdio transport (OpenCode, Claude Code, Gemini), the standalone `mcp-server.js` is invoked directly by the CLI.

---

## Auth & Identification

### Google OAuth Only

- Login via Google OAuth 2.0 (no email/password)
- JWT access token (15 min) in localStorage
- JWT refresh token (7 days) in httpOnly cookie
- Refresh token rotation on each refresh call

### IP-Based Auth (MCP/SSE)

For SSE connections where cookies aren't available:
- AuthGuard Strategy 4: extracts client IP, normalizes it (`::1` → `127.0.0.1`, `::ffff:x.x.x.x` → `x.x.x.x`)
- Looks up or creates user by IP
- Issues JWT for the session

### Agency Members

- Agencies have members (user IDs)
- Members can manage agency resources (CRUD)
- Owner created automatically with agency

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/login/google` | Google OAuth login |
| `GET` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Logout |

### Agencies
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/agency` | Create agency |
| `GET` | `/v1/agency/by-user/:userId` | Get user's agency |
| `GET` | `/v1/agency/:id` | Get agency by ID |
| `PATCH` | `/v1/agency/:id` | Update agency |
| `DELETE` | `/v1/agency/:id` | Delete agency |

### Agency Resources (per agency)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/agency/:agencyId/skills` | Create skill |
| `GET` | `/v1/agency/:agencyId/skills` | List skills |
| `GET` | `/v1/agency/:agencyId/skills/:id` | Get skill |
| `PUT` | `/v1/agency/:agencyId/skills/:id` | Update skill |
| `DELETE` | `/v1/agency/:agencyId/skills/:id` | Delete skill |
| | *(same pattern for `/rules`, `/agents`, `/workflows`)* | |

### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/agency/:id/members` | List members |
| `POST` | `/v1/agency/:id/members` | Add member |
| `DELETE` | `/v1/agency/:id/members/:userId` | Remove member |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/v1/users/search?q=` | Search users |
| `GET` | `/v1/users/:id` | Get user by ID |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 11, TypeScript |
| ORM | TypeORM 0.3 |
| Database | PostgreSQL |
| Cache | Redis (ioredis) |
| Auth | Google OAuth 2.0 + JWT |
| MCP | `@modelcontextprotocol/sdk` |
| CQRS | `@nestjs/cqrs` |
| API Docs | Swagger |

---

## Implementation Status

### Completed

- [x] Google OAuth authentication (no email/password)
- [x] JWT access + refresh token with httpOnly cookie
- [x] Agency CRUD with slug field
- [x] Agency member management (add/remove/list)
- [x] 4 resource types: skills, rules, agents, workflows (DB + REST)
- [x] CQRS commands and handlers (12 commands, 10 queries)
- [x] MCP tools: `list_agency_skills`, `get_skill_detail`, `invoke_skill`
- [x] MCP transport: stdio + SSE
- [x] IP-based auth for SSE/MCP connections
- [x] 17 specialized agents registered in router
- [x] Frontend: Angular 20 with @ngrx/signals
- [x] Skill wizard (5-step: description → domain → agent type → preview → save)
- [x] Unified resource views with Acciones dropdown
- [x] TypeORM migrations (snake_case DB, camelCase TS)

### In Progress

- [ ] Skill wizard end-to-end testing
- [ ] MCP tool testing from CLI (list, detail, invoke)

### Roadmap

- [ ] Marketplace: publish skills as public, browse other agencies
- [ ] Skill versioning
- [ ] Webhook notifications for resource changes
- [ ] Rate limiting per agency
- [ ] Audit log for resource operations
- [ ] API key authentication for programmatic access

---

**Created:** 2026-03-28
**Updated:** 2026-07-19
**Version:** 2.0.0
**Status:** Active development
