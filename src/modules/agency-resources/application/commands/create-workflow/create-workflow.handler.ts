import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { CreateWorkflowCommand } from './create-workflow.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyWorkflowDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(CreateWorkflowCommand)
export class CreateWorkflowHandler implements ICommandHandler<CreateWorkflowCommand> {
  private readonly logger = new Logger(CreateWorkflowHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: CreateWorkflowCommand): Promise<AgencyWorkflowDto> {
    const workflow = await this.repo.createWorkflow({
      agencyId: command.agencyId,
      ...command.data,
    });
    this.logger.log(`Workflow creado: ${workflow.name} (agency: ${command.agencyId})`);
    return AgencyWorkflowDto.fromEntity(workflow);
  }
}
