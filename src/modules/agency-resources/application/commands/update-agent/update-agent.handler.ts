import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { UpdateAgentCommand } from './update-agent.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyAgentDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(UpdateAgentCommand)
export class UpdateAgentHandler implements ICommandHandler<UpdateAgentCommand> {
  private readonly logger = new Logger(UpdateAgentHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: UpdateAgentCommand): Promise<AgencyAgentDto> {
    const agent = await this.repo.findAgentById(command.agentId);
    if (!agent || agent.agencyId !== command.agencyId) {
      throw new Error('Agente no encontrado o no pertenece a esta agencia');
    }
    const updated = await this.repo.updateAgent(command.agentId, command.data);
    this.logger.log(`Agente actualizado: ${updated.name}`);
    return AgencyAgentDto.fromEntity(updated);
  }
}
