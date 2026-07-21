import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { User } from '@modules/auth/decorators/user.decorator';
import { ProjectsService } from '../../application/services/projects.service';
import { AutoDetectProjectDto } from '../dto/project.dto';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('auto-detect')
  @HttpCode(HttpStatus.OK)
  async autoDetectProject(
    @Body() body: AutoDetectProjectDto,
    @Req() req: Request,
    @User('id') userId: string,
  ) {
    const detection = await this.projectsService.detectFromPath(body.projectPath);
    const project = await this.projectsService.findOrCreateForUser(
      userId,
      detection?.name ?? body.projectPath.split('/').pop() ?? 'unknown',
      body.projectPath,
    );

    return {
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          metadata: project.metadata,
          createdAt: project.createdAt,
        },
        detection,
      },
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserProjects(@User('id') userId: string) {
    const projects = await this.projectsService.findByUser(userId);

    return {
      success: true,
      data: {
        projects,
        total: projects.length,
      },
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProject(
    @Param('id') id: string,
    @User('id') userId: string,
  ) {
    const project = await this.projectsService.findById(id);

    if (!project || (project.userId && project.userId !== userId)) {
      return {
        success: false,
        error: 'Proyecto no encontrado',
      };
    }

    return {
      success: true,
      data: { project },
    };
  }
}
