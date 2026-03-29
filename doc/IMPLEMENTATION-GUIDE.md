# Guía de Implementación - Agent Skills MCP

## 🎯 Objetivo

Implementar el flujo completo donde un usuario abre un agente CLI (Qwen-CLI, Gemini-CLI, etc.) y el MCP se activa automáticamente para proporcionar asistencia contextual.

---

## 📋 Prerrequisitos

- Node.js >= 20.x
- pnpm >= 8.x
- PostgreSQL 15+
- Redis 7+ (opcional para caché)
- Docker (opcional, para desarrollo)

---

## 🚀 Quick Start

### 1. Instalación y Configuración

```bash
# Clonar repositorio
git clone https://github.com/aajcr/agent-skills-api.git
cd agent-skills-api

# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env

# Iniciar base de datos (Docker)
pnpm run docker:up

# Ejecutar migraciones
pnpm run db:migrate

# Build del proyecto
pnpm run build
```

### 2. Iniciar Servicios

```bash
# Terminal 1: API REST + Agentes
pnpm run start:dev

# Terminal 2: MCP Server (stdio)
pnpm run start:mcp

# Verificar health
curl http://localhost:8004/health
```

---

## 🔧 Implementación por Fase

### FASE 1: Auto-Activación y Detección de Proyecto

#### 1.1 Middleware de Extracción de IP

**Archivo:** `src/infrastructure/middleware/extract-ip.middleware.ts`

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ExtractIpMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extraer IP real (considerando proxies y load balancers)
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    
    let ipAddress: string;
    
    if (forwardedFor) {
      // x-forwarded-for puede tener múltiples IPs: client, proxy1, proxy2
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ipAddress = realIp;
    } else {
      ipAddress = req.socket.remoteAddress || '127.0.0.1';
    }

    // Remover prefijo IPv6 si existe
    if (ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.substring(7);
    }

    // Adjuntar al request para uso posterior
    (req as any).ipAddress = ipAddress;
    
    // Usar como userId temporal
    (req as any).userId = ipAddress;

    next();
  }
}
```

**Registro en main.ts:**

```typescript
import { ExtractIpMiddleware } from '@infrastructure/middleware/extract-ip.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Registrar middleware globalmente
  app.use(ExtractIpMiddleware);
  
  // ... resto de configuración
}
```

#### 1.2 Servicio de Usuarios por IP

**Archivo:** `src/modules/users/application/services/users.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Encuentra usuario por IP o crea uno nuevo
   * Usa hash de IP para privacidad en producción
   */
  async findByIpOrCreate(ipAddress: string): Promise<User> {
    // Hash de IP para privacidad (opcional en producción)
    const hashedIp = this.hashIpAddress(ipAddress);
    
    let user = await this.userRepository.findOne({
      where: [{ lastIpAddress: ipAddress }, { id: hashedIp }],
    });

    if (!user) {
      user = this.userRepository.create({
        email: `user-${ipAddress.replace(/\./g, '-')}@local.dev`,
        name: `Developer from ${ipAddress}`,
        lastIpAddress: ipAddress,
        ipAddressHistory: [ipAddress],
        active: true,
      });

      await this.userRepository.save(user);
    }

    // Actualizar historial de IPs si es nueva
    if (!user.ipAddressHistory?.includes(ipAddress)) {
      user.ipAddressHistory = [...(user.ipAddressHistory || []), ipAddress];
      user.lastIpAddress = ipAddress;
      await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Hash de IP para privacidad (producción)
   */
  private hashIpAddress(ipAddress: string): string {
    const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-prod';
    return crypto
      .createHmac('sha256', salt)
      .update(ipAddress)
      .digest('hex');
  }
}
```

#### 1.3 Detección Automática de Proyecto

**Archivo:** `src/modules/projects/application/services/projects.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../domain/entities/project.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectDetection {
  name: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  detectedFramework?: string;
  detectedArchitecture?: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Detecta proyecto desde package.json en directorio dado
   */
  async detectFromPath(projectPath: string): Promise<ProjectDetection | null> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      return {
        name: packageJson.name || 'unknown-project',
        version: packageJson.version,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
        scripts: packageJson.scripts,
        detectedFramework: this.detectFramework(packageJson),
        detectedArchitecture: this.detectArchitecture(projectPath),
      };
    } catch (error) {
      // package.json no encontrado o inválido
      return null;
    }
  }

  /**
   * Encuentra o crea proyecto para usuario
   */
  async findOrCreateForUser(
    userId: string,
    projectName: string,
    projectPath?: string,
  ): Promise<Project> {
    let project = await this.projectRepository.findOne({
      where: { name: projectName, userId },
    });

    if (!project) {
      project = this.projectRepository.create({
        name: projectName,
        userId,
        isActive: true,
        defaultBranch: 'main',
      });

      // Si hay path, detectar metadata
      if (projectPath) {
        const detection = await this.detectFromPath(projectPath);
        if (detection) {
          project.metadata = {
            language: this.detectLanguage(detection),
            framework: detection.detectedFramework,
            lastAnalyzedAt: new Date().toISOString(),
          };
        }
      }

      await this.projectRepository.save(project);
    }

    return project;
  }

  /**
   * Detecta framework basado en dependencias
   */
  private detectFramework(packageJson: any): string {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps['@angular/core']) return 'angular';
    if (deps['@nestjs/common']) return 'nestjs';
    if (deps['react']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['express']) return 'node-express';
    if (deps['fastify']) return 'node-fastify';

    return 'node';
  }

  /**
   * Detecta arquitectura basada en estructura de archivos
   */
  private detectArchitecture(projectPath: string): string {
    // Implementación simplificada
    // En producción, escanear estructura de directorios
    return 'unknown';
  }

  /**
   * Detecta lenguaje principal
   */
  private detectLanguage(detection: ProjectDetection): string {
    if (detection.detectedFramework === 'angular' || 
        detection.detectedFramework === 'nestjs') {
      return 'TypeScript';
    }
    
    const hasTs = detection.dependencies?.['typescript'];
    const hasJs = detection.dependencies?.['@babel/core'];
    
    if (hasTs) return 'TypeScript';
    if (hasJs) return 'JavaScript';
    
    return 'Unknown';
  }
}
```

#### 1.4 Endpoint de Auto-Detección

**Archivo:** `src/modules/projects/presentation/controllers/projects.controller.ts`

```typescript
import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectsService } from '../../application/services/projects.service';
import { UsersService } from '@modules/users/application/services/users.service';

interface AutoDetectDto {
  projectPath: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('auto-detect')
  @HttpCode(HttpStatus.OK)
  async autoDetectProject(
    @Body() body: AutoDetectDto,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Req() req: Request,
  ) {
    // Extraer IP del request (ya viene del middleware)
    const ipAddress = (req as any).ipAddress || '127.0.0.1';
    
    // Obtener o crear usuario por IP
    const user = await this.usersService.findByIpOrCreate(ipAddress);

    // Detectar proyecto desde path
    const detection = await this.projectsService.detectFromPath(body.projectPath);

    if (!detection) {
      return {
        success: false,
        error: 'No se pudo detectar el proyecto. Verifica que exista package.json',
      };
    }

    // Encontrar o crear proyecto
    const project = await this.projectsService.findOrCreateForUser(
      user.id,
      detection.name,
      body.projectPath,
    );

    return {
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          metadata: project.metadata,
        },
        detection,
        userId: user.id,
        ipAddress,
      },
    };
  }
}
```

---

### FASE 2: Issues con Contexto JSON

#### 2.1 Schema de Contexto

**Archivo:** `src/modules/issues/domain/entities/issue-context.schema.ts`

```typescript
/**
 * Schema completo para el contexto de issues
 * Almacena toda la interacción usuario-agente
 */

export interface IssueContext {
  /**
   * Historial completo de interacciones
   */
  interactions: Interaction[];

  /**
   * Snapshot del proyecto al crear el issue
   */
  projectSnapshot?: ProjectSnapshot;

  /**
   * Decisiones clave tomadas
   */
  keyDecisions?: KeyDecision[];

  /**
   * Archivos modificados o creados
   */
  filesModified?: FileModification[];

  /**
   * Metadata adicional
   */
  metadata?: Record<string, any>;
}

export interface Interaction {
  /** Timestamp ISO 8601 */
  timestamp: string;
  
  /** Rol del participante */
  role: 'user' | 'agent' | 'system';
  
  /** Contenido del mensaje */
  content: string;
  
  /** ID del agente (si aplica) */
  agentId?: string;
  
  /** Metadata de la interacción */
  metadata?: InteractionMetadata;
}

export interface InteractionMetadata {
  /** Intención detectada */
  intention?: string;
  
  /** Agentes invocados */
  agentsInvoked?: string[];
  
  /** Reglas de código aplicadas */
  rulesApplied?: string[];
  
  /** Tiempo de ejecución en ms */
  executionTime?: number;
  
  /** Errores si los hubo */
  errors?: string[];
}

export interface ProjectSnapshot {
  /** Nombre del proyecto */
  name: string;
  
  /** Versión del package.json */
  version?: string;
  
  /** Dependencias principales */
  dependencies: Record<string, string>;
  
  /** Dev dependencies */
  devDependencies?: Record<string, string>;
  
  /** Scripts disponibles */
  scripts?: Record<string, string>;
  
  /** Framework detectado */
  detectedFramework?: string;
  
  /** Arquitectura detectada */
  detectedArchitecture?: string;
}

export interface KeyDecision {
  /** Decisión tomada */
  decision: string;
  
  /** Razonamiento detrás de la decisión */
  rationale: string;
  
  /** Timestamp de la decisión */
  timestamp: string;
  
  /** Alternativas consideradas */
  alternatives?: string[];
}

export interface FileModification {
  /** Path relativo del archivo */
  path: string;
  
  /** Acción realizada */
  action: 'create' | 'modify' | 'delete';
  
  /** Líneas añadidas */
  linesAdded?: number;
  
  /** Líneas removidas */
  linesRemoved?: number;
  
  /** Diff (opcional) */
  diff?: string;
}
```

#### 2.2 Servicio de Issues con Contexto

**Archivo:** `src/modules/issues/application/services/issues.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue, IssueStatus } from '../domain/entities/issue.entity';
import { IssueContext, Interaction } from '../domain/entities/issue-context.schema';

export interface CreateIssueDto {
  title: string;
  description?: string;
  requirements?: string;
  projectId?: string;
  userId?: string;
  context?: Partial<IssueContext>;
  metadata?: any;
}

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issueRepository: Repository<Issue>,
  ) {}

  /**
   * Crea issue con contexto inicial
   */
  async create(data: CreateIssueDto): Promise<Issue> {
    const issue = this.issueRepository.create({
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      projectId: data.projectId,
      userId: data.userId,
      status: IssueStatus.OPEN,
      context: data.context as IssueContext,
      metadata: {
        ...data.metadata,
        autoCreated: data.metadata?.autoCreated ?? false,
        source: data.metadata?.source ?? 'mcp-agent',
      },
      lastActivityAt: new Date(),
    });

    return await this.issueRepository.save(issue);
  }

  /**
   * Añade interacción al contexto del issue
   */
  async addInteraction(
    issueId: string,
    interaction: Interaction,
  ): Promise<Issue> {
    const issue = await this.issueRepository.findOne({ where: { id: issueId } });

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    // Inicializar contexto si no existe
    if (!issue.context) {
      issue.context = { interactions: [] } as IssueContext;
    }

    // Añadir interacción
    issue.context.interactions = [
      ...(issue.context.interactions || []),
      interaction,
    ];

    // Actualizar metadata
    issue.lastActivityAt = new Date();
    issue.metadata = {
      ...issue.metadata,
      lastInteractionAt: interaction.timestamp,
      totalInteractions: issue.context.interactions.length,
    };

    return await this.issueRepository.save(issue);
  }

  /**
   * Añade decisión clave al contexto
   */
  async addKeyDecision(
    issueId: string,
    decision: { decision: string; rationale: string; alternatives?: string[] },
  ): Promise<Issue> {
    const issue = await this.issueRepository.findOne({ where: { id: issueId } });

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    if (!issue.context) {
      issue.context = { interactions: [], keyDecisions: [] } as IssueContext;
    }

    issue.context.keyDecisions = [
      ...(issue.context.keyDecisions || []),
      {
        ...decision,
        timestamp: new Date().toISOString(),
      },
    ];

    return await this.issueRepository.save(issue);
  }

  /**
   * Actualiza archivos modificados
   */
  async addFileModifications(
    issueId: string,
    files: Array<{ path: string; action: string; linesAdded?: number; linesRemoved?: number }>,
  ): Promise<Issue> {
    const issue = await this.issueRepository.findOne({ where: { id: issueId } });

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    if (!issue.filesModified) {
      issue.filesModified = [];
    }

    issue.filesModified = [...issue.filesModified, ...files];

    return await this.issueRepository.save(issue);
  }

  /**
   * Obtiene issue con contexto completo
   */
  async findByIdWithContext(issueId: string): Promise<Issue | null> {
    return await this.issueRepository.findOne({
      where: { id: issueId },
      select: ['id', 'title', 'description', 'context', 'metadata', 'filesModified'],
    });
  }

  /**
   * Obtiene historial de interacciones
   */
  async getInteractionHistory(issueId: string): Promise<Interaction[]> {
    const issue = await this.findByIdWithContext(issueId);
    return issue?.context?.interactions || [];
  }
}
```

#### 2.3 Endpoint para Crear Issue con Contexto

**Archivo:** `src/modules/issues/presentation/controllers/issues.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IssuesService } from '../../application/services/issues.service';
import { CreateIssueDto } from '../../application/services/issues.service';
import { Interaction } from '../../domain/entities/issue-context.schema';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createIssue(@Body() data: CreateIssueDto) {
    const issue = await this.issuesService.create(data);
    
    return {
      success: true,
      data: {
        id: issue.id,
        title: issue.title,
        status: issue.status,
        context: issue.context,
        createdAt: issue.createdAt,
      },
    };
  }

  @Post(':id/interactions')
  @HttpCode(HttpStatus.OK)
  async addInteraction(
    @Param('id') id: string,
    @Body() interaction: Omit<Interaction, 'timestamp'>,
  ) {
    const issue = await this.issuesService.addInteraction(id, {
      ...interaction,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        issueId: issue.id,
        totalInteractions: issue.context?.interactions.length || 0,
        lastActivityAt: issue.lastActivityAt,
      },
    };
  }

  @Get(':id/context')
  async getContext(@Param('id') id: string) {
    const issue = await this.issuesService.findByIdWithContext(id);

    if (!issue) {
      return {
        success: false,
        error: 'Issue not found',
      };
    }

    return {
      success: true,
      data: {
        title: issue.title,
        context: issue.context,
        filesModified: issue.filesModified,
        keyDecisions: issue.context?.keyDecisions,
      },
    };
  }
}
```

---

### FASE 3: Orquestación de Agentes

#### 3.1 Workflow Engine

**Archivo:** `src/agents/workflow/workflow-engine.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AgentRegistry } from '@core/agents/agent-registry';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';

export interface WorkflowStep {
  agentId: string;
  order: number;
  parallel?: boolean; // Si es true, se ejecuta en paralelo con otros paralelos
  condition?: (context: WorkflowContext) => boolean; // Condición para ejecutar
}

export interface WorkflowContext {
  userInput: string;
  projectId?: string;
  userId?: string;
  issueId?: string;
  previousResponses: Record<string, AgentResponse>;
  metadata: Record<string, any>;
}

@Injectable()
export class WorkflowEngine {
  constructor(private readonly agentRegistry: AgentRegistry) {}

  /**
   * Ejecuta workflow definido
   */
  async executeWorkflow(
    steps: WorkflowStep[],
    context: WorkflowContext,
  ): Promise<Record<string, AgentResponse>> {
    const results: Record<string, AgentResponse> = {};

    // Agrupar steps por orden
    const stepsByOrder = steps.reduce((acc, step) => {
      if (!acc[step.order]) {
        acc[step.order] = [];
      }
      acc[step.order].push(step);
      return acc;
    }, {} as Record<number, WorkflowStep[]>);

    // Ejecutar órdenes secuencialmente
    const orders = Object.keys(stepsByOrder).map(Number).sort((a, b) => a - b);

    for (const order of orders) {
      const currentSteps = stepsByOrder[order];
      
      // Separar paralelos y secuenciales
      const parallelSteps = currentSteps.filter(s => s.parallel);
      const sequentialSteps = currentSteps.filter(s => !s.parallel);

      // Ejecutar paralelos
      if (parallelSteps.length > 0) {
        const parallelResults = await this.executeParallel(
          parallelSteps,
          context,
          results,
        );
        Object.assign(results, parallelResults);
      }

      // Ejecutar secuenciales
      for (const step of sequentialSteps) {
        if (step.condition && !step.condition(context)) {
          continue; // Saltar si no cumple condición
        }

        const result = await this.executeAgent(step.agentId, context);
        results[step.agentId] = result;

        // Actualizar contexto con respuesta
        context.previousResponses[step.agentId] = result;
      }
    }

    return results;
  }

  /**
   * Ejecuta agentes en paralelo
   */
  private async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext,
    previousResults: Record<string, AgentResponse>,
  ): Promise<Record<string, AgentResponse>> {
    const executions = steps.map(async (step) => {
      if (step.condition && !step.condition(context)) {
        return null;
      }
      const result = await this.executeAgent(step.agentId, context);
      return { agentId: step.agentId, result };
    });

    const results = await Promise.all(executions);
    
    return results.reduce((acc, r) => {
      if (r) {
        acc[r.agentId] = r.result;
      }
      return acc;
    }, {} as Record<string, AgentResponse>);
  }

  /**
   * Ejecuta un agente específico
   */
  private async executeAgent(
    agentId: string,
    context: WorkflowContext,
  ): Promise<AgentResponse> {
    const agent = this.agentRegistry.getAgent(agentId);

    if (!agent) {
      return {
        success: false,
        error: `Agent ${agentId} not found`,
        metadata: { executionTime: 0 },
      };
    }

    const request: AgentRequest = {
      input: context.userInput,
      options: {
        projectId: context.projectId,
        userId: context.userId,
        issueId: context.issueId,
        previousResponses: context.previousResponses,
        ...context.metadata,
      },
    };

    return await agent.execute(request);
  }
}
```

#### 3.2 Workflows Predefinidos

**Archivo:** `src/agents/workflow/workflows.ts`

```typescript
import { WorkflowStep } from './workflow-engine.service';

/**
 * Workflow para análisis de proyecto
 */
export const PROJECT_ANALYSIS_WORKFLOW: WorkflowStep[] = [
  { agentId: 'AnalysisAgent', order: 1 },
  { agentId: 'ArchitectureAgent', order: 1, parallel: true },
  { agentId: 'MetricsAgent', order: 1, parallel: true },
  { agentId: 'RulesAgent', order: 2, condition: (ctx) => {
    // Ejecutar si hay reglas aplicables
    return true;
  }},
];

/**
 * Workflow para migración de código
 */
export const CODE_MIGRATION_WORKFLOW: WorkflowStep[] = [
  { agentId: 'AnalysisAgent', order: 1 },
  { agentId: 'RulesAgent', order: 2 },
  { agentId: 'CodeAgent', order: 3 },
  { agentId: 'IssueWorkflowAgent', order: 4 },
];

/**
 * Workflow para creación de feature
 */
export const FEATURE_CREATION_WORKFLOW: WorkflowStep[] = [
  { agentId: 'PMAgent', order: 1 },
  { agentId: 'ArchitectureAgent', order: 2, parallel: true },
  { agentId: 'CodeAgent', order: 3 },
  { agentId: 'AnalysisAgent', order: 4 },
];

/**
 * Workflow genérico de búsqueda
 */
export const SEARCH_WORKFLOW: WorkflowStep[] = [
  { agentId: 'SearchAgent', order: 1 },
  { agentId: 'RulesAgent', order: 1, parallel: true },
];
```

---

### FASE 4: Integración con MCP Server

#### 4.1 MCP Server con Auto-Detección

**Archivo:** `src/mcp-server.ts` (actualizar)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const server = new Server(
  {
    name: 'CodeMentor MCP',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const PORT = process.env.PORT || 8004;
const API_URL = `http://localhost:${PORT}`;

// Tool definitions (aggiornate)
const TOOLS = [
  {
    name: 'agent_query',
    description: 'Consulta principal con auto-detección de proyecto y creación de issues',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Tu consulta' },
        sessionId: { type: 'string', description: 'ID de sesión' },
        projectPath: { type: 'string', description: 'Path al proyecto (auto-detect si no se proporciona)' },
      },
      required: ['input'],
    },
  },
  // ... resto de tools
];

// Call Tool Handler actualizado
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'agent_query': {
        const input = args?.input as string;
        const sessionId = args?.sessionId as string | undefined;
        const projectPath = args?.projectPath as string | undefined;

        // Auto-detect project path si no se proporciona
        const detectedPath = projectPath || await detectProjectPath();
        
        // Auto-detect project metadata
        let projectContext = null;
        if (detectedPath) {
          projectContext = await detectProject(detectedPath);
        }

        // Llamar a API con contexto
        const session = sessionId || `session-${Date.now()}`;
        
        const response = await fetch(`${API_URL}/mcp/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input,
            sessionId: session,
            projectPath: detectedPath,
            projectContext,
            options: {
              autoCreateIssue: true,
              trackInteractions: true,
            },
          }),
        });

        const data = await response.json();
        return {
          content: [{ type: 'text', text: formatAgentResponse(data) }],
        };
      }

      // ... resto de handlers
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

/**
 * Detecta path del proyecto automáticamente
 * Busca package.json desde directorio actual hacia arriba
 */
async function detectProjectPath(): Promise<string | null> {
  let currentDir = process.cwd();
  
  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    try {
      await fs.access(packageJsonPath);
      return currentDir;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }
  
  return null;
}

/**
 * Detecta metadata del proyecto
 */
async function detectProject(projectPath: string): Promise<any> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);

    return {
      name: packageJson.name,
      version: packageJson.version,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
    };
  } catch {
    return null;
  }
}

// ... resto del código
```

---

## 🧪 Testing

### Tests de Integración

**Archivo:** `test/e2e/auto-detect.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Auto-Detect Project (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should auto-detect project from package.json', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects/auto-detect')
      .send({ projectPath: '/path/to/test-project' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.detection.name).toBeDefined();
    expect(response.body.data.detection.detectedFramework).toBeDefined();
  });

  it('should create user by IP automatically', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects/auto-detect')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ projectPath: '/path/to/test-project' })
      .expect(200);

    expect(response.body.data.userId).toBeDefined();
    expect(response.body.data.ipAddress).toBe('192.168.1.100');
  });
});
```

---

## 📊 Monitoreo y Métricas

### Health Check Extendido

**Archivo:** `src/presentation/controllers/health/health.controller.ts`

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }

  @Get('metrics')
  metrics() {
    return {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      version: process.version,
    };
  }
}
```

---

## 🎯 Siguientes Pasos

1. **Completar Fase 1**: Implementar middleware y servicios de auto-detección
2. **Completar Fase 2**: Implementar schema de contexto y endpoints de issues
3. **Completar Fase 3**: Implementar WorkflowEngine y workflows predefinidos
4. **Completar Fase 4**: Actualizar MCP server con auto-detección
5. **Testing**: Escribir tests e2e para cada flujo
6. **Documentación**: Actualizar README con ejemplos de uso
7. **Deploy**: Configurar Docker y CI/CD

---

**Última actualización:** 2026-03-28  
**Versión:** 1.0.0  
**Estado:** En implementación
