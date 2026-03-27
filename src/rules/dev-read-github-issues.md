---
title: Leer Issues de GitHub EXCLUSIVAMENTE con gh CLI
impact: CRITICAL
impactDescription: "ÚNICO método permitido para leer issues de GitHub. NUNCA uses web_fetch, web_search ni GitHub API REST."
tags: development, github, issues, gh-cli, mandatory
---

## Leer Issues de GitHub - Método OBLIGATORIO

**Impact: CRITICAL** — Este es el **ÚNICO** método permitido para leer issues de GitHub. Cualquier otro método está **PROHIBIDO**.

---

## ⚠️ MÉTODOS PROHIBIDOS

**NUNCA uses estos métodos:**

❌ `web_fetch` - Herramienta interna de Qwen, no respeta reglas MCP
❌ `web_search` - Herramienta interna de Qwen, no respeta reglas MCP  
❌ GitHub API REST (`https://api.github.com/...`) - Requiere autenticación adicional
❌ `curl` a URLs de GitHub - No funciona para repositorios privados
❌ Navegador web - No es automatizable

---

## ✅ MÉTODO OBLIGATORIO

**SIEMPRE usa este comando:**

```bash
gh issue view <ISSUE_NUMBER> --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
```

### Ejemplo para issue #7234

```bash
gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
```

---

## 📋 Formato del Comando

### Estructura Base

```bash
gh issue view {numero} --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
```

### Parámetros

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `numero` | Ej: `7234` | Número del issue a leer |
| `--repo` | `ThreefacesGroup/general` | Repositorio fijo (NO cambiar) |
| `--json` | `title,body,state,labels,assignees,comments` | Campos a retornar |

### Campos JSON Obligatorios

1. `title` - Título del issue
2. `body` - Descripción completa
3. `state` - Estado (OPEN/CLOSED)
4. `labels` - Etiquetas asignadas
5. `assignees` - Usuarios asignados
6. `comments` - Comentarios y discusiones

---

## 🔧 Implementación en Agentes MCP

### Cuando el Usuario Solicite Leer un Issue

**Ejemplo:** "Lee el issue https://github.com/ThreefacesGroup/general/issues/7234"

**Flujo OBLIGATORIO:**

1. **Extraer el número del issue** de la URL
   - URL: `https://github.com/ThreefacesGroup/general/issues/7234`
   - Número: `7234`

2. **Ejecutar comando gh** usando `run_shell_command`:
   ```bash
   gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
   ```

3. **Parsear output JSON** y mostrar información relevante

4. **NUNCA** intentar usar `web_fetch` o APIs HTTP

---

## 📝 Output Esperado

```json
{
  "title": "Título del Issue",
  "body": "Descripción completa del issue...",
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
      "body": "Comentario importante sobre la implementación",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  ]
}
```

---

## 🚀 Comandos Relacionados

### Ver Issue en Formato Humano

```bash
gh issue view 7234 --repo ThreefacesGroup/general
```

### Ver Solo Comentarios

```bash
gh issue view 7234 --repo ThreefacesGroup/general --comments
```

### Listar Issues Abiertos

```bash
gh issue list --repo ThreefacesGroup/general --state open
```

### Buscar Issues

```bash
gh issue list --repo ThreefacesGroup/general --search "auth JWT" --state all
```

---

## 🔄 Flujo de Trabajo Completo

### Paso 1: Leer Issue (READ)

```bash
gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
```

### Paso 2: Analizar Contenido

- ✅ Leer título para contexto general
- ✅ Leer body para requerimientos detallados
- ✅ Revisar labels para prioridad y tipo
- ✅ Leer TODOS los comentarios (ahí están las decisiones importantes)
- ✅ Ver assignees para saber quién más trabaja en esto

### Paso 3: Registrar en Sistema

```
Usuario: "Iniciar issue #7234"
   ↓
Sistema registra:
- issueId: "7234"
- workflowStep: "1_READ" ✅
- status: "in_progress"
```

### Paso 4: Actualizar Estado (Opcional)

```bash
gh issue edit 7234 --repo ThreefacesGroup/general --add-label "in-progress"
```

---

## ❌ Errores Comunes - PROHIBIDOS

### ERROR 1: Usar web_fetch

```
❌ INCORRECTO:
Herramienta: web_fetch
URL: https://github.com/ThreefacesGroup/general/issues/7234
```

**Por qué está mal:** `web_fetch` es una herramienta interna de Qwen que no respeta las reglas MCP y no funciona con repositorios privados.

### ERROR 2: Usar GitHub API REST Directamente

```
❌ INCORRECTO:
curl https://api.github.com/repos/ThreefacesGroup/general/issues/7234
```

**Por qué está mal:** Requiere autenticación OAuth/token adicional. `gh CLI` ya maneja la autenticación automáticamente.

### ERROR 3: Navegador Manual

```
❌ INCORRECTO:
"Abrir https://github.com/ThreefacesGroup/general/issues/7234 en el navegador"
```

**Por qué está mal:** No es automatizable, no se puede procesar programáticamente.

---

## ✅ Correcto - ÚNICO MÉTODO PERMITIDO

```bash
✅ CORRECTO:
gh issue view 7234 --repo ThreefacesGroup/general --json title,body,state,labels,assignees,comments
```

**Por qué es correcto:**
- ✅ Usa GitHub CLI oficial (`gh`)
- ✅ Autenticación manejada automáticamente
- ✅ Funciona con repositorios privados
- ✅ Output estructurado en JSON
- ✅ Automatizable y procesable
- ✅ Respeta las reglas MCP

---

## 🛠️ Requisitos Previos

### 1. Instalar GitHub CLI

```bash
# Ubuntu/Debian
sudo apt install gh

# macOS
brew install gh

# Windows
winget install GitHub.cli

# Arch Linux
sudo pacman -S github-cli
```

### 2. Autenticar

```bash
gh auth login
```

**Flujo de autenticación:**
1. Seleccionar GitHub.com
2. Seleccionar HTTPS
3. Login con browser o token
4. Seguir instrucciones en pantalla

### 3. Verificar Autenticación

```bash
gh auth status
```

**Output esperado:**
```
✓ Logged in to github.com as tu-usuario
✓ Token: gho_************************************
✓ Token scopes: repo, workflow
```

---

## 📋 Checklist Antes de Leer un Issue

- [ ] GitHub CLI (`gh`) instalado
- [ ] Autenticación configurada (`gh auth login`)
- [ ] Repositorio accesible para tu usuario
- [ ] Número de issue identificado
- [ ] Comando completo preparado

---

## 🔗 Referencias

- [gh issue view - Documentación Oficial](https://cli.github.com/manual/gh_issue_view)
- [GitHub CLI - Manual Completo](https://cli.github.com/manual/)
- [gh auth - Autenticación](https://cli.github.com/manual/gh_auth_login)

---

## 📌 Notas Importantes

1. **Este es el ÚNICO método permitido** - Cualquier otro método está prohibido
2. **Repositorio fijo** - Siempre usar `ThreefacesGroup/general` (no cambiar)
3. **Campos JSON fijos** - Siempre incluir `title,body,state,labels,assignees,comments`
4. **NUNCA usar web_fetch** - Está explícitamente excluido en la configuración de Qwen
5. **NUNCA usar APIs HTTP** - `gh CLI` maneja todo internamente

---

**Last Updated:** 25 de marzo de 2026  
**Author:** CodeMentor MCP - Development Chapter  
**Version:** 2.0 - Método Único Obligatorio  
**Status:** ✅ CRITICAL - De seguimiento obligatorio
