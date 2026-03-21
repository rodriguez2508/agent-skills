# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Architecture (arch)

**Impact:** CRITICAL
**Description:** Proper module organization and dependency management are the foundation of maintainable NestJS applications. Circular dependencies and god services are the #1 architecture killer.

## 2. Dependency Injection (di)

**Impact:** CRITICAL
**Description:** NestJS's IoC container is powerful but can be misused. Understanding scopes, injection tokens, and proper patterns is essential for testable code.

## 3. Error Handling (error)

**Impact:** HIGH
**Description:** Consistent error handling improves debugging, user experience, and API reliability. Centralized exception filters ensure uniform error responses.

## 4. Security (security)

**Impact:** HIGH
**Description:** Security vulnerabilities can be catastrophic. Input validation, authentication, authorization, and data protection are non-negotiable.

## 5. Performance (perf)

**Impact:** HIGH
**Description:** Optimizing request handling, caching, and database queries directly impacts application responsiveness and scalability.

## 6. Testing (test)

**Impact:** MEDIUM-HIGH
**Description:** Well-tested applications are more reliable. NestJS testing utilities enable comprehensive unit and e2e coverage.

## 7. Database & ORM (db)

**Impact:** MEDIUM-HIGH
**Description:** Proper database access patterns, transactions, and query optimization are crucial for data-intensive applications.

## 8. API Design (api)

**Impact:** MEDIUM
**Description:** RESTful conventions, versioning, DTOs, and consistent response formats improve API usability and maintainability.

## 9. Microservices (micro)

**Impact:** MEDIUM
**Description:** Building distributed systems requires understanding message patterns, health checks, and inter-service communication.

## 10. DevOps & Deployment (devops)

**Impact:** LOW-MEDIUM
**Description:** Configuration management, structured logging, and graceful shutdown ensure production readiness and zero-downtime deployments.

## 11. Clean Architecture (clean)

**Impact:** CRITICAL
**Description:** Clean Architecture provides a robust framework for organizing code with clear separation of concerns. Domain logic is independent of frameworks, databases, and UI, enabling testability and maintainability.

## 12. Hexagonal Architecture (hex)

**Impact:** CRITICAL
**Description:** Hexagonal Architecture (Ports & Adapters) decouples core business logic from external concerns. Ports define interfaces for interaction, while adapters implement specific technologies.

## 13. CQRS (cqrs)

**Impact:** HIGH
**Description:** Command Query Responsibility Segregation separates read and write operations. Commands handle mutations with domain logic; queries handle reads with optimized projections. Improves scalability and testability.

---

## Clean Architecture Layers

Clean Architecture organizes code into concentric layers with the following dependency rule: inner layers do not depend on outer layers, and outer layers depend on inner layers.

**Layer Structure:**

1. **Domain Layer** (Inner Core) - Entities, Value Objects, Domain Services, Domain Events
2. **Application Layer** - Use Cases, Commands, Queries, Application Services
3. **Infrastructure Layer** - Adapters, Repositories, External Services
4. **Presentation Layer** - Controllers, Resolvers, Gateways

## Hexagonal Architecture Pattern

Hexagonal Architecture treats the application as a hexagon with ports on the edges. Inbound ports handle incoming requests; outbound ports handle external dependencies.

**Key Concepts:**

- **Ports** - Interfaces that define contracts for interaction
- **Adapters** - Implementations that connect to external systems
- **Dependency Inversion** - Inner code depends on abstractions, not concretions

## CQRS Pattern

CQRS separates the responsibility between command (write) and query (read) models. This separation allows independent scaling, optimization, and evolution of read and write paths.

**Benefits:**

- Optimized read queries with specific projections
- Clear semantic intent (Command = mutation, Query = read)
- Easier testing of domain logic separately from persistence

