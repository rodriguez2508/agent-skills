import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { IssueService } from '../../application/services/issue.service';
import {
  CreateIssueDto,
  AddInteractionDto,
  AddKeyDecisionDto,
  AddFileModificationDto,
  UpdateProjectSnapshotDto,
} from '../dto/issue.dto';
import { UsersService } from '@modules/users/application/services/users.service';

/**
 * Controller para gestión de issues con contexto
 *
 * Endpoints:
 * - POST /issues: Crear issue
 * - GET /issues/:id: Obtener issue con contexto
 * - POST /issues/:id/interactions: Añadir interacción
 * - POST /issues/:id/decisions: Añadir decisión clave
 * - POST /issues/:id/files: Añadir modificación de archivos
 * - PATCH /issues/:id/snapshot: Actualizar snapshot del proyecto
 * - GET /issues/:id/history: Obtener historial de interacciones
 */
@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issueService: IssueService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Crea un nuevo issue con contexto opcional
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createIssue(@Body() dto: CreateIssueDto, @Req() req: Request) {
    // Obtener IP para identificar usuario si no se proporciona userId
    const ipAddress = (req as any).ipAddress || '127.0.0.1';

    let userId = dto.userId;
    if (!userId) {
      const user = await this.usersService.findByIpOrCreate(ipAddress);
      userId = user.id;
    }

    const issue = await this.issueService.createIssue({
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      userId,
      sessionId: dto.sessionId,
      projectId: dto.projectId,
      context: dto.context,
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: {
        issue,
      },
    };
  }

  /**
   * Obtiene issue por ID con contexto completo
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getIssue(@Param('id') id: string) {
    const issue = await this.issueService.getIssueById(id);

    if (!issue) {
      return {
        success: false,
        error: 'Issue not found',
      };
    }

    return {
      success: true,
      data: {
        issue,
      },
    };
  }

  /**
   * Añade interacción al contexto del issue
   */
  @Post(':id/interactions')
  @HttpCode(HttpStatus.OK)
  async addInteraction(
    @Param('id') id: string,
    @Body() dto: AddInteractionDto,
  ) {
    const result = await this.issueService.addInteraction(id, {
      role: dto.role,
      content: dto.content,
      agentId: dto.agentId,
      metadata: dto.metadata,
    });

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Añade decisión clave al contexto del issue
   */
  @Post(':id/decisions')
  @HttpCode(HttpStatus.OK)
  async addKeyDecision(
    @Param('id') id: string,
    @Body() dto: AddKeyDecisionDto,
  ) {
    const result = await this.issueService.addKeyDecision(id, {
      decision: dto.decision,
      rationale: dto.rationale,
      alternatives: dto.alternatives,
      agentId: dto.agentId,
    });

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Añade modificación de archivos al contexto del issue
   */
  @Post(':id/files')
  @HttpCode(HttpStatus.OK)
  async addFileModifications(
    @Param('id') id: string,
    @Body() dto: { files: AddFileModificationDto[] },
  ) {
    const result = await this.issueService.addFileModifications(
      id,
      dto.files.map((f) => ({
        path: f.path,
        action: f.action,
        linesAdded: f.linesAdded,
        linesRemoved: f.linesRemoved,
        diff: f.diff,
      })),
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Actualiza snapshot del proyecto en el contexto del issue
   */
  @Patch(':id/snapshot')
  @HttpCode(HttpStatus.OK)
  async updateProjectSnapshot(
    @Param('id') id: string,
    @Body() dto: UpdateProjectSnapshotDto,
  ) {
    const result = await this.issueService.updateProjectSnapshot(id, {
      name: dto.name,
      version: dto.version,
      dependencies: dto.dependencies,
      detectedFramework: dto.detectedFramework as any,
      detectedArchitecture: dto.detectedArchitecture as any,
      language: dto.language as any,
    });

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Obtiene historial de interacciones del issue
   */
  @Get(':id/history')
  @HttpCode(HttpStatus.OK)
  async getInteractionHistory(@Param('id') id: string) {
    const history = await this.issueService.getInteractionHistory(id);

    return {
      success: true,
      data: {
        history,
        total: history.length,
      },
    };
  }
}
