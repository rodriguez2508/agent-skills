import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateAgentConfigCommand } from './create-config.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(CreateAgentConfigCommand)
export class CreateAgentConfigHandler implements ICommandHandler<CreateAgentConfigCommand> {
  private readonly logger = new Logger(CreateAgentConfigHandler.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  async execute(command: CreateAgentConfigCommand) {
    const { agencyId, data } = command;
    this.logger.log(`Creating agent config: ${data.agentId} for agency: ${agencyId}`);

    const existing = await this.configRepo.findOne({
      where: { agencyId, agentId: data.agentId },
    });

    if (existing) {
      await this.configRepo.update(existing.id, { ...data, agencyId });
      return this.configRepo.findOneOrFail({ where: { id: existing.id } });
    }

    return this.configRepo.save({
      ...data,
      agencyId,
      isDefault: false,
    } as AgentConfig);
  }
}
