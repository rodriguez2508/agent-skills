---
title: NestJS Controllers
impact: HIGH
impactDescription: 'Proper controller implementation in NestJS'
tags: nestjs, controllers, routes, endpoints
---

## NestJS Controllers

**Impact: HIGH** - Controllers handle incoming requests and return responses. Proper implementation is crucial.

### Basic Controller

```typescript
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }
}
```

### Best Practices

- ✅ Use DTOs for request validation
- ✅ Use decorators for status codes
- ✅ Keep controllers thin - delegate to services
- ✅ UseParam, @Body, @Query decorators
- ❌ Don't put business logic in controllers

### With Guards and Interceptors

```typescript
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {}
}
```

---

**References:**

- [NestJS Controllers](https://docs.nestjs.com/controllers)
