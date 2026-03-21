---
title: Dependency Inversion Principle
impact: CRITICAL
impactDescription: "Core no depende de implementaciones, solo de abstracciones"
tags: solid, dependency-inversion, clean-architecture
---

## Dependency Inversion Principle

**Impact: CRITICAL** — Los módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones.

### Principio DIP

```
        ALTO NIVEL                    BAJO NIVEL
       (Dominio)                   (Infraestructura)

            │                            │
            │    ┌─────────────────┐     │
            └───►│  ABSTRACCIÓN    │◄────┘
                 │  (Puerto)       │
                 └─────────────────┘
                      ▲        │
                      │        │
                 usa │        │ implementa
                      │        ▼
                 ┌─────────────────┐
                 │  ADAPTADOR     │
                 │  (Implementa)  │
                 └─────────────────┘
```

### Incorrect (dependencia directa)

```typescript
// application/use-case.ts - Depende de implementación concreta
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: TypeormUserRepository, // ❌ Concrete dependency
    private readonly sendGrid: SendGridEmailService, // ❌ Concrete dependency
  ) {}

  async execute(dto: CreateUserDto) {
    // Si cambia el ORM, toca modificar este código
    // Si cambia el email provider, toca modificar este código
  }
}

// Problema: Violación DIP
// Alto nivel (UseCase) depende de bajo nivel (ORM, Email)
```

### Correct (dependencia de abstracciones)

```typescript
// domain/ports/user.repository.port.ts
export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// domain/ports/email.service.port.ts
export interface EmailService {
  sendWelcome(email: string, name: string): Promise<void>;
}

// application/use-case.ts - Depende solo de abstracciones
@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,   // ✅ Abstraction
    private readonly emailService: EmailService, // ✅ Abstraction
  ) {}

  async execute(dto: CreateUserDto) {
    // No importa qué implementación esté injectada
    // TypeORM, Prisma, MongoDB - todo funciona igual
  }
}

// infrastructure/adapters/typeorm-user.repository.ts
@Injectable()
export class TypeormUserRepository implements UserRepository {
  // ✅ Implementa el puerto
}

// infrastructure/adapters/sendgrid-email.service.ts
@Injectable()
export class SendGridEmailService implements EmailService {
  // ✅ Implementa el puerto
}
```

### Configuration en NestJS

```typescript
// app.module.ts - Inversión de control
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CacheModule.register(),
  ],
  providers: [
    // Puerto → Implementación
    {
      provide: 'UserRepository',
      useClass: TypeormUserRepository, // Cambiar aquí si quiere otra impl
    },
    {
      provide: 'EmailService',
      useFactory: (config: ConfigService) => {
        const provider = config.get('EMAIL_PROVIDER');
        switch (provider) {
          case 'ses':
            return new SesEmailService(config);
          case 'mailgun':
            return new MailgunEmailService(config);
          default:
            return new SendGridEmailService(config);
        }
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

### Injection Tokens

```typescript
// common/injection-tokens.ts
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');
export const CACHE_PORT = Symbol('CACHE_PORT');
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

// app.module.ts
@Module({
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: TypeormUserRepository,
    },
    {
      provide: EMAIL_SERVICE,
      useClass: SendGridEmailService,
    },
  ],
  exports: [USER_REPOSITORY, EMAIL_SERVICE],
})
export class AppModule {}

// Uso con @Inject()
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: UserRepository,
  ) {}
}
```

### Testing con Mocks

```typescript
// test/create-user.use-case.spec.ts
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepo = { save: jest.fn(), findByEmail: jest.fn() };
    mockEmailService = { sendWelcome: jest.fn() };

    useCase = new CreateUserUseCase(mockUserRepo, mockEmailService);
  });

  it('should create user and send welcome email', async () => {
    const dto = { email: 'test@test.com', name: 'Test' };
    await useCase.execute(dto);

    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockEmailService.sendWelcome).toHaveBeenCalledWith(
      'test@test.com',
      'Test',
    );
  });
});
```

Reference: [SOLID - Dependency Inversion Principle](https://solid.despada.io/)
