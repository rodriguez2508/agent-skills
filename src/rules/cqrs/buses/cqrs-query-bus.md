---
title: Query Bus
impact: MEDIUM
impactDescription: "Lecturas desacopladas"
tags: cqrs, query-bus, reads, mediator
---

## Query Bus

**Impact: MEDIUM** — El Query Bus despacha queries a sus handlers de forma transparente, separando el origen de la petición de la lógica de lectura.

### Arquitectura del Query Bus

```
Controller → QueryBus.execute(query) → Cache → Handler → Repository
                     │
                     ├── Cache Check
                     ├── Logging
                     └── Metrics
```

### Incorrect (consultas en controller)

```typescript
// ❌ Controller conoce detalles de implementación
@Controller('users')
export class UserController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CacheManager,
    private readonly metrics: MetricsService,
  ) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    // Controller decide si buscar en cache o repo
    let user = await this.cache.get(`user:${id}`);
    if (!user) {
      user = await this.userRepo.findById(id);
      await this.cache.set(`user:${id}`, user, 300);
    }
    return user;
  }

  @Get()
  async getUsers(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    // Controller sabe cómo paginar
    const offset = (page - 1) * limit;
    return this.userRepo.findAll({ offset, limit });
  }
}
```

### Correct (Query Bus)

```typescript
// application/queries/get-user.query.ts
export class GetUserQuery {
  constructor(public readonly userId: string) {}
}

// application/queries/handlers/get-user.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetUserQuery } from '../get-user.query';
import { UserRepository } from '../../domain/repositories/user.repository.interface';
import { CachePort } from '../../domain/ports/cache.port';

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(query: GetUserQuery): Promise<GetUserDto | null> {
    const cacheKey = `user:${query.userId}`;

    // Try cache first
    const cached = await this.cache.get<GetUserDto>(cacheKey);
    if (cached) return cached;

    // Fetch from repository
    const user = await this.userRepo.findById(query.userId);
    if (!user) return null;

    // Cache result
    await this.cache.set(cacheKey, this.toDto(user), 300);

    return this.toDto(user);
  }

  private toDto(user: User): GetUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}

// presentation/rest/user.controller.ts
@Controller('users')
export class UserController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  async getUser(@Param('id') id: string) {
    const query = new GetUserQuery(id);
    return this.queryBus.execute(query);
  }

  @Get()
  async getUsers(@Query() queryDto: GetUsersQueryDto) {
    const query = new GetUsersQuery(
      queryDto.page,
      queryDto.limit,
      queryDto.search,
    );
    return this.queryBus.execute(query);
  }
}
```

### Query con Cache Interceptor

```typescript
// application/interceptors/cache.interceptor.ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: CachePort) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const query = context.getArgByIndex(0);
    const cacheKey = this.generateKey(query);

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return next.handle().pipe(
      tap(async (result) => {
        await this.cache.set(cacheKey, result, this.getTTL(query));
      }),
    );
  }

  private generateKey(query: any): string {
    return `query:${query.constructor.name}:${JSON.stringify(query)}`;
  }

  private getTTL(query: any): number {
    if (query instanceof GetUserQuery) return 300;
    if (query instanceof GetUsersQuery) return 60;
    return 60;
  }
}

// Configuración por defecto
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
```

### Read Models Optimizados

```typescript
// application/queries/get-user-stats.query.ts
export class GetUserStatsQuery {
  constructor(
    public readonly userId: string,
    public readonly period: 'day' | 'week' | 'month' = 'week',
  ) {}
}

// application/queries/handlers/get-user-stats.handler.ts
@QueryHandler(GetUserStatsQuery)
export class GetUserStatsHandler implements IQueryHandler<GetUserStatsQuery> {
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

### CORS y Query Bus

```typescript
// application/queries/get-users.query.ts
export class GetUsersQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 20,
    public readonly search?: string,
    public readonly sortBy?: string,
    public readonly sortOrder?: 'ASC' | 'DESC',
  ) {}
}

// presentation/dto/get-users-query.dto.ts
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
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
```

Reference: [CQRS Read Side](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/cqrs-read-side)
