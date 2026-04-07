# TypeScript Type Checking Rule

## 🎯 Purpose

Ensure type safety by running `tsc --noEmit` before any build or deployment process.

---

## 📋 Rule

**Always run `tsc --noEmit` to verify TypeScript errors before building the project.**

This rule applies to **ALL TypeScript projects** including:
- NestJS (backend)
- Angular (frontend)
- Any other TypeScript-based project

---

## 🔍 Why?

1. **Catches type errors early** - Before compilation, you can catch type mismatches
2. **Faster feedback** - `tsc --noEmit` is faster than full build
3. **IDE independence** - Not all IDEs show all TypeScript errors
4. **CI/CD reliability** - Ensures type safety in automated pipelines
5. **Prevents runtime errors** - Many bugs are caught at compile time

---

## 🛠️ How to Use

### Basic Type Check

```bash
npx tsc --noEmit
```

### With Specific tsconfig

```bash
npx tsc --noEmit -p tsconfig.json
```

### With Specific tsconfig (Angular/NestJS)

```bash
# NestJS
npx tsc --noEmit -p tsconfig.build.json

# Angular
npx tsc --noEmit -p tsconfig.app.json

# Tests
npx tsc --noEmit -p tsconfig.spec.json
```

---

## ✅ Workflow

### Before ANY Build

```bash
# 1. Type check first
npx tsc --noEmit

# 2. If no errors, then build
pnpm run build
```

### In package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "prebuild": "pnpm run typecheck",
    "build": "nest build"
  }
}
```

### In CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Type Check
  run: npx tsc --noEmit

- name: Build
  run: pnpm run build
```

---

## 🚨 Common Errors & Solutions

### 1. Implicit Any

```typescript
// ❌ Error: Implicit any
function log(data) {
  console.log(data);
}

// ✅ Solution: Add type annotation
function log(data: string) {
  console.log(data);
}
```

### 2. Missing Return Type

```typescript
// ❌ Error: Missing return type
function getUser(id: number) {
  return { id, name: 'John' };
}

// ✅ Solution: Add explicit return type
function getUser(id: number): { id: number; name: string } {
  return { id, name: 'John' };
}
```

### 3. Module Resolution Issues

```typescript
// ❌ Error: Cannot find module
import { Something } from '@nonexistent/path';

// ✅ Solution: Check tsconfig.json paths
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/core/*"],
      "@shared/*": ["src/shared/*"]
    }
  }
}
```

### 4. Dependency Injection Issues (NestJS/Angular)

```typescript
// ❌ Error: Constructor parameter issues
@Injectable()
export class MyService {
  constructor(private readonly dep: SomeService) {} // If SomeService not provided
}

// ✅ Solution: Ensure all dependencies are provided in module
@Module({
  providers: [MyService, SomeService],
})
export class MyModule {}
```

---

## 📝 tsconfig.json Best Practices

```json
{
  "compilerOptions": {
    "strict": true,                    // Enable all strict type checking
    "noImplicitAny": true,             // Error on implicit any
    "strictNullChecks": true,          // Strict null checks
    "strictFunctionTypes": true,       // Strict function types
    "strictBindCallApply": true,       // Strict bind/call/apply
    "strictPropertyInitialization": true, // Strict property initialization
    "noImplicitThis": true,            // Error on implicit this
    "alwaysStrict": true,              // Use strict mode
    "noUnusedLocals": true,            // Error on unused locals
    "noUnusedParameters": true,        // Error on unused parameters
    "noImplicitReturns": true,         // Error on missing return
    "noFallthroughCasesInSwitch": true, // Error on fallthrough cases
    "esModuleInterop": true,           // ES module interop
    "skipLibCheck": true,              // Skip library checks (faster)
    "forceConsistentCasingInFileNames": true // Consistent casing
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

---

## 🔄 Integration with Build Process

### NestJS

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "prebuild": "pnpm run typecheck",
    "build": "nest build",
    "start:dev": "nest start --watch"
  }
}
```

### Angular

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "prebuild": "pnpm run typecheck",
    "build": "ng build",
    "start": "ng serve"
  }
}
```

---

## 🎓 According to CodeMentor MCP

**Rule ID**: `typescript-type-checking-001`

**Category**: TypeScript

**Priority**: 🔴 CRITICAL

**Applies to**: NestJS, Angular, Any TypeScript Project

---

## 📚 References

- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)
- [Strict Mode in TypeScript](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html)
- [NestJS TypeScript Setup](https://docs.nestjs.com/first-steps#prerequisites)
- [Angular TypeScript Configuration](https://angular.io/guide/typescript-configuration)

---

**Last Updated**: 21 de marzo de 2026
**Author**: CodeMentor MCP
