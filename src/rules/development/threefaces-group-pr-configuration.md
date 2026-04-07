---
title: ThreefacesGroup - Pull Request Configuration
impact: CRITICAL
impactDescription: "Configuración OBLIGATORIA para PRs en repositorios ThreefacesGroup"
tags: threefaces-group, git, pull-request, development-branch, mandatory
---

## ThreefacesGroup - Pull Request Configuration

**Impact: CRITICAL** — Todos los PRs en repositorios de ThreefacesGroup deben seguir esta configuración.

---

## ⚠️ CONFIGURACIÓN OBLIGATORIA

### Rama Base para PRs

**SIEMPRE usa `development` como rama base:**

```bash
✅ CORRECTO:
gh pr create --base development --head feature/ISSUE-123-description

❌ PROHIBIDO:
gh pr create --base main --head feature/ISSUE-123-description
gh pr create --base master --head feature/ISSUE-123-description
```

### Regla de Oro

> **NUNCA hagas PR directamente a `main` o `master`**
> 
> La rama `development` es la rama de integración principal.
> 
> `main`/`master` solo reciben merges desde `development` después de testing en producción.

---

## 📋 Flujo de Trabajo para PRs

### Paso 1: Verificar Rama Base

Antes de crear el PR, verifica que estás en la rama correcta:

```bash
# Verificar rama actual
git branch --show-current
# Debe ser: feature/ISSUE-XXX-descripcion

# Verificar remote
git remote -v
# Debe apuntar a: git@github.com:ThreefacesGroup/<repo>.git
```

### Paso 2: Crear PR.md (Resumen en Español)

El archivo `PR.md` debe estar en español y seguir el template:

```markdown
# Pull Request: #ISSUE_NUMBER - [Título del Issue]

## Resumen
[Descripción breve en español]

## Cambios Realizados

### Nuevos Archivos
- `src/path/to/file.ts` - Descripción

### Archivos Modificados
- `src/path/to/file.ts` - Qué cambió

## Tipo de Cambio
- [ ] 🚀 New feature
- [ ] 🐛 Bug fix
- [ ] 📝 Documentation
- [ ] ♻️ Refactor
- [ ] ⚡ Performance
- [ ] 🧪 Tests
- [ ] 🔧 Chore

## Checklist de Calidad
- [ ] ✅ Type check passed
- [ ] ✅ Build passed
- [ ] ✅ Tests pass
- [ ] ✅ No console.log() de debug
- [ ] ✅ Se siguió Clean Architecture

## Issue Relacionado
- Closes #ISSUE_NUMBER

## Comandos para Probar
```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```
```

### Paso 3: Push de la Rama

```bash
# Push de la rama feature
git push origin feature/ISSUE-123-description
```

### Paso 4: Crear PR con gh CLI

**Comando OBLIGATORIO:**

```bash
gh pr create \
  --title "feat: Issue #123 - Descripción corta" \
  --body-file PR.md \
  --head feature/ISSUE-123-descripcion \
  --base development
```

**Parámetros CRÍTICOS:**

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `--title` | `feat: Issue #XXX - ...` | Formato convencional |
| `--body-file` | `PR.md` | Resumen en español |
| `--head` | `feature/ISSUE-XXX` | Tu rama feature |
| `--base` | **`development`** | ⚠️ NUNCA main/master |

---

## 🚫 Errores Prohibidos

### ERROR 1: Usar `--base main`

```bash
❌ PROHIBIDO:
gh pr create --base main

❌ PROHIBIDO:
gh pr create --base master
```

**Por qué está mal:** `main` y `master` son ramas protegidas que solo reciben merges desde `development`.

### ERROR 2: No especificar `--base`

```bash
❌ PROHIBIDO:
gh pr create --head feature/ISSUE-123
# GitHub usará la rama por defecto (puede ser main!)
```

**Por qué está mal:** Sin `--base` explícito, GitHub puede usar `main` por defecto.

### ERROR 3: Commit de PR.md

```bash
❌ PROHIBIDO:
git add PR.md && git commit -m "docs: add PR description"
```

**Por qué está mal:** `PR.md` es temporal, SOLO se usa como body del PR.

### ERROR 4: PR.md en Inglés

```markdown
❌ PROHIBIDO:
# Pull Request
## Summary
[English text...]
```

**Por qué está mal:** El resumen del PR debe estar en **español** para el equipo.

---

## ✅ Ejemplo Completo

### Contexto

- Issue: #7234
- Repo: ThreefacesGroup/general
- Rama: `feature/7234-mcp-github-issue-reader`

### Comandos

```bash
# 1. Verificar rama
$ git branch --show-current
feature/7234-mcp-github-issue-reader

# 2. Verificar cambios
$ git status
On branch feature/7234-mcp-github-issue-reader
Changes to be committed:
  new file:   src/rules/dev-read-github-issues.md
  modified:   .qwen/INSTRUCTIONS.md

# 3. Push de la rama
$ git push origin feature/7234-mcp-github-issue-reader

# 4. Crear PR (COMANDO CRÍTICO)
$ gh pr create \
  --title "feat: Issue #7234 - Leer issues con gh CLI" \
  --body-file PR.md \
  --head feature/7234-mcp-github-issue-reader \
  --base development

# Output esperado:
# https://github.com/ThreefacesGroup/general/pull/456
```

### Resultado Esperado

- ✅ PR creado en `https://github.com/ThreefacesGroup/general/pull/456`
- ✅ Rama base: `development`
- ✅ Body del PR: Contenido de `PR.md` en español
- ✅ Labels automáticos aplicados

---

## 🔗 Referencias

- [ThreefacesGroup Git Workflow](./dev-issue-workflow.md)
- [Git Commit Rule](./git-commit.md)
- [gh pr create documentation](https://cli.github.com/manual/gh_pr_create)

---

## 📝 Checklist Antes de Crear PR

- [ ] ✅ Rama actual es `feature/*`, `fix/*`, o `hotfix/*`
- [ ] ✅ **NO** estás en `development`, `main`, o `master`
- [ ] ✅ `PR.md` creado en **español**
- [ ] ✅ `PR.md` **NO** está stageado para commit
- [ ] ✅ Push de la rama completado
- [ ] ✅ Comando `gh pr create` incluye `--base development`
- [ ] ✅ Título del PR sigue conventional commits

---

**Last Updated:** 25 de marzo de 2026
**Author:** CodeMentor MCP - ThreefacesGroup Standards
**Version:** 1.0 - Configuración Obligatoria
**Status:** ✅ CRITICAL - De seguimiento obligatorio para todos los PRs
