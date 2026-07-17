import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteAgentConfigCommand } from './delete-config.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { Logger, NotFoundException } from '@nestjs/common';

@CommandHandler(DeleteAgentConfigCommand)
export class DeleteAgentConfigHandler implements ICommandHandler<DeleteAgentConfigCommand> {
  private readonly logger = new Logger(DeleteAgentConfigHandler.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  async execute(command: DeleteAgentConfigCommand) {
    const { agencyId, agentId } = command;
    this.logger.log(`Deleting agent config: ${agentId} for agency: ${agencyId}`);

    const config = await this.configRepo.findOne({ where: { agencyId, agentId } });
    if (!config) {
      throw new NotFoundException(
        `Agent config '${agentId}' not found for agency '${agencyId}'`,
      );
    }
    await this.configRepo.delete(config.id);
  }
}
