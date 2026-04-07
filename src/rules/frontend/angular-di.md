---
title: Angular Dependency Injection
impact: HIGH
impactDescription: "Proper use of Angular DI system for testable and maintainable code"
tags: angular, dependency-injection, providers, injection-token, services
---

## Angular Dependency Injection

**Impact: HIGH** — Proper DI usage ensures testability, maintainability, and follows Angular best practices.

### Core Principle

Use Angular's hierarchical DI system with `providedIn: 'root'` for singleton services and injection tokens for configuration.

### Service Registration

```typescript
// ✅ GOOD - Root-level singleton (tree-shakable)
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private http: HttpClient) {}
}

// ✅ GOOD - Component-level service
@Component({
  selector: 'app-users',
  providers: [LocalUserService], // New instance per component
})
export class UsersComponent {}
```

### Injection Tokens for Configuration

```typescript
// src/app/core/config/app-config.token.ts
export interface AppConfig {
  apiUrl: string;
  maxRetries: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    apiUrl: 'http://localhost:3000/api',
    maxRetries: 3,
  }),
});

// Using the token
@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) {}

  getUsers() {
    return this.http.get(`${this.config.apiUrl}/users`);
  }
}
```

### Factory Providers

```typescript
// Complex provider with dependencies
export function apiFactory(
  http: HttpClient,
  config: AppConfig,
  auth: AuthService,
) {
  return new ApiService(http, config, auth);
}

export const API_SERVICE_PROVIDER = {
  provide: ApiService,
  useFactory: apiFactory,
  deps: [HttpClient, APP_CONFIG, AuthService],
};
```

### Incorrect (manual instantiation)

```typescript
// ❌ BAD - Manual instantiation bypasses DI
export class UsersComponent {
  private userService = new UserService(); // No DI, hard to test
}

// ❌ BAD - Hardcoded configuration
export class ApiService {
  private apiUrl = 'http://localhost:3000/api'; // Not injectable
}
```

### Correct (constructor injection)

```typescript
// ✅ GOOD - Constructor injection
export class UsersComponent {
  constructor(private userService: UserService) {}
}

// ✅ GOOD - Configuration via injection token
export class ApiService {
  constructor(
    private http: HttpClient,
    @Inject(APP_CONFIG) private config: AppConfig,
  ) {}
}
```

### Provider Hierarchy

```
Root (providedIn: 'root')
  └── Available everywhere, single instance
  
Module/Component providers
  └── New instance per provider scope
  
@Optional() decorator
  └── Graceful handling when provider not found
```

### Optional Dependencies

```typescript
export class OptionalService {
  constructor(
    @Optional() private optionalDep: OptionalDependency,
  ) {
    if (this.optionalDep) {
      // Use the dependency
    }
  }
}
```

Reference: [Angular Dependency Injection Guide](https://angular.dev/guide/di)
