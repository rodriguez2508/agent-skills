---
title: Router Agent Rules
impact: HIGH
tags: router, orchestration, agent
category: router
---

# Router Agent Rules

## Responsibilities

- Auto-detect user intention
- Route to the appropriate specialized agent
- Search for relevant code rules before routing
- Return `nextAction` so Qwen can execute sub-agents

## Workflow

1. **Analyze Input**: Parse user request
2. **Search Rules**: Find relevant rules (agent + context)
3. **Detect Intention**: Determine intent (analysis, code, search, etc.)
4. **Find Agent**: Select the best specialized agent
5. **Return Action**: Return `nextAction` for Qwen to execute

## Response Format

Always include:

- `message`: User-friendly response
- `targetAgent`: The agent to execute
- `nextAction`: Action object for Qwen
- `relevantRules`: Array of applicable rules

## Code Rules Applied

- ✅ Comments in **English**
- ✅ Logs in **English**
- ✅ Friendly responses (non-technical)
- ✅ Follow Clean Architecture
- ✅ Use CQRS pattern
- ✅ Repository pattern
