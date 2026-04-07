# TypeScript Code Comments Rule

## 🎯 Purpose

Ensure code clarity through appropriate, meaningful comments while avoiding redundancy and maintaining clean, self-documenting code.

---

## 📋 Rules

### 1. **Comments Should Explain "Why", Not "What"**

```typescript
// ❌ BAD - Redundant, explains what the code does
const isValid = value !== null && value !== undefined; // Check if value is valid

// ✅ GOOD - Explains the business reason
const isValid = value !== null && value !== undefined; // Required for legacy API compatibility
```

### 2. **Avoid Commented-Out Code**

```typescript
// ❌ BAD - Commented code
// const oldMethod = () => {
//   return this.deprecatedLogic();
// };

// ✅ GOOD - Remove it, version control has history
```

### 3. **Use JSDoc for Public APIs**

```typescript
// ❌ BAD - No documentation for public method
async createUser(data: CreateUserDto): Promise<User> {
  return this.repository.save(data);
}

// ✅ GOOD - JSDoc with params and return type
/**
 * Creates a new user in the system.
 * @param data - User creation data with email and password
 * @returns The created user entity
 * @throws ConflictException if email already exists
 */
async createUser(data: CreateUserDto): Promise<User> {
  return this.repository.save(data);
}
```

### 4. **TODO Comments Must Have Context**

```typescript
// ❌ BAD - Vague TODO
// TODO: Fix this

// ✅ GOOD - Specific with context and reference
// TODO(#123): Implement rate limiting for this endpoint
// Current issue: No protection against brute force attacks
// Solution: Add @UseGuards(ThrottlerGuard) with custom config
```

### 5. **Comments Should Not Duplicate Type Information**

```typescript
// ❌ BAD - Type already says this
/**
 * The user's ID (number)
 */
id: number;

// ✅ GOOD - Adds business context
/**
 * Unique identifier assigned by the identity service.
 * Generated as UUID v4 during user registration.
 */
id: string;
```

### 6. **Complex Logic Requires Explanation**

```typescript
// ❌ BAD - Magic logic without explanation
const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000);

// ✅ GOOD - Explains the algorithm
// Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
const timeout = Math.min(1000 * Math.pow(2, retryCount), 30000);
```

### 7. **Use Region Comments for Large Files**

```typescript
// #region Lifecycle Hooks
onModuleInit() { /* ... */ }
onModuleDestroy() { /* ... */ }
// #endregion

// #region Public Methods
create() { /* ... */ }
findAll() { /* ... */ }
// #endregion

// #region Private Helpers
private validateInput() { /* ... */ }
// #endregion
```

### 8. **Avoid Inline Comments on Same Line as Code**

```typescript
// ❌ BAD - Hard to read
const port = configService.get('PORT', 3000); // Default port

// ✅ GOOD - Comment on separate line
// Default port for development environment
const port = configService.get('PORT', 3000);
```

### 9. **Documentation Comments for Modules**

```typescript
/**
 * @module AuthModule
 * 
 * Handles user authentication and authorization.
 * 
 * Features:
 * - JWT-based authentication
 * - Refresh token rotation
 * - Session management
 * - Password reset flow
 * 
 * Dependencies:
 * - UsersModule
 * - RedisModule (for token storage)
 * - MailerModule (for password reset emails)
 */
@Module({
  imports: [UsersModule, RedisModule, MailerModule],
  // ...
})
export class AuthModule {}
```

### 10. **Comments in English**

All comments must be written in **English** for consistency across the codebase.

```typescript
// ❌ BAD - Spanish comment
// Verifica si el usuario existe
const user = await this.findOne(id);

// ✅ GOOD - English comment
// Check if user exists
const user = await this.findOne(id);
```

---

## 🛠️ When Comments Are Necessary

| Scenario | Comment Required | Example |
|----------|-----------------|---------|
| **Business logic** | ✅ Yes | Why a specific rule exists |
| **Workarounds** | ✅ Yes | Temporary fix for external bug |
| **Complex algorithms** | ✅ Yes | Explanation of the approach |
| **Public API** | ✅ Yes | JSDoc for consumers |
| **Self-explanatory code** | ❌ No | `const total = price * quantity;` |
| **Simple getters/setters** | ❌ No | `getName() { return this.name; }` |
| **Obvious validation** | ❌ No | `if (!email) throw Error();` |

---

## 📝 Comment Templates

### JSDoc for Service Methods

```typescript
/**
 * [Action] [Entity] based on [criteria].
 * 
 * @param param - Description of parameter
 * @param options - Optional configuration
 * @returns Description of return value
 * @throws [ExceptionType] When [condition]
 * 
 * @example
 * ```typescript
 * const result = await service.method({ id: '123' });
 * ```
 */
```

### TODO Comment Format

```typescript
// TODO(#[ISSUE_NUMBER]): [Brief description]
// Current issue: [What's wrong]
// Proposed solution: [How to fix]
// Deadline: [Optional - if time-sensitive]
```

### Complex Logic Explanation

```typescript
// Algorithm: [Name of algorithm/pattern]
// Purpose: [What it achieves]
// Complexity: [Time/Space if relevant]
// Reference: [Link to documentation if applicable]
```

---

## 🚨 Anti-Patterns

### 1. Comment Noise

```typescript
// ❌ BAD
/**
 * Get user by ID
 * @param id - The ID
 * @returns The user
 */
async getUser(id: string) {
  return this.findById(id);
}

// ✅ GOOD - Method name is self-explanatory
async getUser(id: string) {
  return this.findById(id);
}
```

### 2. Misleading Comments

```typescript
// ❌ BAD - Comment doesn't match code
// Returns null if user not found
async getUser(id: string): Promise<User> {
  // Actually throws NotFoundException
  const user = await this.repo.findOne(id);
  if (!user) throw new NotFoundException();
  return user;
}

// ✅ GOOD - Accurate comment
// Throws NotFoundException if user not found
```

### 3. Outdated Comments

```typescript
// ❌ BAD - Comment references old implementation
// Uses Redis for caching
// (But code now uses in-memory cache)

// ✅ GOOD - Update comment when refactoring
// Uses in-memory Map for caching (refactored from Redis on 2024-03)
```

---

## ✅ Checklist for Code Reviews

- [ ] Comments explain **why**, not **what**
- [ ] No commented-out code
- [ ] Public APIs have JSDoc
- [ ] TODOs have issue references
- [ ] Complex logic is documented
- [ ] Comments are in English
- [ ] Comments are up-to-date with code
- [ ] No redundant type information
- [ ] Inline comments on separate lines

---

## 🎓 According to CodeMentor MCP

**Rule ID**: `foundations/typescript-comments`

**Category**: foundations

**Priority**: 🔵 MEDIUM

**Applies to**: All TypeScript code

---

## 📄 Related Rules

- `foundations/type-checking` - TypeScript type safety
- `foundations/typescript-naming` - Naming conventions
- `clean-layers` - Clean Architecture structure

---

**Last Updated**: April 2026
**Author**: CodeMentor MCP
**Version**: 1.0
