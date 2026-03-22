# Development Server Rule

## 🎯 Purpose

Ensure user control and safety by **NEVER starting servers automatically**. Servers must always be started manually by the user.

---

## 📋 Rule

**NEVER start development or production servers automatically without explicit user request.**

This applies to:
- Development servers (`npm run start:dev`, `pnpm run start:dev`, `ng serve`, etc.)
- Production servers (`npm run start:prod`, `node dist/main`, etc.)
- Database servers (`docker-compose up`, `mongod`, `redis-server`, etc.)
- Any long-running process

---

## 🔍 Why?

1. **Port conflicts** - User might already have something running on that port
2. **Resource management** - User might want to control when resources are used
3. **Security** - User should be aware of what's running
4. **Debugging** - User needs to see server logs in their terminal
5. **Context awareness** - User might be in a meeting, debugging, or have other processes running

---

## ✅ Correct Behavior

### ❌ WRONG (Don't do this):

```
User: "How do I test the API?"

Assistant: [Automatically runs]
$ pnpm run start:dev

[Server starts without permission]
```

### ✅ CORRECT (Do this):

```
User: "How do I test the API?"

Assistant: "You can start the development server with:

```bash
pnpm run start:dev
```

Then test the API with:
```bash
curl http://localhost:8004/health
```

Would you like me to start the server for you?"
```

---

## 🛠️ How to Apply

### When User Asks to Test/Run/Start:

1. **Provide the command** - Show them how to do it
2. **Ask for permission** - "Would you like me to start it?"
3. **Wait for confirmation** - Only start if user explicitly says yes

### Example Interactions:

#### Scenario 1: User wants to test API

```
User: "How can I test the vector storage?"

Assistant: "You can test it by:

1. Start the server:
   ```bash
   pnpm run start:dev
   ```

2. Then call the API:
   ```bash
   curl "http://localhost:8004/rules/search?q=Clean%20Architecture"
   ```

Would you like me to start the server now?"
```

#### Scenario 2: User wants to run tests

```
User: "Run the tests"

Assistant: "I'll run the tests for you:

```bash
pnpm run test
```

[Then executes the command - tests are short-lived, not servers]
```

#### Scenario 3: User wants to build

```
User: "Build the project"

Assistant: "I'll build the project:

```bash
pnpm run build
```

[Then executes the command - build is short-lived]
```

---

## 🚦 What's Considered a "Server"?

### ❌ Servers (DON'T start automatically):

| Command | Type | Why |
|---------|------|-----|
| `npm run start:dev` | Development server | Long-running |
| `npm run start:prod` | Production server | Long-running |
| `ng serve` | Angular dev server | Long-running |
| `nest start --watch` | NestJS dev server | Long-running |
| `docker-compose up` | Container orchestration | Long-running |
| `mongod` | Database server | Long-running |
| `redis-server` | Cache server | Long-running |
| `node server.js` | Node.js server | Long-running |

### ✅ Safe to Run Automatically:

| Command | Type | Why |
|---------|------|-----|
| `npm run test` | Test runner | Short-lived |
| `npm run build` | Build process | Short-lived |
| `npm run lint` | Linting | Short-lived |
| `npm run typecheck` | Type checking | Short-lived |
| `git status` | Git command | Short-lived |
| `curl http://...` | HTTP request | Short-lived |

---

## 💡 Best Practices

### 1. Always Ask First

```
"To test this, you'll need to start the server first. Would you like me to:
1. Start the server now
2. Just show you the command"
```

### 2. Provide Clear Instructions

```
"To start the server manually:

```bash
pnpm run start:dev
```

The server will run on http://localhost:8004"
```

### 3. Warn About Port Conflicts

```
"⚠️ Note: Make sure port 8004 is not already in use.

To check:
```bash
lsof -i :8004
```

To kill existing process:
```bash
kill -9 <PID>
```"
```

### 4. Remind About Background Processes

```
"💡 Tip: You can run the server in background with:

```bash
pnpm run start:dev &
```

Or use a process manager like PM2:
```bash
pm2 start dist/main --name agent-skills-api
```"
```

---

## 🎓 According to CodeMentor MCP

**Rule ID**: `development-server-001`

**Category**: Development Workflow

**Priority**: 🔴 CRITICAL

**Applies to**: All projects with servers (NestJS, Angular, Express, etc.)

---

## 📝 Summary

### DO:
- ✅ Provide commands for user to run manually
- ✅ Ask for explicit permission before starting servers
- ✅ Warn about port conflicts
- ✅ Explain how to stop servers

### DON'T:
- ❌ Start servers without asking
- ❌ Assume user wants server running
- ❌ Run long-running processes in background without permission
- ❌ Hide server output from user

---

## 🔗 Related Rules

- [TypeScript Type Checking](./typescript/type-checking.md) - Always run `tsc --noEmit` before build
- [Clean Architecture](./nestjs/clean-architecture.md) - NestJS architecture patterns

---

**Last Updated**: 21 de marzo de 2026
**Author**: CodeMentor MCP
