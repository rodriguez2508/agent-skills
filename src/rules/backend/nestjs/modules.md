---
title: NestJS Modules
impact: HIGH
impactDescription: 'Proper module organization in NestJS applications'
tags: nestjs, modules, architecture, feature-modules
---

## NestJS Modules

**Impact: HIGH** — Proper module organization is essential for scalable NestJS applications.

### Core Principle

Use feature modules to organize code by business domain. Follow the principle of high cohesion and low coupling.

### Module Types

#### 1. Feature Modules

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [DatabaseModule],
  exports: [UsersService],
})
export class UsersModule {}
```

#### 2. Shared Modules

```typescript
@Global()
@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
```

#### 3. Core Modules

```typescript
@Module({
  providers: [LoggingService, ValidationService],
  exports: [LoggingService, ValidationService],
})
export class CoreModule {}
```

### Structure

```
src/
├── core/           # Core modules (auth, config)
├── shared/         # Shared services, pipes, guards
├── features/       # Feature modules
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   └── products/
└── app.module.ts
```

### Best Practices

- ✅ Use feature modules to group related functionality
- ✅ Export only what's needed
- ✅ Use `providedIn: 'root'` for singleton services
- ✅ Keep modules focused and small
- ❌ Don't create big monolithic modules

---

**References:**

- [NestJS Modules](https://docs.nestjs.com/fundamentals/modules)
