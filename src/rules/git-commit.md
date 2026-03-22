# Git Commit Rule

## 🎯 Purpose

Ensure clean, focused, and reviewable git commits by following best practices.

---

## 📋 Rules

### 1. **NEVER commit without user permission**

Always ask: "Shall I commit these changes?" before running `git commit`.

### 2. **Commit message format**

```
<type>: <short description>

- Item 1
- Item 2
- Item 3
...
(max 8 items)
```

### 3. **Commit message language: English**

All commit messages must be in **English**.

### 4. **Keep commits focused**

Each commit should address **one logical change** only.

### 5. **Maximum 8 bullet points**

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
```

### ✅ CORRECT (Do this):

```
Assistant: "I've made the following changes:
- Fixed SearchAgent type safety
- Added vector storage integration
- Updated app.module.ts

Shall I commit these changes?"

[User confirms]

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
- ✅ Use English for messages
- ✅ Keep messages under 8 bullet points
- ✅ Use conventional commit types
- ✅ Make atomic commits

### DON'T:
- ❌ Commit without permission
- ❌ Use vague messages like "fix stuff"
- ❌ Write messages in multiple languages
- ❌ Mix unrelated changes in one commit
- ❌ Write essays in commit messages

---

**Last Updated**: 21 de marzo de 2026
**Author**: CodeMentor MCP
