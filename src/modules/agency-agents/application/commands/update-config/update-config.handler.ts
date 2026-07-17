import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateAgentConfigCommand } from './update-config.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(UpdateAgentConfigCommand)
export class UpdateAgentConfigHandler implements ICommandHandler<UpdateAgentConfigCommand> {
  private readonly logger = new Logger(UpdateAgentConfigHandler.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  async execute(command: UpdateAgentConfigCommand) {
    const { agencyId, agentId, data } = command;
    this.logger.log(`Updating agent config: ${agentId} for agency: ${agencyId}`);

    const existing = await this.configRepo.findOne({
      where: { agencyId, agentId },
    });

    if (existing) {
      await this.configRepo.update(existing.id, { ...data, agencyId });
      return this.configRepo.findOneOrFail({ where: { id: existing.id } });
    }

    return this.configRepo.save({
      ...data,
      agentId,
      name: data.name || agentId,
      agencyId,
      isDefault: false,
    } as AgentConfig);
  }
}
