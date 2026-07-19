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
import { CreateWorkflowCommand } from '@agency-resources/application/commands/create-workflow/create-workflow.command';
import { UpdateWorkflowCommand } from '@agency-resources/application/commands/update-workflow/update-workflow.command';
import { DeleteWorkflowCommand } from '@agency-resources/application/commands/delete-workflow/delete-workflow.command';
import { GetWorkflowsByAgencyQuery } from '@agency-resources/application/queries/get-workflows-by-agency/get-workflows-by-agency.query';
import { GetWorkflowByIdQuery } from '@agency-resources/application/queries/get-workflow-by-id/get-workflow-by-id.query';
import { CreateAgencyWorkflowDto, UpdateAgencyWorkflowDto } from '../dto/agency-workflow.dto';
import { AgencyWorkflowDto } from '../dto/agency-resources-response.dto';

@Controller('v1/agency/:agencyId/workflows')
@UseGuards(AuthGuard, AgencyGuard)
export class AgencyWorkflowsController {
  private readonly logger = new Logger(AgencyWorkflowsController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(@Param('agencyId') agencyId: string): Promise<AgencyWorkflowDto[]> {
    return this.queryBus.execute(new GetWorkflowsByAgencyQuery(agencyId));
  }

  @Get(':workflowId')
  async findOne(
    @Param('agencyId') agencyId: string,
    @Param('workflowId') workflowId: string,
  ): Promise<AgencyWorkflowDto | null> {
    return this.queryBus.execute(new GetWorkflowByIdQuery(agencyId, workflowId));
  }

  @Post()
  async create(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateAgencyWorkflowDto,
  ): Promise<AgencyWorkflowDto> {
    return this.commandBus.execute(new CreateWorkflowCommand(agencyId, dto));
  }

  @Put(':workflowId')
  async update(
    @Param('agencyId') agencyId: string,
    @Param('workflowId') workflowId: string,
    @Body() dto: UpdateAgencyWorkflowDto,
  ): Promise<AgencyWorkflowDto> {
    return this.commandBus.execute(new UpdateWorkflowCommand(agencyId, workflowId, dto));
  }

  @Delete(':workflowId')
  async remove(
    @Param('agencyId') agencyId: string,
    @Param('workflowId') workflowId: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteWorkflowCommand(agencyId, workflowId));
  }
}
