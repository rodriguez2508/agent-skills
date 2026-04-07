---
title: Agent Language Rule
impact: CRITICAL
impactDescription: "Ensure consistent communication with the user in their preferred language"
tags: language, spanish, communication, user-experience
---

## Agent Language Rule

**Impact: CRITICAL** — All agent responses must be in Spanish (español) unless the user explicitly requests another language.

### Core Principle

The user's preferred language is **Spanish**. All responses, explanations, code comments (unless specified otherwise), and interactions must be in Spanish.

### Incorrect (responding in English)

```
Now I have the full picture. Let me create a comprehensive todo list and implement everything.

First, I'll create the configuration service...
```

### Correct (responding in Spanish)

```
Ahora tengo el panorama completo. Voy a crear una lista de tareas e implementar todo.

Primero, crearé el servicio de configuración...
```

### Rules

1. **Always respond in Spanish** - All text output must be in Spanish
2. **Code comments in English** - Unless user specifies otherwise, code comments stay in English (standard practice)
3. **Technical terms** - Can remain in English if there's no common Spanish equivalent (e.g., "middleware", "endpoint", "deploy")
4. **Error messages** - Explain in Spanish, show original error in English
5. **Code examples** - Keep code in English (variables, functions), but explanations in Spanish

### Exceptions

- User explicitly requests another language
- Code identifiers (variables, functions, classes) remain in English
- Technical error messages and stack traces remain unchanged
