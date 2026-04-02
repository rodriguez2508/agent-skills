# Features Architecture

This document describes the folder structure and conventions for features in the LINKI Angular application.

## Main Structure

```
src/app/
├── core/                    # Transversal (guards, interceptors, constants, config, shared entities)
├── features/                # Feature slices
│   └── feature-name/
└── shared/                 # Cross-feature UI components
```

## Feature Structure

Each feature follows this pattern:

```
features/
├── auth/
│   ├── context/           # Business logic (Clean Architecture + CQRS)
│   ├── views/             # Page components (route targets)
│   │   ├── [view-name]/   # Feature-specific view page
│   │   └── ...            # Other view pages
│   ├── layouts/           # Layout components (if multiple or specific)
│   ├── shared/            # Feature-specific UI and utilities
│   │   ├── components/    # Reusable components within feature
│   │   ├── guards/        # Route guards specific to feature
│   │   ├── pipes/         # Pipes specific to feature
│   │   └── services/      # Services specific to feature
│   └── auth.routes.ts
│
├── traveler/
│   ├── context/
│   ├── views/
│   │   ├── [view-name]/   # Feature-specific view page
│   │   └── ...            # Other view pages
│   ├── layouts/
│   ├── shared/
│   │   ├── components/
│   │   ├── guards/
│   │   ├── pipes/
│   │   └── services/
│   └── traveler.routes.ts
│
├── driver/
├── admin/
└── public/
```

## Folder Purposes

| Folder | When to Create |
|--------|----------------|
| `context/` | Always - business logic, CQRS, domain, state |
| `views/` | Always - feature-specific view pages (route targets) |
| `views/[view-name]/` | Each view page has its own folder with .component.ts/.html/.scss |
| `layouts/` | Always (if layouts exist) - layout components for the feature |
| `shared/` | Always (if needed) - feature-specific utilities |
| `shared/components/` | Reusable components within the feature |
| `shared/guards/` | Route guards specific to the feature |
| `shared/pipes/` | Pipes specific to the feature |
| `shared/services/` | Services specific to the feature (non-infrastructure) |
| `views/shared/` | ❌ DEPRECATED - Use `shared/components/` instead |

## Context Structure (Clean Architecture + CQRS)

The `context/` directory contains all business logic following Clean Architecture principles. See `_context.md` for detailed implementation rules.

```
context/
├── application/           # Use cases orchestration
│   ├── commands/          # CQRS Commands (write operations)
│   │   └── <action>/
│   │       ├── <action>.command.ts
│   │       └── <action>.handler.ts
│   ├── queries/           # CQRS Queries (read operations)
│   │   └── <action>/
│   │       ├── <action>.query.ts
│   │       └── <action>.handler.ts
│   └── facade.ts          # Entry point for views
├── domain/                # Business rules (pure TypeScript)
│   ├── entities/          # Domain entities
│   ├── value-objects/     # Value objects
│   └── repositories/      # Repository interfaces
├── infrastructure/        # External implementations
│   ├── api/               # HTTP services, WebSocket
│   └── state/             # Signals stores (UI state)
└── index.ts               # Barrel file for public exports
```

**Flow**: Views → Facade → Commands/Queries → Infrastructure → State → Views

## Rules

### 1. Create folders only when needed
- Don't create empty folders "just in case"
- Always use `layouts/` directory if layouts exist (never `*.layout.ts` at root)
- Never create `core/` directory inside features (use `context/` for domain logic, `shared/` for utilities)

### 2. Feature must have
- `context/` - Business logic (Clean Architecture + CQRS)
- `views/` - Page components (route targets)
- `layouts/` - Layout components (if any layouts exist)
- `*.routes.ts` - Routes definition

### 3. Feature may have
- `shared/` - Feature-specific pipes, guards, services (non-UI utilities)
- `views/shared/` - Reusable UI components specific to this feature

## Route File Convention

```typescript
// features/traveler/traveler.routes.ts
import { Routes } from '@angular/router';

export const TRAVELER_ROUTES: Routes = [
  {
    path: 'request',
    loadComponent: () => import('./views/travel-request/travel-request.component').then(m => m.TravelRequestComponent),
    title: 'Linki | Solicitar Viaje',
  },
];
```

## Layout Convention

Layouts should be placed in the `layouts/` directory within the feature:

```typescript
// features/traveler/layouts/traveler.layout.ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-traveler-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class TravelerLayoutV1Component {}
```

**Usage in app.routes.ts:**

```typescript
// src/app/v1/app.routes.ts
{
  path: 'traveler',
  loadComponent: () => import('@v1/features/traveler/layouts/traveler.layout').then(m => m.TravelerLayoutV1Component),
  children: [
    {
      path: '',
      loadChildren: () => import('@v1/features/traveler/traveler.routes').then(m => m.TRAVELER_ROUTES),
    },
  ],
},
```

## Component Convention

```typescript
// features/traveler/views/travel-request/travel-request.component.ts
import { Component, inject, signal } from '@angular/core';

@Component({
  selector: 'app-travel-request',
  standalone: true,
  imports: [...],
  templateUrl: './travel-request.component.html',
  styleUrl: './travel-request.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelRequestComponent {
  private store = inject(TravelStore);

  s_loading = signal(false);
}
```

## State Management

```typescript
// features/traveler/context/state/travel.store.ts
@Injectable({ providedIn: 'root' })
export class TravelStore {
  private s_travels = signal<Travel[]>([]);
  
  readonly travels = this.s_travels.asReadonly();
  readonly loading = computed(() => this.s_loading());
  
  private s_loading = signal(false);
}
```

## Related Documentation

- **Context Structure**: See `_context.md` for Clean Architecture + CQRS details
- **Shared Folder**: See `_shared.md` for `shared/` folder structure and organization
- **Views Folder**: See `_views.md` for `views/` folder structure and conventions
