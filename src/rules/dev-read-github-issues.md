---
title: Read GitHub Issues with gh CLI
impact: HIGH
impactDescription: "Permite leer y entender issues de GitHub antes de comenzar a trabajar - esencial para el flujo de trabajo"
tags: development, github, issues, workflow, gh-cli
---

## Read GitHub Issues with gh CLI

**Impact: HIGH** — Leer completamente un issue antes de comenzar a trabajar es fundamental para entender los requerimientos y evitar retrabajo.

### Comando Base

```bash
gh issue view <ISSUE_NUMBER> --repo <OWNER>/<REPO> --json title,body,state,labels,assignees,comments,author,createdAt
```

### Ejemplo Completo

```bash
gh issue view 6808 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments,author,createdAt
```

### Output Esperado

```json
{
  "title": "Agregar autenticación con JWT",
  "body": "## Descripción\nImplementar autenticación con JWT para los endpoints de la API.\n\n## Requerimientos\n- Login con email/password\n- Generación de token JWT\n- Refresh token\n- Endpoints protegidos",
  "state": "OPEN",
  "labels": [
    {"name": "feature"},
    {"name": "priority"}
  ],
  "assignees": [
    {"login": "usuario1"}
  ],
  "comments": [
    {
      "author": {"login": "tech-lead"},
      "body": "Usar bcrypt para hashear passwords",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ],
  "author": {"login": "product-owner"},
  "createdAt": "2026-03-19T09:00:00Z"
}
```

## Flujo de Trabajo con Issues

### Paso 1: Leer el Issue

```bash
# Ver issue completo
gh issue view <NUM> --repo <OWNER>/<REPO> --json title,body,state,labels,assignees,comments,author,createdAt

# O en formato humano
gh issue view <NUM> --repo <OWNER>/<REPO>
```

### Paso 2: Analizar Requerimientos

Extraer del output:
- ✅ **Título**: Descripción general del problema
- ✅ **Body**: Requerimientos detallados
- ✅ **Labels**: Prioridad y tipo (feature, bug, etc.)
- ✅ **Comments**: Discusiones y decisiones técnicas
- ✅ **Assignees**: Quién más está trabajando

### Paso 3: Registrar en el Sistema

Una vez leído el issue, registrar en el sistema:

```
Usuario: "Iniciar issue #6808 - Agregar autenticación con JWT"
   ↓
Sistema crea Issue en BD con:
- issueId: "6808"
- title: "Agregar autenticación con JWT"
- requirements: Extraídos del body
- status: "in_progress"
- workflowStep: "1_READ" ✅ (completado)
```

### Paso 4: Seguir Trabajando

```bash
# Ver comentarios nuevos
gh issue view <NUM> --repo <OWNER>/<REPO> --comments

# Actualizar estado del issue
gh issue edit <NUM> --repo <OWNER>/<REPO> --add-label "in-progress"

# Cuando esté completo
gh issue close <NUM> --repo <OWNER>/<REPO> --reason completed
```

## Comandos Útiles Adicionales

### Listar issues abiertos
```bash
gh issue list --repo <OWNER>/<REPO> --state open --label feature
```

### Crear nuevo issue
```bash
gh issue create --repo <OWNER>/<REPO> --title "Titulo" --body "Descripción"
```

### Buscar issues
```bash
gh issue list --repo <OWNER>/<REPO> --search "auth JWT" --state all
```

### Ver issue con comentarios
```bash
gh issue view <NUM> --repo <OWNER>/<REPO> --comments
```

## Integración con el Flujo de 9 Pasos

Esta regla se aplica en el **Paso 1: READ** del flujo de issues:

```
1. READ ✅ ← gh issue view
2. ANALYZE
3. PLAN
4. CODE
5. TEST
6. COMMIT
7. PUSH
8. CREATE PR.md
9. CREATE PR
```

## Errores Comunes

### ❌ INCORRECTO
- Empezar a codificar sin leer el issue completo
- No revisar los comentarios (ahí están las decisiones importantes)
- Ignorar los labels (prioridad, tipo)

### ✅ CORRECTO
- Leer título, body, labels Y comentarios
- Extraer requerimientos explícitos e implícitos
- Registrar el issue en el sistema antes de comenzar
- Actualizar el estado mientras trabajas

## Ejemplo de Script de Automatización

```bash
#!/bin/bash
# read-issue.sh - Lee un issue y lo formatea para registro

REPO="ThreefacesGroup/general"
ISSUE_NUM=$1

if [ -z "$ISSUE_NUM" ]; then
  echo "Uso: read-issue.sh <ISSUE_NUMBER>"
  exit 1
fi

echo "📖 Leyendo issue #$ISSUE_NUM de $REPO..."

gh issue view $ISSUE_NUM --repo $REPO --json title,body,state,labels,assignees,comments,author,createdAt | \
  jq -r '"## Issue #\(.title)\n\n**Estado:** \(.state)\n**Autor:** \(.author.login)\n**Creado:** \(.createdAt)\n\n## Descripción\n\(.body)\n\n## Labels\n\(.labels | map(.name) | join(", "))\n\n## Assignees\n\(.assignees | map(.login) | join(", "))\n\n## Comentarios (\(.comments | length))\n\(.comments | map("> **\(.author.login)** (\(.createdAt))\n> \(.body)") | join("\n\n"))"'

echo ""
echo "✅ Issue leído. Ahora registra en el sistema:"
echo "   \"Iniciar issue #$ISSUE_NUM - [título del issue]\""
```

## Herramientas Requeridas

- [GitHub CLI (gh)](https://cli.github.com/) - Instalar con:
  ```bash
  # macOS
  brew install gh
  
  # Ubuntu/Debian
  sudo apt install gh
  
  # Windows
  winget install GitHub.cli
  ```

- Autenticación:
  ```bash
  gh auth login
  ```

## Referencias

- [gh issue view documentation](https://cli.github.com/manual/gh_issue_view)
- [GitHub CLI manual](https://cli.github.com/manual/)
