# PI Configuration for Agent Skills API

## Overview

This document describes how to integrate **Agent Skills API** with **pi** CLI. Two integration options are available:

1. **MCP Configuration** - Use the MCP protocol to connect to Agent Skills API
2. **Extension** - Use the custom TypeScript extension with additional tools

---

## Option 1: MCP Configuration (Recommended)

### Quick Setup

1. Copy the configuration file to pi's config directory:

```bash
cp pi-mcp-config.json ~/.pi/agent/
```

2. Start the Agent Skills API server (if not running):

```bash
cd /home/aajcr/PROYECTOS/agent-skills-api
pnpm run start:dev
```

3. Start pi with the MCP configuration:

```bash
pi
```

Or add to your settings:

```bash
cat >> ~/.pi/agent/settings.json << EOF
{
  "mcp": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high"
    }
  }
}
EOF
```

### MCP Tools Available

| Tool | Description |
|------|-------------|
| `agent_query` | Main tool - routes to specialized agents |
| `search_rules` | Search code rules using BM25 |
| `get_rule` | Get rule by ID |
| `list_rules` | List all available rules |
| `context7_docs` | Fetch library documentation |
| `register_project` | Register project for tracking |

---

## Option 2: Extension

### Quick Setup

The extension is already installed at:

```
~/.pi/agent/extensions/agent-skills-ext.ts
```

To load it manually:

```bash
pi -e ~/.pi/agent/extensions/agent-skills-ext.ts
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "extensions": [
    "~/.pi/agent/extensions/agent-skills-ext.ts"
  ]
}
```

### Extension Tools

| Tool | Description |
|------|-------------|
| `agent_skills_search_rules` | Search code rules |
| `agent_skills_get_rule` | Get rule by ID |
| `agent_skills_list_rules` | List all rules |
| `agent_skills_context7` | Fetch library docs |
| `agent_skills_register_project` | Register project |
| `agent_skills_query` | Main agent query |

### Extension Commands

| Command | Description |
|---------|-------------|
| `/skills` | Show Agent Skills API status |

---

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `pi-mcp-config.json` | `~/.pi/agent/` | MCP server config |
| `agent-skills-ext.ts` | `~/.pi/agent/extensions/` | Extension |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_SKILLS_API_URL` | `http://localhost:8004` | API base URL |

---

## Usage Examples

### Search Rules

```
User: "How do I implement clean architecture in NestJS?"

pi calls: search_rules({ query: "clean architecture NestJS" })

Response: 🎓 According to CodeMentor MCP: Found 3 relevant rule(s):
### 1. Clean Architecture
Category: nestjs
Relevance: 92.5%
Tags: clean-architecture, cqrs, nestjs

Clean Architecture in NestJS separates concerns into...
```

### Agent Query

```
User: "Create a user service in NestJS"

pi calls: agent_query({ 
  message: "Create a user service in NestJS",
  projectPath: "/home/user/my-project"
})

Response: 🤖 CodeAgent is helping you:

I'll create a user service following Clean Architecture...

Files to create:
1. src/users/domain/entities/user.entity.ts
2. src/users/application/services/user.service.ts
...

📋 Issue created: Create user service in NestJS
ID: user-service-20240101

📚 Applied rules:
1. Clean Architecture (nestjs)
2. Dependency Injection (nestjs)
```

### Get Rule

```
User: "Show me the dependency injection rule"

pi calls: get_rule({ id: "dependency-injection" })

Response: 🎓 According to CodeMentor MCP: Here is the requested rule:

# Dependency Injection

ID: dependency-injection
Category: nestjs
Impact: HIGH
Tags: dependency-injection, nestjs, providers

Use NestJS DI system...
```

---

## Troubleshooting

### Connection Refused

1. Make sure Agent Skills API is running:
```bash
curl http://localhost:8004/health
```

2. If not running, start it:
```bash
cd /home/aajcr/PROYECTOS/agent-skills-api
pnpm run start:dev
```

### Tools Not Available

1. Reload pi:
```bash
pi --reload
```

2. Check extension is loaded:
```bash
pi /skills
```

### Port Conflict

If port 8004 is in use, change the port in environment:

```bash
export PORT=8005
```

And update the config:

```bash
sed -i 's/8004/8005/g' ~/.pi/agent/pi-mcp-config.json
```

---

## Files

- `~/.pi/agent/pi-mcp-config.json` - MCP server configuration
- `~/.pi/agent/extensions/agent-skills-ext.ts` - Extension with custom tools

---

## See Also

- [Agent Skills API README](../README.md)
- [MCP Configuration](MCP-CONFIG.md)
- [Pi Documentation](https://pi.dev)