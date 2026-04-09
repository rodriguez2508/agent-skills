---
title: Angular Project Structure
impact: HIGH
impactDescription: 'Consistent and scalable Angular project organization with Clean Architecture'
tags: angular, structure, architecture, modules, standalone, clean-architecture
---

## Angular Project Structure

**Impact: HIGH** — A well-organized Angular project improves maintainability and developer experience.

### Core Principle

Use standalone components (Angular 14+) with feature-based organization. Group by feature, not by type. Use **Clean Architecture** inside features with `context/` pattern.

### Project Structure (Angular 17+)

```
src/
├── app/
│   ├── core/                    # Singleton services, guards, interceptors
│   │   ├── config/
│   │   ├── auth/
│   │   ├── interceptors/
│   │   └── guards/
│   ├── shared/                  # Reusable components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   └── directives/
│   ├── features/                # Feature modules
│   │   ├── users/
│   │   │   ├── context/         # Clean Architecture (NEW!)
│   │   │   │   ├── application/ # Use cases, services
│   │   │   │   ├── domain/      # Entities, interfaces
│   │   │   │   ├── infrastructure/ # External adapters
│   │   │   │   └── index.ts
│   │   │   ├── views/           # Page components
│   │   │   ├── shared/          # Feature-specific guards, pipes
│   │   │   ├── layouts/         # Layout components
│   │   │   ├── index.ts
│   │   │   └── users.routes.ts
│   │   └── dashboard/
│   ├── app.config.ts
│   ├── app.routes.ts
│   └── app.component.ts
├── environments/
└── public/
```

### Feature Structure with Context (Clean Architecture)

```
features/
└── feature-name/
    ├── context/              # Domain context (Clean Architecture)
    │   ├── application/      # Use cases, services
    │   ├── domain/           # Entities, interfaces
    │   ├── infrastructure/   # External adapters, APIs
    │   └── index.ts
    ├── views/                # Page components
    │   ├── component-a/
    │   └── index.ts
    ├── shared/               # Feature-specific shared
    │   ├── guards/
    │   ├── pipes/
    │   └── services/
    ├── layouts/               # Layout components
    ├── index.ts
    └── feature.routes.ts
```

### Context Pattern Example

```typescript
// context/domain/index.ts - Entities
export interface Travel {
  id: string;
  travelerId: string;
  destination: string;
  status: TravelStatus;
}

// context/application/index.ts - Use cases
@Injectable()
export class CreateTravelUseCase {
  constructor(private readonly travelRepository: TravelRepository) {}
  async execute(dto: CreateTravelDto): Promise<Travel> {
    // Business logic
  }
}

// context/infrastructure/index.ts - External services
@Injectable()
export class TravelApiService {
  constructor(private http: HttpClient) {}
}
```

### Incorrect (Old Style)

```
❌ src/
  ├── components/     # All components together
  ├── services/       # All services together
  └── models/         # All models together
```

### Correct (Angular 17+)

```
✅ src/
  ├── core/           # Singleton services
  ├── shared/         # Reusable components
  └── features/
      └── feature/
          ├── context/      # Clean Architecture
          ├── views/        # Pages
          ├── shared/       # Feature-specific
          └── layouts/      # Layouts
```

### Standalone Components (Angular 17+)

```typescript
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {}
```

---

Reference: [Angular Style Guide](https://angular.dev/style-guide)
