# 📁 Views Folder Structure

## Overview
The `views/` folder contains the main page components (route targets) for the feature. Each view is a complete page that users interact with.

## Directory Structure

```
views/
├── [view-name]/           # Each view has its own folder
│   ├── [view-name].component.ts
│   ├── [view-name].component.html
│   ├── [view-name].component.scss
│   └── ...                # Optional: child components if needed
├── [another-view]/
│   └── ...
└── shared/                # ⚠️ DEPRECATED - See _shared.md
```

## 1. View Folder Naming
Each view should have its own folder named after the view/route.

**Naming convention:**
- Use kebab-case for folder names: `travel-request`, `my-travels`, `signin`
- Match the route name if possible

**Example:**
```
views/
├── travel-request/        # Route: /v1/traveler/travel-request
│   ├── travel-request.component.ts
│   ├── travel-request.component.html
│   └── travel-request.component.scss
├── my-travels/            # Route: /v1/traveler/my-travels
│   └── ...
└── signin/                # Route: /v1/auth/signin
    └── ...
```

## 2. Component Structure
Each view component should:
- Be a standalone component
- Use OnPush change detection
- Inject the feature's Facade for data access
- Use signals for reactive state

**Example:**
```typescript
// views/travel-request/travel-request.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TravelerFacade } from '@v1/features/traveler/context/application/auth.facade';

@Component({
  selector: 'app-travel-request',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './travel-request.component.html',
  styleUrl: './travel-request.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelRequestComponent {
  private facade = inject(TravelerFacade);
  
  s_loading = signal(false);
  s_travels = this.facade.travels;
  
  // UI logic only - business logic in facade/context
}
```

## 3. What Goes in Views vs. Shared

### ✅ **Views** (Main page components)
- Route targets (pages users navigate to)
- Complete UI with layout integration
- Page-level state management
- User interaction handlers

### ❌ **NOT in Views** (Use `shared/` instead)
- Reusable components (modals, cards, widgets)
- Guards, pipes, services
- Child components used across multiple views

## 4. Import Convention
Use path aliases for imports:
```typescript
// ❌ Bad
import { TravelRequestComponent } from '../views/travel-request/travel-request.component';

// ✅ Good
import { TravelRequestComponent } from '@v1/features/traveler/views/travel-request/travel-request.component';
```

## 5. Route Configuration
Views are configured in the feature's route file:

```typescript
// traveler.routes.ts
export const TRAVELER_ROUTES: Routes = [
  {
    path: 'travel-request',
    loadComponent: () => import('./views/travel-request/travel-request.component')
      .then(m => m.TravelRequestComponent),
    title: 'Linki | Solicitar Viaje',
  },
  // ... other views
];
```

## 6. Common Patterns

### Page Component Pattern
Each view folder can contain:
- **Main component**: The page itself
- **Child components**: Specific to that page (not shared)
- **Services**: UI logic specific to that page (rare)

### Example Structure
```
views/my-travels/
├── my-travels.component.ts      # Main page component
├── my-travels.component.html
├── my-travels.component.scss
├── components/                  # Child components specific to this page
│   └── travel-card/
│       ├── travel-card.component.ts
│       └── ...
└── services/                    # UI logic specific to this page
    └── my-travels-ui.service.ts
```

## Rules
1. **One folder per view**: Each view/route has its own folder
2. **Keep it focused**: Views should handle UI presentation only
3. **Use facade**: Access data through the feature's Facade, not directly
4. **Shared components**: If a component is used in multiple views, move it to `shared/components/`
5. **No infrastructure**: API calls, state stores, etc. go in `context/`
