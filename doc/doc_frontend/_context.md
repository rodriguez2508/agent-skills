# 🏗️ LINKI V1 Architecture Standard

> **Golden Rule:** All features must strictly follow this structure to ensure scalability and maintainability.

## 📂 Directory Structure (Feature Context)

Each feature (`auth`, `traveler`, `driver`, etc.) must have its `context` folder organized as follows:

```
context/
├── domain/                          # 🧠 CORE: Pure logic and contracts
│   ├── entities/                    # Domain models (classes/interfaces)
│   └── repositories/                # Interfaces (Ports) for data access
│
├── application/                     # 🎮 ORCHESTRATION: Use cases
│   ├── commands/                    # Write (CQRS): Modify state
│   │   └── [verb]-[noun]/           # E.g: create-travel
│   │       ├── *.command.ts         # Command DTO
│   │       └── *.handler.ts         # Execution logic
│   ├── queries/                     # Read (CQRS): Retrieve data
│   │   └── [verb]-[noun]/           # E.g: get-active-travels
│   │       ├── *.query.ts           # Query DTO
│   │       └── *.handler.ts         # Retrieval logic
│   └── [feature].facade.ts          # Facade: Single entry point for UI
│
└── infrastructure/                  # 🔌 CONNECTIONS: Technical implementation
    ├── api/                         # HTTP services (Endpoints)
    ├── socket/                      # WebSocket services (Listeners/Emitters)
    ├── state/                       # Signal Stores (Reactive state)
    │   ├── [entity].store.ts        # Specific store (NO God Stores)
    │   └── [feature]-ui.store.ts    # UI store (loading, errors, pagination)
    └── repositories/                # Implementation of domain interfaces
```

## Implementation Rules

### 1. Granular Stores (No Monoliths)
🚫 **Bad:** `TravelerStore` managing trips, offers, profile, and sockets.
✅ **Good:** `TravelsStore`, `OffersStore`, `TravelerUiStore`.

### 2. Sockets Outside the Store
Stores should be pure state containers. Logic for listening to socket events or initializing connections goes into dedicated services in `infrastructure/socket/`.

### 3. Facade as Orchestrator
UI **never** should import Stores, API Services, or Handlers directly.
Only inject the **Facade**.

```typescript
// Component
private facade = inject(TravelerFacade);
// Usage
this.facade.createTravel(data); // Internally calls a Command
this.travels = this.facade.travels; // Internally exposes a Store Signal
```

### 4. CQRS (Command Query Responsibility Segregation)
- **Commands:** Actions that change server or local state. Return `Promise<void>` or `Promise<Result>`.
- **Queries:** Actions that request data. Data flows reactively through Stores, so queries sometimes only "load" the store, or return specific data.

### 5. Naming Conventions
- **Commands:** Imperative verb + Noun (`CreateTravel`, `AcceptOffer`).
- **Queries:** 'Get' verb + Noun (`GetActiveTravels`, `GetTravelDetails`).
- **Stores:** Plural of resource (`TravelsStore`, `OffersStore`).
