# Rule: Clean Architecture Layers
**Category:** architecture  
**Impact:** HIGH  
**Tags:** clean-architecture, layers, hexagonal

## Description
The project MUST follow Clean Architecture with clear separation of concerns across four distinct layers.

## Rules

### Layer Dependencies
- **Domain Layer** (`src/core/domain/`): MUST NOT depend on any other layer
- **Application Layer** (`src/application/`): MUST ONLY depend on Domain Layer
- **Infrastructure Layer** (`src/infrastructure/`): MAY depend on Domain and Application
- **Presentation Layer** (`src/presentation/`): MAY depend on all layers

### Domain Layer Responsibilities
- Contains enterprise logic and business rules
- Defines entities, value objects, and repository ports
- MUST be framework-agnostic
- MUST NOT import from other layers

### Application Layer Responsibilities
- Contains use cases and CQRS handlers
- Orchestrates domain objects to achieve application goals
- MUST NOT contain business logic (that belongs to Domain)
- MUST NOT depend on frameworks or external tools

### Infrastructure Layer Responsibilities
- Implements repository ports defined in Domain
- Provides adapters for external services (gRPC, HTTP, Database)
- MAY contain framework-specific code

### Presentation Layer Responsibilities
- Handles HTTP/gRPC requests
- Transforms input to application commands/queries
- Transforms application responses to DTOs

## Examples

### ✅ Correct Dependency Flow
```typescript
// Domain Layer (src/core/domain/)
export interface RuleRepository {
  findById(id: string): Promise<Rule | null>;
}

// Application Layer (src/application/)
export class GetRuleHandler {
  constructor(private ruleRepository: RuleRepository) {}
}

// Infrastructure Layer (src/infrastructure/)
export class RuleTypeormRepository implements RuleRepository {
  async findById(id: string): Promise<Rule | null> {
    // TypeORM implementation
  }
}
```

### ❌ Incorrect - Domain importing Infrastructure
```typescript
// ❌ WRONG - Domain should not import TypeORM
import { Entity, Column } from 'typeorm';

@Entity('rules')
export class Rule {
  // This violates Clean Architecture
}
```

## Enforcement
- ArchitectureAgent validates layer dependencies on code reviews
- ESLint rules prevent cross-layer imports
- Build process fails if layer violations detected

## Related Rules
- `CQRS_PATTERN` - Command Query Responsibility Segregation
- `REPOSITORY_PATTERN` - Data access abstraction
- `DEPENDENCY_INVERSION` - Depend on abstractions
