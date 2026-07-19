import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { DeleteWorkflowCommand } from './delete-workflow.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';

@CommandHandler(DeleteWorkflowCommand)
export class DeleteWorkflowHandler implements ICommandHandler<DeleteWorkflowCommand> {
  private readonly logger = new Logger(DeleteWorkflowHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: DeleteWorkflowCommand): Promise<void> {
    const workflow = await this.repo.findWorkflowById(command.workflowId);
    if (!workflow || workflow.agencyId !== command.agencyId) {
      throw new Error('Workflow no encontrado o no pertenece a esta agencia');
    }
    await this.repo.deleteWorkflow(command.workflowId);
    this.logger.log(`Workflow eliminado: ${command.workflowId}`);
  }
}
