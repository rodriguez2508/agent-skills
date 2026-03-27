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
  ) {
    this.apiPort = this.configService.get<number>('PORT', 8004);
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

    // Connect server to transport
    await server.connect(transport);

    // Transport generates its own sessionId
    const transportSessionId = transport.sessionId;
    const session: McpSession = { server, transport };
    this.sessions.set(transportSessionId, session);

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
    try {
      if (existingSessionId) {
        // Update existing session with new transport info
        const existingSession =
          await this.sessionRepository.findBySessionId(existingSessionId);
        await this.sessionRepository.getRepository().update(
          { sessionId: existingSessionId },
          {
            status: SessionStatus.ACTIVE,
            lastActivityAt: new Date(),
            metadata: {
              ...(existingSession?.metadata || {}),
              clientId,
              clientIp: ipAddress,
              lastConnectedAt: new Date().toISOString(),
            } as any,
          },
        );
        this.logger.log(`✅ REACTIVATED session: ${existingSessionId}`);
      } else {
        // Create new session
        await this.sessionRepository.create({
          sessionId: transportSessionId,
          userId,
          title: `MCP Session - ${ipAddress}`,
          metadata: {
            type: 'mcp',
            clientId,
            clientIp: ipAddress,
            createdAt: new Date().toISOString(),
          },
        });
        this.logger.log(
          `💾 NEW session created in PostgreSQL: ${transportSessionId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error creating/updating session in DB: ${error.message}`,
      );
    }

    // STEP 4: Store user info in Redis for fast lookups
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

      // AUTO-CREATE ISSUE on first user message
      let issueId: string | null = null;
      if (role === MessageRole.USER && userId) {
        issueId = await this.getOrCreateIssueForSession(
          sessionId,
          userId,
          content,
        );
      }

      await this.sessionRepository.addMessage({
        sessionId,
        role,
        content,
        issueId: issueId || metadata?.issueId || null,
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
   * Automatically creates or gets an issue for the current session
   * Called on first user message to track conversation context
   */
  async getOrCreateIssueForSession(
    sessionId: string,
    userId: string,
    userMessage: string,
  ): Promise<string | null> {
    try {
      // Check if session already has an issue linked
      const session = await this.sessionRepository.findBySessionId(sessionId);

      if (session?.issueId) {
        this.logger.debug(`♻️ Session already has issue: ${session.issueId}`);
        return session.issueId;
      }

      // Check Redis for cached issueId
      const cachedIssueId = await this.redisService.get<string>(
        `session:${sessionId}:issueId`,
      );
      if (cachedIssueId) {
        this.logger.debug(`♻️ Issue found in Redis: ${cachedIssueId}`);
        return cachedIssueId;
      }

      // Generate issue title from user message (first 100 chars)
      const title =
        userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : '');

      // Create new issue automatically
      const issue = await this.issueService.createIssue({
        title,
        description: `Auto-created from MCP conversation. Initial message: "${userMessage.substring(0, 200)}"`,
        userId,
        sessionId,
        metadata: {
          autoCreated: true,
          source: 'mcp-conversation',
          createdAt: new Date().toISOString(),
          initialMessage: userMessage,
        },
      });

      // Link issue to session
      if (session) {
        await this.sessionRepository
          .getRepository()
          .update({ sessionId }, { issueId: issue.id });
        this.logger.log(
          `🔗 Issue linked to session: ${issue.issueId} -> ${sessionId}`,
        );
      }

      // Cache in Redis
      await this.redisService.set(
        `session:${sessionId}:issueId`,
        issue.id,
        3600,
      );
      await this.redisService.set(
        `issue:${issue.id}:sessionId`,
        sessionId,
        3600,
      );

      this.logger.log(
        `✅ Issue auto-created for conversation: ${issue.issueId} (${title})`,
      );

      return issue.id;
    } catch (error) {
      this.logger.error(`Error creating/Getting issue: ${error.message}`);
      return null;
    }
  }

  private registerTools(server: McpServer) {
    this.logger.log('🔧 MCP: Registering tools...');

    // agent_query - MAIN TOOL! Routes to specialized agents (PM, Code, Architecture, etc.)
    server.tool(
      'agent_query',
      'Main chat tool - Routes your message to a specialized agent (PM, Code, Architecture, Analysis, etc.). Use this for ALL questions and requests. Automatically creates issues when working on tasks.',
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
        const sid = sessionId || extra?.sessionId || 'unknown';

        this.logger.log(
          `💬 MCP: agent_query called - message="${message.substring(0, 100)}..."`,
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
              options: { context, sessionId: sid },
              sessionId: sid,
            }),
          });

          const result = await response.json();

          if (result.success) {
            this.logger.log(
              `✅ MCP: Agent responded - ${result.data?.targetAgent || 'unknown'}`,
            );

            // Format response with agent info
            let text = '';

            if (result.data?.targetAgent) {
              text += `🤖 **${result.data.targetAgent}** te ayuda:\n\n`;
            }

            if (result.data?.message) {
              text += result.data.message;
            }

            // Add routed agent info
            if (result.data?.routedBy && result.data?.targetAgent) {
              text += `\n\n---\n*Enrutado por: ${result.data.routedBy} → ${result.data.targetAgent}*`;
            }

            // Add issue info if created
            if (result.data?.issue) {
              const issue = result.data.issue;
              text += `\n\n📋 **Issue creado:** ${issue.title || issue.id || 'N/A'}\n`;
              if (issue.id) text += `ID: ${issue.id}\n`;
            }

            // Add relevant rules if any
            if (
              result.data?.relevantRules &&
              result.data.relevantRules.length > 0
            ) {
              text += `\n\n📚 **Reglas aplicadas:** ${result.data.relevantRules.length}\n`;
              result.data.relevantRules.forEach((r: any, i: number) => {
                text += `\n${i + 1}. ${r.name} (${r.category})`;
              });
            }

            // Add metadata
            if (result.metadata?.executionTime) {
              text += `\n\n⏱️ Tiempo: ${result.metadata.executionTime}ms`;
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

    // chat_with_agents - Alias for agent_query (for backward compatibility)
    server.tool(
      'chat_with_agents',
      'Ask a question and get help from a specialized agent (PM, Code, Architecture, etc.). This is an alias for agent_query.',
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

    // auto_apply_rules - Automatically searches and applies relevant rules to user queries
    server.tool(
      'auto_apply_rules',
      'Automatically searches and applies relevant code rules to the user query. This tool should be called on every user message to provide context-aware responses.',
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
}
