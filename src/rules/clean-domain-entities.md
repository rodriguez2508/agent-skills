---
title: Domain Entities
impact: CRITICAL
impactDescription: "Entidades puras son el corazón del dominio"
tags: clean-architecture, entities, domain, value-objects
---

## Domain Entities

**Impact: CRITICAL** — Las entidades de dominio encapsulan estado e invariantes de negocio. Deben ser clases puras sin dependencias externas.

### Principios de Entidades de Dominio

1. **Inmutabilidad parcial** - ID y datos core son inmutables
2. **Invariantes garantizadas** - El estado siempre válido
3. **Sin dependencias externas** - Ninguna referencia a frameworks, BD, o servicios
4. **Métodos de dominio** - Comportamiento asociado al negocio

### Incorrect (entidad anémica con validación externa)

```typescript
// user.entity.ts - Entity anémica
@Entity()
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Sin comportamiento - solo datos
}

// Lógica de negocio en servicio
@Injectable()
export class UserService {
  async createUser(data: any) {
    if (!this.validateEmail(data.email)) {
      throw new Error('Invalid email');
    }
    if (data.password.length < 8) {
      throw new Error('Password too short');
    }
    // ...
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### Correct (entidad rica con comportamiento)

```typescript
// domain/entities/user.entity.ts
export class User {
  private constructor(
    private readonly _id: string,
    private readonly _email: string,
    private readonly _password: string,
    private readonly _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get id(): string { return this._id; }
  get email(): string { return this._email; }
  get password(): string { return this._password; }
  get isActive(): boolean { return this._isActive; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateUserProps): User {
    this.validateEmail(props.email);
    this.validatePassword(props.password);

    return new User(
      generateId(),
      props.email,
      props.password,
      true,
      new Date(),
      new Date(),
    );
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  updateEmail(newEmail: string): void {
    this.validateEmail(newEmail);
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  private static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new DomainException('Invalid email format', 'INVALID_EMAIL');
    }
  }

  private static validatePassword(password: string): void {
    if (password.length < 8) {
      throw new DomainException('Password must be at least 8 characters', 'PASSWORD_TOO_SHORT');
    }
    if (!/[A-Z]/.test(password)) {
      throw new DomainException('Password must contain uppercase', 'PASSWORD_NO_UPPERCASE');
    }
  }
}

// DominioException - Excepción específica del dominio
export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'DomainException';
  }
}
```

### Value Objects para Datos Específicos

```typescript
// domain/value-objects/email.vo.ts
export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value.toLowerCase().trim();
  }

  static fromString(value: string): Email {
    if (!value || value.trim().length === 0) {
      throw new DomainException('Email is required', 'EMAIL_REQUIRED');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new DomainException('Invalid email format', 'INVALID_EMAIL');
    }

    return new Email(value);
  }

  get value(): string { return this._value; }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}

// domain/value-objects/money.vo.ts
export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  constructor(amount: number, currency: string) {
    if (amount < 0) {
      throw new DomainException('Amount cannot be negative', 'NEGATIVE_AMOUNT');
    }
    this._amount = Number(amount.toFixed(2));
    this._currency = currency.toUpperCase();
  }

  static usd(amount: number): Money {
    return new Money(amount, 'USD');
  }

  add(other: Money): Money {
    if (this._currency !== other._currency) {
      throw new DomainException('Currency mismatch', 'CURRENCY_MISMATCH');
    }
    return new Money(this._amount + other._amount, this._currency);
  }

  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
}
```

### Uso en Application Layer

```typescript
// application/commands/create-order.command.ts
export class CreateOrderCommand {
  constructor(
    public readonly userId: string,
    public readonly amount: Money,
    public readonly description: string,
  ) {}
}

// application/handlers/create-order.handler.ts
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<Order> {
    // El dominio ya validó el dinero
    const order = Order.create({
      userId: command.userId,
      amount: command.amount,
      description: command.description,
    });

    await this.orderRepository.save(order);
    return order;
  }
}
```

Reference: [Domain-Driven Design - Eric Evans](https://domain-driven.design/)
