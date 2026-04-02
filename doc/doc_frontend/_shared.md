# 📁 Shared Folder Structure

## Overview
The `shared/` folder contains reusable utilities and components. There are **two types** of shared folders:

1. **Global Shared** (`v1/features/shared/`): Components, guards, pipes, and services used by **multiple features**
2. **Feature-Specific Shared** (`v1/features/[feature]/shared/`): Components, guards, pipes, and services used **only by that specific feature**

## Global Shared Structure (`v1/features/shared/`)

```
v1/features/shared/
├── components/              # Reusable UI components used by multiple features
│   ├── navigation/         # Navigation components (navbar, panel-nav, etc.)
│   ├── cards/              # Card components (trip-card, etc.)
│   ├── info/               # Info components (loading, not-found, etc.)
│   ├── admin/              # Admin components (admin-header, admin-sidebar)
│   ├── map/                # Map components (p-map-route)
│   ├── toolbar/            # Toolbar components (top-toolbar)
│   └── dialogs/            # Dialog components (traveler-confirm-travel-dialog)
├── guards/                 # Route guards used by multiple features
├── pipes/                  # Pipes used by multiple features
├── services/               # Services used by multiple features
└── layouts/                # Layout components used by multiple features (rare)
```

**Examples of global components organized by category:**
- **Navigation**: `navbar/`, `panel-nav/`, `sliding-navbar/`
- **Cards**: `trip-card/`, `card-travel-pending/`
- **Info**: `info-loading/`, `info-not-item-found/`
- **Admin**: `admin-header/`, `admin-sidebar/`
- **Map**: `p-map-route/`
- **Toolbar**: `top-toolbar/`
- **Dialogs**: `traveler-confirm-travel-dialog/`

## Feature-Specific Shared Structure (`v1/features/[feature]/shared/`)

```
v1/features/traveler/shared/
├── components/     # Components specific to traveler feature
├── guards/         # Guards specific to traveler feature
├── pipes/          # Pipes specific to traveler feature
└── services/       # Services specific to traveler feature
```

**Examples of feature-specific components:**
- `v1/features/auth/shared/components/session-traveler.component.ts` - Only used in auth
- `v1/features/auth/shared/components/session-driver.component.ts` - Only used in auth

## 1. Components (`shared/components/`)
Contains reusable UI components that are used within the feature but are not main view pages.

**When to use:**
- Modals, dialogs, cards, or widgets used across multiple views in the feature
- Complex form controls specific to the feature
- UI elements that are too small to be a standalone feature

**Example:**
```
shared/components/
├── user-card/
│   ├── user-card.component.ts
│   ├── user-card.component.html
│   └── user-card.component.scss
└── confirmation-dialog/
    ├── confirmation-dialog.component.ts
    └── ...
```

## 2. Guards (`shared/guards/`)
Contains route guards specific to this feature.

**When to use:**
- Protecting routes within the feature (e.g., `AuthGuard` for traveler routes)
- Feature-specific route activation logic

**Example:**
```
shared/guards/
├── traveler.guard.ts
└── admin.guard.ts
```

## 3. Pipes (`shared/pipes/`)
Contains pipes (transformations) specific to this feature.

**When to use:**
- Formatting data specific to the feature domain
- Transforming display values for UI only

**Example:**
```
shared/pipes/
├── format-travel-date.pipe.ts
└── travel-status.pipe.ts
```

## 4. Services (`shared/services/`)
Contains services specific to this feature for UI logic or helpers.

**When to use:**
- UI state management (local to the feature, not global)
- Helper functions for formatting, calculations, or utilities
- Feature-specific business logic that doesn't fit in `context`

**Important:**
- **DO NOT** put infrastructure services (API calls, HTTP, WebSockets) here → use `context/infrastructure/`
- **DO NOT** put global services here → use `@services/` or `core/`

**Example:**
```
shared/services/
├── travel-ui.service.ts      # UI state for travel feature
├── format-helper.service.ts  # Formatting helpers
└── validation.service.ts     # Feature-specific validation
```

## Import Convention
Use path aliases for imports with the organized structure:

```typescript
// ❌ Bad - Old structure
import { TripCardComponent } from '@v1/features/shared/components/trip-card/trip-card.component';

// ✅ Good - New organized structure
import { TripCardComponent } from '@v1/features/shared/components/cards/trip-card/trip-card.component';
import { PanelNavV1Component } from '@v1/features/shared/components/navigation/panel-nav/panel-nav.component';
import { InfoLoadingComponentV1 } from '@v1/features/shared/components/info/info-loading/info-loading.component';

// ✅ Feature-specific shared
import { SessionTravelerComponent } from '@v1/features/auth/shared/components/session-traveler.component';
```

## Rules

### Global Shared (`v1/features/shared/`)
1. **Only for components used by multiple features**: If a component is used by only one feature, it should go in that feature's `shared/` folder
2. **No infrastructure**: API services, HTTP clients, etc. go in `context/infrastructure/`
3. **Organize by type**: Always use subdirectories (`components/`, `guards/`, `pipes/`, `services/`)

### Feature-Specific Shared (`v1/features/[feature]/shared/`)
1. **Only for items used by that feature**: If a component is used by multiple features, it should go in `v1/features/shared/`
2. **Same structure as global shared**: Use `components/`, `guards/`, `pipes/`, `services/` subdirectories

## Examples

### ✅ Correct: Global Shared
```typescript
// Used by traveler, auth, and other features
import { PanelNavV1Component } from '@v1/features/shared/components/panel-nav/panel-nav.component';
```

### ✅ Correct: Feature-Specific Shared
```typescript
// Used only by auth feature
import { SessionTravelerComponent } from '@v1/features/auth/shared/components/session-traveler.component';
```

### ❌ Incorrect: Feature-specific component in global shared
```typescript
// WRONG: session-traveler.component is only used in auth, so it should be in auth/shared/
import { SessionTravelerComponent } from '@v1/features/shared/components/session-traveler.component';
```
