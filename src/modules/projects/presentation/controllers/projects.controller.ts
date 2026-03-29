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
  Optional,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectsService } from '../../application/services/projects.service';
import { UsersService } from '@modules/users/application/services/users.service';
import { AutoDetectProjectDto, CreateProjectDto } from '../dto/project.dto';

/**
 * Controller para gestión de proyectos
 * 
 * Endpoints:
 * - POST /projects/auto-detect: Auto-detectar proyecto desde package.json
 * - GET /projects: Listar proyectos del usuario
 * - POST /projects: Crear proyecto manualmente
 * - GET /projects/:id: Obtener proyecto por ID
 */
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Auto-detecta proyecto desde package.json
   * 
   * Extrae IP del request para identificar usuario automáticamente
   * Crea usuario si no existe
   * Crea proyecto si no existe
   * 
   * @param body - DTO con path al proyecto
   * @param req - Request para extraer IP
   * @returns Proyecto detectado/creado
   */
  @Post('auto-detect')
  @HttpCode(HttpStatus.OK)
  async autoDetectProject(
    @Body() body: AutoDetectProjectDto,
    @Req() req: Request,
  ) {
    // Extraer IP del request (viene del middleware ExtractIpMiddleware)
    const ipAddress = (req as any).ipAddress || '127.0.0.1';
    
    // Obtener o crear usuario por IP
    const user = await this.usersService.findByIpOrCreate(ipAddress);

    // Detectar proyecto desde path
    const detection = await this.projectsService.detectFromPath(body.projectPath);

    if (!detection) {
      return {
        success: false,
        error: 'No se pudo detectar el proyecto. Verifica que exista package.json',
        ipAddress,
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
          createdAt: project.createdAt,
        },
        detection,
        userId: user.id,
        ipAddress,
      },
    };
  }

  /**
   * Lista todos los proyectos del usuario autenticado
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getUserProjects(@Req() req: Request) {
    const ipAddress = (req as any).ipAddress || '127.0.0.1';
    const user = await this.usersService.findByIpOrCreate(ipAddress);
    
    const projects = await this.projectsService.findByUser(user.id);
    
    return {
      success: true,
      data: {
        projects,
        total: projects.length,
      },
    };
  }

  /**
   * Crea un proyecto manualmente
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @Body() dto: CreateProjectDto,
    @Req() req: Request,
  ) {
    const ipAddress = (req as any).ipAddress || '127.0.0.1';
    const user = await this.usersService.findByIpOrCreate(ipAddress);
    
    const project = await this.projectsService.findOrCreateForUser(
      user.id,
      dto.name,
    );
    
    return {
      success: true,
      data: {
        project,
      },
    };
  }

  /**
   * Obtiene proyecto por ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProject(@Param('id') id: string) {
    const project = await this.projectsService.findById(id);
    
    if (!project) {
      return {
        success: false,
        error: 'Proyecto no encontrado',
      };
    }
    
    return {
      success: true,
      data: {
        project,
      },
    };
  }
}
