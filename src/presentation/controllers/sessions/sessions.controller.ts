/**
 * Sessions Controller
 *
 * Endpoints for external agents (Claude Code, Qwen, etc.) to manage
 * sessions, preload project context, and resume work seamlessly.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import * as path from 'path';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { ProjectsService } from '@modules/projects/application/services/projects.service';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import {
  Issue,
  IssueStatus,
} from '@modules/issues/domain/entities/issue.entity';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { RedisIssueContextService } from '@infrastructure/cache/redis-issue-context.service';
import { ContextNodeService } from '@modules/contexts/application/services/context-node.service';
import { AgentRegistry } from '@core/agents/agent-registry';
import { Project } from '@modules/projects/domain/entities/project.entity';
import { ProjectDetection } from '@modules/projects/application/services/projects.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { QueryBus } from '@nestjs/cqrs';
import { GetAgentCatalogQuery } from '@modules/agency-agents/application/queries';
import { McpPlanService } from '@modules/plans/application/services/mcp-plan.service';
import { McpPlanStatus } from '@modules/plans/domain/entities/mcp-plan.entity';
import {
  buildSessionInitResponse,
  SessionInitResponse,
  RelatedProjectSummary,
} from '@core/agents/mcp-json-response';

interface StartSessionBody {
  clientId?: string;
  projectPath?: string;
  projectName?: string;
  title?: string;
  userAgent?: string;
}

interface ResumeSessionBody {
  sessionId?: string;
  clientId?: string;
  messagesLimit?: number;
}

interface ChatBody {
  input: string;
  sessionId?: string;
  clientId?: string;
  role?: 'user' | 'assistant' | 'system';
  searchLimit?: number;
}

interface SearchContextBody {
  projectId?: string;
  sessionId?: string;
  query: string;
  limit?: number;
}

interface LinkProjectsBody {
  sourceProjectId: string;
  targetProjectId: string;
  type?: string;
  description?: string;
}

@ApiTags('sessions')
@Controller('mcp/session')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly userRepository: UserRepository,
    private readonly projectsService: ProjectsService,
    private readonly issueRepository: IssueRepository,
    private readonly redisService: RedisService,
    private readonly redisIssueContext: RedisIssueContextService,
    private readonly agentRegistry: AgentRegistry,
    private readonly contextNodes: ContextNodeService,
    private readonly queryBus: QueryBus,
    private readonly mcpPlanService: McpPlanService,
  ) {}

  @Post('start')
  @ApiOperation({
    summary:
      'Start (or reuse) a session, detect project, preload active issue context',
  })
  async start(@Body() body: StartSessionBody, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const clientId =
      body.clientId ||
      (req.headers['x-client-id'] as string) ||
      `ip-${clientIp}`;

    const { user } = await this.userRepository.findByIpOrCreate({
      ipAddress: clientIp,
    });

    // Resolve project (detect from path if provided, otherwise use name)
    let project: Project | null = null;
    let detection: ProjectDetection | null = null;
    if (body.projectPath) {
      detection = await this.projectsService.detectFromPath(body.projectPath);
      const name =
        detection?.name || body.projectName || path.basename(body.projectPath);
      project = await this.projectsService.findOrCreateForUser(
        user.id,
        name,
        body.projectPath,
      );
    } else if (body.projectName) {
      project = await this.projectsService.findOrCreateProject({
        name: body.projectName,
        userId: user.id,
      });
    }

    // Reuse active session by clientId/user if available
    const existingSessionId = await this.redisService.get<string>(
      `client:${clientId}:sessionId`,
    );
    let session = existingSessionId
      ? await this.sessionRepository.findBySessionId(existingSessionId)
      : null;

    if (!session || session.status !== SessionStatus.ACTIVE) {
      const sessionId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      session = await this.sessionRepository.create({
        sessionId,
        userId: user.id,
        projectId: project?.id,
        title: body.title,
        metadata: {
          ipAddress: clientIp,
          userAgent: body.userAgent,
          mcpClient: clientId,
        },
      });
    } else if (project && !session.projectId) {
      await this.sessionRepository
        .getRepository()
        .update({ id: session.id }, { projectId: project.id });
      session.projectId = project.id;
    }

    await this.redisService.set(
      `client:${clientId}:sessionId`,
      session.sessionId,
      3600,
    );
    if (project) {
      await this.redisService.set(
        `session:${session.sessionId}:projectId`,
        project.id,
        3600,
      );
      await this.redisService.set(
        `session:${session.sessionId}:projectName`,
        project.name,
        3600,
      );
    }

    // Find active issue for this user/project (most recent in progress or open)
    let activeIssue: Issue | null = null;
    if (project) {
      const projectId = project.id;
      const inProgress = await this.issueRepository.findByUserId(
        user.id,
        IssueStatus.IN_PROGRESS,
      );
      activeIssue = inProgress.find((i) => i.projectId === projectId) ?? null;
      if (!activeIssue) {
        const open = await this.issueRepository.findByUserId(
          user.id,
          IssueStatus.OPEN,
        );
        activeIssue = open.find((i) => i.projectId === projectId) ?? null;
      }
    }

    let recentContext: {
      issueId: string;
      title: string;
      status: IssueStatus;
      currentWorkflowStep: Issue['currentWorkflowStep'];
      completedSteps: Issue['completedSteps'];
      nextSteps: Issue['nextSteps'];
      keyDecisions: string[];
      filesModified: string[];
      recentMessages: Array<{
        role: string;
        content: string;
        timestamp: string;
        agentId?: string;
      }>;
      summary?: string;
    } | null = null;
    if (activeIssue) {
      const ctx = await this.redisIssueContext.getContext(activeIssue.id);
      recentContext = {
        issueId: activeIssue.id,
        title: activeIssue.title,
        status: activeIssue.status,
        currentWorkflowStep: activeIssue.currentWorkflowStep,
        completedSteps: activeIssue.completedSteps,
        nextSteps: activeIssue.nextSteps,
        keyDecisions: ctx?.keyDecisions ?? [],
        filesModified: ctx?.filesModified ?? [],
        recentMessages: (ctx?.messages ?? []).slice(-10),
        summary: ctx?.summary,
      };
    }

    return {
      success: true,
      session: {
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        userId: user.id,
        projectId: project?.id,
        issueId: activeIssue?.id,
      },
      project: project
        ? {
            id: project.id,
            name: project.name,
            framework: detection?.detectedFramework,
            architecture: detection?.detectedArchitecture,
            metadata: project.metadata,
          }
        : null,
      recentContext,
      availableAgents: this.agentRegistry.listAgents().map((a) => ({
        id: a.agentId,
        description: a.description,
      })),
    };
  }

  @Post('resume')
  @ApiOperation({
    summary:
      'Resume a session by sessionId or clientId, returning full history',
  })
  async resume(@Body() body: ResumeSessionBody, @Req() req: Request) {
    const clientIp = req.ip || 'unknown';
    const clientId =
      body.clientId ||
      (req.headers['x-client-id'] as string) ||
      `ip-${clientIp}`;
    const limit = Math.min(body.messagesLimit ?? 30, 100);

    let sessionId = body.sessionId;
    if (!sessionId) {
      sessionId =
        (await this.redisService.get<string>(`client:${clientId}:sessionId`)) ??
        undefined;
    }

    if (!sessionId) {
      throw new BadRequestException(
        'sessionId or clientId required (no active session found)',
      );
    }

    const session = await this.sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    const messages = await this.sessionRepository.getMessages(sessionId, limit);

    const project = session.projectId
      ? await this.projectsService.findById(session.projectId)
      : null;

    const activeIssue = session.issueId
      ? await this.issueRepository.findById(session.issueId)
      : null;

    const issueCtx = activeIssue
      ? await this.redisIssueContext.getContext(activeIssue.id)
      : null;

    return {
      success: true,
      session: {
        id: session.id,
        sessionId: session.sessionId,
        status: session.status,
        isValidated: session.isValidated,
        messageCount: session.messageCount,
        lastActivityAt: session.lastActivityAt,
        userId: session.userId,
      },
      project: project
        ? { id: project.id, name: project.name, metadata: project.metadata }
        : null,
      issue: activeIssue
        ? {
            id: activeIssue.id,
            title: activeIssue.title,
            status: activeIssue.status,
            currentWorkflowStep: activeIssue.currentWorkflowStep,
            completedSteps: activeIssue.completedSteps,
            nextSteps: activeIssue.nextSteps,
            keyDecisions: issueCtx?.keyDecisions ?? [],
            filesModified: issueCtx?.filesModified ?? [],
            summary: issueCtx?.summary,
          }
        : null,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        agentId: (m.metadata as any)?.agentId,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('chat')
  @ApiOperation({
    summary:
      'Persist a chat message into the session AND index it as a context node. Returns relevant past context nodes (BM25 over project history).',
  })
  async chat(@Body() body: ChatBody, @Req() req: Request) {
    if (!body.input?.trim()) {
      throw new BadRequestException('input is required');
    }

    const clientIp = req.ip || 'unknown';
    const clientId =
      body.clientId ||
      (req.headers['x-client-id'] as string) ||
      `ip-${clientIp}`;

    // Resolve session: explicit > Redis lookup by clientId
    let sessionId = body.sessionId;
    if (!sessionId) {
      sessionId =
        (await this.redisService.get<string>(`client:${clientId}:sessionId`)) ??
        undefined;
    }
    if (!sessionId) {
      throw new BadRequestException(
        'No active session. Call /mcp/session/start first.',
      );
    }

    const session = await this.sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new BadRequestException(`Session ${sessionId} not found`);
    }

    // 1. Persist the message in chat_messages
    const role: MessageRole =
      body.role === 'assistant'
        ? MessageRole.ASSISTANT
        : body.role === 'system'
          ? MessageRole.SYSTEM
          : MessageRole.USER;
    const stored = await this.sessionRepository.addMessage({
      sessionId,
      role,
      content: body.input,
      issueId: session.issueId,
    });

    // 2. Index it as a context node (per project)
    if (session.projectId) {
      await this.contextNodes.indexMessage({
        id: stored.id,
        projectId: session.projectId,
        sessionId,
        issueId: session.issueId,
        role,
        content: body.input,
        createdAt: stored.createdAt,
      });
    }

    // 3. Retrieve relevant past nodes
    const relevant = session.projectId
      ? await this.contextNodes.search(
          session.projectId,
          body.input,
          Math.min(body.searchLimit ?? 5, 20),
        )
      : [];

    return {
      success: true,
      sessionId,
      messageId: stored.id,
      indexed: !!session.projectId,
      relevantContext: relevant.map((r) => ({
        id: r.node.id,
        role: r.node.role,
        score: Number(r.score.toFixed(3)),
        snippet: r.snippet,
        createdAt: r.node.createdAt,
      })),
      stats: session.projectId
        ? this.contextNodes.getStats(session.projectId)
        : null,
    };
  }

  @Post('project/link')
  @ApiOperation({
    summary:
      'Link two projects with a relationship type (grpc_client, depends_on, calls, shared_db)',
  })
  async linkProjects(@Body() body: LinkProjectsBody) {
    if (!body.sourceProjectId || !body.targetProjectId) {
      throw new BadRequestException(
        'sourceProjectId and targetProjectId are required',
      );
    }
    const rel = await this.projectsService.linkProjects(
      body.sourceProjectId,
      body.targetProjectId,
      body.type,
      body.description,
    );
    return { success: true, relationship: rel };
  }

  @Get('project/:id/related')
  @ApiOperation({
    summary: 'Get all projects related to the given project (both directions)',
  })
  async getRelatedProjects(@Param('id') id: string) {
    const related = await this.projectsService.getRelatedProjects(id);
    return { success: true, projectId: id, ...related };
  }

  @Post('context/search')
  @ApiOperation({
    summary:
      'Search relevant context nodes by BM25 within a project (or session.projectId).',
  })
  async searchContext(@Body() body: SearchContextBody) {
    if (!body.query?.trim()) {
      throw new BadRequestException('query is required');
    }

    let projectId = body.projectId;
    if (!projectId && body.sessionId) {
      const s = await this.sessionRepository.findBySessionId(body.sessionId);
      projectId = s?.projectId;
    }
    if (!projectId) {
      throw new BadRequestException('projectId or sessionId required');
    }

    const results = await this.contextNodes.search(
      projectId,
      body.query,
      Math.min(body.limit ?? 10, 50),
    );

    return {
      success: true,
      projectId,
      query: body.query,
      stats: this.contextNodes.getStats(projectId),
      results: results.map((r) => ({
        id: r.node.id,
        sessionId: r.node.sessionId,
        role: r.node.role,
        score: Number(r.score.toFixed(3)),
        snippet: r.snippet,
        createdAt: r.node.createdAt,
      })),
    };
  }

  /**
   * session_init_auto — Llamada automática al iniciar Claude Code.
   * Una sola petición que: crea sesión, registra proyecto por cwd,
   * y devuelve el catálogo BM2 de agentes disponibles en JSON.
   */
  @Post('init-auto')
  @ApiOperation({
    summary:
      'Auto-init: crea sesión + registra proyecto por cwd + devuelve catálogo de agentes',
  })
  async initAuto(
    @Body() body: { cwd: string; clientId?: string; userAgent?: string },
    @Req() req: Request,
  ): Promise<SessionInitResponse> {
    const start = Date.now();
    const clientIp = req.ip || 'unknown';
    const clientId =
      body.clientId ||
      (req.headers['x-client-id'] as string) ||
      `ip-${clientIp}`;

    if (!body.cwd) {
      throw new BadRequestException('cwd is required');
    }

    const { user } = await this.userRepository.findByIpOrCreate({
      ipAddress: clientIp,
    });

    // Detectar proyecto desde cwd
    const detection = await this.projectsService.detectFromPath(body.cwd);
    const projectName = detection?.name || path.basename(body.cwd);

    const projectBefore = await this.projectsService.findByPath(body.cwd);
    const isNewProject = !projectBefore;

    const project = await this.projectsService.findOrCreateForUser(
      user.id,
      projectName,
      body.cwd,
    );

    // Reutilizar sesión activa o crear nueva
    const existingSessionId = await this.redisService.get<string>(
      `client:${clientId}:sessionId`,
    );
    let session = existingSessionId
      ? await this.sessionRepository.findBySessionId(existingSessionId)
      : null;

    if (!session || session.status !== SessionStatus.ACTIVE) {
      const sessionId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      session = await this.sessionRepository.create({
        sessionId,
        userId: user.id,
        projectId: project.id,
        title: `Auto-init: ${projectName}`,
        metadata: {
          ipAddress: clientIp,
          userAgent: body.userAgent,
          mcpClient: clientId,
        },
      });
    } else if (!session.projectId) {
      await this.sessionRepository
        .getRepository()
        .update({ id: session.id }, { projectId: project.id });
      session.projectId = project.id;
    }

    // Persistir en Redis
    await this.redisService.set(
      `client:${clientId}:sessionId`,
      session.sessionId,
      3600,
    );
    await this.redisService.set(
      `session:${session.sessionId}:projectId`,
      project.id,
      3600,
    );
    await this.redisService.set(
      `session:${session.sessionId}:projectName`,
      project.name,
      3600,
    );

    // Cargar catálogo BM2, planes activos, sesiones recientes, proyectos relacionados e historial de contexto en paralelo
    const [
      catalog,
      activePlansRaw,
      recentSessionsRaw,
      relatedRaw,
      projectHistory,
    ] = await Promise.all([
      this.queryBus.execute(new GetAgentCatalogQuery('summary')),
      this.mcpPlanService.findByProject(project.id, McpPlanStatus.IN_PROGRESS),
      this.sessionRepository.findByProjectId(project.id, 5),
      this.projectsService.getRelatedProjects(project.id),
      this.contextNodes.getProjectSummary(project.id).catch(() => null),
    ]);

    const activePlans = activePlansRaw.map((p) => ({
      planId: p.id,
      title: p.title,
      status: p.status,
      agentId: p.agentId,
      createdAt: p.createdAt.toISOString(),
      dueDate: p.dueDate?.toISOString(),
    }));

    const recentSessions = recentSessionsRaw
      .filter((s) => s.sessionId !== session.sessionId)
      .slice(0, 4)
      .map((s) => ({
        sessionId: s.sessionId,
        title: s.title,
        lastActivityAt: s.lastActivityAt?.toISOString(),
      }));

    const relatedProjects: RelatedProjectSummary[] = [
      ...relatedRaw.dependsOn.map((r) => ({
        projectId: r.project.id,
        name: r.project.name,
        path: r.project.metadata?.localPath as string | undefined,
        relationType: r.type,
        direction: 'outgoing' as const,
      })),
      ...relatedRaw.usedBy.map((r) => ({
        projectId: r.project.id,
        name: r.project.name,
        path: r.project.metadata?.localPath as string | undefined,
        relationType: r.type,
        direction: 'incoming' as const,
      })),
    ];

    // Resumen de trabajo pendiente para que Claude lo presente sin correr git log
    let pendingWorkSummary: string | undefined;
    if (activePlans.length > 0) {
      const planTitles = activePlans.map((p) => `• ${p.title}`).join('\n');
      pendingWorkSummary = `${activePlans.length} plan(es) activo(s):\n${planTitles}`;
    } else if (!isNewProject && recentSessions.length > 0) {
      pendingWorkSummary = `Proyecto retomado. ${recentSessions.length} sesión(es) previas registradas. Sin planes activos pendientes.`;
    }

    this.logger.log(
      `🚀 session_init_auto | project: ${project.name} | session: ${session.sessionId} | new: ${isNewProject} | plans: ${activePlans.length}`,
    );

    return buildSessionInitResponse({
      sessionId: session.sessionId,
      projectId: project.id,
      projectName: project.name,
      framework: detection?.detectedFramework,
      architecture: detection?.detectedArchitecture,
      isNewProject,
      executionTimeMs: Date.now() - start,
      agentCatalog: catalog.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        category: a.category,
        categoryIcon: a.categoryIcon,
        purpose: a.purpose,
      })),
      activePlans,
      recentSessions,
      relatedProjects,
      pendingWorkSummary,
      projectHistory: projectHistory
        ? {
            totalMessages: projectHistory.totalMessages,
            issuesWorked: projectHistory.issuesWorked,
            keyDecisions: projectHistory.keyDecisions,
            modulesModified: projectHistory.modulesModified,
            relevantChunks: projectHistory.relevantChunks,
          }
        : undefined,
    });
  }
}
