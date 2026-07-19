import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { DeleteAgentCommand } from './delete-agent.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';

@CommandHandler(DeleteAgentCommand)
export class DeleteAgentHandler implements ICommandHandler<DeleteAgentCommand> {
  private readonly logger = new Logger(DeleteAgentHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: DeleteAgentCommand): Promise<void> {
    const agent = await this.repo.findAgentById(command.agentId);
    if (!agent || agent.agencyId !== command.agencyId) {
      throw new Error('Agente no encontrado o no pertenece a esta agencia');
    }
    await this.repo.deleteAgent(command.agentId);
    this.logger.log(`Agente eliminado: ${command.agentId}`);
  }
}
