/**
 * Agencies Controller (REST + CQRS)
 *
 * Provides HTTP endpoints for agency management.
 * All business logic is delegated to CQRS commands and queries.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

// Auth
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { User } from '@modules/auth/decorators/user.decorator';

// Commands
import { CreateAgencyCommand } from '@modules/agencies/application/commands/create-agency/create-agency.command';
import { CreateAgencyResult } from '@modules/agencies/application/commands/create-agency/create-agency.handler';
import { PublishTemplateCommand } from '@modules/agencies/application/commands/publish-template/publish-template.command';
import { InstallTemplateCommand } from '@modules/agencies/application/commands/install-template/install-template.command';

// Queries
import { GetAgencyQuery } from '@modules/agencies/application/queries/get-agency/get-agency.query';
import { GetAgencyResult } from '@modules/agencies/application/queries/get-agency/get-agency.handler';
import { SearchTemplatesQuery } from '@modules/agencies/application/queries/search-templates/search-templates.query';
import { SearchTemplatesResult } from '@modules/agencies/application/queries/search-templates/search-templates.handler';

// DTOs
import {
  CreateAgencyRequestDto,
  UpdateAgencyRequestDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  PublishTemplateRequestDto,
  AddMemberRequestDto,
  AgencyDetailResponseDto,
  AgencyResponseDto,
  AgencyTemplateDto,
  toAgencyResponse,
  toAgencyDetailResponse,
  toTemplateDto,
} from '../dto/agency.dto';

// Repository for direct queries (query-only, no service layer)
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';

@Controller('agencies')
export class AgenciesController {
  private readonly logger = new Logger(AgenciesController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly agencyRepository: IAgencyRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // ───────────────────────────────
  //  Agency CRUD
  // ───────────────────────────────

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createAgency(
    @Body() body: CreateAgencyRequestDto,
    @User('id') userId: string,
  ): Promise<AgencyResponseDto> {
    this.logger.log(`POST /agencies — Creating agency: ${body.name} by user ${userId}`);

    const result = await this.commandBus.execute<
      CreateAgencyCommand,
      CreateAgencyResult
    >(
      new CreateAgencyCommand(
        body.name,
        body.slug,
        userId,
        body.description,
        body.logo,
        body.settings,
      ),
    );

    return toAgencyResponse(result.agency);
  }

  @Get()
  async listAgencies(
    @Query('public') isPublic?: string,
  ): Promise<AgencyResponseDto[]> {
    const agencies = isPublic === 'true'
      ? await this.agencyRepository.findPublic()
      : await this.agencyRepository.findAll();
    return agencies.map(toAgencyResponse);
  }

  @Get('by-user/:userId')
  async getAgencyByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AgencyResponseDto> {
    this.logger.log(`GET /agencies/by-user/${userId}`);
    const agencies = await this.agencyRepository.findByOwnerId(userId);
    if (!agencies.length) {
      throw new NotFoundException(`No agency found for user ${userId}`);
    }
    return toAgencyResponse(agencies[0]);
  }

  @Get(':identifier')
  async getAgency(
    @Param('identifier') identifier: string,
  ): Promise<AgencyDetailResponseDto> {
    // Try by slug first; if not found, fallback to UUID
    let result: GetAgencyResult;
    try {
      result = await this.queryBus.execute<GetAgencyQuery, GetAgencyResult>(
        new GetAgencyQuery(identifier, true),
      );
    } catch (err) {
      // Only swallow NotFoundException; rethrow real errors
      if (!(err instanceof NotFoundException)) throw err;
      result = await this.queryBus.execute<GetAgencyQuery, GetAgencyResult>(
        new GetAgencyQuery(identifier, false),
      );
    }
    const response = toAgencyDetailResponse(result.agency, result.members, result.templates);

    // Enrich members with user data
    const userIds = [...new Set(result.members.map(m => m.userId))];
    const users = await Promise.all(userIds.map(id => this.userRepository.findById(id)));
    const userMap = new Map(users.filter(Boolean).map(u => [u!.id, u!]));

    response.members = response.members.map(m => ({
      ...m,
      userName: userMap.get(m.userId)?.name,
      userEmail: userMap.get(m.userId)?.email,
      userAvatar: userMap.get(m.userId)?.avatar,
      lastIpAddress: userMap.get(m.userId)?.lastIpAddress,
    }));

    return response;
  }

  @Patch(':id')
  async updateAgency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAgencyRequestDto,
  ): Promise<AgencyResponseDto> {
    // Map only the fields that are allowed to be updated
    const updateData: Record<string, any> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.logo !== undefined) updateData.logo = body.logo;
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;
    if (body.settings !== undefined) updateData.settings = body.settings;
    if (body.planTier !== undefined) updateData.planTier = body.planTier;

    const updated = await this.agencyRepository.update(id, updateData);
    return toAgencyResponse(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgency(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.agencyRepository.delete(id);
  }

  // ───────────────────────────────
  //  Members
  // ───────────────────────────────

  @Post(':id/members')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddMemberRequestDto,
  ) {
    const member = await this.agencyRepository.addMember({
      agencyId: id,
      userId: body.userId,
      role: body.role || 'member',
    });
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    };
  }

  @Delete(':id/members/:userId')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.agencyRepository.removeMember(id, userId);
  }

  // ───────────────────────────────
  //  Templates
  // ───────────────────────────────

  @Post(':id/templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTemplateRequestDto,
  ): Promise<AgencyTemplateDto> {
    const template = await this.agencyRepository.createTemplate({
      agencyId: id,
      name: body.name,
      description: body.description,
      category: body.category,
      skills: body.skills,
      rules: body.rules,
      workflow: body.workflow,
      persona: body.persona,
    });
    return toTemplateDto(template);
  }

  @Get(':id/templates')
  async listTemplates(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgencyTemplateDto[]> {
    const templates = await this.agencyRepository.findTemplatesByAgencyId(id);
    return templates.map(toTemplateDto);
  }

  @Post(':id/templates/:templateId/publish')
  @HttpCode(HttpStatus.OK)
  async publishTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() body: PublishTemplateRequestDto,
  ): Promise<AgencyTemplateDto> {
    const result = await this.commandBus.execute(
      new PublishTemplateCommand(templateId, id, body.price),
    );
    return toTemplateDto(result.template);
  }

  // ───────────────────────────────
  //  Marketplace
  // ───────────────────────────────

  @Get('marketplace/templates')
  async searchMarketplace(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ): Promise<{ templates: AgencyTemplateDto[]; total: number }> {
    const result = await this.queryBus.execute<
      SearchTemplatesQuery,
      SearchTemplatesResult
    >(new SearchTemplatesQuery(query, category, limit ? parseInt(limit) : 20));
    return {
      templates: result.templates.map(toTemplateDto),
      total: result.total,
    };
  }

  @Post('marketplace/install/:templateId')
  @HttpCode(HttpStatus.CREATED)
  async installTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() body: { targetAgencyId: string; userId: string },
  ): Promise<AgencyTemplateDto> {
    const result = await this.commandBus.execute(
      new InstallTemplateCommand(
        templateId,
        body.targetAgencyId,
        body.userId,
      ),
    );
    return toTemplateDto(result.template);
  }
}
