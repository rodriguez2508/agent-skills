# Git Commit Rule

## 🎯 Purpose

Ensure clean, focused, and reviewable git commits by following best practices.

---

## 📋 Rules

### 1. **NEVER commit without user permission**

Always ask: "Shall I commit these changes?" before running `git commit`.

### 2. **Verify branch before commit (CRITICAL)**

**NEVER commit to development/main branches directly!**

Before committing, always verify:

```bash
# Check current branch
$ git branch --show-current

# ❌ WRONG - If on protected branch
$ git branch --show-current
development  ← STOP! Don't commit here!

# ✅ CORRECT - Create feature branch first
$ git checkout -b feature/ISSUE-123-description
$ git branch --show-current
feature/ISSUE-123-description  ← OK to commit

# ✅ Also OK - If on fix/test branch
$ git branch --show-current
fix/login-bug  ← OK to commit
```

**Protected branches (NEVER commit directly):**
- `development` / `dev`
- `main` / `master`
- `production` / `prod`
- `release/*`

**Allowed branches (OK to commit):**
- `feature/*`
- `fix/*`
- `hotfix/*`
- `chore/*`
- `test/*`
- `docs/*`

### 3. **Commit message format**

```
<type>: <short description>

- Item 1
- Item 2
- Item 3
...
(max 8 items)
```

### 4. **Commit message language: English**

All commit messages must be in **English**.

### 5. **Keep commits focused**

Each commit should address **one logical change** only.

### 6. **Maximum 8 bullet points**

Keep the commit message body to **8 items or less**.

---

## 🛠️ Commit Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code refactoring |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

---

## ✅ Correct Behavior

### ❌ WRONG (Don't do this):

```bash
# Committing without asking
$ git add -A
$ git commit -m "Updated code"

# Committing to development branch (WRONG!)
$ git branch --show-current
development
$ git add -A
$ git commit -m "feat: add new feature"  ← STOP! Wrong branch!
```

### ✅ CORRECT (Do this):

```bash
# Step 1: Verify branch
$ git branch --show-current
feature/ISSUE-123-vector-storage  ← OK to commit

# Step 2: Ask for permission
Assistant: "I've made the following changes:
- Fixed SearchAgent type safety
- Added vector storage integration
- Updated app.module.ts

Shall I commit these changes?"

[User confirms]

# Step 3: Commit
$ git add -A
$ git commit -m "feat: add vector storage integration

- Add IVectorStore interface and types
- Implement InMemoryVectorStore
- Implement ChromaDBVectorStore
- Add EmbeddingService
- Create VectorStoreFactory
- Add VectorStorageModule
- Integrate with SearchAgent
- Add unit tests"
```

---

## 📝 Commit Message Examples

### Good Examples:

```
fix: apply code quality improvements and bug fixes

- Fix RULES_PATH consistency in RulesEngine and RuleFileRepository
- Fix type safety in SearchRulesHandler and SearchAgent
- Fix BM25 search delegation to BM25Engine
- Fix RulesEngine recursive directory loading
- Fix parameter validation in RulesController
- Fix SearchAgent keywords for routing
- Fix Response type in McpService.createSession()
- Optimize SearchAgent with caching
```

```
docs: add testing guide for Vector Storage

- Add comprehensive testing guide
- Include Qwen MCP configuration examples
- Document expected logs and success criteria
- Add troubleshooting section
- Provide example Qwen conversation
```

### Bad Examples:

```
# ❌ Too vague
fix: stuff

# ❌ Too long
fix: fixed a lot of things including the search agent, the vector store, 
the embedding service, the factory, the module, the controllers, the tests, 
the types, the interfaces, and also updated the documentation and added 
some new features that were requested

# ❌ In wrong language
fix: agregué el vector storage y arreglé errores
```

---

## 📄 Creating PR.md (Pull Request Summary in Spanish)

**Before creating a Pull Request, create a `PR.md` file with the summary in Spanish.**

### PR.md Template

```markdown
# Pull Request: #[ISSUE_NUMBER] - [Título del Issue]

## Resumen
[Descripción breve en español de qué hace este PR y por qué es necesario]

## Cambios Realizados

### Nuevos Archivos
- `src/path/to/new-file.ts` - Descripción de lo que hace

### Archivos Modificados
- `src/path/to/modified-file.ts` - Qué se cambió y por qué

### Archivos Eliminados
- `src/path/to/deleted-file.ts` - Por qué se eliminó

## Tipo de Cambio
- [ ] 🚀 New feature (nueva funcionalidad)
- [ ] 🐛 Bug fix (corrección de error)
- [ ] 📝 Documentation (documentación)
- [ ] ♻️ Refactor (refactorización)
- [ ] 🎨 Style (estilo, sin cambios de lógica)
- [ ] ⚡ Performance (mejora de rendimiento)
- [ ] 🧪 Tests (agregar/modificar tests)
- [ ] 🔧 Chore (tareas de mantenimiento)

## Checklist de Calidad
- [ ] ✅ Type check passed (`pnpm run typecheck`)
- [ ] ✅ Build passed (`pnpm run build`)
- [ ] ✅ Tests pass (`pnpm test`)
- [ ] ✅ No hay console.log() de debug
- [ ] ✅ No hay código comentado innecesario
- [ ] ✅ Los nombres de variables son descriptivos
- [ ] ✅ Las funciones tienen un solo propósito
- [ ] ✅ Se siguió Clean Architecture

## Issue Relacionado
- Closes #[ISSUE_NUMBER]
- Related to #[OTHER_ISSUE]

## Capturas de Pantalla (si aplica)
[Agregar screenshots o GIFs del cambio]

## Notas Adicionales
[Cualquier información adicional que los reviewers deban saber]

## Comandos para Probar
```bash
# Instalar dependencias
pnpm install

# Correr type check
pnpm run typecheck

# Correr build
pnpm run build

# Correr tests
pnpm test

# Iniciar servidor de desarrollo
pnpm run start:dev
```
```

### Ejemplo de PR.md Completo

```markdown
# Pull Request: #6808 - Agregar Autenticación con JWT

## Resumen
Este PR implementa autenticación con JWT para los endpoints de la API, permitiendo a los usuarios loguearse con email/password y recibir un token que deben incluir en requests posteriores.

## Cambios Realizados

### Nuevos Archivos
- `src/modules/auth/auth.module.ts` - Módulo de autenticación
- `src/modules/auth/auth.controller.ts` - Controlador con endpoints /login y /register
- `src/modules/auth/auth.service.ts` - Servicio con lógica de autenticación
- `src/modules/auth/dto/login.dto.ts` - DTO para validación de login
- `src/modules/auth/guards/jwt-auth.guard.ts` - Guard para proteger rutas
- `src/modules/auth/strategies/jwt.strategy.ts` - Estrategia de validación JWT

### Archivos Modificados
- `src/app.module.ts` - Importar AuthModule
- `src/modules/users/user.entity.ts` - Agregar campo passwordHash
- `.env.example` - Agregar JWT_SECRET y JWT_EXPIRES_IN

### Migraciones de Base de Datos
- `1711152000008-AddPasswordToUsers.ts` - Agregar columna password_hash

## Tipo de Cambio
- [x] 🚀 New feature (nueva funcionalidad)
- [ ] 🐛 Bug fix (corrección de error)
- [ ] 📝 Documentation (documentación)
- [ ] ♻️ Refactor (refactorización)
- [ ] 🎨 Style (estilo, sin cambios de lógica)
- [ ] ⚡ Performance (mejora de rendimiento)
- [x] 🧪 Tests (agregar/modificar tests)
- [ ] 🔧 Chore (tareas de mantenimiento)

## Checklist de Calidad
- [x] ✅ Type check passed
- [x] ✅ Build passed
- [x] ✅ Tests pass (15 nuevos tests)
- [x] ✅ No hay console.log() de debug
- [x] ✅ No hay código comentado innecesario
- [x] ✅ Los nombres de variables son descriptivos
- [x] ✅ Las funciones tienen un solo propósito
- [x] ✅ Se siguió Clean Architecture

## Issue Relacionado
- Closes #6808
- Blocks #6809 (Perfil de usuario)
- Related to #6800 (Sistema de usuarios)

## Comandos para Probar
```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test

# Probar login
curl -X POST http://localhost:8004/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Probar endpoint protegido
curl http://localhost:8004/auth/profile \
  -H "Authorization: Bearer <TOKEN_JWT>"
```
```

---

## 📋 Pre-Commit Checklist

**Before committing, ALWAYS verify:**

### 1. ✅ Branch Verification

```bash
$ git branch --show-current
```

- ❌ If `development`, `main`, `master` → **STOP!** Create feature branch
- ✅ If `feature/*`, `fix/*`, `hotfix/*` → OK to commit

### 2. ✅ Changes Review

```bash
$ git status
$ git diff --staged
```

- Review all changed files
- Ensure no sensitive data (passwords, keys)
- Remove debug/console.log statements

### 3. ✅ Code Quality

```bash
$ pnpm run typecheck  # or npm run typecheck
$ pnpm run build      # or npm run build
$ pnpm test           # or npm test
```

- No TypeScript errors
- Build succeeds
- Tests pass

### 4. ✅ Commit Message

- [ ] Uses conventional commit type (feat, fix, docs, etc.)
- [ ] Written in English
- [ ] Short and descriptive (max 50 chars for subject)
- [ ] Body has max 8 bullet points
- [ ] References issue/PR if applicable

### 5. ✅ User Permission

- [ ] Asked user: "Shall I commit these changes?"
- [ ] User confirmed

---

## 🚦 When to Ask for Commit

### Ask for commit when:

- ✅ Code changes are complete
- ✅ Tests pass
- ✅ Type check passes (`tsc --noEmit`)
- ✅ Build succeeds
- ✅ Ready for review

### Don't ask yet when:

- ⏳ Work is in progress
- ⏳ Tests are failing
- ⏳ Type errors exist
- ⏳ More changes planned

---

## 💡 Best Practices

### 1. Stage related changes together

```bash
# Group by feature, not by file
git add src/infrastructure/vector-storage/*.ts
```

### 2. Write clear, imperative messages

```
# ✅ Good
feat: add vector storage

# ❌ Bad
added vector storage stuff
```

### 3. Keep commits atomic

```
# ✅ One feature per commit
Commit 1: feat: add vector storage
Commit 2: docs: add vector storage guide

# ❌ Mixed concerns
Commit 1: feat: add vector storage and docs and fix tests
```

### 4. Reference issues/PRs when relevant

```
fix: resolve port conflict in MCP server

Closes #123
```

---

## 🎓 According to CodeMentor MCP

**Rule ID**: `git-commit-001`

**Category**: Development Workflow

**Priority**: 🔴 CRITICAL

**Applies to**: All git operations

---

## 📝 Summary

### DO:
- ✅ Ask before committing
- ✅ **Verify branch is not development/main/master**
- ✅ Use English for messages
- ✅ Keep messages under 8 bullet points
- ✅ Use conventional commit types
- ✅ Make atomic commits
- ✅ Run typecheck and build before commit
- ✅ **Create PR.md in Spanish before creating PR**

### DON'T:
- ❌ Commit without permission
- ❌ **Commit to development/main/master branches**
- ❌ Use vague messages like "fix stuff"
- ❌ Write messages in multiple languages
- ❌ Mix unrelated changes in one commit
- ❌ Write essays in commit messages
- ❌ Skip typecheck/build verification
- ❌ **Create PR without PR.md summary**

---

**Last Updated**: 24 de marzo de 2026
**Author**: CodeMentor MCP
**Version**: 3.0 (Added PR.md template in Spanish)
