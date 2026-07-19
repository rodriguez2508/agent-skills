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
import { CreateAgentCommand } from '@agency-resources/application/commands/create-agent/create-agent.command';
import { UpdateAgentCommand } from '@agency-resources/application/commands/update-agent/update-agent.command';
import { DeleteAgentCommand } from '@agency-resources/application/commands/delete-agent/delete-agent.command';
import { GetAgentsByAgencyQuery } from '@agency-resources/application/queries/get-agents-by-agency/get-agents-by-agency.query';
import { GetAgentByIdQuery } from '@agency-resources/application/queries/get-agent-by-id/get-agent-by-id.query';
import { CreateAgencyAgentDto, UpdateAgencyAgentDto } from '../dto/agency-agent.dto';
import { AgencyAgentDto } from '../dto/agency-resources-response.dto';

@Controller('v1/agency/:agencyId/agents')
@UseGuards(AuthGuard, AgencyGuard)
export class AgencyAgentsController {
  private readonly logger = new Logger(AgencyAgentsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@Param('agencyId') agencyId: string): Promise<AgencyAgentDto[]> {
    return this.queryBus.execute(new GetAgentsByAgencyQuery(agencyId));
  }

  @Get(':agentId')
  async findOne(
    @Param('agencyId') agencyId: string,
    @Param('agentId') agentId: string,
  ): Promise<AgencyAgentDto | null> {
    return this.queryBus.execute(new GetAgentByIdQuery(agencyId, agentId));
  }

  @Post()
  async create(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateAgencyAgentDto,
  ): Promise<AgencyAgentDto> {
    return this.commandBus.execute(new CreateAgentCommand(agencyId, dto));
  }

  @Put(':agentId')
  async update(
    @Param('agencyId') agencyId: string,
    @Param('agentId') agentId: string,
    @Body() dto: UpdateAgencyAgentDto,
  ): Promise<AgencyAgentDto> {
    return this.commandBus.execute(new UpdateAgentCommand(agencyId, agentId, dto));
  }

  @Delete(':agentId')
  async remove(
    @Param('agencyId') agencyId: string,
    @Param('agentId') agentId: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteAgentCommand(agencyId, agentId));
  }
}
