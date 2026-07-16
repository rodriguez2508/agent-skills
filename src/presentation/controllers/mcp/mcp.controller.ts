import {
  Controller,
  Get,
  Post,
  Res,
  Req,
  Logger,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { RouterAgent } from '@agents/router/router.agent';
import { IdentityAgent } from '@agents/identity/identity.agent';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { ProjectsService } from '@modules/projects/application/services/projects.service';
import { McpPlanService } from '@modules/plans/application/services/mcp-plan.service';
import { GraphifyExecutorService } from '@agents/graphify/graphify-executor.service';
import { ObsidianVaultService } from '@agents/obsidian/obsidian-vault.service';
import { ContextNodeService } from '@modules/contexts/application/services/context-node.service';
import { ContextService } from '@modules/contexts/application/services/context.service';
import { ContextType } from '@modules/contexts/domain/entities/context.entity';
import * as path from 'path';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly routerAgent: RouterAgent,
    private readonly identityAgent: IdentityAgent,
    private readonly agentLogger: AgentLoggerService,
    private readonly redisService: RedisService,
    private readonly projectsService: ProjectsService,
    private readonly mcpPlanService: McpPlanService,
    private readonly graphifyExecutor: GraphifyExecutorService,
    private readonly obsidianVault: ObsidianVaultService,
    private readonly contextNodeService: ContextNodeService,
    private readonly contextService: ContextService,
  ) {}

  @Get('sse')
  @ApiOperation({ summary: 'MCP SSE endpoint for Qwen communication' })
  async sse(@Res() res: Response, @Req() req: Request) {
    // Get unique client identifier (Qwen sends clientId or we use IP)
    // Each Qwen instance should have a unique clientId (timestamp-based)
    const clientId =
      (req.query.clientId as string) ||
      (req.headers['x-client-id'] as string) ||
      `ip-${req.ip || 'unknown'}-${Date.now()}`;

    this.logger.log(`🔌 MCP: New SSE client connected (clientId: ${clientId})`);

    // Configure headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // ALWAYS create a new SSE transport for each connection
    // Multiple Qwen instances can connect simultaneously
    // They will share the same userId (by IP) but have different sessionIds
    const { sessionId } = await this.mcpService.createSession(res, clientId);

    this.logger.log(
      `✅ MCP: Session CREATED: ${sessionId} (clientId: ${clientId})`,
    );

    // Handle errors
    res.on('error', (error) => {
      this.logger.error(`❌ MCP: SSE error: ${error.message}`, error.stack);
    });
  }

  @Get('message')
  @ApiOperation({ summary: 'MCP message endpoint (GET for testing)' })
  message(@Res() res: Response) {
    res.json({
      status: 'ok',
      message: '🎓 CodeMentor MCP is ready',
      description: 'POST to this endpoint with MCP messages',
      agents: this.routerAgent['agentRegistry'].getAgentIds(),
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
      ],
    });
  }

  @Post('message')
  @ApiOperation({ summary: 'MCP message endpoint (POST for MCP protocol)' })
  async postMessage(
    @Res() res: Response,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const method = body?.method;
    const params = body?.params || {};

    this.logger.log(
      `📨 MCP: Mensaje recibido | method: ${method} | Body: ${JSON.stringify(body)?.substring(0, 300)}`,
    );

    // Delegate to SSE transport for MCP protocol methods
    // The transport handles initialize, tools/list, tools/call, etc. automatically
    const sessionId =
      (req.headers['last-event-id'] as string) ||
      (req.query.sessionId as string);

    // Get the session from McpService
    let session = sessionId ? this.mcpService.getSession(sessionId) : null;

    if (!session) {
      // Try to find by any active session
      const sessions = this.mcpService.getSessions();
      if (sessions.size > 0) {
        session = Array.from(sessions.values())[0];
      }
    }

    if (!session) {
      this.logger.warn(`⚠️ MCP: No hay sesión activa`);
      res.status(404).json({ error: 'No MCP session found' });
      return;
    }

    try {
      // Let the SSE transport handle the message
      // This will handle initialize, tools/list, tools/call, etc. automatically
      await session.transport.handlePostMessage(req, res, body);
      this.logger.log(
        `✅ MCP: Message handled by transport | method: ${method}`,
      );
    } catch (error: any) {
      this.logger.error(`❌ MCP: Error en transport: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  @Post('register-project')
  @ApiOperation({ summary: 'Register a project with the MCP system' })
  async registerProject(
    @Body()
    body: {
      projectPath: string;
      sessionId?: string;
      relatedProjects?: Array<{
        projectPath?: string;
        projectId?: string;
        type?: string;
        description?: string;
      }>;
    },
    @Req() req: Request,
  ) {
    const { projectPath, sessionId: providedSessionId, relatedProjects } = body;

    if (!projectPath) {
      return { success: false, error: 'projectPath is required' };
    }

    const clientIp = req.ip || 'unknown';
    const sessionId = await this.resolveSessionId(providedSessionId, clientIp);

    this.logger.log(`📁 MCP: Registering project at ${projectPath}`);

    try {
      const { user } = await this.mcpService['userRepository'].findByIpOrCreate(
        {
          ipAddress: clientIp,
        },
      );

      const detection = await this.projectsService.detectFromPath(projectPath);
      const projectName = detection?.name || path.basename(projectPath);

      const project = await this.projectsService.findOrCreateForUser(
        user.id,
        projectName,
        projectPath,
      );

      // Link project to session
      if (sessionId) {
        const sessionRepo = this.mcpService['sessionRepository'];
        const session = await sessionRepo.findBySessionId(sessionId);
        if (session && !session.projectId) {
          await sessionRepo
            .getRepository()
            .update({ id: session.id }, { projectId: project.id });
        }
        await this.redisService.set(
          `session:${sessionId}:projectId`,
          project.id,
          3600,
        );
        await this.redisService.set(
          `session:${sessionId}:projectName`,
          project.name,
          3600,
        );
      }

      // Resolve and link related projects
      const linkedRelationships: Array<{
        name: string;
        type: string;
        id: string;
      }> = [];
      if (relatedProjects?.length) {
        for (const rel of relatedProjects) {
          let targetId = rel.projectId;

          if (!targetId && rel.projectPath) {
            const relDetection = await this.projectsService.detectFromPath(
              rel.projectPath,
            );
            const relName =
              relDetection?.name || path.basename(rel.projectPath);
            const relProject = await this.projectsService.findOrCreateForUser(
              user.id,
              relName,
              rel.projectPath,
            );
            targetId = relProject.id;
          }

          if (targetId) {
            const relationship = await this.projectsService.linkProjects(
              project.id,
              targetId,
              rel.type ?? 'depends_on',
              rel.description,
            );
            const target = await this.projectsService.findById(targetId);
            linkedRelationships.push({
              id: relationship.id,
              name: target?.name ?? targetId,
              type: relationship.type,
            });
            this.logger.log(
              `🔗 Linked ${project.name} → ${target?.name} (${relationship.type})`,
            );
          }
        }
      }

      this.logger.log(`✅ Project registered: ${project.name} (${project.id})`);

      return {
        success: true,
        project: {
          id: project.id,
          name: project.name,
          framework: detection?.detectedFramework || 'unknown',
          language: detection?.detectedArchitecture || 'unknown',
          path: projectPath,
        },
        linkedRelationships,
        sessionId,
      };
    } catch (error) {
      this.logger.error(`Error registering project: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('plans/active')
  @ApiOperation({
    summary:
      'Verifica si hay un mcp_plan activo para la sesión (usado por hooks)',
  })
  async getActivePlan(@Query('sessionId') sessionId: string) {
    if (!sessionId) return { hasPlan: false };
    const plan = await this.mcpPlanService.findBySession(sessionId);
    return {
      hasPlan: !!plan,
      planId: plan?.id,
      title: plan?.title,
      status: plan?.status,
    };
  }

  @Post('projects/link')
  @ApiOperation({ summary: 'Vincula dos proyectos por path' })
  async linkProjects(
    @Body()
    body: {
      sourceProjectPath: string;
      targetProjectPath: string;
      type?: string;
      description?: string;
    },
    @Req() req: Request,
  ) {
    const {
      sourceProjectPath,
      targetProjectPath,
      type = 'depends_on',
      description,
    } = body;
    if (!sourceProjectPath || !targetProjectPath) {
      return {
        success: false,
        error: 'sourceProjectPath and targetProjectPath are required',
      };
    }
    try {
      const clientIp = req.ip || 'unknown';
      const { user } = await this.mcpService['userRepository'].findByIpOrCreate(
        { ipAddress: clientIp },
      );
      const [src, tgt] = await Promise.all([
        this.projectsService.findOrCreateForUser(
          user.id,
          path.basename(sourceProjectPath),
          sourceProjectPath,
        ),
        this.projectsService.findOrCreateForUser(
          user.id,
          path.basename(targetProjectPath),
          targetProjectPath,
        ),
      ]);
      const rel = await this.projectsService.linkProjects(
        src.id,
        tgt.id,
        type,
        description,
      );
      this.logger.log(`🔗 Linked: ${src.name} → ${tgt.name} (${type})`);
      return {
        success: true,
        relationship: {
          id: rel.id,
          source: src.name,
          target: tgt.name,
          type: rel.type,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Returns the list of MCP tools
   */
  private getMcpTools() {
    return [
      {
        name: 'agent_query',
        description:
          'Consulta principal con agentes especializados. Auto-detecta intención y enruta al agente correcto (PMAgent, CodeAgent, SearchAgent, etc.). Crea issues automáticamente y mantiene historial.',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Tu consulta o petición' },
            sessionId: {
              type: 'string',
              description: 'ID de sesión (opcional)',
            },
            userId: { type: 'string', description: 'ID de usuario (opcional)' },
          },
          required: ['input'],
        },
      },
      {
        name: 'search_rules',
        description: 'Busca reglas de código usando BM25',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Término de búsqueda' },
            category: { type: 'string', description: 'Categoría opcional' },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_rule',
        description: 'Obtiene una regla específica por ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID de la regla' },
          },
          required: ['id'],
        },
      },
      {
        name: 'graphify_query',
        description:
          'Consulta el grafo de conocimiento del proyecto. Responde preguntas sobre la arquitectura y relaciones del código.',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Pregunta sobre el código',
            },
          },
          required: ['question'],
        },
      },
      {
        name: 'graphify_explain',
        description: 'Explica un nodo específico del grafo de conocimiento',
        inputSchema: {
          type: 'object',
          properties: {
            node: { type: 'string', description: 'Nombre del nodo a explicar' },
          },
          required: ['node'],
        },
      },
      {
        name: 'graphify_path',
        description: 'Encuentra el camino más corto entre dos nodos del grafo',
        inputSchema: {
          type: 'object',
          properties: {
            nodeA: { type: 'string', description: 'Primer nodo' },
            nodeB: { type: 'string', description: 'Segundo nodo' },
          },
          required: ['nodeA', 'nodeB'],
        },
      },
      {
        name: 'graphify_build',
        description:
          'Construye o actualiza el grafo de conocimiento del proyecto',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Ruta del proyecto' },
            mode: {
              type: 'string',
              enum: ['standard', 'deep'],
              description: 'Modo de extracción',
            },
            update: { type: 'boolean', description: 'Solo archivos cambiados' },
            obsidian: {
              type: 'boolean',
              description: 'Generar vault Obsidian',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'obsidian_search',
        description: 'Busca notas en un vault Obsidian por contenido',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
            query: { type: 'string', description: 'Texto a buscar' },
            limit: {
              type: 'number',
              description: 'Máximo resultados',
              default: 10,
            },
          },
          required: ['vault', 'query'],
        },
      },
      {
        name: 'obsidian_read',
        description: 'Lee una nota específica del vault Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
            path: { type: 'string', description: 'Ruta relativa de la nota' },
          },
          required: ['vault', 'path'],
        },
      },
      {
        name: 'obsidian_write',
        description: 'Crea o actualiza una nota en el vault Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
            path: { type: 'string', description: 'Ruta relativa de la nota' },
            content: { type: 'string', description: 'Contenido Markdown' },
          },
          required: ['vault', 'path', 'content'],
        },
      },
      {
        name: 'obsidian_list',
        description: 'Lista todas las notas del vault Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
            folder: { type: 'string', description: 'Subcarpeta opcional' },
          },
          required: ['vault'],
        },
      },
      {
        name: 'obsidian_tags',
        description: 'Lista todas las etiquetas del vault Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
          },
          required: ['vault'],
        },
      },
      {
        name: 'obsidian_backlinks',
        description: 'Obtiene los backlinks de una nota en el vault Obsidian',
        inputSchema: {
          type: 'object',
          properties: {
            vault: { type: 'string', description: 'Ruta al vault Obsidian' },
            path: { type: 'string', description: 'Ruta relativa de la nota' },
          },
          required: ['vault', 'path'],
        },
      },
      {
        name: 'context_search',
        description:
          'Busca en el historial de conversaciones previas del proyecto usando BM25. Devuelve fragmentos relevantes del chat.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Término de búsqueda (ej: inventario, auth, base de datos)',
            },
            projectPath: {
              type: 'string',
              description: 'Path del proyecto (opcional, se auto-detecta)',
            },
            limit: {
              type: 'number',
              description: 'Máximo de resultados',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_save',
        description:
          'Guarda un fragmento de conocimiento en la memoria persistente del proyecto. Útil para recordar decisiones, configuraciones, o contexto importante.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'Identificador descriptivo (ej: "decisión-arquitectura-auth")',
            },
            content: { type: 'string', description: 'Contenido a recordar' },
            tags: {
              type: 'string',
              description:
                'Etiquetas separadas por coma (ej: "arquitectura, auth, decisión")',
            },
            projectPath: {
              type: 'string',
              description: 'Path del proyecto (opcional)',
            },
          },
          required: ['key', 'content'],
        },
      },
      {
        name: 'memory_search',
        description:
          'Busca en la memoria persistente del proyecto. Recupera decisiones, configuraciones y contexto guardado previamente.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Término de búsqueda' },
            projectPath: {
              type: 'string',
              description: 'Path del proyecto (opcional)',
            },
            limit: {
              type: 'number',
              description: 'Máximo de resultados',
              default: 10,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'memory_list',
        description: 'Lista todas las memorias guardadas del proyecto.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path del proyecto (opcional)',
            },
            tag: {
              type: 'string',
              description: 'Filtrar por etiqueta (opcional)',
            },
          },
        },
      },
      {
        name: 'list_rules',
        description: 'Lista todas las reglas disponibles',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filtrar por categoría' },
            limit: {
              type: 'number',
              description: 'Número máximo',
              default: 50,
            },
          },
        },
      },
    ];
  }

  /**
   * Handles tool call execution
   */
  private async handleToolCall(toolName: string, args: any): Promise<string> {
    this.logger.log(
      `🔧 handleToolCall: ${toolName} | args: ${JSON.stringify(args)?.substring(0, 200)}`,
    );

    switch (toolName) {
      case 'agent_query': {
        const input = args?.input;
        const sessionId = args?.sessionId;
        const userId = args?.userId;

        // Create a minimal mock request object for IP resolution
        const mockReq = {
          ip: args?.clientIp || 'unknown',
          headers: {},
        } as Request;

        const response = await this.chat(
          {
            input,
            sessionId,
            options: { userId },
          } as any,
          mockReq,
        );

        return this.formatAgentResponse(response);
      }

      case 'search_rules': {
        const query = args?.query;
        const category = args?.category;
        const limit = args?.limit || 5;

        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules/search?q=${encodeURIComponent(query)}${category ? `&category=${category}` : ''}&limit=${limit}`,
        );
        const data = await response.json();
        return this.formatRulesResponse(data);
      }

      case 'get_rule': {
        const id = args?.id;
        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules?id=${encodeURIComponent(id)}`,
        );
        const data = await response.json();
        return data.rule
          ? `${data.rule.name}\n\n${data.rule.content}`
          : 'Regla no encontrada';
      }

      case 'list_rules': {
        const category = args?.category;
        const limit = args?.limit || 50;
        const response = await fetch(
          `http://localhost:${process.env.PORT || 8004}/rules?${category ? `category=${category}` : ''}&limit=${limit}`,
        );
        const data = await response.json();
        return this.formatListRulesResponse(data);
      }

      case 'graphify_query': {
        const result = await this.graphifyExecutor.query(args.question);
        return result.answer;
      }

      case 'graphify_explain': {
        const result = await this.graphifyExecutor.explain(args.node);
        return result.explanation;
      }

      case 'graphify_path': {
        const result = await this.graphifyExecutor.path(args.nodeA, args.nodeB);
        return result.path.join('\n');
      }

      case 'graphify_build': {
        const result = await this.graphifyExecutor.buildGraph({
          path: args.path,
          mode: args.mode,
          update: args.update,
          obsidian: args.obsidian,
        });
        return result;
      }

      case 'obsidian_search': {
        const results = await this.obsidianVault.search(
          args.vault,
          args.query,
          args.limit,
        );
        if (results.length === 0) return 'No se encontraron notas.';
        return results
          .map(
            (r, i) =>
              `${i + 1}. **${r.title}** (${r.path})\n   ...${r.snippet}...`,
          )
          .join('\n\n');
      }

      case 'obsidian_read': {
        const content = await this.obsidianVault.readNote(
          args.vault,
          args.path,
        );
        return content || `Nota no encontrada: ${args.path}`;
      }

      case 'obsidian_write': {
        await this.obsidianVault.writeNote(args.vault, args.path, args.content);
        return `Nota creada/actualizada: ${args.path}`;
      }

      case 'obsidian_list': {
        const notes = await this.obsidianVault.listNotes(
          args.vault,
          args.folder,
        );
        if (notes.length === 0) return 'El vault está vacío.';
        return notes.map((n) => `- **${n.title}** (${n.path})`).join('\n');
      }

      case 'obsidian_tags': {
        const tags = await this.obsidianVault.getTags(args.vault);
        if (tags.length === 0) return 'No hay etiquetas.';
        return tags.map((t) => `- #${t}`).join('\n');
      }

      case 'obsidian_backlinks': {
        const backlinks = await this.obsidianVault.getBacklinks(
          args.vault,
          args.path,
        );
        if (backlinks.length === 0) return `Sin backlinks para: ${args.path}`;
        return backlinks.map((b) => `- **${b.title}** (${b.path})`).join('\n');
      }

      case 'context_search': {
        const query = args?.query;
        if (!query) return 'Especifica un query de búsqueda.';
        const projectId = await this.resolveProjectId(args?.projectPath);
        if (!projectId)
          return 'No se pudo resolver el proyecto. Proporciona projectPath.';
        const results = await this.contextNodeService.search(
          projectId,
          query,
          args?.limit || 5,
        );
        if (results.length === 0)
          return `No encontré contexto relacionado con "${query}" en el historial del proyecto.`;
        return `🔍 Contexto relevante para "${query}":\n\n${results
          .map(
            (r, i) =>
              `**${i + 1}.** [${r.node.role}] ${r.snippet.replace(/\n/g, ' ').substring(0, 200)}${r.snippet.length > 200 ? '...' : ''}\n   *Score: ${(r.score * 100).toFixed(0)}% | Sesión: ${r.node.sessionId?.substring(0, 12)}...*`,
          )
          .join('\n\n')}`;
      }

      case 'memory_save': {
        const key = args?.key;
        const content = args?.content;
        if (!key || !content) return 'Requiere key y content.';
        const projectId = await this.resolveProjectId(args?.projectPath);
        if (!projectId) return 'No se pudo resolver el proyecto.';
        const tags = args?.tags
          ? args.tags.split(',').map((t) => t.trim())
          : [];
        const context = await this.contextService.createContext({
          type: ContextType.MEMORY,
          summary: key,
          extractedInfo: {
            type: 'memory',
            key,
            content,
            tags,
            savedAt: new Date().toISOString(),
          } as any,
          metadata: { projectPath: args?.projectPath },
        });
        return `🧠 Memoria guardada: "${key}" (${context.contextId})`;
      }

      case 'memory_search': {
        const memQuery = args?.query;
        if (!memQuery) return 'Especifica un query de búsqueda.';
        const memProjectId = await this.resolveProjectId(args?.projectPath);
        if (!memProjectId) return 'No se pudo resolver el proyecto.';
        const repo = this.contextService['contextRepository'].getRepository();
        const memories = await repo.find({
          where: { type: ContextType.MEMORY as any, isActive: true },
          order: { updatedAt: 'DESC' },
          take: 50,
        });
        const lowerQuery = memQuery.toLowerCase();
        const filtered = memories
          .filter(
            (m) =>
              m.summary?.toLowerCase().includes(lowerQuery) ||
              JSON.stringify(m.extractedInfo)
                .toLowerCase()
                .includes(lowerQuery),
          )
          .slice(0, args?.limit || 10);
        if (filtered.length === 0)
          return `No encontré memorias con "${memQuery}".`;
        return `🧠 Memorias encontradas (${filtered.length}):\n\n${filtered
          .map((m, i) => {
            const info = m.extractedInfo || {};
            return `**${i + 1}.** ${m.summary || info.key || 'Sin título'}\n   ${(info.content || '').substring(0, 150)}${(info.content || '').length > 150 ? '...' : ''}\n   ${info.tags?.length ? `🏷️ ${info.tags.join(', ')}` : ''}`;
          })
          .join('\n\n')}`;
      }

      case 'close_plan': {
        const planId = args?.planId;
        const action = args?.action;
        if (!planId || !action) return 'planId and action (complete|abandon) are required';
        if (action === 'complete') {
          await this.mcpPlanService.complete(planId);
          return `✅ Plan \`${planId}\` completado exitosamente.`;
        } else if (action === 'abandon') {
          await this.mcpPlanService.abandon(planId);
          return `🚫 Plan \`${planId}\` abandonado.`;
        }
        return `❌ Acción inválida: "${action}". Usa "complete" o "abandon".`;
      }

      case 'memory_list': {
        const listProjectId = await this.resolveProjectId(args?.projectPath);
        if (!listProjectId) return 'No se pudo resolver el proyecto.';
        const listRepo =
          this.contextService['contextRepository'].getRepository();
        const allMemories = await listRepo.find({
          where: { type: ContextType.MEMORY as any, isActive: true },
          order: { updatedAt: 'DESC' },
        });
        const tagFilter = args?.tag?.toLowerCase();
        const filtered = tagFilter
          ? allMemories.filter((m) => {
              const tags: string[] = m.extractedInfo?.tags || [];
              return tags.some((t) => t.toLowerCase().includes(tagFilter));
            })
          : allMemories;
        if (filtered.length === 0)
          return 'No hay memorias guardadas para este proyecto.';
        return `🧠 **${filtered.length} memoria(s)**\n\n${filtered
          .map((m, i) => {
            const info = m.extractedInfo || {};
            return `${i + 1}. **${m.summary || info.key || 'Sin título'}**\n   ${(info.content || '').substring(0, 100)}${(info.content || '').length > 100 ? '...' : ''}\n   🏷️ ${info.tags?.join(', ') || 'sin etiquetas'} | Actualizado: ${m.updatedAt?.toISOString().split('T')[0]}`;
          })
          .join('\n\n')}`;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Formats agent response for MCP
   */
  private formatAgentResponse(data: any): string {
    if (!data.success) {
      return `⚠️ Error: ${data.error || 'Error desconocido'}`;
    }

    let text = '';

    // Web search results
    if (data.data?.formattedResults) {
      text += data.data.formattedResults + '\n\n';
    }
    // Message from agent
    if (data.data?.message) {
      text += data.data.message + '\n\n';
    }
    if (data.data?.issue) {
      const issue = data.data.issue;
      text += `📋 **Issue**: ${issue.title || issue.issueId || 'N/A'}\n`;
      if (issue.id) text += `ID: ${issue.id}\n`;
    }
    return text.trim();
  }

  /**
   * Formats rules search response
   */
  private formatRulesResponse(data: any): string {
    if (!data.results || data.results.length === 0) {
      return 'No encontré reglas relacionadas con tu búsqueda.';
    }
    let text = `Encontré ${data.results.length} regla(s):\n\n`;
    data.results.forEach((r: any, i: number) => {
      text += `${i + 1}. **${r.rule.name}** (${r.rule.category})\n`;
      text += `${r.rule.content.substring(0, 150)}...\n\n`;
    });
    return text;
  }

  /**
   * Formats list rules response
   */
  private formatListRulesResponse(data: any): string {
    if (!data.rules || data.rules.length === 0) {
      return 'No hay reglas disponibles.';
    }
    let text = `${data.rules.length} regla(s):\n`;
    data.rules.forEach((r: any) => {
      text += `- **${r.name}** (${r.category})\n`;
    });
    return text;
  }

  @Post('chat')
  @ApiOperation({
    summary: 'Chat endpoint - Auto-applies rules with Redis+BD persistence',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'User message' },
        options: { type: 'object', description: 'Additional options' },
        sessionId: { type: 'string', description: 'Session ID (optional)' },
      },
      required: ['input'],
    },
  })
  async chat(
    @Body()
    body: {
      input: string;
      options?: Record<string, any>;
      sessionId?: string;
      projectPath?: string;
      projectContext?: any;
    },
    @Req() req: Request,
  ) {
    const {
      input,
      options,
      sessionId: providedSessionId,
      projectPath,
      projectContext,
    } = body;

    if (!input || input.trim().length === 0) {
      return {
        success: false,
        error: 'Input is required',
        logs: this.agentLogger.getRecentLogs(10),
      };
    }

    // Get IP from request for fallback session handling
    const clientIp =
      req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

    // Resolve sessionId: use provided, or find by IP, or create new
    const sessionId = await this.resolveSessionId(providedSessionId, clientIp);

    this.logger.log(
      `💬 MCP Chat: User says "${input.substring(0, 100)}..." | sessionId: ${sessionId} | providedSessionId: ${providedSessionId} | clientIp: ${clientIp}`,
    );

    // Log start
    this.agentLogger.info('MCP-Controller', '📥 User message received', {
      input: input.substring(0, 200),
      inputLength: input.length,
      options,
      sessionId,
      clientIp,
      hasWorkIntent: this.detectWorkIntent(input),
    });

    // SAVE USER MESSAGE TO POSTGRESQL FIRST (even if sessionId is fallback)
    if (sessionId && sessionId !== 'unknown') {
      await this.mcpService
        .saveChatMessage(sessionId, MessageRole.USER, input, {
          options,
          clientIp,
        })
        .catch((err) =>
          this.logger.warn(`Error saving user message: ${err.message}`),
        );
    }

    try {
      // AUTO-SEARCH RELEVANT RULES FIRST (before routing)
      const relevantRules = await this.searchRelevantRules(input);

      this.agentLogger.info('MCP-Controller', '📚 Rules found', {
        count: relevantRules.length,
        rules: relevantRules.map((r) => r.name),
      });

      // STORE RULES CONTEXT IN REDIS for this session (TTL: 1 hour)
      if (sessionId && relevantRules.length > 0) {
        await this.storeRulesContextInRedis(sessionId, relevantRules);
      }

      // LOAD PREVIOUS RULES CONTEXT from Redis (for conversation continuity)
      const previousRulesContext = sessionId
        ? await this.loadRulesContextFromRedis(sessionId)
        : '';

      // Add rules context to options
      const optionsWithRules = {
        ...options,
        relevantRules,
        rulesContext:
          this.formatRulesContext(relevantRules) + previousRulesContext,
      };

      // AUTO-CREATE ISSUE: Use the new logic in mcpService
      // This now detects project and intention (work vs analysis)
      let issueIdForSession: string | null = null;
      let projectIdForSession: string | null = null;
      let contextIdForSession: string | null = null;

      try {
        // Get userId first
        let userId = await this.redisService.get<string>(
          `session:${sessionId}:userId`,
        );

        if (!userId) {
          const sessionData =
            await this.mcpService['sessionRepository'].findBySessionId(
              sessionId,
            );
          userId = sessionData?.userId || null;
        }

        if (userId) {
          // STEP 1: If projectPath is provided, detect/create project from it
          if (projectPath) {
            try {
              const projectsService = this.mcpService['projectsService'];
              const detection =
                await projectsService.detectFromPath(projectPath);
              const projectName = detection?.name || path.basename(projectPath);

              const project = await projectsService.findOrCreateForUser(
                userId,
                projectName,
                projectPath,
              );

              projectIdForSession = project.id;

              // Link project to session
              const sessionRepo = this.mcpService['sessionRepository'];
              const session = await sessionRepo.findBySessionId(sessionId);
              if (session && !session.projectId) {
                await sessionRepo
                  .getRepository()
                  .update({ id: session.id }, { projectId: project.id });
                this.logger.log(
                  `🔗 Project linked to session: ${project.name} (${project.id})`,
                );
              }

              // Cache in Redis
              await this.redisService.set(
                `session:${sessionId}:projectId`,
                project.id,
                3600,
              );

              this.logger.log(
                `📁 Project detected from path: ${projectName} (${project.id})`,
              );
            } catch (error) {
              this.logger.warn(
                `Error detecting project from path: ${error.message}`,
              );
            }
          }

          // STEP 2: Process user message (issue creation, context, etc.)
          const result = await this.mcpService.processUserMessage(
            sessionId,
            userId,
            input,
            projectIdForSession || undefined,
          );

          issueIdForSession = result.issueId;
          projectIdForSession = result.projectId || projectIdForSession;
          contextIdForSession = result.contextId;

          this.agentLogger.info(
            'MCP-Controller',
            issueIdForSession
              ? '🔧 Issue created for work session'
              : '🔍 Analysis mode (no issue)',
            {
              issueId: issueIdForSession,
              projectId: projectIdForSession,
              contextId: contextIdForSession,
              input: input.substring(0, 100),
              clientIp,
            },
          );
        }
      } catch (error) {
        this.logger.error(`Error processing user message: ${error.message}`);
      }

      // Add issueId and language preference to options
      const optionsWithIssue = {
        ...optionsWithRules,
        issueId: issueIdForSession,
        projectId: projectIdForSession,
        language: 'es', // Always respond in Spanish
      };

      // Activate RouterAgent to route to specialized agent WITH RULES CONTEXT
      this.logger.log(
        `🔄 RouterAgent: Activating | input: "${input.substring(0, 80)}..." | rulesCount: ${relevantRules.length} | issueId: ${issueIdForSession} | sessionId: ${sessionId}`,
      );

      this.agentLogger.info(
        'RouterAgent',
        '🔄 Activating RouterAgent with rules context',
        {
          inputLength: input.length,
          rulesCount: relevantRules.length,
          sessionId,
          issueId: issueIdForSession,
          projectId: projectIdForSession,
        },
      );

      const [userId, projectName] = await Promise.all([
        this.redisService.get<string>(`session:${sessionId}:userId`),
        this.redisService.get<string>(`session:${sessionId}:projectName`),
      ]);

      const response = await this.routerAgent.execute({
        input,
        options: {
          ...optionsWithIssue,
          sessionId,
          userId,
          projectId: projectIdForSession || undefined,
          projectName: projectName || undefined,
          projectPath,
          projectContext,
          rawInput: input, // input original sin reglas prepended
        },
      });

      // ── EJECUTAR agente especializado si el router lo indicó ────────────────
      let targetAgentId: string | undefined;
      if (
        response.data?.nextAction?.type === 'execute_agent' &&
        response.data?.nextAction?.agent
      ) {
        targetAgentId = response.data.nextAction.agent;
        const targetAgent =
          this.routerAgent['agentRegistry'].getAgent(targetAgentId);

        if (targetAgent) {
          this.logger.log(`🤖 Executing specialized agent: ${targetAgentId}`);
          try {
            const agentResponse = await targetAgent.execute({
              input,
              options: {
                ...optionsWithIssue,
                sessionId,
                userId,
                projectId: projectIdForSession || undefined,
                projectName: projectName || undefined,
                projectPath,
                rulesContext: response.data?.rulesContext,
                relevantRules,
                planId: response.data?.planId,
              },
            });

            if (agentResponse.success && agentResponse.data?.message) {
              // Merge: keep routing metadata + replace message with agent output
              response.data.message = agentResponse.data.message;
              response.data.targetAgent = targetAgentId; // ← preservar para el log del MCP tool
              response.data.agentExecuted = targetAgentId;
              if (agentResponse.data?.steps)
                response.data.steps = agentResponse.data.steps;
            }
          } catch (agentErr) {
            this.logger.warn(
              `⚠️ Specialized agent ${targetAgentId} failed: ${agentErr.message} — keeping router response`,
            );
          }
        }
      }

      // AUTO-SAVE DECISIONS TO MEMORY (analyza input de usuario + respuesta del agente)
      if (projectIdForSession) {
        await this.saveAutoMemory(
          `${input}\n${response.data?.message || ''}`,
          projectIdForSession,
          targetAgentId || response.data?.metadata?.agentId,
        );
      }

      // SAVE RESPONSE TO POSTGRESQL with rules metadata
      if (sessionId && response.data?.message) {
        await this.mcpService
          .saveChatMessage(
            sessionId,
            MessageRole.ASSISTANT,
            response.data.message,
            {
              agentId: response.data?.metadata?.agentId,
              executionTime: response.metadata?.executionTime,
              rulesApplied: relevantRules.length,
              rulesIds: relevantRules.map((r) => r.id),
            },
          )
          .catch((err) =>
            this.logger.warn(`Error saving response: ${err.message}`),
          );

        // UPDATE SESSION with rules context in BD
        await this.updateSessionWithRulesContext(sessionId, relevantRules);
      }

      // GET ISSUE INFO for response (auto-created or linked)
      const issueInfo = sessionId
        ? await this.getIssueInfoForSession(sessionId)
        : null;

      // Log response
      this.agentLogger.info('MCP-Controller', '✅ Response generated', {
        success: response.success,
        executionTime: response.metadata?.executionTime,
        rulesApplied: relevantRules.length,
        issueId: issueInfo?.id,
      });

      return {
        success: response.success,
        data: {
          ...response.data,
          relevantRules: relevantRules.length > 0 ? relevantRules : undefined,
          rulesContext:
            relevantRules.length > 0
              ? this.formatRulesContext(relevantRules)
              : undefined,
          issue: issueInfo,
        },
        error: response.error,
        metadata: response.metadata,
        logs: this.agentLogger.getRecentLogs(20),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.agentLogger.error(
        'MCP-Controller',
        `❌ Chat error: ${errorMessage}`,
        {
          error,
        },
      );

      // SAVE ERROR TO POSTGRESQL
      if (sessionId) {
        await this.mcpService
          .saveChatMessage(
            sessionId,
            MessageRole.ASSISTANT,
            `Error: ${errorMessage}`,
            { isError: true },
          )
          .catch((err) =>
            this.logger.warn(`Error saving error: ${err.message}`),
          );
      }

      return {
        success: false,
        error: errorMessage,
        logs: this.agentLogger.getRecentLogs(20),
      };
    }
  }

  /**
   * Automatically searches for relevant rules
   */
  private async searchRelevantRules(query: string): Promise<any[]> {
    try {
      const port = process.env.PORT || 8004;
      const url = `http://localhost:${port}/rules/search?q=${encodeURIComponent(query)}&limit=5`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(
          `Rules API returned non-OK status: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return data.results?.map((r: any) => r.rule) || [];
    } catch (error) {
      this.logger.error(
        `Failed to search rules: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  /**
   * Stores rules context in Redis for session continuity
   */
  private async storeRulesContextInRedis(
    sessionId: string,
    rules: any[],
  ): Promise<void> {
    try {
      const redisKey = `session:${sessionId}:rulesContext`;
      const rulesData = {
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        })),
        timestamp: new Date().toISOString(),
      };

      // Store with 1 hour TTL
      await this.mcpService['redisService'].set(
        redisKey,
        JSON.stringify(rulesData),
        3600,
      );
      this.logger.debug(`💾 Rules context stored in Redis: ${sessionId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to store rules in Redis: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Loads previous rules context from Redis
   */
  private async loadRulesContextFromRedis(sessionId: string): Promise<string> {
    try {
      const redisKey = `session:${sessionId}:rulesContext`;
      const data = await this.mcpService['redisService'].get(redisKey);

      if (!data || typeof data !== 'string') return '';

      const parsed = JSON.parse(data);
      const rules = parsed.rules || [];

      if (rules.length === 0) return '';

      return (
        `\n\n📋 **Reglas aplicadas en esta sesión:**\n` +
        rules
          .map((r: any, i: number) => `${i + 1}. ${r.name} (${r.category})`)
          .join('\n')
      );
    } catch (error) {
      this.logger.warn(
        `Failed to load rules from Redis: ${error instanceof Error ? error.message : error}`,
      );
      return '';
    }
  }

  /**
   * Updates session in BD with rules context
   */
  private async updateSessionWithRulesContext(
    sessionId: string,
    rules: any[],
  ): Promise<void> {
    try {
      const session =
        await this.mcpService['sessionRepository'].findBySessionId(sessionId);

      if (!session) return;

      // Update session metadata with applied rules
      const updatedMetadata: any = {
        ...session.metadata,
        lastAppliedRules: rules.map((r) => r.id),
        rulesAppliedCount:
          (session.metadata?.rulesAppliedCount || 0) + rules.length,
        lastActivityAt: new Date(),
      };

      await this.mcpService['sessionRepository']
        .getRepository()
        .update({ sessionId }, { metadata: updatedMetadata });

      this.logger.debug(`📝 Session updated with rules context: ${sessionId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to update session with rules: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Formats rules as context string
   */
  private formatRulesContext(rules: any[]): string {
    if (rules.length === 0) return '';

    let context = '\n\n📋 **Relevant Code Rules (MCP):**\n';
    rules.forEach((rule, i) => {
      context += `\n${i + 1}. **${rule.name}** (${rule.category} - ${rule.impact})\n`;
      context += `   ${rule.content.substring(0, 200)}${rule.content.length > 200 ? '...' : ''}\n`;
    });

    return context;
  }

  /**
   * Gets issue info for a session
   */
  private async getIssueInfoForSession(sessionId: string): Promise<any> {
    try {
      // Check Redis first
      const issueId = await this.mcpService['redisService'].get<string>(
        `session:${sessionId}:issueId`,
      );

      if (!issueId) {
        // Check session in DB
        const session =
          await this.mcpService['sessionRepository'].findBySessionId(sessionId);
        if (!session?.issueId) return null;

        // Use issueRepository directly
        const issue = await this.mcpService['sessionRepository']
          ['getRepository']()
          .manager.getRepository('issues')
          .findOne({ where: { id: session.issueId } });

        if (!issue) {
          return {
            id: session.issueId,
            sessionId,
            autoCreated: true,
          };
        }

        return {
          id: issue.id,
          issueId: issue.issueId || session.issueId,
          title: issue.title,
          status: issue.status,
          sessionId,
          autoCreated: issue.metadata?.autoCreated || false,
        };
      }

      // Get issue from DB using IssueService
      const issue = await this.mcpService['issueService'].getIssueById(issueId);

      if (!issue) return null;

      return {
        id: issue.id,
        issueId: issue.issueId,
        title: issue.title,
        status: issue.status,
        sessionId,
        autoCreated: issue.metadata?.autoCreated || false,
      };
    } catch (error) {
      this.logger.warn(`Error getting issue info: ${error.message}`);
      return null;
    }
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get recent agent logs' })
  getLogs(@Query('count') count?: number) {
    const logs = this.agentLogger.getRecentLogs(
      count ? parseInt(count.toString(), 10) : 50,
    );
    const stats = this.agentLogger.getAgentStats();

    return {
      logs,
      stats,
      total: logs.length,
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug MCP sessions, tools, and agents' })
  getDebug() {
    const sessions = this.mcpService.getSessions();
    const agents = this.routerAgent['agentRegistry'].listAgents();

    return {
      sessions: {
        count: sessions.size,
        ids: Array.from(sessions.keys()),
      },
      agents: {
        count: agents.length,
        list: agents.map((a) => ({
          id: a.agentId,
          description: a.description,
        })),
        registered: this.routerAgent['agentRegistry'].getAgentIds(),
      },
      tools: [
        { name: 'search_rules', description: 'Busca reglas de código' },
        { name: 'get_rule', description: 'Obtiene regla por ID' },
        { name: 'list_rules', description: 'Lista reglas disponibles' },
        {
          name: 'auto_apply_rules',
          description: 'Auto-aplica reglas a tu consulta',
        },
      ],
      endpoints: {
        chat: 'POST /mcp/chat - Chat with agents (auto-routes to specialist)',
        sse: 'GET /mcp/sse - MCP SSE connection',
        message: 'POST /mcp/message - MCP protocol messages',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('execute-tool')
  @ApiOperation({
    summary:
      'Ejecuta una herramienta MCP por nombre (graphify, obsidian, memory, etc.)',
  })
  async executeTool(@Body() body: { tool: string; args: Record<string, any> }) {
    const { tool, args } = body;
    if (!tool) return { success: false, error: 'tool name is required' };
    try {
      const result = await this.handleToolCall(tool, args || {});
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('agents')
  @ApiOperation({ summary: 'List all registered agents' })
  getAgents() {
    const agents = this.routerAgent['agentRegistry'].listAgents();
    const stats = this.agentLogger.getAgentStats();

    return {
      total: agents.length,
      agents: agents.map((a) => ({
        id: a.agentId,
        description: a.description,
        logs: stats[a.agentId]?.total || 0,
      })),
      usage: stats,
    };
  }

  /**
   * Resuelve projectPath → projectId (UUID) para usar con ContextNodeService.
   */
  private async resolveProjectId(projectPath?: string): Promise<string | null> {
    if (!projectPath) {
      return null;
    }
    try {
      const detection = await this.projectsService.detectFromPath(projectPath);
      const name = detection?.name || path.basename(projectPath);
      const clientIp = '127.0.0.1';
      const { user } = await this.mcpService['userRepository'].findByIpOrCreate(
        { ipAddress: clientIp },
      );
      const project = await this.projectsService.findOrCreateForUser(
        user.id,
        name,
        projectPath,
      );
      return project.id;
    } catch {
      return null;
    }
  }

  /**
   * Auto-guarda decisiones clave detectadas en la respuesta del agente.
   * Escanea el texto en busca de patrones de decisión y persiste en contexts con type='memory'.
   */
  private async saveAutoMemory(
    message: string,
    projectId: string,
    agentId?: string,
  ): Promise<void> {
    const decisionKeywords = [
      'decidí',
      'decidimos',
      'implementé',
      'implementamos',
      'refactoricé',
      'cambiamos',
      'solución fue',
      'optamos',
      'elegimos',
      'migramos',
      'agregamos',
      'removimos',
      'la arquitectura es',
      'usamos',
      'estructura es',
      'conclusión',
      'resumen',
      'tl;dr',
      'en resumen',
    ];
    const lower = message.toLowerCase();
    const foundKeywords = decisionKeywords.filter((k) => lower.includes(k));
    if (foundKeywords.length === 0) return;

    const lines = message.split('\n');
    const decisionLines = lines.filter((l) => {
      const lineLower = l.toLowerCase();
      return decisionKeywords.some((k) => lineLower.includes(k));
    });
    if (decisionLines.length === 0) return;

    const content = decisionLines.join('\n').substring(0, 1000);
    const summary = `Auto: ${foundKeywords.slice(0, 3).join(', ')}`;
    const tags = [
      ...new Set(
        foundKeywords.map((k) => {
          if (k.includes('arquitectura') || k.includes('estructura'))
            return 'arquitectura';
          if (k.includes('migramos') || k.includes('cambiamos'))
            return 'cambio';
          if (
            k.includes('decid') ||
            k.includes('optamos') ||
            k.includes('elegimos')
          )
            return 'decision';
          if (k.includes('conclusión') || k.includes('resumen'))
            return 'resumen';
          return 'auto';
        }),
      ),
    ];

    try {
      await this.contextService.createContext({
        type: ContextType.MEMORY,
        summary: summary.substring(0, 200),
        extractedInfo: {
          type: 'auto_memory',
          agentId,
          content,
          tags,
          keywords: foundKeywords,
          projectId,
          savedAt: new Date().toISOString(),
        } as any,
      });
      this.logger.log(
        `🧠 Auto-memory saved: ${summary} | tags: ${tags.join(', ')}`,
      );
    } catch (err) {
      this.logger.warn(`Auto-memory save failed: ${err.message}`);
    }
  }

  /**
   * Detects if the user input indicates work intent (not just a question)
   */
  private detectWorkIntent(input: string): boolean {
    const lowerInput = input.toLowerCase();
    const workPatterns = [
      'quiero',
      'necesito',
      'haz',
      'crear',
      'implementar',
      'agregar',
      'trabajar',
      'desarrollar',
      'build',
      'make',
      'create',
      'add',
      'fix',
      'bug',
      'error',
      'problema',
      'issue',
      'tarea',
      'generar código',
      'escribir',
      'modificar',
      'cambiar',
      'analiza',
      'analisis',
      'analyze',
      'revisar',
      'verificar',
      'revisar código',
      'verificar código',
    ];
    return workPatterns.some((pattern) => lowerInput.includes(pattern));
  }

  /**
   * Gets or creates an issue for the session
   * Includes fallback by IP when sessionId is invalid
   */
  private async getOrCreateIssueForSession(
    sessionId: string,
    input: string,
    clientIp?: string,
  ): Promise<string | null> {
    try {
      // Skip if sessionId is invalid
      if (!sessionId || sessionId === 'unknown') {
        this.logger.warn(
          `⚠️ Invalid sessionId, attempting IP-based fallback | clientIp: ${clientIp}`,
        );

        // Try to find user by IP
        if (clientIp) {
          // Use findByIpOrCreate which handles both cases
          const { user } = await this.mcpService[
            'userRepository'
          ].findByIpOrCreate({
            ipAddress: clientIp,
          });
          return this.createIssueDirect(user.id, input, sessionId, clientIp);
        }

        this.logger.warn(
          '⚠️ No clientIp available for fallback, cannot create issue',
        );
        return null;
      }

      // Check if issue already exists for session
      const existingIssueId = await this.redisService.get<string>(
        `session:${sessionId}:issueId`,
      );
      if (existingIssueId) {
        this.logger.log(
          `🔧 Issue already exists for session: ${sessionId} | issueId: ${existingIssueId}`,
        );
        return existingIssueId;
      }

      // Try to get userId from Redis
      let userId = await this.redisService.get<string>(
        `session:${sessionId}:userId`,
      );

      // Fallback: find user by session in DB if not in Redis
      let session: any = null;
      if (!userId) {
        session =
          await this.mcpService['sessionRepository'].findBySessionId(sessionId);
        if (session?.userId) {
          userId = session.userId;
          // Restore to Redis
          await this.redisService.set(
            `session:${sessionId}:userId`,
            userId,
            3600,
          );
          this.logger.log(`♻️ Restored userId from DB: ${userId}`);
        }
      }

      this.logger.log(
        `🔧 getOrCreateIssueForSession | sessionId: ${sessionId} | userId: ${userId} | clientIp: ${clientIp} | input: "${input.substring(0, 80)}..."`,
      );

      if (!userId) {
        this.logger.warn(
          `⚠️ No userId found for session ${sessionId} and IP ${clientIp}, cannot create issue`,
        );
        return null;
      }

      const title = this.extractTitleFromInput(input);

      this.logger.log(
        `🔧 Creating issue with title: "${title}" | userId: ${userId}`,
      );

      const issueData = await this.mcpService['issueService'].createIssue({
        title,
        description: `Issue created from MCP conversation: ${input.substring(0, 200)}`,
        userId,
        sessionId: sessionId !== 'unknown' ? sessionId : undefined,
        metadata: {
          autoCreated: true,
          source: 'mcp-auto-detect',
          initialMessage: input,
          clientIp,
        },
      });

      await this.redisService.set(
        `session:${sessionId}:issueId`,
        issueData.id,
        86400,
      );

      this.logger.log(
        `✅ Auto-created issue: ${issueData.id} | issueId: ${issueData.issueId} | title: "${title}" | for session: ${sessionId} | userId: ${userId}`,
      );
      return issueData.id;
    } catch (error: any) {
      this.logger.error(
        `❌ Error creating issue: ${error.message} | stack: ${error.stack} | sessionId: ${sessionId}`,
      );
      return null;
    }
  }

  /**
   * Helper to create issue directly with userId
   */
  private async createIssueDirect(
    userId: string,
    input: string,
    sessionId: string,
    clientIp?: string,
  ): Promise<string | null> {
    try {
      const title = this.extractTitleFromInput(input);

      const issueData = await this.mcpService['issueService'].createIssue({
        title,
        description: `Issue created from MCP conversation: ${input.substring(0, 200)}`,
        userId,
        sessionId: sessionId !== 'unknown' ? sessionId : undefined,
        metadata: {
          autoCreated: true,
          source: 'mcp-ip-fallback',
          initialMessage: input,
          clientIp,
        },
      });

      this.logger.log(
        `✅ Auto-created issue (IP fallback): ${issueData.id} | issueId: ${issueData.issueId} | title: "${title}" | userId: ${userId} | clientIp: ${clientIp}`,
      );
      return issueData.id;
    } catch (error: any) {
      this.logger.error(`❌ Error creating issue (direct): ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts a title from user input
   */
  private extractTitleFromInput(input: string): string {
    const cleaned = input
      .replace(
        /(quiero|necesito|trabajar|en|implementar|agregar|crear|haz|make|build)/gi,
        '',
      )
      .trim();
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  /**
   * Resolves sessionId: uses provided, finds by IP, or creates new
   */
  private async resolveSessionId(
    providedSessionId: string | undefined,
    clientIp: string,
  ): Promise<string> {
    // 1. If valid provided sessionId, use it
    if (providedSessionId && providedSessionId !== 'unknown') {
      // Verify it exists in Redis or DB
      const existsInRedis = await this.redisService.get(
        `session:${providedSessionId}:userId`,
      );
      if (existsInRedis) {
        this.logger.debug(`Using provided sessionId: ${providedSessionId}`);
        return providedSessionId;
      }
      // Check DB
      const session =
        await this.mcpService['sessionRepository'].findBySessionId(
          providedSessionId,
        );
      if (session && session.status === 'active') {
        this.logger.debug(
          `Using provided sessionId from DB: ${providedSessionId}`,
        );
        // Restore to Redis
        const userId = session.userId;
        if (userId) {
          await this.redisService.set(
            `session:${providedSessionId}:userId`,
            userId,
            3600,
          );
        }
        return providedSessionId;
      }
    }

    // 2. Try to find active session by IP in Redis
    try {
      const cachedSessionId = await this.redisService.get<string>(
        `client:ip-${clientIp}:sessionId`,
      );
      if (cachedSessionId) {
        const session =
          await this.mcpService['sessionRepository'].findBySessionId(
            cachedSessionId,
          );
        if (session && session.status === 'active') {
          this.logger.log(
            `♻️ Found active session by IP in Redis: ${cachedSessionId} for IP ${clientIp}`,
          );
          return cachedSessionId;
        }
      }
    } catch (error) {
      this.logger.warn(`Error finding session by IP in Redis: ${error}`);
    }

    // 3. Try to find in DB by IP
    try {
      const sessions =
        await this.mcpService['sessionRepository'].getActiveSessions();
      const matchingSession = sessions.find(
        (s) =>
          s.metadata?.clientIp === clientIp ||
          s.metadata?.ipAddress === clientIp,
      );
      if (matchingSession) {
        this.logger.log(
          `♻️ Found active session by IP in DB: ${matchingSession.sessionId} for IP ${clientIp}`,
        );
        // Cache for next time
        await this.redisService.set(
          `client:ip-${clientIp}:sessionId`,
          matchingSession.sessionId,
          3600,
        );
        return matchingSession.sessionId;
      }
    } catch (error) {
      this.logger.warn(`Error finding session by IP in DB: ${error}`);
    }

    // 4. Return provided or unknown - will create issue with user lookup
    this.logger.warn(
      `⚠️ No session found for IP ${clientIp}, using provided or fallback`,
    );
    return providedSessionId || 'unknown';
  }

  @Post('plans/create')
  @ApiOperation({ summary: 'Crea un plan MCP explícitamente en BD' })
  async createPlan(
    @Body()
    body: {
      title: string;
      summary?: string;
      intention?: string;
      projectPath?: string;
      sessionId?: string;
      agentId?: string;
      steps?: Array<{
        order: number;
        description: string;
        agentId?: string;
        status?: string;
      }>;
    },
    @Req() req: Request,
  ) {
    const {
      title,
      summary,
      intention,
      projectPath,
      sessionId,
      agentId,
      steps,
    } = body;
    if (!title) {
      return { success: false, error: 'title is required' };
    }
    try {
      const clientIp = req.ip || 'unknown';
      const resolvedSessionId =
        sessionId || (await this.resolveSessionId(undefined, clientIp));
      let projectId: string | undefined;
      if (projectPath) {
        const { user } = await this.mcpService[
          'userRepository'
        ].findByIpOrCreate({ ipAddress: clientIp });
        const detection =
          await this.projectsService.detectFromPath(projectPath);
        const projectName = detection?.name || path.basename(projectPath);
        const project = await this.projectsService.findOrCreateForUser(
          user.id,
          projectName,
          projectPath,
        );
        projectId = project.id;
      }
      const plan = await this.mcpPlanService.create({
        title,
        projectId,
        sessionId:
          resolvedSessionId !== 'unknown' ? resolvedSessionId : undefined,
        agentId: agentId || 'RouterAgent',
        plan: {
          summary: summary || title,
          detectedIntention: intention || 'code',
          steps: steps?.map((s) => ({
            order: s.order,
            description: s.description,
            agentId: s.agentId,
            status: (s.status as any) || 'pending',
          })) || [{ order: 1, description: title, status: 'in_progress' }],
          rulesApplied: [],
          agentsInvolved: agentId ? [agentId] : ['RouterAgent'],
        },
      });
      this.logger.log(`📋 Plan created via API: ${plan.id} | ${title}`);

      // Also save as memory in contexts
      if (summary || title) {
        try {
          await this.contextService.createContext({
            type: ContextType.MEMORY,
            summary: `Plan: ${title}`,
            extractedInfo: {
              type: 'plan_memory',
              content: summary || title,
              planId: plan.id,
              agentId: agentId || 'RouterAgent',
              intention: intention || 'code',
              tags: ['plan', intention || 'code'],
              savedAt: new Date().toISOString(),
            } as any,
          });
          this.logger.log(`🧠 Plan saved as memory: ${title}`);
        } catch (err) {
          this.logger.warn(`Plan memory save failed: ${err.message}`);
        }
      }

      return {
        success: true,
        data: { id: plan.id, title: plan.title, status: plan.status },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('plans/close')
  @ApiOperation({ summary: 'Cierra (completa o abandona) un plan MCP' })
  async closePlan(
    @Body()
    body: {
      planId: string;
      action: 'complete' | 'abandon';
      reason?: string;
    },
  ) {
    const { planId, action, reason } = body;
    if (!planId || !action) {
      return { success: false, error: 'planId and action (complete|abandon) are required' };
    }
    try {
      if (action === 'complete') {
        await this.mcpPlanService.complete(planId);
      } else {
        await this.mcpPlanService.abandon(planId);
      }
      this.logger.log(`📋 Plan ${action}d: ${planId}${reason ? ` (${reason})` : ''}`);
      return {
        success: true,
        data: { planId, status: action === 'complete' ? 'completed' : 'abandoned' },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get('plans')
  @ApiOperation({ summary: 'Lista planes MCP por sesión o proyecto' })
  async listPlans(
    @Query('sessionId') sessionId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    try {
      if (sessionId) {
        const plan = await this.mcpPlanService.findBySession(sessionId);
        return { success: true, data: plan ? [plan] : [] };
      }
      if (projectId) {
        const plans = await this.mcpPlanService.findByProject(
          projectId,
          status as any,
        );
        return { success: true, data: plans };
      }
      return { success: true, data: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
