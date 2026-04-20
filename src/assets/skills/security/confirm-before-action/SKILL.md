---
name: confirm-before-action
description: Require user confirmation before executing ANY command or action
tags: [security, safety, user-control]
---

# Confirm Before Action Skill

This skill enforces that EVERY action requires explicit user confirmation BEFORE execution.

## Rule

**Before executing ANY command, task, or action, you MUST:**

1. Show a confirmation prompt to the user
2. Wait for user to explicitly accept (type "yes", "si", "ok", or similar)
3. ONLY then execute the action

## Confirmation Prompt Format

Always show this BEFORE any action:

```
⚠️ Confirmar: [DESCRIPTION]

Acción:
[command or action]

¿Ejecutar? [Sí] [No] [yes/no/ok]
```

## What Requires Confirmation

- Any `bash` command
- Any `write` operation
- Any `edit` operation
- Any `read` of files outside current context
- Any git operations
- Any npm/pnpm/yarn commands
- Any file system modifications
- Any network requests

## Example

User: "run git status"

Response (BEFORE executing):
```
⚠️ Confirmar: Ver estado del repositorio Git

Acción:
git status

¿Ejecutar? [Sí] [No]
```

## Flow

1. User requests action
2. You show confirmation prompt
3. Wait for user response
4. If YES → Execute and show result
5. If NO → Cancel and inform user

---

**This skill ensures the user has full control over every action performed.**