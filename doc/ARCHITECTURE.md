# Arquitectura v3

## Visión General

Agent Skills v3 implementa una **arquitectura distribuida de sub-agentes especializados** comunicándose vía **gRPC** con un **gateway MCP** centralizado.

---

## Principios de Diseño

### 1. Separación de Responsabilidades

| Capa | Responsabilidad | Tecnología |
|------|-----------------|------------|
| **Gateway** | HTTP/SSE, MCP Protocol | Node.js + @modelcontextprotocol/sdk |
| **Enrutamiento** | Detección contextual, health check | Node.js + gRPC |
| **Sub-agentes** | Reglas específicas por framework | Node.js + gRPC + BM25 |
| **Búsqueda** | Indexación y búsqueda de reglas | BM25 (Okapi algorithm) |

### 2. Clean Architecture + CQRS

Cada sub-agente sigue Clean Architecture:

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (gRPC Controllers / Request Handlers)  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            Application Layer            │
│         (Query/Command Handlers)        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Domain Layer               │
│      (Entities, Rules, Interfaces)      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Infrastructure Layer            │
│    (BM25 Engine, File System, gRPC)     │
└─────────────────────────────────────────┘
```

### 3. Monorepo con pnpm Workspaces

```
agent-skills/
├── apps/                  # Aplicaciones independientes
│   ├── mcp-master/        # Gateway principal
│   ├── angular-agent/     # Sub-agente Angular
│   ├── nestjs-agent/      # Sub-agente NestJS
│   └── typescript-agent/  # Sub-agente TypeScript
├── packages/              # Librerías compartidas
│   ├── core/              # Tipos e interfaces
│   ├── proto/             # Definiciones gRPC
│   └── search-engine/     # Motor BM25
└── libs/                  # Librerías opcionales
    └── rules-repository/  # Repositorio de reglas (futuro)
```

---

## Comunicación gRPC

### Protocolo Definido

```protobuf
service AgentSkillService {
  // Búsqueda unaria
  rpc SearchRules(SearchRulesRequest) returns (SearchRulesResponse);
  
  // Búsqueda con streaming
  rpc SearchRulesStream(SearchRulesRequest) returns (stream StreamSearchResult);
  
  // Obtener regla específica
  rpc GetRule(GetRuleRequest) returns (GetRuleResponse);
  
  // Listar reglas
  rpc ListRules(ListRulesRequest) returns (ListRulesResponse);
  
  // Listar reglas con streaming
  rpc ListRulesStream(ListRulesRequest) returns (stream StreamRulesBatch);
  
  // Health check
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}
```

### Ventajas de gRPC

| Característica | Beneficio |
|----------------|-----------|
| **HTTP/2** | Multiplexing, menor latencia |
| **Protobuf** | Serialización binaria eficiente |
| **Streaming** | Respuestas parciales sin esperar completitud |
| **Tipado fuerte** | Contratos definidos en .proto |
| **Bidireccional** | Comunicación full-duplex |

---

## Motor de Búsqueda BM25

### Algoritmo

BM25 (Best Matching 25) es un algoritmo probabilístico de ranking:

```
score(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D|/avgdl))

Donde:
- D: documento (regla)
- Q: query (búsqueda del usuario)
- f(qi, D): frecuencia del término qi en D
- IDF: peso inverso de frecuencia de documento
- k1: parámetro de saturación (1.5 por defecto)
- b: parámetro de longitud (0.75 por defecto)
- avgdl: longitud promedio de documentos
```

### Implementación

```typescript
// packages/search-engine/src/bm25.ts
export class BM25SearchEngine {
  private invertedIndex: Map<string, Map<string, number>>;
  private docLengths: Map<string, number>;
  private avgDocLength: number;

  search(query: string, limit: number = 10): SearchResult[] {
    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const token of tokens) {
      const docs = this.invertedIndex.get(token);
      if (!docs) continue;

      for (const [docId, termFreq] of docs.entries()) {
        const score = this.bm25Score(termFreq, docId, docs.size);
        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    return this.sortByScore(scores, limit);
  }
}
```

### Configuración Óptima

```typescript
const engine = new BM25SearchEngine({
  k1: 1.5,  // Saturación de frecuencia
  b: 0.75,  // Penalización por longitud
});
```

---

## Auto-Enrutamiento Contextual

### Flujo de Detección

```
┌─────────────────────────────────────────────────────────────┐
│                    Mensaje del Usuario                      │
│  "Necesito crear un componente standalone con signals"      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Análisis de Keywords                                    │
│     - "standalone" → angular                                │
│     - "signals" → angular                                   │
│     - "componente" → angular                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Detección por Proyecto (opcional)                       │
│     - angular.json detectado → angular                      │
│     - @angular/core en package.json → angular               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Búsqueda de Reglas                                      │
│     - searchLocalRules(message, "angular")                  │
│     - BM25 score > threshold                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Respuesta Contextualizada                               │
│     - Reglas de Angular inyectadas                          │
│     - Sub-agente Angular marcado como activo                │
└─────────────────────────────────────────────────────────────┘
```

### Implementación

```typescript
// apps/mcp-master/src/index.ts
server.tool('auto_route_query', async ({ message, projectPath }) => {
  // 1. Detectar por keywords
  const frameworkKeywords = {
    angular: ['component', 'signal', 'rxjs', 'standalone'],
    nestjs: ['controller', 'injectable', 'module', 'guard'],
    typescript: ['interface', 'type', 'generic'],
  };

  // 2. Detectar por proyecto
  let detectedFramework = detectByProject(projectPath);

  // 3. Determinar framework final
  const finalFramework = detectedFramework || bestKeywordMatch;

  // 4. Obtener reglas
  const rules = searchLocalRules(message, finalFramework);

  // 5. Responder con contexto
  return buildContextualResponse(finalFramework, rules);
});
```

---

## Health Check

### Implementación

```typescript
// MCP Master verifica cada 30 segundos
async function checkAgentHealth(agent: AgentConfig): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new grpc.Client(
      `${agent.host}:${agent.port}`,
      grpc.credentials.createInsecure()
    );

    const deadline = Date.now() + 2000; // 2s timeout

    client.waitForReady(deadline, (err) => {
      client.close();
      resolve(!err);
    });
  });
}

setInterval(runHealthChecks, 30000);
```

### Estados del Agente

| Estado | Descripción | Acción |
|--------|-------------|--------|
| `healthy: true` | Agente responde en < 2s | Usar para búsquedas |
| `healthy: false` | Agente no responde | Fallback a búsqueda local |
| No registrado | Agente no configurado | Mostrar error |

---

## Escalabilidad

### Horizontal

```
                    ┌──────────────┐
                    │  Load        │
                    │  Balancer    │
                    └──────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  MCP Master   │ │  MCP Master   │ │  MCP Master   │
│   :3003       │ │   :3003       │ │   :3003       │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Angular     │ │   NestJS      │ │  TypeScript   │
│   Agent       │ │   Agent       │ │   Agent       │
│   :50051      │ │   :50052      │ │   :50053      │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Vertical

- Aumentar `k1` y `b` en BM25 para mejor precisión
- Agregar más reglas por framework
- Implementar caché de búsquedas frecuentes

---

## Seguridad

### Consideraciones Actuales

| Riesgo | Estado | Mitigación |
|--------|--------|------------|
| gRPC sin autenticación | ⚠️ Abierto | Firewall local (localhost only) |
| MCP sin autorización | ⚠️ Abierto | Solo trusted clients |
| Variables de entorno | ✅ Configurables | SKILLS_PATH, PORT |

### Futuras Mejoras

1. **Autenticación gRPC**: mTLS entre master y agentes
2. **API Keys**: Para clientes MCP
3. **Rate Limiting**: Prevenir abuso de búsquedas
4. **Audit Log**: Registrar todas las consultas

---

## Testing Strategy

### Unit Tests

```typescript
// packages/search-engine/src/bm25.test.ts
describe('BM25SearchEngine', () => {
  it('should return results sorted by score', () => {
    const engine = new BM25SearchEngine();
    engine.index({ id: '1', name: 'Test', content: 'Angular signals', category: 'angular', tags: [], impact: 'HIGH' });
    
    const results = engine.search('angular signals');
    expect(results[0].rule.id).toBe('1');
  });
});
```

### Integration Tests

```typescript
// apps/mcp-master/test/auto-route.e2e.ts
describe('Auto Route Query', () => {
  it('should detect Angular from keywords', async () => {
    const response = await mcp.callTool({
      name: 'auto_route_query',
      arguments: { message: 'crear componente con signals' }
    });

    expect(response.content).toContain('ANGULAR');
  });
});
```

---

## Performance Benchmarks

| Operación | Latencia | Throughput |
|-----------|----------|------------|
| BM25 Search (100 reglas) | < 5ms | 200 req/s |
| gRPC Unary Call | < 10ms | 100 req/s |
| gRPC Streaming (1000 reglas) | < 50ms | 20 req/s |
| Health Check (3 agentes) | < 100ms | 1 req/30s |

---

## Decision Log

### ¿Por qué gRPC en lugar de HTTP REST?

- **Menor latencia**: HTTP/2 multiplexing
- **Streaming nativo**: Para respuestas grandes
- **Contratos fuertes**: .proto genera tipos automáticamente
- **Eficiencia**: Protobuf es más pequeño que JSON

### ¿Por qué BM25 en lugar de Vector Search?

- **Simplicidad**: Sin ML models que entrenar
- **Transparencia**: Score calculable y debuggable
- **Performance**: < 5ms vs ~50ms de embeddings
- **Costo**: Cero dependencias externas

### ¿Por qué monorepo?

- **Código compartido**: Tipos, utilidades, search engine
- **Versionado único**: Todos los paquetes en sync
- **Desarrollo local**: Cambios se reflejan inmediatamente
- **pnpm**: Disk-efficient con symlinks

---

## Futuro

### Roadmap v4

- [ ] Autenticación gRPC (mTLS)
- [ ] Caché Redis para búsquedas
- [ ] Dashboard de métricas (Prometheus + Grafana)
- [ ] Sub-agentes para más frameworks (React, Vue, FastAPI)
- [ ] Vector search híbrido (BM25 + embeddings)
- [ ] Migración a NestJS (opcional)
