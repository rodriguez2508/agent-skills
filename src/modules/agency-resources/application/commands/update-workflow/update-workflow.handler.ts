import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { UpdateWorkflowCommand } from './update-workflow.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyWorkflowDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(UpdateWorkflowCommand)
export class UpdateWorkflowHandler implements ICommandHandler<UpdateWorkflowCommand> {
  private readonly logger = new Logger(UpdateWorkflowHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: UpdateWorkflowCommand): Promise<AgencyWorkflowDto> {
    const workflow = await this.repo.findWorkflowById(command.workflowId);
    if (!workflow || workflow.agencyId !== command.agencyId) {
      throw new Error('Workflow no encontrado o no pertenece a esta agencia');
    }
    const updated = await this.repo.updateWorkflow(command.workflowId, command.data);
    this.logger.log(`Workflow actualizado: ${updated.name}`);
    return AgencyWorkflowDto.fromEntity(updated);
  }
}
