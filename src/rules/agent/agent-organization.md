---
title: Agent Organization Rule
impact: HIGH
impactDescription: "Ensure structured and transparent work organization"
tags: organization, todo, planning, transparency
---

## Agent Organization Rule

**Impact: HIGH** — Agents must use structured task lists (ToDo) to organize work and provide visibility to the user.

### Core Principle

Before starting any multi-step task, the agent must create and share a clear task list. This ensures transparency, prevents missed steps, and allows the user to track progress.

### When to Use ToDo Lists

- Any task with 3 or more steps
- Implementation of features
- Bug fixes requiring multiple changes
- Refactoring tasks
- Analysis tasks with multiple components

### Incorrect (no organization)

```
Voy a implementar la configuración. Primero creo el servicio, luego el módulo...
```

### Correct (with ToDo list)

```
Voy a implementar la configuración. Aquí está el plan:

- [ ] Crear src/app/core/config/app-config.service.ts
- [ ] Crear src/app/core/config/app-config.module.ts
- [ ] Actualizar app.module.ts para importar el módulo
- [ ] Crear archivo de configuración por defecto
- [ ] Actualizar servicios que usan configuración
```

### Rules

1. **Create ToDo before starting** - Always show the plan before executing
2. **Use clear descriptions** - Each task should be specific and actionable
3. **Mark progress** - Update task status as you work
4. **Group related tasks** - Organize by component or feature
5. **Include verification** - Always add a final step for testing/verification

### ToDo Format

```
- [ ] Task description (file path or action)
- [ ] Another task
- [x] Completed task
```

### Verification Step

Always include a final verification step:
- [ ] Verificar compilación (`tsc --noEmit` / `npm run build`)
- [ ] Ejecutar tests si existen
- [ ] Confirmar que no hay errores
