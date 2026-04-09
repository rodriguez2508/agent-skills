---
title: CQRS Handlers
impact: HIGH
impactDescription: "Orquestación de commands y queries"
tags: cqrs, handlers, orchestration, bus
---

## CQRS Handlers

**Impact: HIGH** — Los Handlers procesan Commands y Queries. Contienen orquestación pero no lógica de dominio (que va en entidades/domain services).

### Command Handlers

```typescript
// application/commands/handlers/create-order.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateOrderCommand } from '../create-order.command';
import { OrderRepository } from '../../domain/repositories/order.repository.interface';
import { OrderCreatedEvent } from '../../domain/events/order-created.event';
import { EventBus } from '@nestjs/cqrs';

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly userRepository: UserRepository,
    private readonly inventoryService: InventoryService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    // 1. Obtener entidades necesarias
    const user = await this.userRepository.findById(command.userId);
    const products = await this.productRepository.findByIds(
      command.items.map(i => i.productId),
    );

    // 2. Ejecutar lógica de dominio
    const order = Order.create({
      userId: command.userId,
      items: command.items,
    });

    // 3. Validar y ejecutar efectos secundarios de dominio
    order.validateStock(products);

    // 4. Persistir cambios
    await this.orderRepository.save(order);

    // 5. Publicar eventos
    this.eventBus.publish(new OrderCreatedEvent(order.id, command.userId));

    return order.id;
  }
}
```

### Query Handlers

```typescript
// application/queries/handlers/get-order.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetOrderQuery } from '../get-order.query';
import { GetOrderDto } from '../../dto/get-order.dto';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly cache: CachePort,
  ) {}

  async execute(query: GetOrderQuery): Promise<GetOrderDto | null> {
    // Try cache first
    const cacheKey = `order:${query.orderId}`;
    const cached = await this.cache.get<GetOrderDto>(cacheKey);
    if (cached) return cached;

    // Fetch from repository
    const order = await this.orderRepository.findById(query.orderId);
    if (!order) return null;

    // Transform to DTO
    const dto = this.toDto(order);

    // Cache result
    await this.cache.set(cacheKey, dto, 300); // 5 min TTL

    return dto;
  }

  private toDto(order: Order): GetOrderDto {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      total: order.total,
      createdAt: order.createdAt,
    };
  }
}
```

### Manejo de Errores en Handlers

```typescript
// application/commands/handlers/create-payment.handler.ts
@CommandHandler(CreatePaymentCommand)
export class CreatePaymentHandler implements ICommandHandler<CreatePaymentCommand> {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(command: CreatePaymentCommand): Promise<PaymentResult> {
    try {
      // 1. Obtener entidades
      const order = await this.orderRepository.findById(command.orderId);
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // 2. Ejecutar lógica de pago
      const payment = order.processPayment(command.amount, command.method);

      // 3. Persistir
      await this.paymentRepository.save(payment);
      await this.orderRepository.save(order);

      // 4. Retornar resultado
      return {
        success: true,
        paymentId: payment.id,
        status: payment.status,
      };
    } catch (error) {
      // Clasificación de errores
      if (error instanceof InsufficientFundsException) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'The payment amount exceeds the available balance.',
        };
      }

      if (error instanceof PaymentDeclinedException) {
        return {
          success: false,
          error: 'PAYMENT_DECLINED',
          message: 'The payment was declined by the provider.',
        };
      }

      throw error; // Errores no manejados escalan
    }
  }
}
```

### Unit Testing de Handlers

```typescript
// test/create-order.handler.spec.ts
describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockOrderRepo = { save: jest.fn(), findById: jest.fn() };
    mockUserRepo = { findById: jest.fn() };
    mockEventBus = { publish: jest.fn() };

    handler = new CreateOrderHandler(
      mockOrderRepo,
      mockUserRepo,
      mockInventoryService, // Mock
      mockEventBus,
    );
  });

  describe('execute', () => {
    it('should create order successfully', async () => {
      // Arrange
      const command = new CreateOrderCommand('user-1', [
        { productId: 'prod-1', quantity: 2 },
      ]);

      mockUserRepo.findById.mockResolvedValue(createMockUser());
      mockProductRepo.findByIds.mockResolvedValue([createMockProduct()]);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result).toBeDefined();
      expect(mockOrderRepo.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw when user not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      const command = new CreateOrderCommand('invalid-user', []);

      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### Patrón Unit of Work

```typescript
// application/unit-of-work.ts
export interface IUnitOfWork {
  start(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getRepository<T>(name: string): T;
}

// application/commands/handlers/create-order.handler.ts
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  constructor(
    private readonly uow: IUnitOfWork,
  ) {}

  async execute(command: CreateOrderCommand): Promise<string> {
    await this.uow.start();

    try {
      const userRepo = this.uow.getRepository<UserRepository>('users');
      const orderRepo = this.uow.getRepository<OrderRepository>('orders');

      const user = await userRepo.findById(command.userId);
      const order = Order.create({ userId: user.id, items: command.items });

      await orderRepo.save(order);

      await this.uow.commit();
      return order.id;
    } catch (error) {
      await this.uow.rollback();
      throw error;
    }
  }
}
```

Reference: [CQRS Handlers - EventFlow](https://docs.eventflow.net/)
