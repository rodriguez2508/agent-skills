# Agent Skills MCP - Idea de Negocio

## 🎯 Visión General

**Agent Skills MCP** es una plataforma de agentes de IA autónomos que se integra nativamente con agentes CLI (Qwen-CLI, Gemini-CLI, Cursor, Claude Code) para proporcionar asistencia contextual inteligente en el desarrollo de software.

### Propuesta de Valor

> "Un desarrollador abre su agente de IA favorito dentro de un proyecto y obtiene asistencia inmediata, contextual y autónoma sin configuración manual."

---

## 🔄 Flujo de Usuario Principal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. DESARROLLADOR EN PROYECTO                                           │
│  $ cd /home/dev/mi-proyecto                                             │
│  $ qwen                                                                 │
│  (Qwen-CLI inicia dentro del contexto del proyecto)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. USUARIO ESCRIBE PETICIÓN NATURAL                                    │
│  "quiero que analices el proyecto"                                      │
│  "necesito migrar el componente X a signals"                            │
│  "crea una historia de usuario para autenticación"                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. DETECCIÓN AUTOMÁTICA DE CONTEXTO (Auto-Activación)                  │
│  ✓ MCP se activa automáticamente al detectar comandos de agente         │
│  ✓ Lee package.json → projectId: "mi-proyecto"                          │
│  ✓ Extrae IP del cliente → userId: "192.168.1.100"                      │
│  ✓ Detecta estructura del proyecto (Angular, NestJS, etc.)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. ROUTERAGENT ANALIZA INTENCIÓN                                       │
│  "analices el proyecto" → AnalysisAgent + ArchitectureAgent             │
│  "migrar componente" → CodeAgent + IssueWorkflowAgent                   │
│  "historia de usuario" → PMAgent                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. CREACIÓN AUTOMÁTICA DE ISSUE                                        │
│  {                                                                        │
│    "userId": "192.168.1.100",                                           │
│    "projectId": "mi-proyecto",                                          │
│    "title": "Analizar proyecto",                                        │
│    "status": "open",                                                    │
│    "context": {                                                          │
│      "interactions": [                                                   │
│        {                                                                 │
│          "timestamp": "2026-03-28T10:00:00Z",                           │
│          "role": "user",                                                 │
│          "content": "quiero que analices el proyecto"                   │
│        },                                                                │
│        {                                                                 │
│          "timestamp": "2026-03-28T10:00:05Z",                           │
│          "role": "agent",                                                │
│          "content": "Iniciando análisis del proyecto...",               │
│          "agent": "AnalysisAgent"                                        │
│        }                                                                 │
│      ],                                                                  │
│      "projectSnapshot": {                                                │
│        "name": "mi-proyecto",                                            │
│        "version": "1.0.0",                                              │
│        "dependencies": { "@angular/core": "^17.0.0", ... }              │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. ORQUESTACIÓN DE AGENTES                                             │
│  Secuencial: AnalysisAgent → ArchitectureAgent → MetricsAgent           │
│  Paralelo: CodeAgent + RulesAgent (según complejidad)                   │
│  Con contexto: Cada agente recibe el historial completo                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  7. RESPUESTA ENRIQUECIDA AL USUARIO                                    │
│  ✓ Análisis completo del proyecto                                       │
│  ✓ Issues creados automáticamente ("migrar componente X")               │
│  ✓ Reglas de código aplicadas                                           │
│  ✓ Sugerencias de mejora                                                │
│  ✓ Métricas de calidad                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitectura del Sistema

### Jerarquía de Datos

```
┌──────────────────────────────────────────────────────────────┐
│ USUARIO (identificado por IP)                                │
│ id: "uuid"                                                   │
│ ipAddress: "192.168.1.100"                                   │
│ email: "dev@example.com" (opcional)                          │
└──────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────────────────────────────────────────────┐
│ PROYECTOS (múltiples por usuario)                            │
│ id: "uuid"                                                   │
│ name: "mi-proyecto" (del package.json)                       │
│ repoUrl: "https://github.com/user/repo"                      │
│ metadata: { language: "TypeScript", framework: "Angular" }   │
└──────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ├─────────────────┬──────────────────┐
         ▼                 ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ SESIONES        │ │ ISSUES          │ │ HISTORIAL       │
│ Chat temporal   │ │ Trabajo activo  │ │ Completo        │
│ status: active  │ │ status: open    │ │ JSONB           │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Schema de Contexto en Issues

```typescript
interface IssueContext {
  /**
   * Historial completo de interacciones
   * Se actualiza en cada mensaje del usuario/agente
   */
  interactions: Array<{
    timestamp: string;      // ISO 8601
    role: 'user' | 'agent' | 'system';
    content: string;        // Mensaje completo
    agent?: string;         // ID del agente si es 'agent'
    metadata?: {
      intention?: string;   // Intención detectada
      agentsInvoked?: string[];
      rulesApplied?: string[];
      filesModified?: string[];
      executionTime?: number;
    };
  }>;

  /**
   * Snapshot del proyecto al momento de crear el issue
   */
  projectSnapshot?: {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    detectedFramework?: 'angular' | 'nestjs' | 'react' | 'vue' | 'node';
    detectedArchitecture?: 'hexagonal' | 'mvc' | 'clean' | 'monolith';
  };

  /**
   * Decisiones clave tomadas durante la sesión
   */
  keyDecisions?: Array<{
    decision: string;
    rationale: string;
    timestamp: string;
    alternatives?: string[];
  }>;

  /**
   * Archivos modificados o creados
   */
  filesModified?: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    linesAdded?: number;
    linesRemoved?: number;
  }>;
}
```

---

## 🤖 Agentes Especializados

### RouterAgent (Orquestador Principal)

**Responsabilidad:** Detectar intención y orquestar agentes especializados

```typescript
// Detección de intención
const intentionPatterns = {
  'pm': ['crear issue', 'historia de usuario', 'producto', 'prd'],
  'code': ['crear', 'generar', 'implementar', 'código'],
  'analysis': ['analiza', 'revisa', 'verifica', 'auditoría'],
  'architecture': ['arquitectura', 'estructura', 'patrón'],
  'issue-workflow': ['issue', 'ticket', 'tarea', 'workflow'],
  'search': ['buscar', 'encuentra', 'search', 'reglas'],
};
```

### PMAgent (Product Management)

**Responsabilidad:** Crear issues, user stories, criterios de aceptación

**Herramientas:**
- `create_issue(title, description, context)`
- `create_user_story(role, goal, benefit)`
- `define_acceptance_criteria(criteria[])`
- `estimate_business_value(priority, impact)`

**Ejemplo de uso:**
```
Usuario: "Necesito autenticación con Google"

PMAgent crea:
{
  title: "Implementar autenticación con Google OAuth",
  description: "Como usuario, quiero iniciar sesión con Google...",
  userStory: {
    role: "Usuario del sistema",
    goal: "Iniciar sesión usando mi cuenta de Google",
    benefit: "Acceso rápido sin crear nueva contraseña"
  },
  acceptanceCriteria: [
    "El usuario ve botón 'Login con Google'",
    "Redirección exitosa a Google OAuth",
    "Callback maneja respuesta correctamente",
    "Session se crea tras autenticación exitosa"
  ],
  businessValue: "HIGH",
  priority: "P1"
}
```

### CodeAgent

**Responsabilidad:** Generar código siguiendo reglas y patrones

**Características:**
- Aplica reglas de código automáticamente
- Sigue Clean Architecture + CQRS
- Genera tests unitarios
- Respeta convenciones del proyecto

### AnalysisAgent

**Responsabilidad:** Analizar código, calidad, deuda técnica

**Herramientas:**
- Análisis estático de código
- Detección de code smells
- Métricas de complejidad ciclomática
- Identificación de dependencias

### ArchitectureAgent

**Responsabilidad:** Validar arquitectura, patrones, estructura

**Validaciones:**
- Clean Architecture compliance
- Dependency Injection correctness
- Module boundaries
- Layer separation

### IssueWorkflowAgent

**Responsabilidad:** Gestionar el flujo de trabajo de issues

**Workflow Steps:**
```typescript
enum IssueWorkflowStep {
  READ = '1_READ',           // Leer contexto y código existente
  ANALYZE = '2_ANALYZE',     // Analizar impacto
  PLAN = '3_PLAN',           // Crear plan de acción
  CODE = '4_CODE',           // Generar código
  TEST = '5_TEST',           // Verificar tests
  COMMIT = '6_COMMIT',       // Commit cambios
  PUSH = '7_PUSH',           // Push a rama
  CREATE_PR_MD = '8_CREATE_PR_MD', // Crear PR.md
  CREATE_PR = '9_CREATE_PR'  // Crear Pull Request
}
```

### SearchAgent

**Responsabilidad:** Búsqueda BM25 de reglas de código

**Algoritmo:** Okapi BM25
```
score(D, Q) = Σ IDF(qi) × (f(qi, D) × (k1 + 1)) / (f(qi, D) + k1 × (1 - b + b × |D|/avgdl))
```

### RulesAgent

**Responsabilidad:** Listar y gestionar reglas de código

**Categorías:**
- `nestjs` - Reglas de NestJS
- `angular` - Reglas de Angular
- `typescript` - Reglas de TypeScript
- `architecture` - Patrones arquitectónicos

### IdentityAgent

**Responsabilidad:** Gestionar identidad MCP y prefijos de respuesta

**Prefijos:**
- `🎓 Según CodeMentor MCP` - Reglas de código
- `🤖 Agent Response` - Respuestas de agentes
- `📋 Issue Created` - Issues creados

### MetricsAgent

**Responsabilidad:** Métricas y tracking de uso

**Métricas:**
- Total de sesiones por usuario
- Issues creados/resueltos
- Tiempo promedio de resolución
- Reglas más aplicadas

---

## 💾 Modelo de Datos

### Tabla: users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  last_ip_address INET,
  ip_address_history INET[],
  total_sessions INTEGER DEFAULT 0,
  total_searches INTEGER DEFAULT 0,
  preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_last_ip ON users(last_ip_address);
CREATE INDEX idx_users_email ON users(email);
```

### Tabla: projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  repo_url VARCHAR(500),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  default_branch VARCHAR(100) DEFAULT 'main',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_user_id ON projects(user_id);
```

### Tabla: issues

```sql
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id VARCHAR(50),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  requirements TEXT,
  status VARCHAR(50) DEFAULT 'open',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  context JSONB,  -- CONTEXTO COMPLETO DE INTERACCIONES
  current_workflow_step VARCHAR(100),
  completed_steps JSONB,
  next_steps TEXT[],
  key_decisions JSONB,
  files_modified TEXT[],
  metadata JSONB,
  last_session_id UUID,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_user_id ON issues(user_id);
CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_issues_context ON issues USING GIN(context);
```

### Tabla: sessions

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active',
  title VARCHAR(255),
  is_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMP,
  metadata JSONB,
  message_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_issue_id ON sessions(issue_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

---

## 🔌 Integración con Agentes CLI

### Qwen-CLI

**Configuración automática:** `~/.qwen/settings.json`

```json
{
  "mcp": {
    "enabled": true,
    "autoActivateSkills": true,
    "preferMcpOverInternalTools": true
  },
  "mcpServers": {
    "agent-skills-api": {
      "url": "http://localhost:8004/mcp/sse",
      "trust": true,
      "priority": "high",
      "autoDetectProject": true,
      "identifyByIp": true
    }
  }
}
```

### Gemini-CLI

**Configuración:** `~/.gemini/mcp.json`

```json
{
  "mcpServers": {
    "agent-skills-api": {
      "command": "node",
      "args": ["/path/to/agent-skills-api/dist/mcp-server.js"],
      "env": {
        "PORT": "8004",
        "AUTO_DETECT_PROJECT": "true"
      },
      "trust": true
    }
  }
}
```

### Cursor

**Configuración:** `.cursor/settings.json` (proyecto) o `~/.cursor/settings.json`

```json
{
  "mcp": {
    "agent-skills-api": {
      "command": "node",
      "args": ["/path/to/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:8004"
      }
    }
  }
}
```

### Claude Code

**Configuración:** `~/.claude/mcp.json`

```json
{
  "mcpServers": {
    "agent-skills-api": {
      "command": "node",
      "args": ["/path/to/dist/mcp-server.js"],
      "env": {
        "API_URL": "http://localhost:8004"
      }
    }
  }
}
```

---

## 🚀 Endpoints de la API

### REST API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/mcp/chat` | Chat con agentes (MCP) |
| `GET` | `/mcp/sse` | MCP SSE endpoint |
| `POST` | `/users` | Crear usuario (auto por IP) |
| `GET` | `/users/:id/projects` | Obtener proyectos de usuario |
| `POST` | `/projects` | Crear proyecto |
| `POST` | `/issues` | Crear issue con contexto |
| `GET` | `/issues/:id` | Obtener issue con contexto |
| `PATCH` | `/issues/:id/context` | Actualizar contexto de issue |
| `GET` | `/sessions/:id` | Obtener sesión |
| `POST` | `/sessions` | Crear sesión |
| `GET` | `/rules` | Listar reglas |
| `GET` | `/rules/search?q=xxx` | Buscar reglas (BM25) |

### MCP Tools

| Herramienta | Descripción |
|-------------|-------------|
| `agent_query` | Consulta principal con auto-enrutamiento |
| `search_rules` | Búsqueda BM25 de reglas |
| `get_rule` | Obtener regla por ID |
| `list_rules` | Listar reglas disponibles |
| `create_issue` | Crear issue con contexto (PMAgent) |
| `get_project_context` | Obtener contexto del proyecto |

---

## 🔐 Identificación por IP

### Implementación

```typescript
// Middleware: extract-ip.middleware.ts
@Injectable()
export class ExtractIpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extraer IP real (considerando proxies)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] 
               || req.headers['x-real-ip'] 
               || req.socket.remoteAddress;
    
    req['userId'] = ip; // Usar IP como identificador temporal
    next();
  }
}

// Service: users.service.ts
async findByIpOrCreate(ipAddress: string): Promise<User> {
  let user = await this.userRepository.findOne({ 
    where: { lastIpAddress: ipAddress } 
  });

  if (!user) {
    user = this.userRepository.create({
      email: `user-${ipAddress}@local.dev`,
      name: `User from ${ipAddress}`,
      lastIpAddress: ipAddress,
      ipAddressHistory: [ipAddress],
    });
    await this.userRepository.save(user);
  }

  return user;
}
```

### Consideraciones de Producción

| Escenario | Solución |
|-----------|----------|
| IP dinámica (DHCP) | Usar `IP + fingerprint del proyecto` |
| VPN/Proxy | Extraer de headers `X-Forwarded-For` |
| Múltiples usuarios misma IP | Requerir autenticación (API key) |
| Privacidad | Hash de IP con salt rotativo |

---

## 📊 Métricas y Tracking

### Por Usuario

```sql
SELECT 
  u.id,
  u.last_ip_address,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT i.id) as total_issues,
  COUNT(DISTINCT s.id) as total_sessions,
  SUM(s.message_count) as total_messages
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN issues i ON u.id = i.user_id
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id;
```

### Por Proyecto

```sql
SELECT 
  p.name,
  COUNT(DISTINCT i.id) as total_issues,
  COUNT(DISTINCT CASE WHEN i.status = 'completed' THEN i.id END) as completed_issues,
  AVG(EXTRACT(EPOCH FROM (i.completed_at - i.created_at))) / 3600 as avg_resolution_hours
FROM projects p
LEFT JOIN issues i ON p.id = i.project_id
GROUP BY p.id, p.name;
```

---

## 🎯 Casos de Uso Ejemplo

### Caso 1: Análisis de Proyecto

```
Usuario: "quiero que analices el proyecto"

Flujo:
1. RouterAgent detecta intención → "analysis"
2. AnalysisAgent escanea estructura del proyecto
3. ArchitectureAgent valida patrones
4. MetricsAgent calcula métricas
5. Issue creado automáticamente:
   {
     title: "Análisis completo del proyecto",
     context: {
       interactions: [...],
       projectSnapshot: {...},
       findings: {
         codeSmells: 5,
         complexityAvg: 12.3,
         testCoverage: "78%",
         architectureCompliance: "92%"
       }
     }
   }
6. Respuesta al usuario con resumen ejecutivo
```

### Caso 2: Migración de Componente

```
Usuario: "necesito migrar el componente X a signals"

Flujo:
1. RouterAgent detecta intención → "code" + "issue-workflow"
2. PMAgent crea issue:
   {
     title: "Migrar componente X a signals",
     userStory: "Como desarrollador, quiero usar signals...",
     acceptanceCriteria: [...]
   }
3. CodeAgent analiza componente actual
4. CodeAgent genera nueva versión con signals
5. IssueWorkflowAgent actualiza paso a paso:
   - 1_READ ✓
   - 2_ANALYZE ✓
   - 3_PLAN ✓
   - 4_CODE ✓
   - 5_TEST (pendiente)
6. Usuario recibe código + issue actualizado
```

### Caso 3: Nueva Feature

```
Usuario: "quiero agregar autenticación con JWT"

Flujo:
1. RouterAgent detecta intención → "pm" + "code"
2. PMAgent crea PRD (Product Requirements Document):
   {
     title: "Implementar autenticación JWT",
     businessValue: "HIGH",
     estimatedHours: 8,
     acceptanceCriteria: [...]
   }
3. PMAgent desglosa en issues:
   - Issue #1: Crear módulo Auth
   - Issue #2: Implementar JWT strategy
   - Issue #3: Crear guards
   - Issue #4: Tests e2e
4. CodeAgent genera código para cada issue
5. Usuario recibe roadmap completo + código
```

---

## 🛣️ Roadmap

### Fase 1: Auto-Activación (Crítico)
- [ ] Detección automática de proyecto (leer package.json)
- [ ] Identificación por IP (middleware)
- [ ] Conexión MCP instantánea sin configuración manual
- [ ] Contexto JSON en issues

### Fase 2: Orquestación de Agentes
- [ ] WorkflowEngine para ejecución secuencial/paralela
- [ ] Cola de tareas con Redis
- [ ] Tracking de progreso en tiempo real
- [ ] Reintentos y manejo de errores

### Fase 3: Integración CLI
- [ ] Qwen-CLI: configuración auto-activada
- [ ] Gemini-CLI: documentación y setup
- [ ] Cursor: extensión marketplace
- [ ] Claude Code: perfil preconfigurado

### Fase 4: Producción
- [ ] Autenticación real (API keys, OAuth)
- [ ] Rate limiting
- [ ] Audit log
- [ ] Dashboard de métricas
- [ ] Webhooks para notificaciones

---

## 💰 Modelo de Negocio

### Versión Community (Gratis)
- ✅ Auto-activación MCP
- ✅ 5 agentes básicos (Router, Search, Code, Analysis, Rules)
- ✅ Issues con contexto (hasta 100 interacciones)
- ✅ 3 proyectos por usuario
- ✅ Comunidad Discord

### Versión Pro ($15/mes)
- ✅ Todos los agentes (11)
- ✅ Issues ilimitados
- ✅ Proyectos ilimitados
- ✅ Orquestación avanzada (secuencial/paralelo)
- ✅ Integración GitHub/GitLab
- ✅ Dashboard de métricas
- ✅ Soporte prioritario

### Versión Enterprise (Custom)
- ✅ Deploy on-premise
- ✅ SSO (SAML, OIDC)
- ✅ Audit log completo
- ✅ SLA 99.9%
- ✅ Soporte dedicado 24/7
- ✅ Custom agents

---

## 📈 KPIs

| Métrica | Objetivo | Actual |
|---------|----------|--------|
| Usuarios activos diarios | 100 | - |
| Issues creados/día | 500 | - |
| Tiempo promedio de respuesta | < 2s | - |
| Satisfacción de usuario (CSAT) | > 4.5/5 | - |
| Retención a 30 días | > 60% | - |

---

## 🔒 Seguridad y Privacidad

### Consideraciones

| Riesgo | Mitigación |
|--------|------------|
| IP como identificador | Hash con salt rotativo |
| Contexto sensible | Encriptación AES-256 en DB |
| Acceso no autorizado | API keys para producción |
| Rate limiting | 100 req/hora por IP (gratis) |
| Audit trail | Log de todas las acciones |

### Compliance

- ✅ GDPR: Derecho al olvido (borrar usuario + datos)
- ✅ SOC2: Audit log completo
- ✅ ISO 27001: Encriptación de datos en reposo y tránsito

---

## 📝 Licencia

MIT License - Ver LICENSE para detalles

---

## 👥 Contribución

1. Fork el repositorio
2. Crea rama de feature (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push a rama (`git push origin feature/amazing-feature`)
5. Abre Pull Request

---

**Documentación creada:** 2026-03-28  
**Versión:** 1.0.0  
**Estado:** Draft
