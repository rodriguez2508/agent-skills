---
name: clean-architecture
description: Implement Clean Architecture combined with CQRS for scalable NestJS applications
tags: [architecture, clean-architecture, cqrs, nestjs, hexagonal, patterns]
---

# Clean Architecture Skill

This skill implements Clean Architecture combined with CQRS pattern for scalable and maintainable NestJS applications.

## When to Use

Use this skill when the user asks to:
- Design a new application architecture
- Refactor existing code to Clean Architecture
- Understand layer separation
- Implement a new module
- Apply best architectural patterns

## Architecture Layers

### 1. Layer Structure

```
src/
├── core/                    # Domain Layer
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── ports/
│   └── events/
│
├── application/             # Application Layer (CQRS)
│   ├── commands/
│   ├── queries/
│   └── ports/
│
├── infrastructure/          # Infrastructure Layer
│   ├── adapters/
│   ├── persistence/
│   └── search/
│
└── presentation/            # Presentation Layer
    ├── controllers/
    └── dto/
```

### 2. Layer Responsibilities

| Layer | Responsibility | Dependencies |
|-------|---------------|-------------|
| **Domain** | Entities, Value Objects, Business Rules | None (pure) |
| **Application** | Use Cases, CQRS Handlers | Domain |
| **Infrastructure** | DB, External APIs, Adapters | Application |
| **Presentation** | Controllers, DTOs, HTTP | Application |

## Entity Example

```typescript
// core/domain/entities/user.entity.ts
export class User {
  public readonly id: string;
  public readonly email: Email;
  public readonly name: string;
  public readonly createdAt: Date;

  private constructor(data: UserData) {
    this.id = data.id;
    this.email = data.email;
    this.name = data.name;
    this.createdAt = data.createdAt;
  }

  static create(data: CreateUserData): User {
    // Business logic validation here
    return new User(data);
  }

  updateProfile(name: string): void {
    this.name = name;
  }
}
```

## Port Interface (Domain)

```typescript
// core/domain/ports/user.repository.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
```

## Infrastructure Adapter

```typescript
// infrastructure/persistence/user.repository.ts
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  private toDomain(entity: UserEntity): User {
    return User.create({
      id: entity.id,
      email: entity.email,
      name: entity.name,
      createdAt: entity.createdAt,
    });
  }
}
```

## Key Principles

### 1. Dependency Rule
- **Inner layers** never depend on outer layers
- Dependencies point inward only
- Use **ports** (interfaces) to invert dependencies

### 2. Single Responsibility
- Each layer has one job
- Controllers = HTTP handling
- Application = orchestration
- Domain = business logic

### 3. Separation of Concerns
- CQRS: Separate reads from writes
- Queries = single responsibility for reading
- Commands = single responsibility for writing

## Benefits

| Benefit | Description |
|---------|------------|
| **Testability** | Test each layer independently |
| **Maintainability** | Isolated changes by layer |
| **Scalability** | Optimize reads/writes separately |
| **Flexibility** | Swap infrastructure without domain changes |

## References

- Clean Architecture: Robert C. Martin
- CQRS: Greg Young
- Hexagonal Architecture: Alistair Cockburn