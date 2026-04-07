---
title: Clean Architecture Layers
impact: CRITICAL
impactDescription: "Base para toda la arquitectura - 40%+ mejor testabilidad"
tags: clean-architecture, layers, domain, application
---

## Clean Architecture Layers

**Impact: CRITICAL** — La separación en capas garantiza testabilidad, mantenibilidad y escalabilidad. Las dependencias fluyen hacia el centro, nunca hacia afuera.

### Estructura por Módulo

```
src/modules/user/
├── domain/           # Reglas de negocio puras (sin dependencias externas)
│   ├── entities/     # Entidades de dominio
│   ├── value-objects/# Value Objects para integridad
│   ├── repositories/ # Interfaces (puertos - abstracciones)
│   ├── services/     # Servicios de dominio
│   └── events/       # Eventos de dominio
├── application/      # Casos de uso (CQRS)
│   ├── commands/     # Comandos (escritura)
│   ├── queries/      # Queries (lectura)
│   ├── handlers/     # Handlers de Commands/Queries
│   ├── services/     # Servicios de aplicación
│   └── dto/          # DTOs específicos por operación
├── infrastructure/   # Implementaciones concretas
│   ├── repositories/ # Adaptadores de repositorios
│   ├── external/     # APIs externas, gRPC clients
│   └── persistence/ # Migraciones, TypeORM entities
└── presentation/     # Controllers, GraphQL Resolvers
    ├── rest/
    ├── graphql/
    └── grpc/
```

### Incorrect (todo mezclado)

```typescript
// user.service.ts - Lógica de dominio + persistencia + validaciones + efectos
@Injectable()
export class UserService {
  constructor(
    private repo: Repository<UserEntity>,
    private bcrypt: BcryptService,
    private email: EmailService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const hashed = await this.bcrypt.hash(dto.password, 10);
    const user = await this.repo.save({ ...dto, password: hashed });
    await this.email.sendWelcome(dto.email);
    await this.analytics.track('user_created', user);
    return user;
  }
}

// Problemas:
// 1. Lógica de negocio mezclada con persistencia
// 2. Efectos secundarios (email, analytics) acoplados
// 3. Dificultad para testear sin mocks externos
// 4. No reusable fuera de NestJS
```

### Correct (capas separadas)

```typescript
// domain/entities/user.entity.ts - Entidad pura
export class User {
  constructor(
    private readonly _id: string,
    private readonly _email: string,
    private readonly _password: string,
    private readonly _createdAt: Date,
  ) {}

  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get createdAt(): Date { return this._createdAt; }

  static create(props: CreateUserProps): User {
    return new User(
      generateId(),
      props.email,
      props.password,
      new Date(),
    );
  }
}

// domain/services/user.domain-service.ts - Lógica de dominio
@Injectable({ scope: Scope.TRANSIENT })
export class UserDomainService {
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// application/commands/handlers/create-user.handler.ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const user = User.create({
      email: command.email,
      password: command.password,
    });

    await this.userRepository.save(user);
    this.eventBus.publish(new UserCreatedEvent(user.id, user.email));

    return user.id;
  }
}

// infrastructure/repositories/typeorm-user.repository.ts
@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {}

  async save(user: User): Promise<void> {
    const entity = this.toEntity(user);
    await this.repo.save(entity);
  }

  private toEntity(user: User): UserEntity {
    const entity = new UserEntity();
    entity.id = user.id;
    entity.email = user.email;
    entity.password = user.password;
    entity.createdAt = user.createdAt;
    return entity;
  }
}
```

### Regla de Dependencia

**El inner層 no depende del outer層. El outer層 depende del inner層.**

```typescript
// CORRECTO: Dependencia hacia abstracciones
// application/commands/handlers/create-user.handler.ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler {
  constructor(
    private readonly userRepository: UserRepository, // Abstraction
    private readonly eventBus: EventBus,             // Abstraction
  ) {}
}

// INFRASTRUCTURE implementa la abstracción
@Injectable()
export class TypeormUserRepository implements UserRepository {
  // Implementación concreta
}
```

Reference: [Clean Architecture - Uncle Bob](https://blog.cleancoder.com/uncle-blog/2012/08/13/the-clean-architecture.html)
