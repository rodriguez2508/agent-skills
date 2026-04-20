---
name: cqrs-pattern
description: Implement Command Query Responsibility Segregation (CQRS) - Commands and Queries separation
tags: [architecture, cqrs, commands, queries, pattern, nestjs]
---

# CQRS Pattern Skill

This skill implements Command Query Responsibility Segregation pattern for NestJS applications.

## When to Use

Use this skill when the user asks to:
- Design data operations
- Implement create/update/delete operations
- Design read operations
- Separate read/write concerns
- Optimize database queries

## CQRS Core Concepts

### Command vs Query

| Aspect | Command | Query |
|--------|---------|-------|
| **Purpose** | Change state | Read state |
| **Returns** | void/result | data |
| **Side effects** | Yes | No |
| **Idempotent** | Depends | Yes |

## Commands Structure

```
src/modules/user/application/
├── commands/
│   ├── create-user/
│   │   ├── create-user.command.ts
│   │   └── create-user.handler.ts
│   ├── update-user/
│   │   └── update-user.handler.ts
│   └── delete-user/
│       └── delete-user.handler.ts
```

### Command Example

```typescript
// commands/create-user/create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly password: string,
  ) {}
}

// commands/create-user/create-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommandBus } from '@nestjs/cqrs';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    // Validation
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    // Create domain entity
    const user = User.create({
      email: command.email,
      name: command.name,
      password: command.password,
    });

    // Save
    await this.userRepository.save(user);

    // Publish event
    this.eventBus.publish(new UserCreatedEvent(user.id, user.email));

    return user.id;
  }
}
```

## Queries Structure

```
src/modules/user/application/
└── queries/
    ├── get-user/
    │   ├── get-user.query.ts
    │   └── get-user.handler.ts
    └── list-users/
        └── list-users.handler.ts
```

### Query Example

```typescript
// queries/get-user/get-user.query.ts
export class GetUserQuery {
  constructor(
    public readonly userId: string,
  ) {}
}

// queries/get-user/get-user.handler.ts
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<UserDTO> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Just return DTO, no business logic
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
```

## Controller

```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<{ id: string }> {
    const command = new CreateUserCommand(dto.email, dto.name, dto.password);
    const userId = await this.commandBus.execute(command);
    return { id: userId };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<UserDTO> {
    const query = new GetUserQuery(id);
    return await this.queryBus.execute(query);
  }

  @Get()
  async list(@Query() dto: ListUsersDto): Promise<UserDTO[]> {
    const query = new ListUsersQuery(dto.limit, dto.offset);
    return await this.queryBus.execute(query);
  }
}
```

## Benefits

| Aspect | Benefit |
|--------|---------|
| **Semantics** | Command name = clear intention |
| **Testability** | Test each handler independently |
| **Audit** | Commands = change history |
| **Optimization** | Separate read/write databases |
| **Scalability** | Scale queries independently |

## Wrong Approach

```typescript
// ❌ DON'T: Mixed read/write
@Injectable()
export class UserService {
  async getUser(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    // Business logic in query!
    if (user.isBlocked) {
      throw new ForbiddenException();
    }
    return user;
  }

  async createUser(dto: Dto): Promise<User> {
    // Query in command!
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException();
    }
    return this.repo.save(dto);
  }
}
```

## Right Approach

```typescript
// ✅ DO: Separate Commands and Queries

// Query - just read, no logic
@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  async execute(query: GetUserQuery): Promise<User> {
    return this.repo.findOne({ where: { id: query.userId } });
  }
}

// Command - validate and change state
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<User> {
    // Validate here
    // Change state here
    // Publish events here
    return this.repo.save(command);
  }
}
```

## Key Takeaways

1. **Commands change state** - Use verbs (Create, Update, Delete)
2. **Queries read state** - Use nouns or verb-ish (Get, List, Search)
3. **No business logic in queries** - Just return DTOs
4. **Validation in commands** - Business rules here
5. **Events after commands** - Notify other parts of system