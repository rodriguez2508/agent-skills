import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { AgencyGuard } from '@modules/agencies/guard/agency.guard';
import { CreateSkillCommand } from '@agency-resources/application/commands/create-skill/create-skill.command';
import { UpdateSkillCommand } from '@agency-resources/application/commands/update-skill/update-skill.command';
import { DeleteSkillCommand } from '@agency-resources/application/commands/delete-skill/delete-skill.command';
import { GetSkillsByAgencyQuery } from '@agency-resources/application/queries/get-skills-by-agency/get-skills-by-agency.query';
import { GetSkillByIdQuery } from '@agency-resources/application/queries/get-skill-by-id/get-skill-by-id.query';
import { CreateAgencySkillDto, UpdateAgencySkillDto } from '../dto/agency-skill.dto';
import { AgencySkillDto } from '../dto/agency-resources-response.dto';

@Controller('v1/agency/:agencyId/skills')
@UseGuards(AuthGuard, AgencyGuard)
export class AgencySkillsController {
  private readonly logger = new Logger(AgencySkillsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@Param('agencyId') agencyId: string): Promise<AgencySkillDto[]> {
    return this.queryBus.execute(new GetSkillsByAgencyQuery(agencyId));
  }

  @Get(':skillId')
  async findOne(
    @Param('agencyId') agencyId: string,
    @Param('skillId') skillId: string,
  ): Promise<AgencySkillDto | null> {
    return this.queryBus.execute(new GetSkillByIdQuery(agencyId, skillId));
  }

  @Post()
  async create(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateAgencySkillDto,
  ): Promise<AgencySkillDto> {
    return this.commandBus.execute(new CreateSkillCommand(agencyId, dto));
  }

  @Put(':skillId')
  async update(
    @Param('agencyId') agencyId: string,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateAgencySkillDto,
  ): Promise<AgencySkillDto> {
    return this.commandBus.execute(new UpdateSkillCommand(agencyId, skillId, dto));
  }

  @Delete(':skillId')
  async remove(
    @Param('agencyId') agencyId: string,
    @Param('skillId') skillId: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteSkillCommand(agencyId, skillId));
  }
}
