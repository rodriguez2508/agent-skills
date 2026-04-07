# TypeScript Naming Conventions Rule

## 🎯 Purpose

Ensure consistent, descriptive, and predictable naming across the TypeScript codebase to improve readability and maintainability.

---

## 📋 General Rules

### 1. **Use PascalCase for Types and Classes**

```typescript
// ✅ GOOD
class UserService {}
interface CreateUserDto {}
type ApiResponse<T> = {}
enum UserRole {}

// ❌ BAD
class userService {}
interface createuserdto {}
type apiResponse<T> = {}
```

### 2. **Use camelCase for Variables and Functions**

```typescript
// ✅ GOOD
const currentUser = {};
function calculateTotal() {}
const getUserById = () => {};

// ❌ BAD
const CurrentUser = {};
function CalculateTotal() {}
```

### 3. **Use UPPER_CASE for Constants**

```typescript
// ✅ GOOD
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT = 5000;

// ❌ BAD
const maxRetryCount = 3; // If truly constant
const MaxRetryCount = 3;
```

### 4. **Use Private Prefix for Class Members**

```typescript
// ✅ GOOD - Use private keyword or # for true privacy
class User {
  private internalId: string;
  #secretKey: string; // ES2022 private fields
  
  constructor() {
    this.internalId = '';
    this.#secretKey = '';
  }
}

// ⚠️ AVOID - Hungarian notation
class User {
  private _internalId: string; // Don't use underscore prefix
}
```

---

## 📁 File Naming

### 5. **Match Filename to Export**

```typescript
// ✅ GOOD - File: user.service.ts
export class UserService {}

// ✅ GOOD - File: create-user.dto.ts
export class CreateUserDto {}

// ❌ BAD - File: UserService.ts (PascalCase for file)
export class UserService {}

// ❌ BAD - File: user-service.service.ts (redundant suffix)
export class UserService {}
```

### 6. **Use Descriptive Suffixes**

| Type | Suffix | Example |
|------|--------|---------|
| Controller | `.controller.ts` | `users.controller.ts` |
| Service | `.service.ts` | `auth.service.ts` |
| Repository | `.repository.ts` | `users.repository.ts` |
| DTO | `.dto.ts` | `create-user.dto.ts` |
| Entity | `.entity.ts` | `user.entity.ts` |
| Module | `.module.ts` | `auth.module.ts` |
| Guard | `.guard.ts` | `jwt-auth.guard.ts` |
| Interceptor | `.interceptor.ts` | `logging.interceptor.ts` |
| Pipe | `.pipe.ts` | `validation.pipe.ts` |
| Handler | `.handler.ts` | `create-user.handler.ts` |

---

## 🏷️ Specific Naming Patterns

### 7. **DTO Naming**

```typescript
// ✅ GOOD - Clear intent
class CreateUserDto {}
class UpdateUserDto {}
class UserResponseDto {}
class UserListResponseDto {}

// ❌ BAD - Vague
class UserData {}
class UserInfo {}
class UserDto {} // Too generic
```

### 8. **Service Naming**

```typescript
// ✅ GOOD - Describes responsibility
class UserService {}
class AuthenticationProvider {}
class TokenGenerator {}

// ❌ BAD - Unclear scope
class UserHelper {}
class UserManager {} // Manager is ambiguous
class UserUtils {} // Utils are often god objects
```

### 9. **Repository Naming**

```typescript
// ✅ GOOD - Entity + Repository
class UserRepository {}
class ProductRepository {}

// ❌ BAD
class UserDAO {} // Don't use DAO
class UserDataAccess {} // Too verbose
class RepoUser {} // Wrong order
```

### 10. **Handler Naming (CQRS)**

```typescript
// ✅ GOOD - Action + Entity + Handler
class CreateUserHandler {}
class FindUserByIdHandler {}
class DeleteUserHandler {}

// ❌ BAD
class CreateHandler {} // Missing entity
class UserHandler {} // Missing action
class HandleCreateUser {} // Wrong pattern
```

---

## 🔤 Variable Naming

### 11. **Boolean Variables Should Start with Auxiliary Verbs**

```typescript
// ✅ GOOD
const isValid = true;
const hasPermission = false;
const canEdit = true;
const shouldUpdate = false;
const isUserLoggedIn = true;

// ❌ BAD
const valid = true;
const permission = false;
const edit = true;
```

### 12. **Arrays Should Be Plural**

```typescript
// ✅ GOOD
const users: User[] = [];
const productList: Product[] = [];
const items: Item[] = [];

// ❌ BAD
const userList: User[] = []; // Redundant
const userArray: User[] = []; // Redundant
const user: User[] = []; // Misleading (singular for array)
```

### 13. **Functions Should Start with Verbs**

```typescript
// ✅ GOOD
function getUserById() {}
function calculateTotal() {}
function validateEmail() {}
function createOrder() {}

// ❌ BAD
function userById() {} // Missing verb
function total() {} // Unclear action
function emailValidation() {} // Noun instead of verb
```

---

## 🚫 Naming Anti-Patterns

### 14. **Avoid Magic Numbers in Names**

```typescript
// ❌ BAD
const process1 = () => {};
const data2 = {};
function handler3() {}

// ✅ GOOD
const processUser = () => {};
const userData = {};
function handlePayment() {}
```

### 15. **Avoid Abbreviations**

```typescript
// ❌ BAD
const usr = {};
const calcTot = () => {};
const msg = '';
const req = {};
const res = {};

// ✅ GOOD
const user = {};
const calculateTotal = () => {};
const message = '';
const request = {};
const response = {};

// ⚠️ ACCEPTABLE - Well-known abbreviations
const id = ''; // ID is universally understood
const dto = {}; // DTO is standard in NestJS
const api = ''; // API is common
```

### 16. **Avoid Single Letter Names (Except Loop Counters)**

```typescript
// ❌ BAD
const x = 5;
function process(d: UserData) {}

// ✅ GOOD - Loop counters are acceptable
for (let i = 0; i < users.length; i++) {}
users.forEach(u => console.log(u.name)); // Short but clear

// ✅ GOOD - Descriptive names
const retryCount = 5;
function process(data: UserData) {}
```

---

## 📊 Naming by Context

### 17. **Exception Naming**

```typescript
// ✅ GOOD - Should end with "Exception"
class NotFoundException extends HttpException {}
class InvalidCredentialsException extends HttpException {}
class UserAlreadyExistsException extends HttpException {}

// ❌ BAD
class NotFound {}
class Error {}
class UserException {} // Too vague
```

### 18. **Event Naming**

```typescript
// ✅ GOOD - Past tense for domain events
class UserCreatedEvent {}
class OrderShippedEvent {}
class PaymentProcessedEvent {}

// ✅ GOOD - Present tense for CQRS commands
class CreateUserCommand {}
class ShipOrderCommand {}

// ❌ BAD
class UserCreateEvent {} // Inconsistent tense
class CreateOrderEvent {} // Mixed pattern
```

### 19. **Decorator Naming**

```typescript
// ✅ GOOD - Descriptive, often with @ prefix in usage
@Auth()
@Cache()
@ValidateUser()

// ❌ BAD
@DoAuth() // "Do" prefix is redundant
@AuthDecorator() // "Decorator" suffix is redundant
```

---

## 📝 Special Cases

### 20. **Type Alias vs Interface**

```typescript
// ✅ Interface for object shapes
interface User {
  id: string;
  name: string;
}

// ✅ Type for unions, primitives, tuples
type UserRole = 'admin' | 'user' | 'guest';
type UserId = string;
type Coordinates = [number, number];

// ✅ Type for mapped types
type PartialUser = Partial<User>;
type ReadonlyUser = Readonly<User>;
```

### 21. **Generic Type Parameters**

```typescript
// ✅ GOOD - Single letter for simple generics
function identity<T>(arg: T): T {
  return arg;
}

// ✅ GOOD - Descriptive for complex generics
function mapEntities<Entity, ResponseDto>(
  entities: Entity[],
  transform: (e: Entity) => ResponseDto
): ResponseDto[] {}

// ❌ BAD - Inconsistent
function process<A, B, C>(a: A, b: B, c: C) {} // Too vague
```

---

## ✅ Checklist for Code Reviews

- [ ] Classes/Interfaces/Types use PascalCase
- [ ] Variables/Functions use camelCase
- [ ] Constants use UPPER_CASE
- [ ] Files use kebab-case with descriptive suffix
- [ ] Boolean variables start with is/has/can/should
- [ ] Arrays use plural names
- [ ] Functions start with verbs
- [ ] No abbreviations (except well-known ones)
- [ ] Exceptions end with "Exception"
- [ ] Events use appropriate tense
- [ ] Names are self-explanatory without comments

---

## 🎓 According to CodeMentor MCP

**Rule ID**: `foundations/typescript-naming`

**Category**: foundations

**Priority**: 🔵 MEDIUM

**Applies to**: All TypeScript code

---

## 📄 Related Rules

- `foundations/type-checking` - TypeScript type safety
- `foundations/typescript-comments` - Code comments
- `clean-layers` - Clean Architecture structure

---

**Last Updated**: April 2026
**Author**: CodeMentor MCP
**Version**: 1.0
