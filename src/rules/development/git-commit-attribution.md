---
title: Git Commit Attribution Rule
impact: HIGH
impactDescription: "Commit messages must not include AI authorship trailers"
tags: git, commit, attribution, co-authored-by, ai
---

# Git Commit Attribution Rule

**Impact: HIGH** — Los commits deben reflejar únicamente autores humanos reales.

## Regla

**Nunca** agregar `Co-Authored-By` ni ningún trailer de autoría a los commits, especialmente referencias a IAs.

## Por qué

- `Co-Authored-By` es un estándar de GitHub para **personas reales** con emails reales
- Una IA es una herramienta, no un autor — usarla como coautor es semánticamente incorrecto
- Ensucia el historial y puede confundir a otros colaboradores
- GitHub muestra el avatar del "coautor" en el commit, generando ruido visual

## Incorrecto

```
feat: add user authentication

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>
```

## Correcto

```
feat: add user authentication
```

## Aplica a

Todos los commits, en todos los proyectos, independientemente de si el código fue generado con ayuda de IA.
