---
title: Event Bus
impact: MEDIUM
impactDescription: "Comunicación desacoplada entre bounded contexts"
tags: cqrs, event-bus, domain-events, messaging
---

## Event Bus

**Impact: MEDIUM** — El Event Bus permite publicación y suscripción de eventos de dominio. Los eventos representan algo que ya ocurrió y pueden procesarse de forma asíncrona.

### Anatomía de un Evento

```typescript
// domain/events/user-created.event.ts
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

// domain/events/order-shipped.event.ts
export class OrderShippedEvent {
  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly carrier: string,
    public readonly shippedAt: Date = new Date(),
  ) {}
}
```

### Incorrect (efectos secundarios acoplados)

```typescript
// ❌ Envío de email directamente en el handler
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly emailService: EmailService, // ❌ Acoplado
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const user = User.create({ email: command.email, name: command.name });

    await this.userRepo.save(user);

    // ❌ Envío de email acoplado al command
    await this.emailService.sendWelcome(user.email, user.name);

    return user.id;
  }
}

// Problema: Si el email falla, toda la transacción falla
// Problema: No se pueden agregar más efectos sin modificar el handler
// Problema: Testing requiere mock de email service
```

### Correct (eventos desacoplados)

```typescript
// domain/events/user-created.event.ts
export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

// application/commands/handlers/create-user.handler.ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus, // ✅ Solo publica eventos
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const user = User.create({ email: command.email, name: command.name });
    await this.userRepository.save(user);

    // ✅ Publicar evento - efectos son responsabilidad de subscribers
    this.eventBus.publish(new UserCreatedEvent(user.id, user.email));

    return user.id;
  }
}

// infrastructure/event-handlers/user-created-email.handler.ts
@Injectable()
export class UserCreatedEmailHandler implements EventHandler<UserCreatedEvent> {
  constructor(
    private readonly emailService: EmailService,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    await this.emailService.sendWelcome(event.email);
  }
}

// infrastructure/event-handlers/user-created-analytics.handler.ts
@Injectable()
export class UserCreatedAnalyticsHandler implements EventHandler<UserCreatedEvent> {
  constructor(
    private readonly analytics: AnalyticsService,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    await this.analytics.track('user_created', {
      userId: event.userId,
      email: event.email,
      timestamp: event.occurredAt,
    });
  }
}

// infrastructure/event-handlers/user-created-welcome-sequence.handler.ts
@Injectable()
export class UserCreatedWelcomeSequenceHandler
  implements EventHandler<UserCreatedEvent> {
  constructor(
    private readonly queue: QueueService,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    // Agregar a cola para procesamiento asíncrono
    await this.queue.add('welcome-sequence', {
      userId: event.userId,
      email: event.email,
    });
  }
}
```

### Event Bus con NestJS

```typescript
// app.module.ts - Registro de event handlers
@Module({
  imports: [CqrsModule],
  providers: [
    // Command Handlers
    CreateUserHandler,
    // Event Handlers
    UserCreatedEmailHandler,
    UserCreatedAnalyticsHandler,
    UserCreatedWelcomeSequenceHandler,
  ],
})
export class AppModule {}

// Los event handlers se registran automáticamente
// @Injectable()
// export class UserCreatedEmailHandler implements EventHandler<UserCreatedEvent> {
//   @Events(UserCreatedEvent)
//   async handle(event: UserCreatedEvent): Promise<void> {}
// }
```

### Event Store para Auditoría

```typescript
// domain/events/event-base.ts
export abstract class DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date = new Date(),
    public readonly eventId: string = generateUUID(),
  ) {}
}

// infrastructure/persistence/event-store.ts
@Injectable()
export class EventStore {
  constructor(
    @InjectRepository(EventStoreEntity)
    private readonly repo: Repository<EventStoreEntity>,
  ) {}

  async save<T extends DomainEvent>(event: T): Promise<void> {
    const entity = new EventStoreEntity();
    entity.eventId = event.eventId;
    entity.aggregateId = event.aggregateId;
    entity.eventType = event.constructor.name;
    entity.payload = JSON.stringify(event);
    entity.occurredAt = event.occurredAt;

    await this.repo.save(entity);
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const entities = await this.repo.find({
      where: { aggregateId },
      order: { occurredAt: 'ASC' },
    });

    return entities.map(e => JSON.parse(e.payload) as DomainEvent);
  }
}

// Reconstruir estado desde eventos (Event Sourcing)
@Injectable()
export class UserRepository {
  constructor(
    private readonly eventStore: EventStore,
  ) {}

  async findById(id: string): Promise<User | null> {
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) return null;

    return User.reconstitute(id, events);
  }
}

// User entity con event sourcing
export class User {
  private constructor(
    private readonly id: string,
    private events: DomainEvent[],
  ) {}

  static reconstitute(id: string, events: DomainEvent[]): User {
    const user = new User(id, events);
    events.forEach(event => user.apply(event));
    return user;
  }

  apply(event: DomainEvent): void {
    switch (event) {
      case UserCreatedEvent e:
        this.email = e.email;
        break;
      case UserEmailChangedEvent e:
        this.email = e.newEmail;
        break;
    }
  }
}
```

### Dead Letter Queue para Eventos Fallidos

```typescript
// infrastructure/event-handlers/dead-letter.handler.ts
@Injectable()
export class DeadLetterEventHandler implements EventHandler<any> {
  constructor(
    private readonly deadLetterQueue: Queue,
    private readonly logger: Logger,
  ) {}

  async handle(failedEvent: any, error: Error): Promise<void> {
    this.logger.error(
      `Event ${failedEvent.constructor.name} failed after retries`,
      error.stack,
    );

    await this.deadLetterQueue.add('failed-events', {
      event: failedEvent,
      error: error.message,
      failedAt: new Date(),
      retries: failedEvent.retries || 0,
    });
  }
}
```

Reference: [Domain Events - Jimmy Bogard](https://lostechies.com/jimmybogard/2010/04/07/framework-essay-domain-events/)
