---
title: Command Bus
impact: MEDIUM
impactDescription: "Despacho centralizado de commands"
tags: cqrs, command-bus, dispatching, mediator
---

## Command Bus

**Impact: MEDIUM** — El Command Bus actúa como mediator entre controllers y handlers. Despacha commands a sus handlers correspondientes de forma transparente.

### Arquitectura del Command Bus

```
Controller → CommandBus.execute(command) → Middleware → Handler → Repository
                     │
                     ├── Logging
                     ├── Validation
                     ├── Transaction
                     └── Retry
```

### Incorrect (dispatch manual)

```typescript
// ❌ Controller conoce directamente al handler
@Injectable()
export class UserController {
  constructor(
    private readonly createUserHandler: CreateUserHandler,
  ) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    // Controller depende directamente del handler
    const command = new CreateUserCommand(dto.email, dto.name, dto.password);
    return this.createUserHandler.execute(command);
  }
}

// Problema: Si hay muchos handlers, controller se llena de dependencias
// Problema: No hay punto central para cross-cutting concerns
```

### Correct (Command Bus)

```typescript
// application/commands/create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
    public readonly password: string,
  ) {}
}

// presentation/rest/user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    const command = new CreateUserCommand(dto.email, dto.name, dto.password);
    return this.commandBus.execute(command);
  }
}

// Middleware de logging
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const command = context.getArgByIndex(0);
    const commandName = command.constructor.name;

    console.log(`[CommandBus] Executing: ${commandName}`);

    return next.handle().pipe(
      tap(result => {
        console.log(`[CommandBus] Completed: ${commandName}, Result: ${result}`);
      }),
      catchError(error => {
        console.error(`[CommandBus] Failed: ${commandName}`, error);
        throw error;
      }),
    );
  }
}

// Configuración del Command Bus
@Module({
  imports: [CqrsModule],
  providers: [
    CreateUserHandler,
    UpdateUserHandler,
    DeleteUserHandler,
  ],
})
export class ApplicationModule {}

// CqrsModule ya registra los handlers automáticamente
// @CommandHandler(CreateUserCommand) → CrearUserHandler
```

### Command Bus con Middleware

```typescript
// application/middleware/transaction.middleware.ts
@Injectable()
export class TransactionMiddleware implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const command = context.getArgByIndex(0);

    // Solo commands, no queries
    if (!this.isCommand(command)) {
      return next.handle();
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await next.handle();

      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private isCommand(command: any): boolean {
    return command instanceof CreateUserCommand ||
           command instanceof UpdateUserCommand ||
           command instanceof DeleteUserCommand;
  }
}

// application/middleware/retry.middleware.ts
@Injectable()
export class RetryMiddleware implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const command = context.getArgByIndex(0);
    const retries = this.getRetries(command);

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < retries) {
      try {
        return await lastValueFrom(next.handle());
      } catch (error) {
        lastError = error;
        if (!this.isRetryable(error)) {
          throw error;
        }
        attempt++;
        await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }

    throw lastError;
  }

  private getRetries(command: any): number {
    if (command instanceof CreateUserCommand) return 3;
    if (command instanceof UpdateUserCommand) return 2;
    return 1;
  }

  private isRetryable(error: any): boolean {
    return error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Registro Manual de Handlers

```typescript
// application/commands/handlers/index.ts
import { CreateUserHandler } from './create-user.handler';
import { UpdateUserHandler } from './update-user.handler';
import { DeleteUserHandler } from './delete-user.handler';

export const COMMAND_HANDLERS = [
  CreateUserHandler,
  UpdateUserHandler,
  DeleteUserHandler,
];

// app.module.ts
@Module({
  providers: [
    ...COMMAND_HANDLERS,
    {
      provide: CommandBus,
      useFactory: (...handlers: ICommandHandler[]) => {
        const bus = new CommandBus();
        handlers.forEach(handler => {
          const metadata = Reflect.getMetadata(
            'command',
            handler,
          );
          bus.register({
            command: metadata,
            handler,
          });
        });
        return bus;
      },
      inject: [...COMMAND_HANDLERS],
    },
  ],
})
export class AppModule {}
```

Reference: [Mediator Pattern](https://refactoring.guru/design-patterns/mediator)
