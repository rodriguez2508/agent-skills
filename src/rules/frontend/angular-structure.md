---
title: Angular Project Structure
impact: MEDIUM
impactDescription: "Consistent and scalable Angular project organization"
tags: angular, structure, architecture, modules, standalone
---

## Angular Project Structure

**Impact: MEDIUM** — A well-organized Angular project improves maintainability and developer experience.

### Core Principle

Use standalone components (Angular 14+) with feature-based organization. Group by feature, not by type.

### Recommended Structure (Angular 17+)

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
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   └── users.routes.ts
│   │   └── dashboard/
│   ├── app.config.ts            # Application configuration
│   ├── app.routes.ts            # Root routes
│   └── app.component.ts
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
└── public/                      # Static assets
    └── config.json              # Runtime configuration
```

### Standalone Components (Angular 17+)

```typescript
// ✅ GOOD - Standalone component
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent {
  // Component logic
}
```

### Feature Routes

```typescript
// src/app/features/users/users.routes.ts
export const USER_ROUTES: Routes = [
  {
    path: '',
    component: UserListComponent,
  },
  {
    path: ':id',
    component: UserDetailComponent,
  },
];

// src/app/app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then(m => m.USER_ROUTES),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
];
```

### Incorrect (type-based organization)

```
src/
├── components/     # ❌ All components together
├── services/       # ❌ All services together
├── models/         # ❌ All models together
└── pipes/          # ❌ All pipes together
```

### Correct (feature-based organization)

```
src/
├── features/
│   ├── users/      # ✅ Everything about users together
│   ├── products/   # ✅ Everything about products together
│   └── auth/       # ✅ Everything about auth together
```

### Core vs Shared

| Folder | Purpose | Examples |
|--------|---------|----------|
| `core/` | Singleton services, app-wide | AuthService, ConfigService, HttpInterceptor |
| `shared/` | Reusable UI components | ButtonComponent, DatePipe, LoadingDirective |
| `features/` | Business features | UserModule, ProductModule, DashboardComponent |

Reference: [Angular Style Guide](https://angular.dev/style-guide)
