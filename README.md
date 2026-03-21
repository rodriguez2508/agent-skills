# Agent Skills API - NestJS Agent

🤖 **Single Agent con Arquitectura Hexagonal + CQRS**

Implementación de un sub-agente especializado para NestJS usando arquitectura hexagonal, CQRS y búsqueda BM25.

---

## 📑 Índice

- [Arquitectura](#arquitectura)
- [Instalación](#instalación)
- [Scripts](#scripts)
- [API Endpoints](#api-endpoints)
- [gRPC Services](#grpc-services)
- [Estructura del Proyecto](#estructura-del-proyecto)

---

## 🏗️ Arquitectura

### Hexagonal + CQRS

```
┌─────────────────────────────────────────────────────────┐
│                  Presentation Layer                     │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ REST Controllers│  │ gRPC Server Adapter         │  │
│  │ - Health        │  │ - SearchRules               │  │
│  │ - Rules         │  │ - GetRule                   │  │
│  └─────────────────┘  │ - ListRules                 │  │
│                       └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │ ports
┌─────────────────────────────────────────────────────────┐
│                 Application Layer (CQRS)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Queries:                                          │  │
│  │ - SearchRulesQuery → SearchRulesHandler          │  │
│  │ - GetRuleQuery → GetRuleHandler                  │  │
│  │ - ListRulesQuery → ListRulesHandler              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │ ports
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ BM25 Engine  │  │ gRPC Adapter │  │ File System  │  │
│  │ (Search)     │  │ (Server)     │  │ (Repository) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    Domain Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Rule Entity  │  │ Value Objects│  │ Repository   │  │
│  │              │  │ - RuleId     │  │ Ports        │  │
│  │              │  │ - Category   │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Instalación

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

### 3. Build del proyecto

```bash
pnpm run build
```

---

## 📜 Scripts

```bash
# Desarrollo
pnpm run start:dev

# Producción
pnpm run start:prod

# Build
pnpm run build

# Tests
pnpm run test
pnpm run test:cov

# Lint
pnpm run lint
```

---

## 🔌 API Endpoints

### REST API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/rules` | Listar todas las reglas |
| `GET` | `/rules?q=query` | Buscar reglas (query params) |
| `POST` | `/rules/search` | Buscar reglas (body) |
| `GET` | `/rules?id=xxx` | Obtener regla por ID |

### Swagger

Accede a la documentación interactiva en: `http://localhost:3000/api`

---

## 📡 gRPC Services

### Puerto: 50051

### Servicios

```protobuf
service AgentSkillService {
  rpc SearchRules(SearchRulesRequest) returns (SearchRulesResponse);
  rpc SearchRulesStream(SearchRulesRequest) returns (stream StreamSearchResult);
  rpc GetRule(GetRuleRequest) returns (GetRuleResponse);
  rpc ListRules(ListRulesRequest) returns (ListRulesResponse);
  rpc ListRulesStream(ListRulesRequest) returns (stream StreamRulesBatch);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}
```

### Ejemplo de uso (Node.js)

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('src/proto/agent-skill.proto', {});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const client = new protoDescriptor.agent_skill.AgentSkillService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Search
client.searchRules({ query: 'CQRS', category: 'nestjs', limit: 10 }, (err, response) => {
  console.log(response.results);
});
```

---

## 📁 Estructura del Proyecto

```
src/
├── core/                      # Domain Layer
│   ├── domain/
│   │   ├── entities/
│   │   │   └── rule.entity.ts
│   │   ├── value-objects/
│   │   │   ├── rule-id.vo.ts
│   │   │   └── rule-category.vo.ts
│   │   └── ports/
│   │       └── rule-repository.port.ts
│   └── events/
│       └── rule-created.event.ts
│
├── application/               # Application Layer (CQRS)
│   ├── commands/
│   │   └── handlers/
│   ├── queries/
│   │   ├── search-rules/
│   │   ├── get-rule/
│   │   ├── list-rules/
│   │   └── handlers/
│   └── ports/
│       └── search-engine.port.ts
│
├── infrastructure/            # Infrastructure Layer
│   ├── adapters/
│   │   ├── grpc/
│   │   │   └── grpc-server.adapter.ts
│   │   └── http/
│   ├── persistence/
│   │   └── repositories/
│   │       └── rule-file.repository.ts
│   └── search/
│       └── bm25/
│           ├── bm25.engine.ts
│           └── bm25.config.ts
│
├── presentation/              # Presentation Layer
│   ├── controllers/
│   │   ├── health/
│   │   └── rules/
│   └── dto/
│       ├── search-rules.dto.ts
│       └── rule-response.dto.ts
│
├── proto/
│   └── agent-skill.proto
│
└── rules/
    └── nestjs/
        ├── clean-architecture.md
        └── dependency-injection.md
```

---

## 🔍 Búsqueda BM25

El motor BM25 implementa el algoritmo Okapi BM25:

```
score(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D|/avgdl))
```

### Configuración

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `k1` | 1.5 | Saturación de frecuencia |
| `b` | 0.75 | Penalización por longitud |

### Variables de Entorno

```bash
BM25_K1=1.5
BM25_B=0.75
```

---

## 🧪 Testing

```bash
# Unit tests
pnpm run test

# Coverage
pnpm run test:cov

# Watch mode
pnpm run test:watch
```

---

## 🛠️ Tecnologías

| Tecnología | Versión | Descripción |
|------------|---------|-------------|
| NestJS | 11.x | Framework |
| CQRS | 11.x | Patrón CQRS |
| gRPC | 1.12.x | Comunicación |
| BM25 | - | Motor de búsqueda |
| Swagger | 11.x | Documentación |
| TypeScript | 5.7.x | Lenguaje |

---

## 📝 Licencia

MIT
