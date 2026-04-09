---
title: NestJS Dependency Injection
impact: HIGH
impactDescription: 'Proper use of NestJS DI system for modular and testable code'
tags: nestjs, dependency-injection, providers, modules
---

## NestJS Dependency Injection

**Impact: HIGH** — Proper DI in NestJS ensures modularity, testability, and follows framework best practices.

### Core Principle

Use NestJS's hierarchical DI system with proper provider scopes and injection tokens.

### Service Registration

```typescript
// ✅ GOOD - Root-level singleton
@Injectable({ providedIn: 'root' })
export class UserService {}

// ✅ GOOD - Module-level provider
@Module({
  providers: [UserService],
})
export class UserModule {}

// ✅ GOOD - Scoped provider
@Injectable({ scope: Scope.DEFAULT })
export class ScopedService {}
```

### Constructor Injection

```typescript
// ✅ GOOD
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly configService: ConfigService,
  ) {}
}
```

### Incorrect

```typescript
// ❌ BAD - Manual instantiation
@Injectable()
export class UserService {
  private userRepo = new UserRepository(); // No DI
}
```

---

**References:**

- [NestJS DI Documentation](https://docs.nestjs.com/fundamentals/dependency-injection)
