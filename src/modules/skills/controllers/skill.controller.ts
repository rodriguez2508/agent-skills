import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkillFileService } from '../services/skill-file.service';
import { SkillPatch } from '../interfaces/skill-file.interface';

@ApiTags('skills')
@Controller('skills')
export class SkillController {
  private readonly logger = new Logger(SkillController.name);

  constructor(private readonly skillFileService: SkillFileService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos los skills disponibles (progressive disclosure)' })
  async listSkills() {
    const skills = await this.skillFileService.listSkills();
    return { success: true, count: skills.length, skills };
  }

  @Get('search')
  @ApiOperation({ summary: 'Busca skills por relevancia (keywords)' })
  async searchSkills(@Query('q') query: string, @Query('limit') limit?: number) {
    if (!query) return { success: false, error: 'query is required' };
    const results = await this.skillFileService.searchSkills(query, limit || 5);
    return { success: true, count: results.length, results };
  }

  @Get('relevant')
  @ApiOperation({ summary: 'Obtiene skills relevantes para una tarea (auto-inyección)' })
  async getRelevantSkills(@Query('task') task: string, @Query('limit') limit?: number) {
    if (!task) return { success: false, error: 'task is required' };
    const docs = await this.skillFileService.getRelevantSkills(task, limit || 3);
    return {
      success: true,
      count: docs.length,
      skills: docs.map((d) => ({
        name: d.metadata.name,
        description: d.metadata.description,
        tags: d.metadata.tags,
        version: d.metadata.version,
        usageCount: d.metadata.usageCount,
        body: d.body,
      })),
    };
  }

  @Get(':name')
  @ApiOperation({ summary: 'Obtiene un skill completo por nombre' })
  async getSkill(@Param('name') name: string) {
    const doc = await this.skillFileService.getSkill(name);
    if (!doc) return { success: false, error: `Skill '${name}' not found` };
    return { success: true, skill: doc.metadata, body: doc.body };
  }

  @Post('create')
  @ApiOperation({ summary: 'Crea un nuevo skill' })
  async createSkill(
    @Body()
    body: {
      name: string;
      description: string;
      content: string;
      tags?: string[];
      agents?: string[];
      overwrite?: boolean;
    },
  ) {
    const { name, description, content, tags, agents, overwrite } = body;
    if (!name || !description || !content) {
      return { success: false, error: 'name, description, and content are required' };
    }
    const doc = await this.skillFileService.createSkill(name, description, content, tags, agents, overwrite);
    return {
      success: true,
      skill: { name: doc.metadata.name, version: doc.metadata.version },
    };
  }

  @Post(':name/patch')
  @ApiOperation({ summary: 'Parchea un skill existente (secciones, tags, descripción)' })
  async patchSkill(@Param('name') name: string, @Body() patch: SkillPatch) {
    const doc = await this.skillFileService.patchSkill(name, patch);
    if (!doc) return { success: false, error: `Skill '${name}' not found` };
    return {
      success: true,
      skill: { name: doc.metadata.name, version: doc.metadata.version },
    };
  }

  @Post(':name/use')
  @ApiOperation({ summary: 'Registra un uso del skill (incrementa contador)' })
  async recordUsage(@Param('name') name: string) {
    await this.skillFileService.recordUsage(name);
    return { success: true };
  }

  @Post(':name/delete')
  @ApiOperation({ summary: 'Elimina un skill' })
  async deleteSkill(@Param('name') name: string) {
    const deleted = await this.skillFileService.deleteSkill(name);
    return { success: deleted };
  }
}
