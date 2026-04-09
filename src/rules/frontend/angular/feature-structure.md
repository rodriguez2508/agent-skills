---
title: Angular Feature Module Structure
impact: HIGH
impactDescription: 'Organize feature modules following Clean Architecture with context separation'
tags: angular, feature, structure, clean-architecture, context
---

## Angular Feature Module Structure

**Impact: HIGH** - Features should follow a consistent structure based on Clean Architecture.

### Recommended Structure

```
features/
└── feature-name/
    ├── context/           # Domain context (Clean Architecture)
    │   ├── application/  # Use cases, services
    │   ├── domain/       # Entities, interfaces
    │   ├── infrastructure/ # External adapters, APIs
    │   └── index.ts      # Barrel file
    ├── views/            # Page components
    │   ├── component-a/
    │   ├── component-b/
    │   └── index.ts
    ├── shared/           # Feature-specific shared components
    │   ├── guards/
    │   ├── pipes/
    │   └── services/
    ├── layouts/          # Layout components
    ├── index.ts         # Barrel file
    └── feature.routes.ts # Routes definition
```

### Context Pattern (Clean Architecture)

```typescript
// context/domain/index.ts - Define entities
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

### Views Pattern

```typescript
// views/travel-form/travel-form.component.ts
@Component({
  selector: 'app-travel-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './travel-form.component.html',
})
export class TravelFormComponent {
  // Feature-specific component
}
```

### Shared Pattern

```typescript
// shared/guards/auth.guard.ts
@Injectable({ providedIn: 'root' })
export class AuthGuard {}

// shared/pipes/date-format.pipe.ts
@Pipe({ name: 'dateFormat' })
export class DateFormatPipe {}

// shared/services/travel.service.ts
@Injectable({ providedIn: 'root' })
export class TravelService {}
```

### Incorrect (Old Style)

```
❌ feature/
  ├── components/
  ├── services/
  └── models/
```

### Correct (Clean Architecture)

```
✅ feature/
  ├── context/
  │   ├── application/
  │   ├── domain/
  │   └── infrastructure/
  ├── views/
  ├── shared/
  └── layouts/
```

---

**References:**

- [Angular Style Guide](https://angular.dev/style-guide)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
