# Rule: Repository Pattern
**Category:** architecture  
**Impact:** HIGH  
**Tags:** repository, data-access, ports, adapters

## Description
Data access MUST be abstracted through the Repository Pattern to decouple domain logic from persistence concerns.

## Rules

### Repository Location
- **Repository Ports** (interfaces): MUST be in `src/core/domain/ports/`
- **Repository Implementations**: MUST be in `src/infrastructure/persistence/repositories/`

### Repository Interface Definition
```typescript
// src/core/domain/ports/rule-repository.port.ts
export interface RuleRepository {
  findById(id: string): Promise<Rule | null>;
  findAll(): Promise<Rule[]>;
  create(rule: Rule): Promise<Rule>;
  update(rule: Rule): Promise<Rule>;
  delete(id: string): Promise<void>;
  search(query: string, filters?: RuleFilters): Promise<Rule[]>;
}
```

### Repository Implementation
```typescript
// src/infrastructure/persistence/repositories/rule-typeorm.repository.ts
@Injectable()
export class RuleTypeormRepository implements RuleRepository {
  constructor(
    @InjectRepository(RuleEntity)
    private readonly repository: Repository<RuleEntity>,
  ) {}

  async findById(id: string): Promise<Rule | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  private toDomain(entity: RuleEntity): Rule {
    return new Rule({
      id: entity.id,
      name: entity.name,
      content: entity.content,
      category: entity.category,
      tags: entity.tags,
      impact: entity.impact as RuleImpact,
    });
  }
}
```

### Domain Entity Return
- Repositories MUST return domain entities (not database entities)
- Repositories MUST NOT expose database-specific types
- Conversion from DB entity to domain entity MUST happen in repository

### Dependency Injection
- Repository implementations MUST be injectable (`@Injectable()`)
- Handlers MUST depend on repository interfaces (not implementations)
- Use NestJS dependency injection for wiring

### Unit of Work (for transactions)
```typescript
export interface UnitOfWork {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

// Usage in command handler
async execute(command: CreateRuleCommand): Promise<Rule> {
  return await this.unitOfWork.transaction(async () => {
    const rule = await this.ruleRepository.create(rule);
    await this.eventPublisher.publish(new RuleCreatedEvent(rule));
    return rule;
  });
}
```

## Testing Benefits
```typescript
// Easy mocking in tests
const mockRuleRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  // ...
};

const handler = new CreateRuleHandler(mockRuleRepository);
```

## Anti-Patterns

### ❌ Wrong - Handler using database directly
```typescript
export class GetRuleHandler {
  constructor(
    @InjectRepository(RuleEntity) // ❌ WRONG
    private readonly repository: Repository<RuleEntity>,
  ) {}
}
```

### ✅ Correct - Handler using repository port
```typescript
export class GetRuleHandler {
  constructor(
    private readonly ruleRepository: RuleRepository, // ✅ CORRECT
  ) {}
}
```

## Related Rules
- `CLEAN_ARCHITECTURE_LAYERS` - Layer separation
- `DEPENDENCY_INVERSION` - Depend on abstractions
- `UNIT_OF_WORK` - Transaction management
