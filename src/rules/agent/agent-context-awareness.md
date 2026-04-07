---
title: Agent Context Awareness Rule
impact: HIGH
impactDescription: "Ensure agents understand and respect the current project context"
tags: context, project, awareness, routing
---

## Agent Context Awareness Rule

**Impact: HIGH** — Agents must detect and respect the current project context before taking any action.

### Core Principle

Always work within the context of the user's current project, not the server's project. Detect the project framework, language, and structure before applying rules or generating code.

### Project Detection Flow

1. **Receive projectPath** from the user's MCP client
2. **Read package.json** from that path to detect:
   - Project name
   - Framework (Angular, React, NestJS, etc.)
   - Language (TypeScript, JavaScript)
3. **Apply relevant rules** based on detected context
4. **Create/link project** in the database if not exists

### Incorrect (using wrong context)

```
# User is working on Angular project "linki-f"
# Agent applies NestJS rules from server project "agent-skills-api"

Las reglas del MCP son para NestJS, no para Angular frontend...
```

### Correct (using correct context)

```
# User is working on Angular project "linki-f"
# Agent detects Angular and applies frontend rules

Proyecto detectado: linki-f (Angular 19, TypeScript)
Aplicando reglas de Angular frontend...
```

### Rules

#### 1. Detect Framework First

Before generating code or applying rules:
- Check `@angular/core` → Angular rules
- Check `@nestjs/common` → NestJS rules
- Check `react` → React rules

#### 2. Use Project-Specific Rules

- Angular project → Apply `frontend/` rules
- NestJS project → Apply `architecture/`, `cqrs/`, `api/` rules
- Mixed project → Apply both sets appropriately

#### 3. Never Assume Server Context

The server project (`agent-skills-api`) is NOT the user's project. Always use the provided `projectPath`.

#### 4. Handle Missing Context Gracefully

If no project path is provided:
- Ask the user for the project path
- Or detect from the conversation context
- Never fall back to `process.cwd()`

### Context Metadata

Store and use:
- `projectName` - From package.json
- `framework` - Detected from dependencies
- `language` - TypeScript or JavaScript
- `architecture` - Detected from folder structure
- `projectPath` - Absolute path to project root
