# Plan de Migración desde Cipher

📊 **Análisis comparativo y hoja de ruta para mejorar Agent Skills API con características de Cipher**

---

## 📈 Resumen Ejecutivo

| Métrica | Cipher | Agent Skills API | Brecha |
|---------|--------|------------------|--------|
| **Madurez MCP** | ✅ Completo | ⚠️ Parcial | 60% |
| **Almacenamiento** | 7 backends | Memory/Basic | 85% |
| **LLM Providers** | 6+ | ❌ None | 100% |
| **UI/UX** | Web + CLI | API Only | 100% |
| **Tests** | Unit+Int+E2E | Unit básicos | 70% |
| **Docker** | ✅ Completo | ❌ None | 100% |

---

## 🎯 Características a Migrar

### 🔴 Prioridad ALTA (Sprint 1-2)

#### 1. Sistema de Memoria Dual (System 1 & 2)

**Qué es:**
- **System 1**: Memoria a corto plazo (conceptos, lógica de negocio, interacciones recientes)
- **System 2**: Memoria de razonamiento (pasos de pensamiento del modelo)

**Ubicación en Cipher:**
```
src/core/brain/memory/
src/core/session/
```

**Beneficios:**
- Los agentes recuerdan contexto entre sesiones
- Mejor calidad de respuestas con historial enriquecido
- Posibilidad de aprender de interacciones pasadas

**Implementación en Agent Skills API:**
```
src/
├── core/
│   ├── memory/
│   │   ├── short-term-memory.ts    # System 1
│   │   ├── long-term-memory.ts     # System 2
│   │   └── memory-manager.ts
│   └── session/
│       ├── session.entity.ts
│       ├── session.repository.ts
│       └── session.service.ts
```

**Tareas:**
- [ ] Crear entidades de memoria (CQRS: commands, queries, events)
- [ ] Implementar repositorios (SQLite inicial, luego multi-backend)
- [ ] Integrar con agentes existentes
- [ ] Añadir tests unitarios y de integración

---

#### 2. MCP Transportes Completos

**Qué es:**
- Soporte completo para SSE y Streamable-HTTP (ya parcialmente implementado)
- Compatibilidad total con clientes MCP (IDEs, herramientas)

**Ubicación en Cipher:**
```
src/core/mcp/
src/app/mcp/
```

**Beneficios:**
- Funciona con Cursor, Claude Code, VS Code, Windsurf, Cline, etc.
- Mayor alcance de usuarios
- Estándar de la industria

**Mejoras necesarias:**
- [ ] Completar implementación Streamable-HTTP
- [ ] Añadir autenticación MCP
- [ ] Soporte para notificaciones push
- [ ] Testing con múltiples clientes MCP

---

#### 3. Vector Storage Multi-Backend

**Qué es:**
- Abstracción para 7+ backends de vectores (Chroma, Pinecone, FAISS, Redis, Weaviate, Qdrant, Milvus, Pgvector)

**Ubicación en Cipher:**
```
src/core/vector_storage/
src/core/brain/embedding/backend/
```

**Beneficios:**
- Flexibilidad para diferentes necesidades
- Escalabilidad (de SQLite a producción con Pinecone/Qdrant)
- Búsquedas semánticas de reglas

**Implementación:**
```typescript
// Interface común
interface VectorStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  upsert(id: string, vector: number[], metadata: Record<string, any>): Promise<void>;
  search(query: number[], limit: number): Promise<VectorResult[]>;
  delete(id: string): Promise<void>;
}

// Implementaciones
class ChromaVectorStore implements VectorStore { ... }
class PineconeVectorStore implements VectorStore { ... }
class FAISSVectorStore implements VectorStore { ... }
```

**Tareas:**
- [ ] Crear interfaz común VectorStore
- [ ] Implementar SQLite Vector (desarrollo)
- [ ] Implementar ChromaDB (fácil de usar)
- [ ] Implementar Pinecone (producción)
- [ ] Factory pattern para selección dinámica
- [ ] Integrar con SearchAgent

---

#### 4. LLM Provider Abstraction

**Qué es:**
- Factory pattern para múltiples proveedores de LLM (OpenAI, Anthropic, Google, Ollama, LM Studio, AWS Bedrock, Azure)

**Ubicación en Cipher:**
```
src/core/brain/llm/
```

**Beneficios:**
- Cambiar de proveedor sin cambiar código
- Fallback automático si un proveedor falla
- Cost optimization (usar modelos más baratos cuando sea posible)

**Implementación:**
```typescript
interface LLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  stream(prompt: string, options?: LLMOptions): AsyncIterable<string>;
}

class OpenAIProvider implements LLMProvider { ... }
class AnthropicProvider implements LLMProvider { ... }
class OllamaProvider implements LLMProvider { ... }
class LMStudioProvider implements LLMProvider { ... }
```

**Tareas:**
- [ ] Definir interfaz LLMProvider
- [ ] Implementar OpenAI (prioridad)
- [ ] Implementar Anthropic
- [ ] Implementar Ollama (local, gratis)
- [ ] Implementar LM Studio (local)
- [ ] Crear LLMFactory
- [ ] Integrar con todos los agentes

---

#### 5. Embedding Resiliente

**Qué es:**
- Sistema de embeddings con circuit breaker, retry logic, y fallback strategies

**Ubicación en Cipher:**
```
src/core/brain/embedding/
  ├── circuit-breaker.ts
  ├── resilient-embedder.ts
  ├── safe-operations.ts
  └── backend/
      ├── openai.ts
      ├── ollama.ts
      ├── lmstudio.ts
      └── ...
```

**Beneficios:**
- Mayor estabilidad
- Fallback automático si un servicio falla
- Mejor experiencia de usuario

**Tareas:**
- [ ] Implementar CircuitBreaker pattern
- [ ] Crear ResilientEmbedder con retry logic
- [ ] Añadir fallback a embeddings locales (Ollama)
- [ ] Tests de resiliencia

---

### 🟡 Prioridad MEDIA (Sprint 3-4)

#### 6. Knowledge Graph

**Qué es:**
- Grafo de conocimiento para relaciones entre reglas, conceptos y patrones

**Ubicación en Cipher:**
```
src/core/knowledge_graph/
```

**Beneficios:**
- Búsquedas más inteligentes
- Descubrimiento de reglas relacionadas
- Visualización de dependencias

**Tareas:**
- [ ] Modelar entidades del grafo (Nodos: Regla, Concepto, Patrón)
- [ ] Implementar relaciones (USA, RELACIONADO_CON, PARTE_DE)
- [ ] Integrar con SQLite o Neo4j
- [ ] Añadir queries de grafos al SearchAgent

---

#### 7. Web UI

**Qué es:**
- Interfaz React para gestión de sesiones, chat con agentes, y visualización de reglas

**Ubicación en Cipher:**
```
src/app/ui/
```

**Beneficios:**
- Acceso para usuarios no técnicos
- Visualización de reglas y relaciones
- Mejor experiencia de usuario

**Tareas:**
- [ ] Crear estructura React + Vite
- [ ] Implementar chat con agentes
- [ ] Visor de reglas con búsqueda
- [ ] Gestión de sesiones
- [ ] Dashboard de métricas

---

#### 8. CLI Interactivo

**Qué es:**
- CLI para interactuar con agentes desde terminal

**Ubicación en Cipher:**
```
src/app/cli/
```

**Beneficios:**
- Mejor DX para desarrolladores
- Automatización de tareas
- Integración con scripts

**Tareas:**
- [ ] Usar Commander.js
- [ ] Comandos: `search`, `list`, `analyze`, `session`
- [ ] Modo interactivo
- [ ] Soporte para pipes

---

#### 9. Tests de Integración

**Qué es:**
- Setup completo de tests (Unit + Integration + E2E)

**Ubicación en Cipher:**
```
vitest.config.ts
examples/
src/**/__test__/
```

**Beneficios:**
- Mayor confianza en cambios
- Detección temprana de bugs
- Documentación viva

**Tareas:**
- [ ] Migrar a Vitest (más rápido que Jest)
- [ ] Crear tests de integración para agentes
- [ ] Tests E2E con HTTP testing
- [ ] CI/CD integration

---

#### 10. WebSocket Server

**Qué es:**
- Comunicación en tiempo real para streaming de respuestas

**Ubicación en Cipher:**
```
src/app/api/websocket/
```

**Beneficios:**
- Streaming de respuestas de agentes
- Notificaciones en tiempo real
- Mejor UX en Web UI

**Tareas:**
- [ ] Implementar WebSocket server
- [ ] Integrar con eventos CQRS
- [ ] Soporte para reconexión
- [ ] Autenticación WS

---

### 🟢 Prioridad BAJA (Sprint 5+)

#### 11. Dockerización Completa

**Tareas:**
- [ ] Dockerfile multi-stage
- [ ] docker-compose.yml (app + DB + vectores)
- [ ] Docker GitHub Actions

---

#### 12. Documentación Extensa

**Tareas:**
- [ ] Guía de configuración
- [ ] Documentación de LLM providers
- [ ] Documentación de vector stores
- [ ] Ejemplos de uso
- [ ] Deployment guide

---

#### 13. Seguridad Avanzada

**Tareas:**
- [ ] Rate limiting
- [ ] Helmet
- [ ] CORS avanzado
- [ ] Autenticación JWT
- [ ] API keys

---

#### 14. Logging Avanzado

**Tareas:**
- [ ] Migrar a Winston
- [ ] Logs estructurados
- [ ] Múltiples transports (file, console, HTTP)
- [ ] Log rotation

---

## 📅 Roadmap Sugerido

### **Fase 1: Fundación (Sprint 1-2)**
- [ ] Memoria Dual
- [ ] MCP Completo
- [ ] Vector Storage (SQLite + Chroma)
- [ ] LLM Provider (OpenAI + Ollama)

### **Fase 2: Resiliencia (Sprint 3-4)**
- [ ] Embedding Resiliente
- [ ] Knowledge Graph
- [ ] Tests de Integración
- [ ] WebSocket

### **Fase 3: UX (Sprint 5-6)**
- [ ] Web UI
- [ ] CLI Interactivo
- [ ] Documentación

### **Fase 4: Producción (Sprint 7-8)**
- [ ] Docker
- [ ] Seguridad
- [ ] Logging Avanzado
- [ ] Monitoring

---

## 🔧 Arquitectura Propuesta Post-Migración

```
src/
├── core/                          # Domain layer (Cipher-inspired)
│   ├── memory/                    # ⭐ NUEVO: Dual memory system
│   ├── session/                   # ⭐ MEJORADO: Session management
│   ├── vector_storage/            # ⭐ NUEVO: Multi-backend vectors
│   ├── embedding/                 # ⭐ NUEVO: Resilient embeddings
│   ├── llm/                       # ⭐ NUEVO: LLM providers
│   ├── knowledge_graph/           # ⭐ NUEVO: Knowledge graph
│   ├── mcp/                       # ⭐ MEJORADO: Full MCP support
│   ├── events/                    # CQRS events
│   ├── logger/                    # ⭐ MEJORADO: Winston
│   └── utils/
│
├── application/                   # Application layer (CQRS)
│   ├── commands/
│   ├── queries/
│   ├── handlers/
│   ├── sagas/                     # ⭐ NUEVO: Orchestration
│   └── ports/
│       ├── input/
│       └── output/
│
├── infrastructure/                # Infrastructure layer
│   ├── persistence/
│   ├── vector-stores/             # ⭐ NUEVO
│   ├── llm-providers/             # ⭐ NUEVO
│   ├── mcp/                       # ⭐ MEJORADO
│   └── adapters/
│
├── presentation/                  # Presentation layer
│   ├── http/                      # REST API
│   ├── websocket/                 # ⭐ NUEVO
│   ├── mcp/                       # MCP server
│   ├── cli/                       # ⭐ NUEVO
│   └── ui/                        # ⭐ NUEVO: Web UI
│
└── agents/                        # Agent layer (existing)
    ├── router/
    ├── search/
    ├── rules/
    ├── code/
    ├── architecture/
    ├── analysis/
    ├── identity/
    └── metrics/
```

---

## 📊 Métricas de Éxito

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| **Agentes** | 8 | 8 (mejorados) |
| **Reglas** | 20+ | 50+ (con grafo) |
| **Tests** | 17 | 100+ |
| **LLM Providers** | 0 | 6+ |
| **Vector Backends** | 0 | 3+ |
| **MCP Transports** | 1 (SSE) | 2 (SSE + HTTP) |
| **UI** | 0 | 2 (Web + CLI) |
| **Docker** | 0 | 1 |
| **Documentación** | Básica | Completa |

---

## 🚀 Primeros Pasos

1. **Crear rama `feature/cipher-migration`**
2. **Empezar con Vector Storage** (más fácil, mayor impacto)
3. **Luego LLM Provider** (habilita múltiples proveedores)
4. **Después Memoria Dual** (mejora agentes existentes)
5. **Finalizar con MCP Completo** (compatibilidad total)

---

## ⚠️ Riesgos y Mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Complejidad | Alto | Migrar incrementalmente |
| Breaking changes | Medio | Versionado semántico |
| Curva de aprendizaje | Medio | Documentación + ejemplos |
| Performance | Bajo | Tests de carga tempranos |

---

## 📚 Referencias de Cipher

- **GitHub**: https://github.com/campfirein/cipher
- **Docs**: https://docs.byterover.dev/cipher/overview
- **NPM**: https://www.npmjs.com/package/@byterover/cipher
- **Discord**: https://discord.com/invite/UMRrpNjh5W

---

**Última actualización**: 21 de marzo de 2026
**Autor**: CodeMentor MCP Analysis
