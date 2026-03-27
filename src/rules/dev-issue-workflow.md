---
title: Complete Issue Workflow - From Read to PR
impact: CRITICAL
impactDescription: "Standard workflow for handling issues from start to finish - ensures consistency and traceability"
tags: development, workflow, issue, git, pr, commit
---

## Complete Issue Workflow - From Read to PR

**Impact: CRITICAL** — Following a standardized workflow for issues ensures traceability, consistency, and allows resuming work across sessions.

### Workflow Steps

```
┌─────────────┐
│ 1. READ     │ ← Understand the issue requirements
│    ISSUE    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 2. ANALYZE  │ ← Check architecture, existing code, dependencies
│    CONTEXT  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. PLAN     │ ← Define implementation steps based on architecture
│    STEPS    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 4. CODE     │ ← Implement following Clean Architecture + rules
│    SOLUTION │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 5. TEST     │ ← Verify implementation works correctly
│    & VERIFY │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 6. COMMIT   │ ← Atomic commits with conventional commits
│    CHANGES  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 7. PUSH     │ ← Push to feature branch
│    TO BRANCH│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 8. CREATE   │ ← Document changes in PR.md
│    PR.md    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 9. CREATE   │ ← Open PR with description
│    PULL     │
│    REQUEST  │
└─────────────┘
```

### Step 1: Read Issue

**Actions:**
- Extract issue ID, title, and description
- Identify requirements and acceptance criteria
- Note any linked issues or dependencies

**Example:**
```
Issue #123: Add user authentication with JWT
Requirements:
- Login endpoint with email/password
- JWT token generation
- Token refresh mechanism
- Protected routes
```

### Step 2: Analyze Context

**Actions:**
- Check existing authentication implementation
- Review architecture (Clean Architecture layers)
- Identify affected modules
- Check for similar patterns in codebase

**Questions to answer:**
- ¿Qué capa del dominio afecta?
- ¿Hay servicios existentes que deba modificar?
- ¿Qué repositorios necesito?
- ¿Qué endpoints debo crear/modificar?

### Step 3: Plan Steps

**Create implementation plan based on architecture:**

```markdown
## Implementation Plan

### Domain Layer
- [ ] Create User entity with email, password, roles
- [ ] Create AuthToken value object
- [ ] Define UserRepository port
- [ ] Define AuthTokenProvider port

### Application Layer
- [ ] Create LoginCommand handler
- [ ] Create GenerateTokenCommand handler
- [ ] Create AuthApplicationService

### Infrastructure Layer
- [ ] Implement UserRepository with TypeORM
- [ ] Implement JwtTokenProvider
- [ ] Create database migration for users table

### Presentation Layer
- [ ] Create AuthController with POST /login
- [ ] Create AuthController with POST /refresh
- [ ] Add AuthGuard for protected routes
```

### Step 4: Code Solution

**Follow these rules while coding:**
- Use Dependency Injection (constructor injection)
- Apply Clean Architecture (dependencies toward domain)
- Use Repository pattern for data access
- Apply CQRS for commands and queries
- Write type-safe TypeScript (strict mode)

**Example structure:**
```
src/modules/auth/
├── domain/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── value-objects/
│   │   └── auth-token.vo.ts
│   └── ports/
│       ├── user-repository.port.ts
│       └── token-provider.port.ts
├── application/
│   ├── commands/
│   │   └── login/
│   │       ├── login.command.ts
│   │       └── login.handler.ts
│   └── services/
│       └── auth.application.service.ts
├── infrastructure/
│   ├── persistence/
│   │   └── user.repository.ts
│   └── providers/
│       └── jwt-token.provider.ts
└── presentation/
    └── controllers/
        └── auth.controller.ts
```

### Step 5: Test & Verify

**Verification checklist:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Code follows project rules
- [ ] No TypeScript errors
- [ ] No linting errors

### Step 6: Commit Changes

**Use Conventional Commits:**

```bash
# Feature
git commit -m "feat(auth): add login endpoint with JWT token generation"

# Fix
git commit -m "fix(auth): validate email format in login request"

# Refactor
git commit -m "refactor(auth): extract token validation to separate service"

# Test
git commit -m "test(auth): add unit tests for login handler"
```

**Commit rules:**
- One logical change per commit
- Use imperative mood ("add" not "added")
- Include scope in parentheses
- Body explains WHY, not WHAT

### Step 7: Push to Branch

**Branch naming:**
```
feature/ISSUE-123-user-authentication
fix/ISSUE-125-login-validation
```

**Commands:**
```bash
git checkout -b feature/ISSUE-123-user-authentication
git add .
git commit -m "feat(auth): add login endpoint"
git push origin feature/ISSUE-123-user-authentication
```

### Step 8: Create PR.md (DO NOT COMMIT!)

**Create `PR.md` documenting changes - THIS FILE IS TEMPORARY, DO NOT COMMIT!**

⚠️ **IMPORTANT:** `PR.md` is **ONLY** used as body when creating the PR on GitHub/GitLab. **NEVER commit this file!**

**When user says "sube la rama y crea pr":**
1. ✅ Push the branch: `git push origin <branch-name>`
2. ✅ Read PR.md content
3. ✅ Open GitHub/GitLab in browser OR use `gh pr create --body-file PR.md`
4. ❌ **DO NOT** run: `git add PR.md && git commit -m "docs: add PR description"`
5. ❌ **DO NOT** commit PR.md at all!

```markdown
# Pull Request: Issue #123 - User Authentication

## Summary
Implements user authentication with JWT tokens including login, token refresh, and protected routes.

## Changes

### New Files
- `src/modules/auth/domain/entities/user.entity.ts`
- `src/modules/auth/domain/value-objects/auth-token.vo.ts`
- `src/modules/auth/application/commands/login/login.handler.ts`
- `src/modules/auth/infrastructure/persistence/user.repository.ts`
- `src/modules/auth/presentation/controllers/auth.controller.ts`

### Modified Files
- `src/app.module.ts` - Added AuthModule
- `src/infrastructure/database/typeorm/entities/index.ts` - Added User entity

### Database Migrations
- `1711152000008-CreateUsersTable.ts` - Creates users table with indexes

## Architecture Compliance
- ✅ Clean Architecture layers respected
- ✅ Dependency Injection used throughout
- ✅ Repository pattern implemented
- ✅ CQRS pattern for commands
- ✅ TypeScript strict mode

## Testing
- [x] Unit tests: 15 tests passing
- [x] Integration tests: 5 tests passing
- [x] E2E tests: 3 tests passing

## Issue Tracking
- Closes #123
- Related to #120 (user registration)

## Next Steps
- [ ] Deploy to staging
- [ ] QA review
- [ ] Merge to main
```

### Step 9: Push and Create PR

**Push your changes and create the PR on GitHub/GitLab:**

⚠️ **CRITICAL: BRANCH BASE CONFIGURATION**

| Repository | Base Branch | Command |
|------------|-------------|---------|
| **ThreefacesGroup/** | `development` | `--base development` |
| Other repos | Check team config | `--base <team-branch>` |

**For ThreefacesGroup repositories (MOST COMMON):**

```bash
# Push branch to remote
git push origin feature/ISSUE-123-user-authentication

# Copy PR.md content
cat PR.md

# Open GitHub/GitLab in browser
# Navigate to: https://github.com/OWNER/REPO/pulls
# Click "New Pull Request"
# Select your branch: feature/ISSUE-123-user-authentication
# Paste PR.md content in the description
# Create Pull Request
```

⚠️ **DO NOT run these commands:**
```bash
# ❌ WRONG - Don't commit PR.md!
git add PR.md && git commit -m "docs: add PR description"

# ❌ WRONG - Don't push PR.md!
git push origin feature/ISSUE-123
```

✅ **CORRECT workflow:**
```bash
# 1. Push your code changes (already committed)
git push origin feature/ISSUE-123

# 2. Read PR.md for reference
cat PR.md

# 3. Open GitHub/GitLab in browser
# 4. Create PR manually
# 5. Paste PR.md content as description
# 6. Delete PR.md locally (optional, it's temporary)
rm PR.md
```

**Alternative: Using gh CLI**

⚠️ **CRITICAL FOR THREEFACESGROUP:**

```bash
# Push branch
git push origin feature/ISSUE-123

# Create PR using PR.md as body
# 🚨 THREEFACESGROUP: ALWAYS use --base development!
gh pr create \
  --title "feat: Issue #123 - User Authentication" \
  --body-file PR.md \
  --head feature/ISSUE-123-user-authentication \
  --base development

# PR.md is still temporary, you can delete it after creating PR
rm PR.md
```

⚠️ **CRITICAL WARNINGS:**

| Rule | Priority | Description |
|------|----------|-------------|
| **NEVER** use `--base main` | 🔴 CRITICAL | Main is protected, PR will be rejected |
| **NEVER** use `--base master` | 🔴 CRITICAL | Master is protected, PR will be rejected |
| **ALWAYS** use `--base development` | 🔴 CRITICAL | Default integration branch for ThreefacesGroup |
| **ALWAYS** write PR.md in **Spanish** | 🔴 CRITICAL | Team language requirement |

**Main/master branches are protected and should only receive merged PRs from development.**

## Session Tracking

**Important:** Each session should track:
1. **Current step** in the workflow
2. **Completed steps** with timestamps
3. **Next steps** to continue in next session
4. **Key decisions** made during implementation
5. **Files modified** in this session

**Example session metadata:**
```json
{
  "issueId": "123",
  "workflowStep": "4_CODE_SOLUTION",
  "completedSteps": ["1_READ", "2_ANALYZE", "3_PLAN"],
  "nextSteps": ["Complete AuthController", "Add validation pipes"],
  "keyDecisions": [
    "Use JWT for tokens",
    "Store refresh tokens in Redis"
  ],
  "filesModified": [
    "src/modules/auth/domain/entities/user.entity.ts",
    "src/modules/auth/application/commands/login/login.handler.ts"
  ],
  "sessionStart": "2026-03-23T10:00:00Z",
  "sessionEnd": "2026-03-23T11:30:00Z"
}
```

## Example: "Sube la rama y crea PR"

**When user says:** "Sube la rama y crea PR"

**DO:**
```bash
# 1. Verify current branch
git branch --show-current
# Output: feature/ISSUE-123-user-authentication ✓

# 2. Push branch to remote
git push origin feature/ISSUE-123-user-authentication

# 3. Read PR.md for reference
cat PR.md

# 4. Create PR on GitHub/GitLab
# Option A: Using gh CLI (RECOMMENDED)
gh pr create \
  --title "feat: Issue #123 - User Authentication" \
  --body-file PR.md \
  --head feature/ISSUE-123-user-authentication \
  --base development

# Option B: Manual in browser
# - Open: https://github.com/OWNER/REPO/pulls
# - Click "New Pull Request"
# - Select base: development
# - Select head: feature/ISSUE-123-user-authentication
# - Paste PR.md content as description
# - Create Pull Request

# 5. Update session tracking
# - workflowStep: "9_CREATE_PR" ✓
# - prUrl: "https://github.com/OWNER/REPO/pull/456"
# - status: "completed"
```

**DON'T:**
```bash
# ❌ NEVER commit PR.md!
git add PR.md && git commit -m "docs: add PR description"

# ❌ NEVER use --base main!
gh pr create --base main  # WRONG!

# ❌ NEVER push to main directly!
git checkout main && git push  # WRONG!
```

## Resume Across Sessions

When resuming work on an issue:
1. Load last session metadata
2. Check current workflow step
3. Review completed steps
4. Continue from next step
5. Update session tracking

**Example resume command:**
```
"Continue working on Issue #123"
→ System loads last session
→ Shows: "Last session: Completed Step 4 (Code Solution) - 70%"
→ Next step: "Complete remaining 30% of coding, then Test & Verify"
```
