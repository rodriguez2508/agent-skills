---
title: Ports and Adapters
impact: CRITICAL
impactDescription: "Desacoplamiento total del core de negocio"
tags: hexagonal, ports, adapters, dependency-inversion
---

## Ports and Adapters

**Impact: CRITICAL** — Hexagonal Architecture aísla la lógica de negocio de las tecnologías externas mediante puertos (interfaces) y adaptadores (implementaciones).

### Arquitectura Hexagonal

```
                    ┌─────────────────────────┐
                    │      APPLICATION         │
                    │   (Core de Negocio)     │
                    │                         │
                    │  ┌───────────────────┐  │
    ┌──────────┐    │  │   Domain Entities  │  │    ┌──────────────┐
    │   HTTP   │◄───┼──│   Domain Services  │  ├──►│  Database     │
    │  Client  │    │  │   Use Cases       │  │    │  (TypeORM)   │
    └──────────┘    │  └───────────────────┘  │    └──────────────┘
                    │                         │
                    │       PUERTOS            │
                    │  ┌───────────────────┐  │
    ┌──────────┐    │  │  IUserRepository  │  │    ┌──────────────┐
    │  GraphQL │◄───┼──│  IEmailService     │  ├──►│  Redis Cache  │
    │  Client  │    │  │  IEventPublisher  │  │    │  (Cache)     │
    └──────────┘    │  └───────────────────┘  │    └──────────────┘
                    │                         │
                    └─────────────────────────┘
                           │              │
                           │ ADAPTADORES  │
                           ▼              ▼
                    ┌──────────┐   ┌──────────┐
                    │  REST    │   │ PostgreSQL│
                    │ Controller│   │  Adapter │
                    └──────────┘   └──────────┘
```

### Incorrect (dependencias inversas)

```typescript
// application/service con dependencias concretas
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: TypeormUserRepository, // ❌ Dependencia concreta
    private readonly emailService: SendGridEmailService,    // ❌ Dependencia concreta
    private readonly cacheManager: RedisCacheManager,        // ❌ Dependencia concreta
  ) {}

  async createUser(dto: CreateUserDto) {
    // Si queremos cambiar Redis por Memory Cache, toca modificar este código
    // Si queremos cambiar SendGrid por AWS SES, toca modificar este código
  }
}
```

### Correct (puertos y adaptadores)

```typescript
// domain/ports/inbound/user.repository.port.ts (Puerto de entrada)
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(filters: UserFilters): Promise<User[]>;
}

export interface UserFilters {
  name?: string;
  email?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// domain/ports/outbound/email.service.port.ts (Puerto de salida)
export interface EmailService {
  sendWelcomeEmail(email: string, name: string): Promise<void>;
  sendPasswordReset(email: string, token: string): Promise<void>;
}

// domain/ports/outbound/cache.port.ts
export interface CachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// infrastructure/adapters/typeorm-user.repository.ts
@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly ormRepo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.ormRepo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<void> {
    const entity = this.toEntity(user);
    await this.ormRepo.save(entity);
  }
}

// infrastructure/adapters/sendgrid-email.service.ts
@Injectable()
export class SendGridEmailService implements EmailService {
  constructor(private readonly config: ConfigService) {}

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    // Implementación SendGrid
  }
}

// infrastructure/adapters/redis-cache.adapter.ts
@Injectable()
export class RedisCacheAdapter implements CachePort {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(key, value, ttlSeconds);
  }
}
```

### Inyección de Dependencias

```typescript
// application/services/create-user.handler.ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler {
  constructor(
    private readonly userRepository: UserRepository,    // Puerto - abstracción
    private readonly emailService: EmailService,       // Puerto - abstracción
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    const user = User.create({
      email: command.email,
      name: command.name,
    });

    await this.userRepository.save(user);       // Usa cualquier adapter
    await this.emailService.sendWelcomeEmail(  // Usa cualquier adapter
      user.email,
      user.name,
    );

    return user.id;
  }
}

// Módulo de infraestructura - bindea puertos a adaptadores
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    // Puerto → Implementación concreta
    {
      provide: 'UserRepository',
      useClass: TypeormUserRepository,
    },
    {
      provide: 'EmailService',
      useClass: process.env.EMAIL_PROVIDER === 'ses'
        ? SesEmailService
        : SendGridEmailService,
    },
    {
      provide: 'CachePort',
      useClass: RedisCacheAdapter,
    },
  ],
  exports: ['UserRepository', 'EmailService', 'CachePort'],
})
export class InfrastructureModule {}
```

### Beneficios del Patrón

| Beneficio | Descripción |
|-----------|-------------|
| **Testabilidad** | Mock de puertos sin necesidad de frameworks |
| **Flexibilidad** | Cambiar adaptadores sin modificar core |
| **Reusabilidad** | mismo core con diferentes tecnologías |
| **Mantenibilidad** | Cambios externos no afectan lógica de negocio |

Reference: [Hexagonal Architecture - Alistair Cockburn](https://alistair.cockburn.us/hexagonal+architecture)
