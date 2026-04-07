---
title: Abstract vs Concrete Dependencies
impact: HIGH
impactDescription: "Claridad en qué es abstracción y qué es implementación"
tags: abstraction, concrete, dependencies, patterns
---

## Abstract vs Concrete Dependencies

**Impact: HIGH** — Distinguir entre abstracciones (interfaces/puertos) y concreciones (implementaciones/adaptadores) es fundamental para mantener el acoplamiento correcto.

### Clasificación de Dependencias

```
┌─────────────────────────────────────────────────────────────┐
│                    ABSTRACCIONES                            │
│  Interfaces, Types, Abstract Classes                       │
│  Definen CONTRATO - no implementan lógica                  │
│  Ubicación: domain/ports/, domain/types/                   │
├─────────────────────────────────────────────────────────────┤
│                    CONCRECIONES                            │
│  Classes con lógica, adaptadores, servicios                │
│  Implementan CONTRATO - tienen dependencias                │
│  Ubicación: infrastructure/adapters/, services/            │
├─────────────────────────────────────────────────────────────┤
│                    CONFIGURACIÓN                           │
│  Factories, Builders, Configuradores                       │
│  Crean y conectan dependencias                             │
│  Ubicación: infrastructure/config/, bootstrap/             │
└─────────────────────────────────────────────────────────────┘
```

### Incorrect (mezclar abstracción y concreción)

```typescript
// ❌ TODO junto - difícil de testear, difícil de mantener
@Injectable()
export class UserService {
  constructor(
    private repo: TypeormUserRepository,   // ❌ Concrete
    private sendGrid: SendGridEmailService, // ❌ Concrete
    private redis: RedisCacheManager,       // ❌ Concrete
    private http: AxiosAdapter,             // ❌ Concrete
  ) {}
}

// ❌ Implementación mezclada con puerto
export interface UserRepository {
  async save(user: User): Promise<void> {  // ❌ Default implementation
    // Esta interfaz tiene lógica - no es puro contrato
  }
}
```

### Correct (separación estricta)

```typescript
// domain/ports/user.repository.port.ts - SOLO abstracción
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}

// domain/types/user.types.ts - Tipos puros
export type UserFilters = {
  name?: string;
  email?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
};

export type CreateUserProps = {
  email: string;
  name: string;
  password: string;
};

// infrastructure/adapters/typeorm-user.repository.ts - SOLO concreción
@Injectable()
export class TypeormUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
    private readonly mapper: UserMapper,
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async save(user: User): Promise<void> {
    const entity = this.mapper.toEntity(user);
    await this.repo.save(entity);
  }
}
```

### Dependency Graph Correcto

```typescript
// ✓ Dominio no conoce nada de Infraestructura
// ✓ Infraestructura implementa contratos del dominio
// ✓ Application usa solo contratos del dominio

// DOMAIN (nivel 0 - no conoce a nadie)
export interface UserRepository {
  save(user: User): Promise<void>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

// APPLICATION (nivel 1 - conoce DOMAIN)
@Injectable()
export class CreateUserHandler {
  constructor(
    private readonly userRepo: UserRepository,     // Depende de Domain
    private readonly eventBus: EventPublisher,      // Depende de Domain
  ) {}
}

// INFRASTRUCTURE (nivel 2 - implementa Domain)
@Injectable()
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly ds: DataSource) {}  // Depende de frameworks
}

@Injectable()
export class KafkaEventPublisher implements EventPublisher {
  constructor(private readonly kafka: KafkaClient) {} // Depende de frameworks
}
```

### Patrón Abstract Factory

```typescript
// domain/factories/user.factory.ts
export abstract class UserFactory {
  abstract createUser(props: CreateUserProps): User;
  abstract createAdminUser(props: CreateUserProps, role: string): User;
}

// infrastructure/factories/typeorm-user.factory.ts
@Injectable()
export class TypeormUserFactory extends UserFactory {
  createUser(props: CreateUserProps): User {
    return User.create(props);
  }

  createAdminUser(props: CreateUserProps, role: string): User {
    const admin = User.create(props);
    admin.addRole(role);
    return admin;
  }
}

// application/service - solo conoce abstracción
@Injectable()
export class UserApplicationService {
  constructor(
    private readonly userFactory: UserFactory,  // Abstraction
  ) {}

  async createAdmin(email: string, name: string): Promise<User> {
    const admin = this.userFactory.createAdminUser(
      { email, name, password: 'temp' },
      'ADMIN',
    );
    return admin;
  }
}
```

### Diagrama de Dependencias

```
                    DOMAIN (Contratos)
                    ┌─────────────────────┐
                    │  Interfaces/Puertos  │
                    │  Types/ValueObjects │
                    │  Domain Exceptions  │
                    └─────────────────────┘
                              ▲
                              │ implementa
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
 APPLICATION         INFRASTRUCTURE              PRESENTATION
 (Orquesta)          (Implementa)               (Expone)
 ┌──────────────┐    ┌──────────────┐          ┌──────────────┐
 │ Use Cases    │───►│ Repositories │◄─────────│ Controllers  │
 │ Handlers     │    │ Adapters     │          │ Resolvers    │
 │ Services     │    │ Services     │          │ Gateways     │
 └──────────────┘    └──────────────┘          └──────────────┘
```

Reference: [Abstraction - Martin Fowler](https://martinfowler.com/bliki/AbstractClass.html)
