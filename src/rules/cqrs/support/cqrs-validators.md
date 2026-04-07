---
title: CQRS Validators
impact: MEDIUM-HIGH
impactDescription: "Validación temprana y clara"
tags: cqrs, validation, class-validator,fluent-validation
---

## CQRS Validators

**Impact: MEDIUM-HIGH** — La validación debe ocurrir antes de que el command/query llegue al handler. validators separan la validación de la lógica de negocio.

### Validation Pipeline

```
Request → DTO Validation → Command Validation → Domain Validation → Handler
           (Pipes)         (Validators)        (Entities)
```

### Incorrect (validación en handler)

```typescript
// ❌ Todo junto - difícil de testear
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<string> {
    // Validación de formato
    if (!command.email.includes('@')) {
      throw new BadRequestException('Invalid email');
    }
    if (command.password.length < 8) {
      throw new BadRequestException('Password too short');
    }

    // Validación de negocio
    const existing = await this.userRepo.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('Email exists');
    }

    // Lógica de negocio
    const user = User.create({ ... });
    await this.userRepo.save(user);

    return user.id;
  }
}
```

### Correct (validación separada)

```typescript
// application/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}

// application/validators/create-user.validator.ts
import { ValidatorConstraint, ValidatorInterface, ValidationArguments } from 'class-validator';
import { UserRepository } from '../../domain/repositories/user.repository.interface';

@ValidatorConstraint({ async: true })
export class UniqueEmailValidator implements ValidatorInterface {
  constructor(private readonly userRepo: UserRepository) {}

  async validate(email: string, args: ValidationArguments): Promise<boolean> {
    const existing = await this.userRepo.findByEmail(email);
    return !existing;
  }

  defaultMessage(args: ValidationArguments): string {
    return 'Email already exists';
  }
}

// application/validators/create-user.validator.ts
import { Injectable } from '@nestjs/common';
import { registerAs } from '@nestjs/config';

@Injectable()
export class CreateUserValidator {
  constructor(
    private readonly userRepo: UserRepository,
  ) {}

  async validate(command: CreateUserCommand): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Unique email check
    const existing = await this.userRepo.findByEmail(command.email.value);
    if (existing) {
      errors.push({
        field: 'email',
        message: 'Email already registered',
        code: 'EMAIL_EXISTS',
      });
    }

    // Password strength check
    if (command.password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    // Business rule: no disposable emails
    if (this.isDisposableEmail(command.email.value)) {
      errors.push({
        field: 'email',
        message: 'Disposable emails are not allowed',
        code: 'DISPOSABLE_EMAIL',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isDisposableEmail(email: string): boolean {
    const domain = email.split('@')[1];
    return DISPOSABLE_DOMAINS.includes(domain);
  }
}

// Handler usa resultado de validación
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly validator: CreateUserValidator,
    private readonly userRepo: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    // 1. Validar primero
    const validation = await this.validator.validate(command);
    if (!validation.isValid) {
      throw new ValidationException(validation.errors);
    }

    // 2. Lógica de dominio
    const user = User.create({ ... });
    await this.userRepo.save(user);

    // 3. Eventos
    this.eventBus.publish(new UserCreatedEvent(user.id));

    return user.id;
  }
}
```

### Validator con class-validator Decorators

```typescript
// application/dto/create-order.dto.ts
import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  shippingAddress: string;
}

// Global validation pipe en main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(3000);
}
```

### Custom Validation Decorator

```typescript
// application/decorators/is-unique-email.decorator.ts
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Inject } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../common/injection-tokens';

export function IsUniqueEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isUniqueEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      async: true,
      validator: {
        async validate(value: string, args: ValidationArguments) {
          const userRepo = Inject(USER_REPOSITORY)();
          const existing = await userRepo.findByEmail(value);
          return !existing;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Email already exists';
        },
      },
    });
  };
}

// Uso en DTO
export class CreateUserDto {
  @IsEmail()
  @IsUniqueEmail({ message: 'Email already registered' })
  email: string;
}
```

### Result Type para Validación

```typescript
// application/validators/validation-result.type.ts
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export class ValidationException extends Error {
  constructor(public readonly errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
  }
}
```

Reference: [Class Validator](https://github.com/typestack/class-validator)
