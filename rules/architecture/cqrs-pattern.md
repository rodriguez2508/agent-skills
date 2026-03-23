# Rule: CQRS Pattern Implementation
**Category:** architecture  
**Impact:** HIGH  
**Tags:** cqrs, commands, queries, handlers

## Description
The application MUST implement CQRS (Command Query Responsibility Segregation) pattern to separate read and write operations.

## Rules

### Command vs Query Separation
- **Commands**: Operations that change state (create, update, delete)
- **Queries**: Operations that read state (get, list, search)
- Commands and Queries MUST be separate classes
- Each Command/Query MUST have exactly one Handler

### Command Structure
```typescript
// Command definition
export class CreateRuleCommand implements ICommand<Rule> {
  constructor(
    public readonly name: string,
    public readonly content: string,
    public readonly category: string,
  ) {}
}

// Command Handler
export class CreateRuleHandler implements ICommandHandler<CreateRuleCommand, Rule> {
  async execute(command: CreateRuleCommand): Promise<Rule> {
    // Implementation
  }
}
```

### Query Structure
```typescript
// Query definition
export class GetRuleByIdQuery implements IQuery<Rule | null> {
  constructor(public readonly id: string) {}
}

// Query Handler
export class GetRuleByIdHandler implements IQueryHandler<GetRuleByIdQuery, Rule | null> {
  async execute(query: GetRuleByIdQuery): Promise<Rule | null> {
    // Implementation
  }
}
```

### Handler Responsibilities
- Handlers MUST be thin orchestration layers
- Business logic MUST be in domain entities/services
- Handlers MUST use repository ports (not direct implementations)
- Handlers MUST return domain entities or DTOs (never database models)

### Event Publishing
- Commands that change state SHOULD publish domain events
- Events MUST be published after transaction completion
- Event handlers MUST be side-effect free

## File Organization
```
src/application/
├── commands/
│   ├── create-rule/
│   │   ├── create-rule.command.ts
│   │   └── handlers/
│   │       └── create-rule.handler.ts
│   └── update-rule/
├── queries/
│   ├── get-rule/
│   │   ├── get-rule.query.ts
│   │   └── handlers/
│   │       └── get-rule.handler.ts
│   └── list-rules/
└── events/
    └── handlers/
```

## Benefits
- Clear separation of concerns
- Easier testing (commands and queries tested separately)
- Independent scaling of read/write operations
- Better audit trail for commands

## Related Rules
- `CLEAN_ARCHITECTURE_LAYERS` - Layer separation
- `DOMAIN_EVENTS` - Event-driven architecture
- `REPOSITORY_PATTERN` - Data access
