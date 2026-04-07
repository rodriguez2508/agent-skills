---
title: Domain Services
impact: HIGH
impactDescription: "Lógica de negocio que no pertenece a una entidad"
tags: clean-architecture, domain-services, business-logic
---

## Domain Services

**Impact: HIGH** — Los servicios de dominio encapsulan operaciones de negocio que no pertenecen naturalmente a una entidad individual. Contienen lógica de negocio pura.

### Cuándo Usar Domain Services

1. **Operaciones que involucran múltiples entidades**
2. **Lógica de negocio que no pertenece a ninguna entidad específica**
3. **Cálculos complejos que requieren datos de múltiples fuentes**

### Incorrect (lógica de dominio en Application Service)

```typescript
// application/services/order.service.ts
@Injectable()
export class OrderService {
  async createOrder(userId: string, items: OrderItemDto[]) {
    // Lógica de dominio mezclada con servicios de infraestructura
    const user = await this.userRepository.findById(userId);
    if (!user.isActive) {
      throw new Error('User is not active');
    }

    let total = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }
      total += product.price * item.quantity;
      orderItems.push(new OrderItem(product.id, item.quantity, product.price));
    }

    // Descuento por volumen
    if (total > 1000) {
      total *= 0.9; // 10% descuento
    }

    const order = new Order(userId, orderItems, total);
    await this.orderRepository.save(order);

    // Notificaciones
    await this.emailService.sendOrderConfirmation(user.email, order);
    await this.inventoryService.reserveItems(orderItems);

    return order;
  }
}
```

### Correct (separación de responsabilidades)

```typescript
// domain/services/order-domain.service.ts
@Injectable({ scope: Scope.TRANSIENT })
export class OrderDomainService {
  calculateTotal(items: OrderItem[]): Money {
    let subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Descuento por volumen - lógica de dominio
    if (subtotal > 1000) {
      return Money.usd(subtotal * 0.9);
    }

    return Money.usd(subtotal);
  }

  validateOrderCreation(user: User, items: OrderItem[]): void {
    if (!user.isActive) {
      throw new DomainException('User is not active', 'USER_INACTIVE');
    }

    if (items.length === 0) {
      throw new DomainException('Order must have at least one item', 'EMPTY_ORDER');
    }
  }

  createOrderItems(
    products: Product[],
    quantities: number[],
  ): OrderItem[] {
    const items: OrderItem[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const quantity = quantities[i];

      if (product.stock < quantity) {
        throw new DomainException(
          `Insufficient stock for ${product.name}`,
          'INSUFFICIENT_STOCK',
        );
      }

      items.push(
        new OrderItem(
          product.id,
          quantity,
          product.price,
        ),
      );
    }

    return items;
  }
}

// application/services/order-application.service.ts
@Injectable()
export class OrderApplicationService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly userRepository: UserRepository,
    private readonly productRepository: ProductRepository,
    private readonly orderDomainService: OrderDomainService,
    private readonly eventBus: EventBus,
  ) {}

  async createOrder(userId: string, items: OrderItemDto[]): Promise<Order> {
    // 1. Obtener datos
    const user = await this.userRepository.findById(userId);
    const productIds = items.map((i) => i.productId);
    const products = await this.productRepository.findByIds(productIds);

    // 2. Crear items con validación de dominio
    const orderItems = this.orderDomainService.createOrderItems(
      products,
      items.map((i) => i.quantity),
    );

    // 3. Calcular total
    const total = this.orderDomainService.calculateTotal(orderItems);

    // 4. Validar creación
    this.orderDomainService.validateOrderCreation(user, orderItems);

    // 5. Crear orden
    const order = Order.create({
      userId,
      items: orderItems,
      total,
    });

    // 6. Persistir
    await this.orderRepository.save(order);

    // 7. Publicar eventos
    this.eventBus.publish(new OrderCreatedEvent(order.id, userId, total.value));

    return order;
  }
}
```

### Domain Service con Múltiples Entidades

```typescript
// domain/services/transfer-domain.service.ts
export class TransferDomainService {
  validateTransfer(
    sourceAccount: BankAccount,
    destinationAccount: BankAccount,
    amount: Money,
  ): void {
    if (sourceAccount.id === destinationAccount.id) {
      throw new DomainException(
        'Cannot transfer to same account',
        'SAME_ACCOUNT',
      );
    }

    if (!sourceAccount.isActive || !destinationAccount.isActive) {
      throw new DomainException(
        'One or both accounts are inactive',
        'INACTIVE_ACCOUNT',
      );
    }

    if (sourceAccount.balance.lessThan(amount)) {
      throw new DomainException(
        'Insufficient funds',
        'INSUFFICIENT_FUNDS',
      );
    }

    if (amount.lessThan(Money.usd(1))) {
      throw new DomainException(
        'Minimum transfer amount is 1',
        'BELOW_MINIMUM',
      );
    }
  }

  executeTransfer(
    sourceAccount: BankAccount,
    destinationAccount: BankAccount,
    amount: Money,
  ): TransferResult {
    sourceAccount.withdraw(amount);
    destinationAccount.deposit(amount);

    return new TransferResult(
      generateTransferId(),
      sourceAccount.id,
      destinationAccount.id,
      amount,
      new Date(),
      TransferStatus.COMPLETED,
    );
  }
}

// Entidad con comportamiento de dominio
export class BankAccount {
  constructor(
    private readonly _id: string,
    private readonly _ownerId: string,
    private _balance: Money,
    private readonly _isActive: boolean,
  ) {}

  get id(): string { return this._id; }
  get balance(): Money { return this._balance; }
  get isActive(): boolean { return this._isActive; }

  withdraw(amount: Money): void {
    if (this._balance.lessThan(amount)) {
      throw new DomainException('Insufficient funds', 'INSUFFICIENT_FUNDS');
    }
    this._balance = this._balance.subtract(amount);
  }

  deposit(amount: Money): void {
    this._balance = this._balance.add(amount);
  }
}
```

### Inyección en NestJS

```typescript
// domain/services/order-domain.service.module.ts
import { Module } from '@nestjs/common';

@Module({
  providers: [OrderDomainService],
  exports: [OrderDomainService],
})
export class OrderDomainModule {}

// application/services/order-application.service.ts
@Injectable()
export class OrderApplicationService {
  constructor(
    private readonly orderDomainService: OrderDomainService,
    // Otras dependencias...
  ) {}
}
```

Reference: [Domain-Driven Design - Services](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-model-structure)
