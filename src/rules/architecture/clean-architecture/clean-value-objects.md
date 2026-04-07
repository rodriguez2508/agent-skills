---
title: Value Objects
impact: HIGH
impactDescription: "Integridad de datos y semántica rica"
tags: clean-architecture, value-objects, domain-primitives
---

## Value Objects

**Impact: HIGH** — Los Value Objects encapsulan valores simples con reglas de validación y comportamiento. Son inmutables y se definen por su valor, no por identidad.

### Características de Value Objects

1. **Inmutabilidad** - Una vez creado, no puede cambiar
2. **Igualdad por valor** - Dos VOs son iguales si sus valores son iguales
3. **Validación garantizada** - El constructor valida y lanza excepciones
4. **Comportamiento incluido** - Operaciones relacionadas con el valor

### Incorrect (tipos primitivos sin validación)

```typescript
// DTOs con tipos primitivos
interface CreateUserDto {
  email: string;    // Sin validación
  age: number;      // Sin rango
  phone: string;    // Sin formato
  amount: number;   // Sin moneda
}

// Uso sin validación
@Injectable()
export class UserService {
  async createUser(dto: CreateUserDto) {
    const user = await this.repo.save({
      email: dto.email,
      age: dto.age,         // Podría ser -999
      phone: dto.phone,     // Podría ser cualquier string
    });

    // Validación tardía
    if (dto.age < 0 || dto.age > 150) {
      throw new Error('Invalid age');
    }
  }
}

// Problemas:
// 1. Errores aparecen en tiempo de ejecución, no al crear el objeto
// 2. Sin tipos específicos - todo es string o number
// 3. Duplicación de validación
```

### Correct (Value Objects con validación)

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

  get domain(): string {
    return this._value.split('@')[1];
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string { return this._value; }
}

// domain/value-objects/age.vo.ts
export class Age {
  private readonly _value: number;

  private constructor(value: number) {
    if (!Number.isInteger(value)) {
      throw new DomainException('Age must be an integer', 'AGE_NOT_INTEGER');
    }
    if (value < 0 || value > 150) {
      throw new DomainException('Age must be between 0 and 150', 'AGE_OUT_OF_RANGE');
    }
    this._value = value;
  }

  static fromBirthDate(birthDate: Date): Age {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return new Age(age);
  }

  static of(value: number): Age {
    return new Age(value);
  }

  get value(): number { return this._value; }

  isAdult(): boolean { return this._value >= 18; }
}

// domain/value-objects/phone.vo.ts
export class Phone {
  private readonly _value: string;
  private readonly _countryCode: string;

  private constructor(value: string, countryCode: string) {
    this._value = value;
    this._countryCode = countryCode;
  }

  static fromString(value: string): Phone {
    const cleanValue = value.replace(/\D/g, '');

    if (cleanValue.length < 10) {
      throw new DomainException('Phone number too short', 'PHONE_TOO_SHORT');
    }

    // Últimos 10 dígitos como número local
    const localNumber = cleanValue.slice(-10);
    const countryCode = cleanValue.slice(0, cleanValue.length - 10) || '1';

    return new Phone(localNumber, countryCode);
  }

  get value(): string { return this._value; }
  get countryCode(): string { return this._countryCode; }
  get formatted(): string { return `+${this.countryCode} ${this._value}`; }
}

// domain/value-objects/money.vo.ts
export class Money {
  private readonly _amount: number;
  private readonly _currency: Currency;

  private constructor(amount: number, currency: Currency) {
    if (amount < 0) {
      throw new DomainException('Amount cannot be negative', 'NEGATIVE_AMOUNT');
    }
    this._amount = Number(amount.toFixed(2));
    this._currency = currency;
  }

  static usd(amount: number): Money {
    return new Money(amount, Currency.USD);
  }

  static eur(amount: number): Money {
    return new Money(amount, Currency.EUR);
  }

  static of(amount: number, currency: Currency): Money {
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    this.validateCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.validateCurrency(other);
    const result = this._amount - other._amount;
    if (result < 0) {
      throw new DomainException('Result would be negative', 'NEGATIVE_RESULT');
    }
    return new Money(result, this._currency);
  }

  multiply(factor: number): Money {
    return new Money(this._amount * factor, this._currency);
  }

  compare(other: Money): number {
    this.validateCurrency(other);
    return this._amount - other._amount;
  }

  isGreaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  isLessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  private validateCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new DomainException(
        `Currency mismatch: ${this._currency} vs ${other._currency}`,
        'CURRENCY_MISMATCH',
      );
    }
  }

  get amount(): number { return this._amount; }
  get currency(): Currency { return this._currency; }

  toString(): string {
    return `${this._currency.symbol}${this._amount.toFixed(2)}`;
  }
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  MXN = 'MXN',
}

Object.defineProperty(Currency, 'symbol', {
  value: { USD: '$', EUR: '€', GBP: '£', MXN: '$' },
  writable: false,
});
```

### Uso en Entidades y DTOs

```typescript
// domain/entities/user.entity.ts
export class User {
  constructor(
    private readonly _id: string,
    private readonly _email: Email,
    private readonly _age: Age,
    private readonly _phone: Phone,
    private readonly _createdAt: Date,
  ) {}

  static create(props: CreateUserProps): User {
    return new User(
      generateId(),
      Email.fromString(props.email),
      Age.of(props.age),
      Phone.fromString(props.phone),
      new Date(),
    );
  }

  updatePhone(newPhone: string): void {
    this._phone = Phone.fromString(newPhone);
  }

  get email(): string { return this._email.value; }
  get age(): number { return this._age.value; }
  get phone(): string { return this._phone.formatted; }
}

// application/dto/create-user.dto.ts
export class CreateUserDto {
  email: string;
  age: number;
  phone: string;

  toCommand(userId: string): CreateUserCommand {
    return new CreateUserCommand(
      userId,
      Email.fromString(this.email),
      Age.of(this.age),
      Phone.fromString(this.phone),
    );
  }
}
```

Reference: [Value Objects - Martin Fowler](https://martinfowler.com/bliki/ValueObject.html)
