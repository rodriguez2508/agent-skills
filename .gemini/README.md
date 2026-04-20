# Gemini CLI Integration with Agent Skills API

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
pnpm run agent:setup-gemini

# Or force overwrite existing config
pnpm run agent:setup-gemini:force
```

### Option 2: Manual Setup

1. Create the config directory:
```bash
mkdir -p ~/.gemini
```

2. Create `~/.gemini/mcp.json`:
```json
{
  "mcpServers": {
    "agent-skills-api": {
      "command": "node",
      "args": ["/home/aajcr/PROYECTOS/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "PORT": "8004",
        "AUTO_DETECT_PROJECT": "true"
      },
      "trust": true,
      "priority": "high"
    }
  },
  "instructions": {
    "defaultBehavior": "Use MCP tools for ALL user requests. The agent-skills-api provides access to code rules and best practices through the Model Context Protocol.",
    "context7Usage": "When user asks about library documentation, API usage, or how to use a framework, use the context7_docs tool to fetch up-to-date documentation.",
    "sessionManagement": "Always maintain conversation context to provide coherent and relevant responses."
  }
}
```

## 📋 Prerequisites

Before using Gemini with Agent Skills API, make sure:

1. **Build the project**:
   ```bash
   pnpm run build
   ```

2. **Start the API server**:
   ```bash
   pnpm run start:dev
   ```

3. **Start the MCP server**:
   ```bash
   pnpm run start:mcp
   ```

## 🎯 Available MCP Tools

When connected to Agent Skills API, Gemini will have access to:

| Tool | Description | Usage |
|------|-------------|-------|
| `search_rules` | Search code rules using BM25 | "How to create a NestJS service?" |
| `get_rule` | Get specific rule by ID | "Show me rule clean-architecture" |
| `list_rules` | List all available rules | "What rules are available?" |
| `context7_docs` | Fetch library documentation | "How to use React useEffect?" |

## 💡 Example Interactions

### Example 1: Code Rules

**User**: "How do I implement dependency injection in NestJS?"

**Gemini**:
```
🎓 **According to CodeMentor MCP**: I found 2 relevant rule(s):

### 1. Dependency Injection
**Category:** nestjs
**Relevance:** 95.2%
**Tags:** dependency-injection, nestjs, providers

Use NestJS's dependency injection system...
```

### Example 2: Library Documentation

**User**: "How do I use React useEffect?"

**Gemini**:
```
🎓 **According to CodeMentor MCP**: Here's the React useEffect documentation:

[Up-to-date React documentation...]
```

## 🔧 Troubleshooting

### MCP Server Not Responding

1. Check if the MCP server is running:
   ```bash
   pnpm run start:mcp
   ```

2. Verify the build is up to date:
   ```bash
   pnpm run build
   ```

3. Check server logs for errors

### Configuration Not Loading

1. Verify `~/.gemini/mcp.json` exists with correct configuration
2. Ensure the path to `dist/mcp-server.js` is correct
3. Restart Gemini CLI

### Tools Not Available

1. Check MCP server is running on port 8004
2. Verify the configuration file syntax
3. Check that `trust: true` is set

## 📚 Additional Resources

- [Main README](../README.md) - Project overview
- [Architecture](../doc/ARCHITECTURE.md) - System architecture
- [MCP Configuration](../doc/MCP-CONFIG.md) - Configuration for all agents
- [Instructions](./INSTRUCTIONS.md) - Detailed instructions for Gemini

## ✅ Verification Checklist

- [ ] Gemini CLI installed and configured
- [ ] `~/.gemini/mcp.json` created with correct configuration
- [ ] MCP server running (`pnpm run start:mcp`)
- [ ] Project built (`pnpm run build`)
- [ ] MCP tools responding correctly

## 🎉 You're All Set!

Gemini CLI is now integrated with Agent Skills API. Start asking questions about code rules, best practices, and library documentation!
