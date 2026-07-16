import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { Response } from 'express';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';
import { SessionStatus } from '@modules/sessions/domain/entities/session.entity';
import { IssueService } from '@modules/issues/application/services/issue.service';
import { IssueStatus } from '@modules/issues/domain/entities/issue.entity';
import { ProjectsService } from '@modules/projects/application/services/projects.service';
import { ContextService } from '@modules/contexts/application/services/context.service';
import { ContextType } from '@modules/contexts/domain/entities/context.entity';
import { Context7Adapter } from '@infrastructure/adapters/context7/context7.adapter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface McpSession {
  server: McpServer;
  transport: SSEServerTransport;
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly apiPort: number;

  // Stores active sessions by sessionId (MCP runtime)
  private sessions: Map<string, McpSession> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionRepository: SessionRepository,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly issueService: IssueService,
    private readonly projectsService: ProjectsService,
    private readonly contextService: ContextService,
    private readonly context7Adapter: Context7Adapter,
  ) {
    this.apiPort = this.configService.get<number>('PORT', 8004);
  }

  /**
   * Lee package.json desde el directorio actual
   * Usado para detectar el nombre del proyecto automáticamente
   */
  private async readPackageJson(dir: string): Promise<{
    name: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.debug(`No package.json found in ${dir}: ${error.message}`);
      return null;
    }
  }

  /**
   * Finds an active session by clientId
   * If session exists but has no user_id, it will be updated
   * Also tries to resume session from an active purpose if available
   */
  async findActiveSessionId(clientId: string): Promise<string | null> {
    try {
      // Try Redis first (faster)
      const cachedSessionId = await this.redisService.get<string>(
        `client:${clientId}:sessionId`,
      );
      if (cachedSessionId) {
        // Check if session exists in PostgreSQL
        const session =
          await this.sessionRepository.findBySessionId(cachedSessionId);
        if (session && session.status === 'active') {
          this.logger.debug(`♻️ Session found in cache: ${cachedSessionId}`);

          // FIX: If session has no user_id, update it
          if (!session.userId) {
            const ipAddress = clientId.replace('ip-', '');
            const { user } = await this.userRepository.findByIpOrCreate({
              ipAddress,
            });

            // Update session with user_id
            await this.sessionRepository
              .getRepository()
              .update({ id: session.id }, { userId: user.id });

            this.logger.log(
              `🔧 Fixed session ${cachedSessionId}: Added userId ${user.id}`,
            );
          }

          return cachedSessionId;
        }
      }

      // Search in PostgreSQL
      const sessions = await this.sessionRepository.getActiveSessions();
      const matchingSession = sessions.find(
        (s) =>
          s.metadata?.clientId === clientId ||
          s.metadata?.clientIp === clientId.replace('ip-', ''),
      );

      if (matchingSession) {
        // FIX: If session has no user_id, update it
        if (!matchingSession.userId) {
          const ipAddress = clientId.replace('ip-', '');
          const { user } = await this.userRepository.findByIpOrCreate({
            ipAddress,
          });

          await this.sessionRepository
            .getRepository()
            .update({ id: matchingSession.id }, { userId: user.id });

          this.logger.log(
            `🔧 Fixed session ${matchingSession.sessionId}: Added userId ${user.id}`,
          );
        }

        // Cache for next time
        await this.redisService.set(
          `client:${clientId}:sessionId`,
          matchingSession.sessionId,
          3600,
        );
        this.logger.debug(
          `♻️ Session found in DB: ${matchingSession.sessionId}`,
        );
        return matchingSession.sessionId;
      }
    } catch (error) {
      this.logger.error(`Error finding session: ${error.message}`);
    }

    return null;
  }

  /**
   * Updates lastActivityAt for a session
   */
  async touchSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionRepository.findBySessionId(sessionId);
      if (session) {
        await this.sessionRepository
          .getRepository()
          .update({ id: session.id }, { lastActivityAt: new Date() });
        this.logger.debug(`🕒 Session activity updated: ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating activity: ${error.message}`);
    }
  }

  /**
   * Creates a new MCP session with its transport
   * Creates session in DB immediately
   * REUSES existing session for same IP if available
   */
  async createSession(
    res: Response,
    clientId?: string,
  ): Promise<{ sessionId: string; session: McpSession }> {
    const transport = new SSEServerTransport('/mcp/message', res);

    const server = new McpServer(
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

    this.registerTools(server);
    this.registerPrompts(server);

    // Connect server to transport
    await server.connect(transport);

    // Send initial system message via SSE to instruct the client to use tools
    try {
      const systemMessage = {
        role: 'system',
        content: `You are connected to CodeMentor MCP.

IMPORTANT: You MUST use the MCP tools for all questions and work requests:

1. FIRST: Call 'register_project' with the project path when starting work on a project
   Example: { "projectPath": "/home/user/projects/my-app" }

2. THEN: Use 'agent_query' tool for any question, implementation, analysis, or research
   ALWAYS include 'projectPath' when calling agent_query

3. Use 'search_rules' to find relevant code rules
4. Use 'context7_docs' to fetch up-to-date library documentation

When a user asks to implement, analyze, create, fix, or research something, you MUST call the 'agent_query' tool with the user's message AND the projectPath.

Issue tracking is enabled for this session.`,
      };

      // Send as an SSE event
      res.write(
        `data: ${JSON.stringify({ type: 'system', message: systemMessage })}\n\n`,
      );
      this.logger.log('✅ MCP: Sent initial system instructions to client');
    } catch (error) {
      this.logger.warn(`⚠️ Failed to send initial message: ${error.message}`);
    }

    // Transport generates its own sessionId
    const transportSessionId = transport.sessionId;
    const session: McpSession = { server, transport };
    this.sessions.set(transportSessionId, session);

    // Heartbeat to keep SSE connection alive (prevents proxy/client timeouts)
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);
    res.on('close', () => clearInterval(heartbeat));

    // Extract IP from clientId (format: "ip-::ffff:127.0.0.1-timestamp")
    const ipMatch = clientId?.match(/^ip-(.+?)(-\d+)?$/);
    const ipAddress = ipMatch ? ipMatch[1] : res.req?.ip || 'unknown';

    // STEP 1: Create or get user by IP
    const { user, isNew } = await this.userRepository.findByIpOrCreate({
      ipAddress,
      email: undefined,
      name: undefined,
    });

    const userId = user.id;
    this.logger.debug(
      `👤 User ${isNew ? 'created' : 'found'} for IP ${ipAddress}: ${userId}`,
    );

    // STEP 1.5: Project will be detected when user sends first message
    // DO NOT use process.cwd() as it's the server directory, not the user's project
    const projectId: string | null = null;
    let projectName: string | null = null;

    // STEP 2: TRY TO REUSE EXISTING ACTIVE SESSION FOR THIS IP
    let existingSessionId: string | null = null;
    try {
      // Check Redis first (faster)
      const cachedSessionId = await this.redisService.get<string>(
        `client:ip-${ipAddress}:sessionId`,
      );
      if (cachedSessionId) {
        // Verify session exists in DB and is active
        const dbSession =
          await this.sessionRepository.findBySessionId(cachedSessionId);
        if (dbSession && dbSession.status === 'active') {
          existingSessionId = cachedSessionId;
          this.logger.log(
            `♻️ REUSING existing session for IP ${ipAddress}: ${existingSessionId}`,
          );
        }
      }

      // If not in Redis, search DB for active session by IP
      if (!existingSessionId) {
        const activeSessions =
          await this.sessionRepository.getActiveSessions(userId);
        const matchingSession = activeSessions.find(
          (s) =>
            s.metadata?.clientIp === ipAddress ||
            s.metadata?.ipAddress === ipAddress,
        );

        if (matchingSession) {
          existingSessionId = matchingSession.sessionId;
          this.logger.log(
            `♻️ REUSING existing DB session for IP ${ipAddress}: ${existingSessionId}`,
          );

          // Cache for next time
          await this.redisService.set(
            `client:ip-${ipAddress}:sessionId`,
            existingSessionId,
            3600,
          );
        }
      }
    } catch (error) {
      this.logger.warn(`Error checking for existing session: ${error.message}`);
    }

    // STEP 3: Create session in PostgreSQL (new or update existing)
    // IMPORTANT: Include projectId if available
    try {
      if (existingSessionId) {
        // Update existing session with new transport info
        const existingSession =
          await this.sessionRepository.findBySessionId(existingSessionId);

        // Update projectId if not already set and we have one
        const updateData: any = {
          status: SessionStatus.ACTIVE,
          lastActivityAt: new Date(),
          metadata: {
            ...(existingSession?.metadata || {}),
            clientId,
            clientIp: ipAddress,
            lastConnectedAt: new Date().toISOString(),
          } as any,
        };

        // Link project to existing session if not already linked
        if (projectId && !existingSession?.projectId) {
          updateData.projectId = projectId;
          this.logger.log(
            `🔗 Project ${projectName} linked to existing session ${existingSessionId}`,
          );
        }

        await this.sessionRepository
          .getRepository()
          .update({ sessionId: existingSessionId }, updateData);
        this.logger.log(`✅ REACTIVATED session: ${existingSessionId}`);
      } else {
        // Create new session WITH projectId
        await this.sessionRepository.create({
          sessionId: transportSessionId,
          userId,
          projectId: projectId || undefined,
          title: `MCP Session - ${ipAddress}${projectName ? ` - ${projectName}` : ''}`,
          metadata: {
            type: 'mcp',
            clientId,
            clientIp: ipAddress,
            createdAt: new Date().toISOString(),
            ...(projectName ? { projectName, projectPath: process.cwd() } : {}),
          },
        });
        this.logger.log(
          `💾 NEW session created in PostgreSQL: ${transportSessionId}${projectId ? ` | Project: ${projectName}` : ''}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error creating/updating session in DB: ${error.message}`,
      );
    }

    // STEP 4: Store user info in Redis for fast lookups
    // Also store projectId for fast lookups
    try {
      const finalSessionId = existingSessionId || transportSessionId;
      await this.redisService.set(
        `session:${finalSessionId}:userId`,
        userId,
        3600,
      );
      await this.redisService.set(
        `session:${finalSessionId}:clientId`,
        clientId || '',
        3600,
      );
      await this.redisService.set(
        `session:${finalSessionId}:ip`,
        ipAddress,
        3600,
      );

      // Store projectId in Redis for fast lookups
      if (projectId) {
        await this.redisService.set(
          `session:${finalSessionId}:projectId`,
          projectId,
          3600,
        );
        await this.redisService.set(
          `session:${finalSessionId}:projectName`,
          projectName,
          3600,
        );
      }

      // Cache IP -> sessionId mapping
      await this.redisService.set(
        `client:ip-${ipAddress}:sessionId`,
        finalSessionId,
        3600,
      );

      this.logger.debug(
        `💾 Session metadata stored in Redis: ${finalSessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing session metadata in Redis: ${error.message}`,
      );
    }

    // Store clientId -> sessionId in Redis for fast lookups (short TTL, 1 hour)
    if (clientId) {
      const finalSessionId = existingSessionId || transportSessionId;
      await this.redisService.set(
        `client:${clientId}:sessionId`,
        finalSessionId,
        3600,
      );
    }

    const finalSessionId = existingSessionId || transportSessionId;
    this.logger.log(
      `✅ MCP: Session ${existingSessionId ? 'REUSED' : 'CREATED'}: ${finalSessionId}`,
    );

    // Cleanup when connection closes
    res.on('close', () => {
      this.closeSession(transportSessionId);
    });

    return { sessionId: finalSessionId, session };
  }

  /**
   * Gets or creates session for a user when first tool is called
   * Simplified: No longer uses SessionPurpose
   */
  async getOrCreateSessionForToolUse(
    sessionId: string,
    userId: string,
    toolName: string,
    clientId?: string,
    ipAddress?: string,
  ): Promise<string> {
    // Check if session already exists in DB
    const existingDbSession =
      await this.sessionRepository.findBySessionId(sessionId);

    if (existingDbSession) {
      this.logger.debug(`♻️ Session already exists in DB: ${sessionId}`);
      return existingDbSession.sessionId;
    }

    // Fallback: Session not found (shouldn't happen normally)
    this.logger.warn(`⚠️ Session not found, creating on-the-fly: ${sessionId}`);
    return sessionId;
  }

  /**
   * Closes and removes a session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.log(`🗑️ MCP: Session closed: ${sessionId}`);
    }
  }

  /**
   * Gets a session by ID
   */
  getSession(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Gets all sessions (for debug)
   */
  getSessions(): Map<string, McpSession> {
    return this.sessions;
  }

  /**
   * Saves a chat message to PostgreSQL
   * Creates session if it doesn't exist
   * Automatically creates/links an issue on first message
   */
  async saveChatMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    metadata?: any,
  ): Promise<void> {
    try {
      // Get user info from Redis
      const userId = await this.redisService.get<string>(
        `session:${sessionId}:userId`,
      );
      const clientId = await this.redisService.get<string>(
        `session:${sessionId}:clientId`,
      );
      const ipAddress = await this.redisService.get<string>(
        `session:${sessionId}:ip`,
      );

      // Create session if it doesn't exist (first message)
      if (userId) {
        await this.getOrCreateSessionForToolUse(
          sessionId,
          userId,
          'conversation',
          clientId || undefined,
          ipAddress || undefined,
        );
      }

      await this.sessionRepository.addMessage({
        sessionId,
        role,
        content,
        issueId: metadata?.issueId || null,
        metadata,
        tokenCount: content.length,
      });
      this.logger.debug(
        `💬 Message saved to PostgreSQL: ${sessionId} - ${role}`,
      );
    } catch (error) {
      this.logger.error(`Error saving message to DB: ${error.message}`);
    }
  }

  /**
   * Process user message: detect project, intention, create issue if work, save to context
   *
   * Flow:
   * 1. Detect project from message
   * 2. Find or create project in DB
   * 3. Detect intention (work vs analysis)
   * 4. If work intention -> create issue
   * 5. Save message to Context (always, even without issue)
   */
  async processUserMessage(
    sessionId: string,
    userId: string,
    userMessage: string,
    existingProjectId?: string,
  ): Promise<{
    projectId: string | null;
    issueId: string | null;
    contextId: string | null;
  }> {
    try {
      const session = await this.sessionRepository.findBySessionId(sessionId);

      // STEP 1: If project already provided, use it; otherwise detect from message
      let projectId: string | null = existingProjectId || null;
      let projectName: string | null = null;

      if (existingProjectId) {
        const existingProject =
          await this.projectsService.findById(existingProjectId);
        projectName = existingProject?.name || null;
        this.logger.log(
          `📁 Using provided project: ${projectName} (${existingProjectId})`,
        );
      } else {
        projectName = await this.detectProjectName(userMessage);
        this.logger.log(
          `🔍 Detected project from message: ${projectName || 'unknown'}`,
        );
      }

      // STEP 2: Check if session already has an issue linked
      // This is critical - we don't want to create multiple issues per session!
      const existingIssueId =
        session?.issueId ||
        (await this.redisService.get<string>(`session:${sessionId}:issueId`));

      if (existingIssueId) {
        this.logger.log(
          `♻️ Session already has issue: ${existingIssueId}. Reusing existing issue.`,
        );

        // Link project if not already done
        if (projectId && !session?.projectId) {
          await this.sessionRepository
            .getRepository()
            .update({ sessionId }, { projectId });

          await this.redisService.set(
            `session:${sessionId}:projectId`,
            projectId,
            3600,
          );

          this.logger.log(
            `🔗 Project linked to existing issue: ${projectName}`,
          );
        }

        return {
          projectId: session?.projectId || projectId,
          issueId: existingIssueId,
          contextId: null,
        };
      }

      // STEP 3: Find or create project if not already set
      if (!projectId) {
        const projectToCreate = {
          name: projectName || `session-${sessionId.substring(0, 8)}`,
          userId,
          metadata: {
            detectedFrom: projectName ? 'mcp-message' : 'mcp-default',
            initialMessage: userMessage.substring(0, 200),
            sessionId,
          },
        };

        const project =
          await this.projectsService.findOrCreateProject(projectToCreate);
        projectId = project.id;
        projectName = project.name;
      }

      // Link project to session
      if (session && !session.projectId) {
        await this.sessionRepository
          .getRepository()
          .update({ sessionId }, { projectId });
        this.logger.log(`🔗 Project linked to session: ${projectName}`);
      }

      // Cache project in Redis
      await this.redisService.set(
        `session:${sessionId}:projectId`,
        projectId,
        3600,
      );

      // STEP 4: Detect intention (work vs analysis)
      const intention = this.detectIntention(userMessage);
      this.logger.log(`🎯 Detected intention: ${intention}`);

      // STEP 5: If work intention AND no existing issue -> create issue
      let issueId: string | null = null;
      let contextId: string | null = null;

      if (intention === 'work') {
        // Generate contextual issue ID with project name
        const title = this.generateIssueTitle(userMessage);
        const contextualIssueId = projectName
          ? `${projectName.toLowerCase()}-${Date.now().toString(36).substring(0, 6)}`
          : `issue-${Date.now()}`;

        this.logger.log(
          `📋 Creating issue: ${contextualIssueId} | projectName: ${projectName || 'none'}`,
        );

        const issue = await this.issueService.createIssue({
          title,
          description: `Created from MCP conversation. Initial message: "${userMessage.substring(0, 500)}"`,
          userId,
          sessionId,
          projectId: projectId || undefined,
          metadata: {
            autoCreated: true,
            source: 'mcp-work-intention',
            createdAt: new Date().toISOString(),
            initialMessage: userMessage,
            projectName: projectName || undefined,
            contextualIssueId,
          },
        });

        issueId = issue.id;

        // Link issue to session
        if (session && issueId) {
          await this.sessionRepository
            .getRepository()
            .update({ sessionId }, { issueId });
        }

        // Cache in Redis
        if (issueId) {
          await this.redisService.set(
            `session:${sessionId}:issueId`,
            issueId,
            3600,
          );
        }

        this.logger.log(
          `✅ Issue created: ${issue.issueId} (${title}) | Project: ${projectName || 'none'}`,
        );

        // STEP 5: Create Context for this issue
        const contextType =
          await this.contextService.detectContextType(userMessage);

        const context = await this.contextService.createContext({
          issueId: issueId!,
          type: contextType,
          summary: title,
          messages: [
            {
              role: 'user' as const,
              content: userMessage,
              timestamp: new Date().toISOString(),
            },
          ],
          metadata: {
            projectName: projectName || undefined,
          },
        });

        contextId = context.id;

        // Cache context in Redis
        await this.redisService.set(
          `session:${sessionId}:contextId`,
          contextId,
          3600,
        );

        this.logger.log(
          `📝 Context created: ${context.contextId} for issue ${issue.issueId}`,
        );
      } else {
        // Analysis intention - just save to context without issue
        // Get existing issue from session if any
        const existingIssueId =
          session?.issueId ||
          (await this.redisService.get<string>(`session:${sessionId}:issueId`));

        if (existingIssueId) {
          // Add message to existing context
          const activeContext =
            await this.contextService.getActiveContext(existingIssueId);
          if (activeContext) {
            await this.contextService.addMessage(
              activeContext.id,
              'user',
              userMessage,
            );
            contextId = activeContext.id;
            this.logger.log(
              `📝 Message added to existing context: ${activeContext.contextId}`,
            );
          } else {
            // Create new context for analysis
            const contextType =
              await this.contextService.detectContextType(userMessage);
            const context = await this.contextService.createContext({
              issueId: existingIssueId,
              type: contextType,
              summary: `Analysis: ${userMessage.substring(0, 50)}...`,
              messages: [
                {
                  role: 'user' as const,
                  content: userMessage,
                  timestamp: new Date().toISOString(),
                },
              ],
              metadata: {
                projectName: projectName || undefined,
                isAnalysis: true,
              },
            });
            contextId = context.id;
            await this.redisService.set(
              `session:${sessionId}:contextId`,
              contextId,
              3600,
            );
            this.logger.log(
              `📝 Analysis context created: ${context.contextId}`,
            );
          }
        } else {
          // No issue yet - create analysis-only context (temporarily without issue)
          const contextType =
            await this.contextService.detectContextType(userMessage);
          const context = await this.contextService.createContext({
            issueId: undefined as any, // Will be linked later when issue is created
            type: contextType,
            summary: `Analysis: ${userMessage.substring(0, 50)}...`,
            messages: [
              {
                role: 'user' as const,
                content: userMessage,
                timestamp: new Date().toISOString(),
              },
            ],
            metadata: {
              projectName: projectName || undefined,
              projectId: projectId || undefined,
              isAnalysis: true,
              pendingIssue: true, // Mark as pending issue creation
            },
          });
          contextId = context.id;
          await this.redisService.set(
            `session:${sessionId}:contextId`,
            contextId,
            3600,
          );
          this.logger.log(
            `📝 Analysis context created (pending issue): ${context.contextId}`,
          );
        }
      }

      return { projectId, issueId, contextId };
    } catch (error) {
      this.logger.error(`Error processing user message: ${error.message}`);
      return { projectId: null, issueId: null, contextId: null };
    }
  }

  /**
   * Legacy method - redirects to processUserMessage
   */
  async getOrCreateIssueForSession(
    sessionId: string,
    userId: string,
    userMessage: string,
    projectNameFromContext?: string,
  ): Promise<string | null> {
    const result = await this.processUserMessage(
      sessionId,
      userId,
      userMessage,
    );
    return result.issueId;
  }

  /**
   * Detect if user message indicates work intention vs analysis
   */
  private detectIntention(userMessage: string): 'work' | 'analysis' {
    const lower = userMessage.toLowerCase();

    // Keywords that indicate work intention (create issue)
    const workKeywords = [
      'implementar',
      'implement',
      'crear',
      'create',
      'agregar',
      'add',
      'migrar',
      'migrate',
      'hacer',
      'make',
      'build',
      'construir',
      'fix',
      'bug',
      'arreglar',
      'corregir',
      'resolver',
      'desarrollar',
      'develop',
      'trabajar',
      'work on',
      'refactorizar',
      'refactor',
      'mejorar',
      'improve',
      'actualizar',
      'update',
      'modificar',
      'modify',
      'convertir',
      'convert',
      'transformar',
      'transform',
    ];

    // Keywords that indicate analysis only (no issue)
    const analysisKeywords = [
      'analizar',
      'analyze',
      'analisis',
      'analysis',
      'buscar',
      'search',
      'busca',
      'find',
      'investigar',
      'research',
      'investiga',
      'consultar',
      'consult',
      'consulta',
      'revisar',
      'review',
      'revisa',
      'explicar',
      'explain',
      'explica',
      'dime',
      'tell me',
      'que hay',
      'what is',
      'como funciona',
      'how does',
      'como es',
      'que hay de',
      'what about',
    ];

    // Check for work keywords first
    for (const keyword of workKeywords) {
      if (lower.includes(keyword)) {
        return 'work';
      }
    }

    // Check for analysis-only keywords
    for (const keyword of analysisKeywords) {
      if (lower.includes(keyword)) {
        return 'analysis';
      }
    }

    // Default to analysis if unclear
    return 'analysis';
  }

  /**
   * Detects project name dynamically from multiple sources
   * Priority: 1. Working Directory, 2. Message content
   */
  private async detectProjectName(
    userMessage: string,
    projectNameFromContext?: string,
  ): Promise<string | null> {
    // 1. Use explicitly provided project name
    if (projectNameFromContext) {
      return projectNameFromContext;
    }

    // 2. Try to detect from working directory (PWD)
    const projectFromCwd = this.extractProjectFromWorkingDirectory();
    if (projectFromCwd) {
      this.logger.debug(`🔍 Project detected from PWD: ${projectFromCwd}`);
      return projectFromCwd;
    }

    // 3. Try to detect from user message
    const projectFromMessage = this.extractProjectFromMessage(userMessage);
    if (projectFromMessage) {
      this.logger.debug(
        `🔍 Project detected from message: ${projectFromMessage}`,
      );
      return projectFromMessage;
    }

    this.logger.debug(`🔍 No project detected from PWD or message`);
    return null;
  }

  /**
   * Extracts project name from the current working directory
   * Example: /home/aajcr/PROYECTOS/LINKI/linki-f → linki-f
   */
  private extractProjectFromWorkingDirectory(): string | null {
    try {
      const cwd = process.cwd();
      if (!cwd) return null;

      // Get the last segment of the path (project name)
      const pathParts = cwd
        .split('/')
        .filter((p) => p && p !== 'home' && p !== 'PROYECTOS');

      // Return the most relevant path segment (usually the last one)
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        // Clean up: remove dashes, etc but keep the name
        return lastPart.trim();
      }

      return null;
    } catch (error) {
      this.logger.warn(`Could not detect project from PWD: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts project name from user message
   * Patterns: "proyecto X", "project X", "del proyecto X"
   */
  private extractProjectFromMessage(message: string): string | null {
    const lowerMessage = message.toLowerCase();

    // Patterns to extract project name from message
    const patterns = [
      /(?:proyecto|project|del proyecto|del project|el proyecto)\s+([a-zA-Z0-9_-]+)/i,
      /(?:trabajar en|work on|in)\s+([a-zA-Z0-9_-]+)/i,
      /(?:analizar|analyze)\s+([a-zA-Z0-9_-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const potentialProject = match[1].trim();
        // Filter out common words that aren't project names
        const excluded = [
          'un',
          'una',
          'el',
          'la',
          'this',
          'a',
          'an',
          'the',
          'mi',
          'my',
          'tu',
          'your',
        ];
        if (!excluded.includes(potentialProject.toLowerCase())) {
          return potentialProject;
        }
      }
    }

    return null;
  }

  /**
   * Generates a title from user message
   */
  private generateIssueTitle(userMessage: string): string {
    // Clean up the message to create a meaningful title
    let title = userMessage
      .replace(/(quiero|necesito|por favor|please|can you|could you)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (title.length > 80) {
      title = title.substring(0, 80) + '...';
    }

    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  /**
   * Register prompts to instruct Qwen to use MCP tools
   */
  private registerPrompts(server: McpServer) {
    try {
      server.prompt(
        'system_instructions',
        'System instructions for CodeMentor MCP',
        {
          description: z.string().optional(),
        },
        async ({ description }) => {
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `You are CodeMentor AI assistant. You MUST use the MCP tools provided for ALL questions and tasks.

IMPORTANT RULES:
1. ALWAYS use 'agent_query' tool for any question, work request, or analysis
2. The MCP provides code rules, project analysis, and specialized agents
3. NEVER respond directly without using available tools when the user asks about:
   - Implementing features
   - Analyzing code or projects
   - Creating or modifying code
   - Debugging or fixing issues
   - Any work-related task

4. The system automatically creates issues for work tasks to track progress

When in doubt, ALWAYS use the agent_query tool first.`,
                },
              },
            ],
          };
        },
      );

      server.prompt(
        'analyze_project',
        'Prompt for analyzing the current project',
        {
          projectPath: z.string().optional(),
        },
        async ({ projectPath }) => {
          return {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Analyze the project${projectPath ? ` at ${projectPath}` : ''}. Use the MCP tools to:
1. Search for relevant code rules
2. Use agent_query to get comprehensive analysis
3. Identify architecture patterns
4. Provide actionable recommendations`,
                },
              },
            ],
          };
        },
      );

      this.logger.log('✅ MCP: Prompts registered');
    } catch (error) {
      this.logger.warn(`⚠️ Failed to register prompts: ${error.message}`);
    }
  }

  private registerTools(server: McpServer) {
    this.logger.log('🔧 MCP: Registering tools...');

    // Register prompts to instruct Qwen to use tools
    this.registerPrompts(server);

    // agent_query - MAIN TOOL! MUST be used for ALL questions and work requests
    server.tool(
      'agent_query',
      'OBLIGATORIO antes de cualquier implementación. Registra el plan de trabajo en BD, carga reglas del proyecto y enruta al agente especializado (CodeAgent, ArchitectureAgent, AnalysisAgent, etc.). Devuelve guía de implementación basada en las reglas reales del proyecto. NUNCA implementes código sin llamar este tool primero — el MCP necesita registrar el plan para mantener historial del proyecto.',
      {
        message: z.string().describe('Your question or request'),
        context: z
          .any()
          .optional()
          .describe('Additional context (web info, project code, etc.)'),
        sessionId: z
          .string()
          .optional()
          .describe('Session ID for conversation continuity'),
        projectPath: z
          .string()
          .optional()
          .describe(
            'Absolute path to the current project (e.g., /home/user/projects/my-app). ALWAYS include this when you know the project path.',
          ),
      },
      async ({ message, context, sessionId, projectPath }, extra) => {
        // Try multiple sources for sessionId: parameter, extra
        const sid = sessionId || extra?.sessionId || 'unknown';

        this.logger.log(
          `💬 MCP: agent_query called - message="${message.substring(0, 100)}..." | sessionId: ${sid}`,
        );

        try {
          // Call the chat endpoint which auto-routes to specialized agents
          const port = this.apiPort;
          const url = `http://localhost:${port}/mcp/chat`;

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: message,
              options: { context, sessionId: sid, language: 'es' },
              sessionId: sid,
              projectPath,
            }),
          });

          const result = await response.json();

          if (result.success) {
            // /mcp/chat wraps RouterAgent response: result.data.data = RouterAgent data
            const inner = result.data?.data ?? result.data ?? {};
            const agentName = inner.agentExecuted || inner.targetAgent || null;
            this.logger.log(
              `✅ MCP: Agent responded - ${agentName || 'router-only'}`,
            );

            // Format response with agent info
            let text = '';

            if (agentName) {
              text += `🤖 **${agentName}**\n\n`;
            }

            if (inner.message) {
              text += inner.message;
            }

            // Plan info — always explicit, never implied
            if (inner.planId) {
              text += `\n\n📋 **Plan registrado en MCP**\n`;
              text += `ID: \`${inner.planId}\`\n`;
              text += `Agente: ${agentName || 'RouterAgent'}\n`;
            } else {
              text += `\n\n⚠️ **Sin plan registrado** — este mensaje no creó un mcp_plan. Llama agent_query con una tarea técnica específica para registrar el plan.`;
            }

            // Rules applied
            if (inner.relevantRules?.length > 0) {
              text += `\n\n📚 **Reglas aplicadas (${inner.relevantRules.length}):**\n`;
              inner.relevantRules.forEach((r: any, i: number) => {
                text += `\n${i + 1}. ${r.name} (${r.category})`;
              });
            }

            if (result.metadata?.executionTime) {
              text += `\n\n⏱️ ${result.metadata.executionTime}ms`;
            }

            return { content: [{ type: 'text' as const, text }] };
          } else {
            return {
              content: [
                { type: 'text' as const, text: `⚠️ Error: ${result.error}` },
              ],
              isError: true,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: agent_query failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `⚠️ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // chat_with_agents - MUST USE for any question or work request
    server.tool(
      'chat_with_agents',
      'MUST USE for ALL questions and work requests. Get help from specialized agents (PM, Code, Architecture, Analysis, GitHub). Automatically creates issues for any task. Alias for agent_query - prefer agent_query instead.',
      {
        message: z.string().describe('Your question or request'),
        context: z
          .any()
          .optional()
          .describe('Additional context (web info, project code, etc.)'),
        sessionId: z
          .string()
          .optional()
          .describe('Session ID for conversation continuity'),
      },
      async ({ message, context, sessionId }, extra) => {
        // Same implementation as agent_query
        const sid = sessionId || extra?.sessionId || 'unknown';

        this.logger.log(
          `🤖 MCP: chat_with_agents called - message="${message.substring(0, 100)}..."`,
        );

        try {
          const port = this.apiPort;
          const url = `http://localhost:${port}/mcp/chat`;

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              input: message,
              options: { context, sessionId: sid },
              sessionId: sid,
            }),
          });

          const result = await response.json();

          if (result.success) {
            let text = '';
            if (result.data?.targetAgent) {
              text += `🤖 **${result.data.targetAgent}** te ayuda:\n\n`;
            }
            if (result.data?.message) {
              text += result.data.message;
            }
            if (result.data?.routedBy && result.data?.targetAgent) {
              text += `\n\n---\n*Enrutado por: ${result.data.routedBy} → ${result.data.targetAgent}*`;
            }
            if (
              result.data?.relevantRules &&
              result.data.relevantRules.length > 0
            ) {
              text += `\n\n📋 **Reglas aplicadas:** ${result.data.relevantRules.length}\n`;
              result.data.relevantRules.forEach((r: any, i: number) => {
                text += `\n${i + 1}. ${r.name} (${r.category})`;
              });
            }
            return { content: [{ type: 'text' as const, text }] };
          } else {
            return {
              content: [
                { type: 'text' as const, text: `⚠️ Error: ${result.error}` },
              ],
              isError: true,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return {
            content: [{ type: 'text' as const, text: `⚠️ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // auto_apply_rules - MUST USE for code-related questions
    server.tool(
      'auto_apply_rules',
      'MUST USE for code-related questions. Searches and applies relevant code rules from the project. Provides context-aware responses with best practices. Always use this with agent_query for comprehensive answers.',
      {
        userQuery: z.string().describe("The user's question or request"),
        sessionId: z.string().optional().describe('Session ID for tracking'),
      },
      async ({ userQuery, sessionId }, extra) => {
        const currentSessionId = sessionId || extra?.sessionId || 'unknown';

        this.logger.log(
          `🤖 MCP: auto_apply_rules triggered - query="${userQuery.substring(0, 100)}..."`,
        );

        try {
          // Search for relevant rules
          const url = `http://localhost:${this.apiPort}/rules/search?q=${encodeURIComponent(userQuery)}&limit=5`;
          const response = await fetch(url);
          const data = await response.json();

          if (data.results && data.results.length > 0) {
            this.logger.log(
              `✅ MCP: Found ${data.results.length} relevant rules`,
            );
            const text = this.formatResponse('search', data);
            return { content: [{ type: 'text' as const, text }] };
          } else {
            this.logger.debug('ℹ️ MCP: No relevant rules found');
            return {
              content: [
                {
                  type: 'text' as const,
                  text: '🎓 **Según CodeMentor MCP**: No se encontraron reglas relevantes para esta consulta.',
                },
              ],
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: auto_apply_rules failed - ${msg}`);
          return {
            content: [
              {
                type: 'text' as const,
                text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // search_rules
    server.tool(
      'search_rules',
      'Searches code rules using BM25. Returns rules with prefix "🎓 According to CodeMentor MCP"',
      {
        query: z.string().describe('Search term'),
        category: z
          .string()
          .optional()
          .describe('Category (nestjs, angular, typescript)'),
        limit: z.number().default(5).describe('Maximum number of results'),
      },
      async ({ query, category, limit }, extra) => {
        // Get session info from request context
        const sessionId = extra?.sessionId || 'unknown';

        // Get user info from Redis (stored during session creation)
        const userId = await this.redisService.get<string>(
          `session:${sessionId}:userId`,
        );
        const ipAddress = await this.redisService.get<string>(
          `session:${sessionId}:ip`,
        );

        // Create session in DB on first tool use (meaningful interaction)
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId,
            userId,
            'search_rules',
            ipAddress ? `ip-${ipAddress}` : undefined,
            ipAddress || undefined,
          );
        }

        this.logger.log(
          `🔍 MCP: search_rules called - query="${query}", category=${category}, limit=${limit}`,
        );
        try {
          const url = `http://localhost:${this.apiPort}/rules/search?q=${encodeURIComponent(query)}${
            category ? `&category=${category}` : ''
          }&limit=${limit || 5}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('search', data);
          this.logger.log(
            `✅ MCP: search_rules completed - ${data.results?.length || 0} results`,
          );
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: search_rules failed - ${msg}`);
          return {
            content: [
              {
                type: 'text' as const,
                text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // get_rule
    server.tool(
      'get_rule',
      'Gets a rule by ID. Returns with prefix "🎓 According to CodeMentor MCP"',
      {
        id: z.string().describe('Rule ID'),
      },
      async ({ id }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';
        const userId = await this.redisService.get<string>(
          `session:${sessionId}:userId`,
        );
        const ipAddress = await this.redisService.get<string>(
          `session:${sessionId}:ip`,
        );

        // Create session in DB on first tool use
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId,
            userId,
            'get_rule',
            ipAddress ? `ip-${ipAddress}` : undefined,
            ipAddress || undefined,
          );
        }

        this.logger.log(`📖 MCP: get_rule called - id=${id}`);
        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/rules?id=${encodeURIComponent(id)}`,
          );
          const data = await response.json();
          const text = this.formatResponse('get', data);
          this.logger.log(`✅ MCP: get_rule completed`);
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: get_rule failed - ${msg}`);
          return {
            content: [
              {
                type: 'text' as const,
                text: `⚠️ 🎓 According to CodeMentor MCP: ${msg}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // list_rules
    server.tool(
      'list_rules',
      'Lista reglas disponibles. Devuelve con prefijo "🎓 Según CodeMentor MCP"',
      {
        category: z.string().optional().describe('Filtrar por categoría'),
        limit: z.number().default(50).describe('Número máximo'),
      },
      async ({ category, limit }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';
        const userId = await this.redisService.get<string>(
          `session:${sessionId}:userId`,
        );
        const ipAddress = await this.redisService.get<string>(
          `session:${sessionId}:ip`,
        );

        // Create session in DB on first tool use
        if (userId) {
          await this.getOrCreateSessionForToolUse(
            sessionId,
            userId,
            'list_rules',
            ipAddress ? `ip-${ipAddress}` : undefined,
            ipAddress || undefined,
          );
        }

        this.logger.log(
          `📋 MCP: list_rules llamado - category=${category}, limit=${limit}`,
        );
        try {
          const params = new URLSearchParams();
          if (category) params.set('category', category);
          params.set('limit', String(limit || 50));

          const url = `http://localhost:${this.apiPort}/rules?${params.toString()}`;
          const response = await fetch(url);
          const data = await response.json();
          const text = this.formatResponse('list', data);
          this.logger.log(
            `✅ MCP: list_rules completado - ${data.rules?.length || 0} reglas`,
          );
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: list_rules falló - ${msg}`);
          return {
            content: [
              {
                type: 'text' as const,
                text: `⚠️ 🎓 Según CodeMentor MCP: ${msg}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ============================================
    // GitHub Tools
    // ============================================

    // read_github_issue
    server.tool(
      'read_github_issue',
      'Lee un issue de GitHub. Puedes especificar el número (#123) o la URL completa.',
      {
        issueRef: z.string().describe('Número del issue (#123) o URL completa'),
        owner: z.string().optional().describe('Owner del repo (ej: owner)'),
        repo: z.string().optional().describe('Nombre del repo (ej: repo)'),
      },
      async ({ issueRef, owner, repo }, extra) => {
        this.logger.log(`🐙 MCP: read_github_issue - issueRef="${issueRef}"`);

        try {
          let resolvedOwner = owner;
          let resolvedRepo = repo;
          let issueNumber = issueRef;

          // Parse URL: https://github.com/owner/repo/issues/123
          const urlMatch = issueRef.match(
            /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
          );
          if (urlMatch) {
            resolvedOwner = urlMatch[1];
            resolvedRepo = urlMatch[2];
            issueNumber = urlMatch[3];
          } else {
            // Strip leading # if present
            issueNumber = issueRef.replace(/^#/, '');
          }

          const repoFlag =
            resolvedOwner && resolvedRepo
              ? `--repo ${resolvedOwner}/${resolvedRepo}`
              : '';

          const cmd = `gh issue view ${issueNumber} ${repoFlag} --json title,body,labels,assignees,state,comments`;
          const { stdout, stderr } = await execAsync(cmd);

          if (stderr) {
            this.logger.warn(`gh issue view stderr: ${stderr}`);
          }

          const text = stdout.trim() || 'Sin resultado';
          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // list_github_issues
    server.tool(
      'list_github_issues',
      'Lista los issues de un repositorio de GitHub.',
      {
        owner: z.string().optional().describe('Owner del repo'),
        repo: z.string().optional().describe('Nombre del repo'),
        state: z
          .enum(['open', 'closed', 'all'])
          .default('open')
          .describe('Estado de los issues'),
      },
      async ({ owner, repo, state }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';

        this.logger.log(
          `🐙 MCP: list_github_issues - owner=${owner}, repo=${repo}, state=${state}`,
        );

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: `Lista los issues ${state} de github.com/${owner || 'owner'}/${repo || 'repo'}`,
                options: { sessionId, githubOwner: owner, githubRepo: repo },
                sessionId,
              }),
            },
          );

          const result = await response.json();
          return {
            content: [
              { type: 'text' as const, text: result.data?.message || 'OK' },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // read_github_pr
    server.tool(
      'read_github_pr',
      'Lee un pull request de GitHub.',
      {
        prRef: z.string().describe('Número del PR (#123) o URL completa'),
        owner: z.string().optional().describe('Owner del repo'),
        repo: z.string().optional().describe('Nombre del repo'),
      },
      async ({ prRef, owner, repo }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';

        this.logger.log(`🐙 MCP: read_github_pr - prRef="${prRef}"`);

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: `Lee el PR ${prRef} de github.com/${owner || 'owner'}/${repo || 'repo'}`,
                options: { sessionId, githubOwner: owner, githubRepo: repo },
                sessionId,
              }),
            },
          );

          const result = await response.json();
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data?.message || 'PR obtenido',
              },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // analyze_github_repo
    server.tool(
      'analyze_github_repo',
      'Analiza un repositorio de GitHub y muestra estadísticas.',
      {
        owner: z.string().describe('Owner del repo'),
        repo: z.string().describe('Nombre del repo'),
      },
      async ({ owner, repo }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';

        this.logger.log(`🐙 MCP: analyze_github_repo - ${owner}/${repo}`);

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/chat`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                input: `Analiza el repo github.com/${owner}/${repo}`,
                options: { sessionId, githubOwner: owner, githubRepo: repo },
                sessionId,
              }),
            },
          );

          const result = await response.json();
          return {
            content: [
              {
                type: 'text' as const,
                text: result.data?.message || 'Análisis completado',
              },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // context7_docs - Fetch up-to-date library documentation
    server.tool(
      'context7_docs',
      'Fetches up-to-date, version-specific documentation and code examples for libraries using Context7. Use when user asks about library docs, API usage, or how to use a framework.',
      {
        library: z
          .string()
          .describe(
            'Library name or ID (e.g., "Next.js" or "/vercel/next.js")',
          ),
        query: z
          .string()
          .describe(
            'What you need help with (e.g., "middleware authentication", "setup")',
          ),
      },
      async ({ library, query }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';

        this.logger.log(
          `📚 MCP: context7_docs - library="${library}", query="${query}"`,
        );

        try {
          let result;

          // Check if library is a direct ID (starts with /)
          if (library.startsWith('/')) {
            result = await this.context7Adapter.getDocs(library, query);
          } else {
            result = await this.context7Adapter.searchDocs(library, query);
          }

          if (!result.success) {
            return {
              content: [
                { type: 'text' as const, text: `⚠️ ${result.documentation}` },
              ],
              isError: true,
            };
          }

          let text = `📚 **Documentation for** \`${result.libraryId}\` (${result.libraryName})\n\n`;
          text += `**Query**: ${query}\n\n`;
          text += `---\n\n`;
          text += result.documentation;

          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: context7_docs failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // register_project - Register current project with MCP system
    server.tool(
      'register_project',
      'Registers the current project with the MCP system. Detects framework, language, and creates/links project to the current session. ALWAYS call this when starting work on a new project. Use relatedProjects to declare cross-project relationships (gateway→portal, portal→controlserver, etc.).',
      {
        projectPath: z
          .string()
          .describe(
            'Absolute path to the project (e.g., /home/user/projects/my-app)',
          ),
        relatedProjects: z
          .array(
            z.object({
              projectPath: z
                .string()
                .optional()
                .describe('Absolute path of the related project'),
              projectId: z
                .string()
                .optional()
                .describe('ID of already-registered related project'),
              type: z
                .enum(['grpc_client', 'depends_on', 'calls', 'shared_db'])
                .optional()
                .describe('Relationship type (default: depends_on)'),
              description: z
                .string()
                .optional()
                .describe('Human-readable description of the relationship'),
            }),
          )
          .optional()
          .describe('Other projects this project depends on or calls'),
      },
      async ({ projectPath, relatedProjects }, extra) => {
        const sessionId = extra?.sessionId || 'unknown';

        this.logger.log(`📁 MCP: register_project - path="${projectPath}"`);

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/register-project`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectPath, sessionId, relatedProjects }),
            },
          );

          const result = await response.json();

          if (result.success) {
            let text = `✅ **Project Registered**\n\n`;
            text += `- **Name**: \`${result.project.name}\`\n`;
            text += `- **Framework**: ${result.project.framework}\n`;
            text += `- **Language**: ${result.project.language}\n`;
            text += `- **Path**: \`${result.project.path}\`\n`;
            text += `- **ID**: \`${result.project.id}\`\n`;

            if (result.linkedRelationships?.length) {
              text += `\n🔗 **Linked Projects** (${result.linkedRelationships.length}):\n`;
              for (const r of result.linkedRelationships) {
                text += `  - \`${r.name}\` via \`${r.type}\`\n`;
              }
            }

            return { content: [{ type: 'text' as const, text }] };
          } else {
            return {
              content: [{ type: 'text' as const, text: `⚠️ ${result.error}` }],
              isError: true,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: register_project failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // session_init_auto — auto-init al arrancar Claude Code
    server.tool(
      'session_init_auto',
      'Inicialización de sesión. Devuelve JSON con sessionId, projectId, catálogo de agentes, planes activos (activePlans) y resumen de trabajo pendiente (pendingWorkSummary). Si activePlans tiene contenido: presentarlo y esperar instrucción del usuario sin ejecutar más herramientas. Si activePlans está vacío: usar git log y git status para mostrar el estado actual del código. NUNCA llamar read_github_issue ni list_github_issues de forma autónoma.',
      {
        cwd: z
          .string()
          .describe(
            'Directorio de trabajo actual del agente (process.cwd()). Requerido.',
          ),
        clientId: z
          .string()
          .optional()
          .describe('Identificador único del cliente MCP'),
        userAgent: z
          .string()
          .optional()
          .describe('Nombre del cliente (ej: claude-code, qwen)'),
      },
      async ({ cwd, clientId, userAgent }, extra) => {
        this.logger.log(`🚀 MCP: session_init_auto - cwd="${cwd}"`);

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/session/init-auto`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cwd, clientId, userAgent }),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          // Persist sessionId for pre-write hook
          if (data.sessionId) {
            const fs = await import('fs/promises');
            await fs
              .writeFile('/tmp/.mcp-session', data.sessionId, 'utf-8')
              .catch(() => {});
          }

          // Devolver JSON estructurado para que el CLI pueda parsear
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify(data, null, 2) },
            ],
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: session_init_auto failed - ${msg}`);
          return {
            content: [
              {
                type: 'text' as const,
                text: `❌ Error en session_init_auto: ${msg}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // link_project_relation — vincula dos proyectos entre sí
    server.tool(
      'link_project_relation',
      'Vincula dos proyectos registrados en el MCP. Úsalo cuando el usuario mencione que un proyecto depende de otro o se integra con él (frontend/backend, microservicios, etc.). Registra la relación en BD y la incluye en el contexto de sesiones futuras.',
      {
        sourceProjectPath: z
          .string()
          .describe('Path local del proyecto fuente (el actual)'),
        targetProjectPath: z
          .string()
          .describe('Path local del proyecto relacionado'),
        type: z
          .enum(['depends_on', 'calls', 'grpc_client', 'shared_db'])
          .optional()
          .describe('Tipo de relación'),
        description: z
          .string()
          .optional()
          .describe('Descripción de la relación'),
      },
      async ({ sourceProjectPath, targetProjectPath, type, description }) => {
        try {
          const port = this.apiPort;
          const response = await fetch(
            `http://localhost:${port}/mcp/projects/link`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceProjectPath,
                targetProjectPath,
                type,
                description,
              }),
            },
          );
          const data = await response.json();
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(data) }],
          };
        } catch (error) {
          return {
            content: [
              { type: 'text' as const, text: `❌ Error: ${error.message}` },
            ],
            isError: true,
          };
        }
      },
    );

    // register_plan — crea un plan de trabajo en BD explícitamente
    server.tool(
      'register_plan',
      'Crea un plan de trabajo en la base de datos explícitamente. Útil para registrar intenciones de trabajo, tareas técnicas o issues que se van a implementar. Similar al flujo de agent_query pero sin ejecutar agentes. Requiere al menos title y projectPath o sessionId.',
      {
        title: z.string().describe('Título descriptivo del plan (obligatorio)'),
        summary: z.string().optional().describe('Resumen detallado del plan'),
        projectPath: z
          .string()
          .optional()
          .describe('Path al proyecto (opcional si se da sessionId)'),
        sessionId: z
          .string()
          .optional()
          .describe('ID de sesión MCP (opcional si se da projectPath)'),
        intention: z
          .string()
          .optional()
          .describe(
            'Intención detectada (code, analysis, pm, architecture, etc.)',
          ),
        agentId: z.string().optional().describe('Agente responsable del plan'),
      },
      async (
        { title, summary, projectPath, sessionId, intention, agentId },
        extra,
      ) => {
        const sid = sessionId || extra?.sessionId || 'unknown';
        this.logger.log(
          `📋 MCP: register_plan - title="${title.substring(0, 80)}"`,
        );

        try {
          const body: Record<string, any> = { title };
          if (summary) body.summary = summary;
          if (projectPath) body.projectPath = projectPath;
          if (sid) body.sessionId = sid;
          if (intention) body.intention = intention;
          if (agentId) body.agentId = agentId;

          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/plans/create`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const planData = await response.json();
          if (!planData.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `⚠️ No se pudo crear el plan: ${planData.error || 'error desconocido'}`,
                },
              ],
              isError: true,
            };
          }

          let text = `📋 **Plan registrado exitosamente**\n\n`;
          text += `**ID**: \`${planData.data.id}\`\n`;
          text += `**Título**: ${planData.data.title}\n`;
          text += `**Estado**: ${planData.data.status}\n\n`;
          text += `El plan ha sido guardado en la base de datos. Puedes consultarlo con \`list_plans\`.`;

          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: register_plan failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // close_plan — cierra (completa o abandona) un plan
    server.tool(
      'close_plan',
      'Cierra un plan marcándolo como completado o abandonado. Requiere planId y action (complete|abandon).',
      {
        planId: z.string().describe('ID del plan a cerrar'),
        action: z
          .enum(['complete', 'abandon'])
          .describe('Acción: complete para marcar como completado, abandon para abandonar'),
        reason: z.string().optional().describe('Razón opcional del cierre'),
      },
      async ({ planId, action, reason }) => {
        this.logger.log(
          `📋 MCP: close_plan - planId="${planId}", action="${action}"`,
        );

        try {
          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/plans/close`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ planId, action, reason }),
            },
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          if (!data.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `⚠️ No se pudo cerrar el plan: ${data.error || 'error desconocido'}`,
                },
              ],
              isError: true,
            };
          }

          const emoji = action === 'complete' ? '✅' : '🚫';
          let text = `${emoji} **Plan ${action === 'complete' ? 'completado' : 'abandonado'}**\n\n`;
          text += `**ID**: \`${data.data.planId}\`\n`;
          text += `**Estado**: ${data.data.status}\n`;
          if (reason) text += `**Razón**: ${reason}\n`;

          return { content: [{ type: 'text' as const, text }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: close_plan failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    // list_plans — consulta planes activos
    server.tool(
      'list_plans',
      'Lista los planes activos para una sesión o proyecto. Si se da sessionId, devuelve el plan activo. Si se da projectId, devuelve todos los planes.',
      {
        sessionId: z.string().optional().describe('ID de sesión'),
        projectId: z.string().optional().describe('ID de proyecto'),
        status: z
          .string()
          .optional()
          .describe(
            'Filtrar por estado (open, in_progress, completed, abandoned)',
          ),
      },
      async ({ sessionId, projectId, status }) => {
        this.logger.log(
          `📋 MCP: list_plans - sessionId="${sessionId || '-'}" projectId="${projectId || '-'}"`,
        );

        try {
          const qs = new URLSearchParams();
          if (sessionId) qs.set('sessionId', sessionId);
          if (projectId) qs.set('projectId', projectId);
          if (status) qs.set('status', status);

          const response = await fetch(
            `http://localhost:${this.apiPort}/mcp/plans?${qs.toString()}`,
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const plansData = await response.json();
          const plans: any[] = plansData.data || [];

          if (plans.length === 0) {
            const noPlansMsg =
              'No hay planes registrados para los criterios especificados.';
            return { content: [{ type: 'text' as const, text: noPlansMsg }] };
          }

          let text = `📋 **Planes encontrados** (${plans.length}):\n\n`;
          plans.forEach((p: any, i: number) => {
            const planInfo = p.plan || {};
            text += `${i + 1}. **${p.title}**\n`;
            text += `   ID: \`${p.id}\` | Estado: ${p.status}\n`;
            text += `   Agente: ${p.agentId || '-'} | Sesión: ${p.sessionId || '-'}\n`;
            if (planInfo.detectedIntention) {
              text += `   Intención: ${planInfo.detectedIntention}\n`;
            }
            text += `   Creado: ${new Date(p.createdAt).toLocaleString()}\n\n`;
          });

          return { content: [{ type: 'text' as const, text: text.trim() }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Error';
          this.logger.error(`❌ MCP: list_plans failed - ${msg}`);
          return {
            content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    this.logger.log('✅ MCP: Todas las herramientas registradas');
  }

  private formatResponse(type: 'search' | 'get' | 'list', data: any): string {
    const prefix = '🎓 **Según CodeMentor MCP**';

    if (type === 'search') {
      if (!data.results || data.results.length === 0) {
        return `${prefix}: No encontré reglas relacionadas con tu búsqueda.`;
      }
      let response = `${prefix}: Encontré ${data.results.length} regla(s):\n\n`;
      data.results.forEach((r: any, i: number) => {
        response += `### ${i + 1}. ${r.rule.name}\n`;
        response += `**Categoría:** ${r.rule.category} | **Impacto:** ${r.rule.impact}${r.rule.impactDescription ? ` (${r.rule.impactDescription})` : ''} | **Relevancia:** ${(r.score * 100).toFixed(1)}%\n`;
        response += `**Tags:** ${r.rule.tags?.join(', ') || 'N/A'}\n\n`;
        response += `${r.rule.content.substring(0, 400)}${r.rule.content.length > 400 ? '...' : ''}\n\n---\n\n`;
      });
      return response.trim();
    }

    if (type === 'get') {
      if (!data.rule) return `${prefix}: No encontré regla con ese ID.`;
      let response = `${prefix}:\n\n# ${data.rule.name}\n\n`;
      if (data.rule.impactDescription) {
        response += `**Impacto:** ${data.rule.impact} - ${data.rule.impactDescription}\n\n`;
      }
      response += data.rule.content;
      return response;
    }

    if (type === 'list') {
      if (!data.rules || data.rules.length === 0) {
        return `${prefix}: No hay reglas disponibles.`;
      }
      let response = `${prefix}: ${data.rules.length} regla(s) disponible(s):\n\n`;
      const grouped = data.rules.reduce((acc: any, r: any) => {
        if (!acc[r.category]) acc[r.category] = [];
        acc[r.category].push(r);
        return acc;
      }, {});
      for (const [cat, rules] of Object.entries(grouped)) {
        response += `## 📁 ${cat.toUpperCase()}\n`;
        (rules as any[]).forEach((r, i) => {
          const impactInfo = r.impactDescription ? ` - ${r.impact}` : '';
          response += `${i + 1}. **${r.name}** (\`${r.id}\`)${impactInfo}\n`;
        });
        response += '\n';
      }
      return response.trim();
    }

    return `${prefix}: ${JSON.stringify(data, null, 2)}`;
  }

  /**
   * Detects framework from package.json
   */
  private detectFramework(packageJson: any): string {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps['@angular/core']) return 'angular';
    if (deps['@nestjs/common'] || deps['@nestjs/core']) return 'nestjs';
    if (deps['react']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['express']) return 'node-express';
    if (deps['fastify']) return 'node-fastify';
    if (deps['next']) return 'nextjs';
    if (deps['nuxt']) return 'nuxtjs';

    return 'node';
  }

  /**
   * Detects primary language from package.json
   */
  private detectLanguage(packageJson: any): string {
    if (
      packageJson.dependencies?.['@angular/core'] ||
      packageJson.dependencies?.['@nestjs/common']
    ) {
      return 'TypeScript';
    }

    const hasTs =
      packageJson.dependencies?.['typescript'] ||
      packageJson.devDependencies?.['typescript'];
    if (hasTs) return 'TypeScript';

    return 'JavaScript';
  }
}
