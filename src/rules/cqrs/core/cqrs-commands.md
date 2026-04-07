---
title: CQRS Commands
impact: HIGH
impactDescription: "40%+ mejor testabilidad y separación de intenciones"
tags: cqrs, commands, writes, mutations
---

## CQRS Commands

**Impact: HIGH** — Los Commands encapsulan operaciones de escritura con semántica clara. Cada comando representa una intención de cambio en el sistema.

### Estructura por Funcionalidad

```
src/modules/user/
├── application/
│   ├── commands/
│   │   └── create-user/
│   │       ├── create-user.command.ts
│   │       └── create-user.handler.ts
│   └── update-user/
│       ├── update-user.command.ts
│       └── update-user.handler.ts
```

### Incorrect (mezclar con queries)

```typescript
// ❌ Mezcla de lectura y escritura
@Injectable()
export class UserService {
  async getUser(id: string): Promise<User> {
    return this.repo.findOne({ where: { id } });
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    return this.repo.save({ ...dto, password: hashed });
  }
}
```

### Correct (Commands separados por funcionalidad)

```typescript
// application/commands/create-user/create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly email: Email,
    public readonly name: string,
    public readonly password: string,
  ) {}
}

// application/commands/create-user/create-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from './create-user.command';
import { UserRepository } from '../../domain/repositories/user.repository.interface';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const user = User.create({
      email: command.email.value,
      name: command.name,
      password: command.password,
    });

    await this.userRepository.save(user);
    this.eventBus.publish(new UserCreatedEvent(user.id, user.email));

    return user.id;
  }
}

// application/commands/update-user/update-user.command.ts
export class UpdateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly name?: string,
    public readonly email?: Email,
  ) {}
}

// application/commands/update-user/update-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateUserCommand } from './update-user.command';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateUserCommand): Promise<void> {
    const user = await this.userRepository.findById(command.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (command.name) user.updateName(command.name);
    if (command.email) user.updateEmail(command.email.value);

    await this.userRepository.save(user);
    this.eventBus.publish(new UserUpdatedEvent(user.id));
  }
}

// application/commands/delete-user/delete-user.command.ts
export class DeleteUserCommand {
  constructor(public readonly userId: string) {}
}

// application/commands/delete-user/delete-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteUserCommand } from './delete-user.command';

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeleteUserCommand): Promise<void> {
    const user = await this.userRepository.findById(command.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.softDelete();
    await this.userRepository.save(user);
    this.eventBus.publish(new UserDeletedEvent(user.id));
  }
}
```

### Controller usando CommandBus

```typescript
// presentation/rest/user.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateUserCommand } from '../../application/commands/create-user/create-user.command';
import { CreateUserDto } from '../../application/dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto): Promise<{ id: string }> {
    const command = new CreateUserCommand(
      dto.email,
      dto.name,
      dto.password,
    );

    const userId = await this.commandBus.execute(command);
    return { id: userId };
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: string): Promise<void> {
    const command = new DeleteUserCommand(id);
    await this.commandBus.execute(command);
  }
}
```

### Benefits de Commands

| Aspecto | Benefit |
|---------|---------|
| **Semántica** | Nombre del command indica intención clara |
| **Testabilidad** | Cada command tiene su handler testeable |
| **Auditoría** | Log de commands = historial de cambios |
| **Retry** | Commands idempotentes pueden reintentarse |

Reference: [CQRS - Commands](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/cqrs-command-microservice)
