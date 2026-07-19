import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { CreateAgentCommand } from './create-agent.command';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyAgentDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@CommandHandler(CreateAgentCommand)
export class CreateAgentHandler implements ICommandHandler<CreateAgentCommand> {
  private readonly logger = new Logger(CreateAgentHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(command: CreateAgentCommand): Promise<AgencyAgentDto> {
    const agent = await this.repo.createAgent({
      agencyId: command.agencyId,
      ...command.data,
    });
    this.logger.log(`Agente creado: ${agent.name} (agency: ${command.agencyId})`);
    return AgencyAgentDto.fromEntity(agent);
  }
}
