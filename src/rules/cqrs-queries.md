---
title: CQRS Queries
impact: HIGH
impactDescription: "Lecturas optimizadas sin lógica de dominio"
tags: cqrs, queries, reads, projections
---

## CQRS Queries

**Impact: HIGH** — Los Queries encapsulan operaciones de lectura. No contienen lógica de dominio, solo retornan datos optimizados para presentación.

### Estructura por Funcionalidad

```
src/modules/user/
├── application/
│   ├── commands/
│   │   └── create-user/
│   │       ├── create-user.command.ts
│   │       └── create-user.handler.ts
│   └── queries/
│       └── get-user/
│           ├── get-user.query.ts
│           └── get-user.handler.ts
```

### Incorrect (read/write mezclados)

```typescript
// ❌ Mezcla lógica de dominio con query
@Injectable()
export class UserService {
  async findUserWithOrders(id: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }
    const orders = await this.orderRepo.find({
      where: { userId: id },
      relations: ['items'],
    });
    return {
      ...user,
      totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
      orderCount: orders.length,
    };
  }
}
```

### Correct (Queries separadas por funcionalidad)

```typescript
// application/queries/get-user/get-user.query.ts
export class GetUserQuery {
  constructor(
    public readonly userId: string,
  ) {}
}

// application/queries/get-user/get-user.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUserQuery } from './get-user.query';
import { GetUserDto } from '../../dto/get-user.dto';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<GetUserDto | null> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}

// application/queries/get-users/get-users.query.ts
export class GetUsersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly search?: string,
    public readonly role?: string,
  ) {}
}

// application/queries/get-users/get-users.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUsersQuery } from './get-users.query';

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<GetUsersResponseDto> {
    const { users, total } = await this.userRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
    });

    return {
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}

// application/queries/get-user-with-orders/get-user-with-orders.query.ts
export class GetUserWithOrdersQuery {
  constructor(
    public readonly userId: string,
    public readonly includeItems: boolean = false,
  ) {}
}

// application/queries/get-user-with-orders/get-user-with-orders.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUserWithOrdersQuery } from './get-user-with-orders.query';

@QueryHandler(GetUserWithOrdersQuery)
export class GetUserWithOrdersHandler
  implements IQueryHandler<GetUserWithOrdersQuery> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(query: GetUserWithOrdersQuery): Promise<GetUserWithOrdersDto | null> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) return null;

    const orders = await this.orderRepository.findByUser(query.userId, {
      includeItems: query.includeItems,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      orders: orders.map(o => ({
        id: o.id,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
        items: query.includeItems ? o.items : undefined,
      })),
    };
  }
}
```

### Controller usando QueryBus

```typescript
// presentation/rest/user.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserQuery } from '../../application/queries/get-user/get-user.query';
import { GetUsersQuery } from '../../application/queries/get-users/get-users.query';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
  ) {
    const query = new GetUsersQuery(page, limit, search);
    return this.queryBus.execute(query);
  }

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const query = new GetUserQuery(id);
    return this.queryBus.execute(query);
  }
}
```

### Read Models y Proyecciones

```typescript
// application/queries/get-user-stats/get-user-stats.query.ts
export class GetUserStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly period: 'day' | 'week' | 'month' = 'week',
  ) {}
}

// application/queries/get-user-stats/get-user-stats.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUserStatsQuery } from './get-user-stats.query';

@QueryHandler(GetUserStatsQuery)
export class GetUserStatsHandler
  implements IQueryHandler<GetUserStatsQuery> {
  constructor(
    @Inject('UserReadRepository')
    private readonly readRepo: UserReadRepository,
  ) {}

  async execute(query: GetUserStatsQuery): Promise<UserStatsDto> {
    const stats = await this.readRepo.getUserStats(
      query.userId,
      query.period,
    );

    return {
      userId: query.userId,
      totalOrders: stats.orderCount,
      totalSpent: stats.totalAmount,
      lastOrderDate: stats.lastOrderDate,
      averageOrderValue: stats.orderCount > 0
        ? stats.totalAmount / stats.orderCount
        : 0,
    };
  }
}
```

### Beneficios de Separación Queries/Commands

| Aspecto | Queries | Commands |
|---------|---------|----------|
| **Responsabilidad** | Solo lectura | Mutación |
| **Optimización** | Proyecciones específicas | Transacciones |
| **Caching** | Frecuente | Poco frecuente |
| **Consistencia** | Eventual | Inmediata |

Reference: [CQRS - Queries](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/cqrs-read-side)
