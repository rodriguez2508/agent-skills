# Rule: Domain Events Pattern
**Category:** architecture  
**Impact:** MEDIUM  
**Tags:** domain-events, events, eda, messaging

## Description
Domain events MUST be used to capture side effects and communicate state changes across bounded contexts without coupling.

## Rules

### Event Naming
- Events MUST be named in past tense (RuleCreated, RuleUpdated)
- Events MUST represent business facts, not technical operations
- Event names MUST be ubiquitous language of the domain

### Event Structure
```typescript
// src/core/domain/events/rule-created.event.ts
export class RuleCreatedEvent implements IDomainEvent {
  public readonly occurredOn: Date;
  public readonly eventId: string;

  constructor(
    public readonly ruleId: string,
    public readonly ruleName: string,
    public readonly category: string,
  ) {
    this.occurredOn = new Date();
    this.eventId = crypto.randomUUID();
  }
}
```

### Publishing Events
```typescript
// In command handler after transaction
export class CreateRuleHandler {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(command: CreateRuleCommand): Promise<Rule> {
    const rule = Rule.create(command);
    await this.ruleRepository.create(rule);
    
    // Publish AFTER persistence
    await this.eventPublisher.publish(new RuleCreatedEvent(
      rule.id,
      rule.name,
      rule.category,
    ));
    
    return rule;
  }
}
```

### Event Handlers
```typescript
// src/application/events/handlers/rule-created.handler.ts
@Injectable()
export class RuleCreatedEventHandler {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly searchIndexer: SearchIndexer,
  ) {}

  @OnEvent('rule.created')
  async handle(event: RuleCreatedEvent): Promise<void> {
    // Side effects - no business logic
    await this.notificationService.notifyRuleCreated(event);
    await this.searchIndexer.index(event.ruleId);
  }
}
```

### Event Bus Interface
```typescript
// src/core/domain/ports/event-bus.port.ts
export interface EventBus {
  publish(event: IDomainEvent): Promise<void>;
  publishAll(events: IDomainEvent[]): Promise<void>;
  subscribe<T extends IDomainEvent>(
    eventClass: Class<T>,
    handler: (event: T) => Promise<void>,
  ): void;
}
```

## Event Ordering
- Events from same aggregate MUST be published in order
- Events across aggregates MAY be eventually consistent
- Event handlers MUST be idempotent

## Anti-Patterns

### ❌ Wrong - Event before persistence
```typescript
await this.eventPublisher.publish(new RuleCreatedEvent(rule)); // ❌
await this.ruleRepository.create(rule); // What if this fails?
```

### ✅ Correct - Event after persistence
```typescript
await this.ruleRepository.create(rule); // ✅
await this.eventPublisher.publish(new RuleCreatedEvent(rule));
```

### ❌ Wrong - Business logic in event handler
```typescript
@OnEvent('rule.created')
async handle(event: RuleCreatedEvent) {
  // ❌ WRONG - This is business logic
  if (event.category === 'critical') {
    rule.approve();
  }
}
```

### ✅ Correct - Side effects only
```typescript
@OnEvent('rule.created')
async handle(event: RuleCreatedEvent) {
  // ✅ CORRECT - Side effect only
  await this.emailService.sendAdminNotification(event);
}
```

## Related Rules
- `CQRS_PATTERN` - Command/Query separation
- `AGGREGATE_ROOT` - Aggregate boundaries
- `EVENTUAL_CONSISTENCY` - Consistency model
