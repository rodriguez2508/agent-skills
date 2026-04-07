import {
  Controller,
  Post,
  Body,
  Logger,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RouterAgent } from '@agents/router/router.agent';
import { McpService } from '@infrastructure/adapters/mcp/mcp.service';
import { SessionRepository } from '@modules/sessions/infrastructure/persistence/session.repository';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { MessageRole } from '@modules/sessions/domain/entities/chat-message.entity';

/**
 * DTO para solicitudes del subagente task
 */
class TaskDelegateDto {
  input: string;
  sessionId?: string;
  userId?: string;
  projectPath?: string;
  options?: Record<string, any>;
}

/**
 * TaskBridgeController
 *
 * Endpoint especial para que el subagente `general-purpose` delegue análisis a MCP.
 */
@ApiTags('Task Bridge')
@Controller('api/task')
export class TaskBridgeController {
  private readonly logger = new Logger(TaskBridgeController.name);

  constructor(
    private readonly routerAgent: RouterAgent,
    private readonly mcpService: McpService,
    private readonly sessionRepository: SessionRepository,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  @Post('delegate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delegar análisis del subagente task a agentes MCP especializados',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'La consulta o solicitud del usuario',
        },
        sessionId: {
          type: 'string',
          description: 'ID de sesión (opcional)',
        },
        userId: {
          type: 'string',
          description: 'ID de usuario (opcional)',
        },
        projectPath: {
          type: 'string',
          description: 'Path al proyecto (opcional)',
        },
        options: {
          type: 'object',
          description: 'Opciones adicionales',
        },
      },
      required: ['input'],
    },
  })
  async delegateTask(
    @Body() dto: TaskDelegateDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();
    const clientIp =
      req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    this.logger.log(
      `📨 [TASK-BRIDGE] Solicitud recibida | input="${dto.input.substring(0, 100)}..." | sessionId=${dto.sessionId || 'new'} | clientIp=${clientIp}`,
    );

    try {
      // STEP 1: Resolve or create session
      const sessionId =
        dto.sessionId || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      let session = await this.sessionRepository.findBySessionId(sessionId);

      if (!session) {
        // STEP 2: Resolve or create user
        let userId = dto.userId;
        if (!userId) {
          const { user } = await this.userRepository.findByIpOrCreate({
            ipAddress: clientIp,
          });
          userId = user.id;
        }

        // Create session
        const sessionEntity = await this.sessionRepository.create({
          sessionId,
          userId,
          metadata: {
            source: 'task-bridge',
            clientIp,
            createdAt: new Date().toISOString(),
          },
        });

        session = sessionEntity;
        this.logger.log(`📄 [TASK-BRIDGE] Session created: ${sessionId}`);
      }

      // STEP 3: Process user message (detect project, create if needed)
      const projectResult = await this.mcpService.processUserMessage(
        sessionId,
        session!.userId!,
        dto.input,
      );

      this.logger.log(
        `🔧 [TASK-BRIDGE] Project detected: ${projectResult.projectId || 'none'} | Issue: ${projectResult.issueId || 'none'}`,
      );

      // STEP 4: Prepare request for RouterAgent
      const routerRequest = {
        input: dto.input,
        options: {
          ...dto.options,
          sessionId,
          userId: session!.userId,
          projectPath: dto.projectPath || projectResult.projectId,
          projectId: projectResult.projectId,
          issueId: projectResult.issueId,
          source: 'task-bridge',
        },
      };

      // STEP 5: Execute RouterAgent
      this.logger.log(
        `🔄 [TASK-BRIDGE] Executing RouterAgent | intention=auto-detect`,
      );

      const routerResponse = await this.routerAgent.execute(routerRequest);

      // STEP 6: Save response to session
      if (routerResponse.data?.message) {
        await this.mcpService.saveChatMessage(
          sessionId,
          MessageRole.ASSISTANT,
          routerResponse.data.message,
          {
            agentId: routerResponse.metadata?.agentId,
            executionTime: routerResponse.metadata?.executionTime,
            source: 'task-bridge',
          },
        );
      }

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `✅ [TASK-BRIDGE] Respuesta enviada | executionTime=${executionTime}ms | success=${routerResponse.success}`,
      );

      // STEP 7: Return response
      res.json({
        success: routerResponse.success,
        data: {
          ...routerResponse.data,
          sessionId,
          projectId: projectResult.projectId,
          issueId: projectResult.issueId,
          executionTime,
        },
        metadata: {
          ...routerResponse.metadata,
          source: 'task-bridge',
          sessionId,
          projectId: projectResult.projectId,
          issueId: projectResult.issueId,
        },
        error: routerResponse.error,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const executionTime = Date.now() - startTime;

      this.logger.error(
        `❌ [TASK-BRIDGE] Error: ${errorMessage}`,
        error.stack,
      );

      res.status(500).json({
        success: false,
        error: errorMessage,
        metadata: {
          source: 'task-bridge',
          executionTime,
        },
      });
    }
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Endpoint simplificado para análisis de proyectos',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'La consulta del usuario',
        },
        projectPath: {
          type: 'string',
          description: 'Path absoluto al proyecto (opcional)',
        },
      },
      required: ['input'],
    },
  })
  async analyzeProject(
    @Body() dto: { input: string; projectPath?: string },
    @Req() req: Request,
  ) {
    const sessionId = `analyze-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.logger.log(
      `📊 [ANALYZE] Análisis solicitado | input="${dto.input.substring(0, 100)}..." | projectPath=${dto.projectPath || 'auto'}`,
    );

    // Delegate to the main delegate endpoint
    const mockRes = {
      json: (data: any) => data,
      status: () => mockRes,
    } as unknown as Response;

    return this.delegateTask(
      {
        input: dto.input,
        sessionId,
        projectPath: dto.projectPath,
      },
      req,
      mockRes,
    );
  }
}
