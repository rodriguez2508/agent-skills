---
title: Angular Environment Configuration
impact: HIGH
impactDescription: "Proper environment variable handling for development and production"
tags: angular, environment, configuration, production, deployment
---

## Angular Environment Configuration

**Impact: HIGH** — Proper environment configuration is critical for security and deployment flexibility.

### Core Principle

Use Angular's built-in environment system with `environment.ts` (development) and `environment.prod.ts` (production). For runtime configuration (post-build), use `APP_INITIALIZER` with an external JSON file.

### Build-Time Configuration (Standard)

```typescript
// src/environments/environment.ts (development)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  featureFlags: {
    newDashboard: true,
  },
};

// src/environments/environment.prod.ts (production)
export const environment = {
  production: true,
  apiUrl: 'https://api.example.com',
  featureFlags: {
    newDashboard: false,
  },
};

// angular.json configuration
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.prod.ts"
      }
    ]
  }
}
```

### Runtime Configuration (APP_INITIALIZER)

For configuration that changes after build (e.g., different environments on Render):

```typescript
// src/app/core/config/app-config.interface.ts
export interface AppConfig {
  apiUrl: string;
  authUrl: string;
  featureFlags: Record<string, boolean>;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// src/app/core/config/app-config.service.ts
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig | null = null;

  get apiUrl(): string {
    return this.config?.apiUrl || '';
  }

  async loadConfig(): Promise<void> {
    const response = await fetch('/config.json');
    this.config = await response.json();
  }
}

// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: AppConfigService) => () => configService.loadConfig(),
      deps: [AppConfigService],
      multi: true,
    },
    AppConfigService,
  ],
};

// public/config.json (runtime config, deployed with app)
{
  "apiUrl": "https://api.example.com",
  "authUrl": "https://auth.example.com",
  "featureFlags": { "newDashboard": true }
}
```

### Incorrect (hardcoded values)

```typescript
// ❌ BAD - Hardcoded URL
const API_URL = 'http://localhost:3000/api';

// ❌ BAD - Importing environment directly in services
import { environment } from '../../environments/environment';
```

### Correct (dependency injection)

```typescript
// ✅ GOOD - Inject configuration
constructor(
  @Inject(APP_CONFIG) private config: AppConfig,
  private http: HttpClient,
) {}

getUsers() {
  return this.http.get(`${this.config.apiUrl}/users`);
}
```

### Deployment Scripts

```json
// package.json
{
  "scripts": {
    "start": "ng serve",
    "build:prod": "ng build --configuration production",
    "generate:config": "node scripts/generate-runtime-config.js"
  }
}
```

Reference: [Angular Environment Variables Guide](https://angular.dev/guide/build)
