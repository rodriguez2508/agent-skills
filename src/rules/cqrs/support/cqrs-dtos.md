---
title: CQRS DTOs
impact: MEDIUM
impactDescription: "Contratos claros para commands y queries"
tags: cqrs, dtos, data-transfer-objects, projections
---

## CQRS DTOs

**Impact: MEDIUM** — Los DTOs en CQRS definen contratos claros para cada operación. Commands y Queries pueden tener DTOs diferentes optimizados para su propósito específico.

### Tipos de DTOs en CQRS

```
┌─────────────────────────────────────────────────────────────┐
│                    COMMAND DTOs                              │
│  Input: Validación, tipado, transformación                 │
│  Propósito: Transportar datos del command                   │
├─────────────────────────────────────────────────────────────┤
│                    QUERY DTOs                               │
│  Input: Filtros, paginación, ordenación                    │
│  Propósito: Parámetros de búsqueda                         │
├─────────────────────────────────────────────────────────────┤
│                    RESPONSE DTOs                            │
│  Output: Proyecciones optimizadas                          │
│  Propósito: Estructura de respuesta                        │
└─────────────────────────────────────────────────────────────┘
```

### Command DTOs

```typescript
// application/dto/create-user.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateUserCommandDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

// application/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserCommandDto } from './create-user.dto';

export class UpdateUserCommandDto extends PartialType(CreateUserCommandDto) {
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  preferences?: UserPreferences;
}

export class UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: boolean;
}
```

### Query DTOs

```typescript
// application/dto/get-users-query.dto.ts
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(['name', 'email', 'createdAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;
}
```

### Response DTOs

```typescript
// application/dto/user-response.dto.ts
export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}

// application/dto/user-detail-response.dto.ts
export class UserDetailResponseDto extends UserResponseDto {
  phone?: string;
  avatarUrl?: string;
  preferences?: UserPreferences;
  lastLoginAt?: Date;
}

// application/dto/users-paginated-response.dto.ts
export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  constructor(data: T[], meta: {
    page: number;
    limit: number;
    total: number;
  }) {
    this.data = data;
    this.meta = {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    };
  }
}

// Uso
type GetUsersResponseDto = PaginatedResponseDto<UserResponseDto>;
```

### Proyecciones Específicas

```typescript
// application/dto/user-summary.dto.ts
// Proyección mínima para listas
export class UserSummaryDto {
  id: string;
  name: string;
  avatarUrl?: string;
}

// application/dto/user-with-orders.dto.ts
// Proyección para detalle con relaciones
export class OrderSummaryDto {
  id: string;
  total: number;
  status: string;
  itemCount: number;
}

export class UserWithOrdersDto {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  orders: OrderSummaryDto[];
}

// application/dto/user-admin.dto.ts
// Proyección para panel de administración
export class UserAdminDto {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  loginCount: number;
  metadata?: Record<string, any>;
}
```

### Mapper para Transformaciones

```typescript
// application/mappers/user.mapper.ts
@Injectable()
export class UserMapper {
  toResponseDto(user: User): UserResponseDto {
    return new UserResponseDto({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  }

  toDetailDto(user: User): UserDetailResponseDto {
    return new UserDetailResponseDto({
      ...this.toResponseDto(user),
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      preferences: user.preferences,
      lastLoginAt: user.lastLoginAt,
    });
  }

  toSummaryDto(user: User): UserSummaryDto {
    return new UserSummaryDto({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
  }

  toAdminDto(user: User, stats: UserStats): UserAdminDto {
    return new UserAdminDto({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      loginCount: stats.loginCount,
    });
  }

  toOrderSummaryDto(order: Order): OrderSummaryDto {
    return {
      id: order.id,
      total: order.total,
      status: order.status,
      itemCount: order.items.length,
    };
  }
}
```

### NestJS Pipe para Validación

```typescript
// application/pipes/command-validation.pipe.ts
@Injectable()
export class CommandValidationPipe implements PipeTransform {
  constructor(private readonly validator: CommandValidator) {}

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (metadata.type === 'body') {
      const errors = await this.validator.validate(value);
      if (errors.length > 0) {
        throw new ValidationException(errors);
      }
    }
    return value;
  }
}

// Uso en controller
@Controller('users')
export class UserController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @UsePipes(CommandValidationPipe)
  async createUser(@Body() dto: CreateUserCommandDto) {
    const command = new CreateUserCommand(
      dto.email,
      dto.name,
      dto.password,
    );
    return this.commandBus.execute(command);
  }
}
```

Reference: [DTO Pattern - Microsoft](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/architect-microservice-container-applications/data-sovereignty-per-microservice)
