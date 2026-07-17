import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetConfigQuery } from './get-config.query';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { Logger } from '@nestjs/common';

@QueryHandler(GetConfigQuery)
export class GetConfigHandler implements IQueryHandler<GetConfigQuery> {
  private readonly logger = new Logger(GetConfigHandler.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  async execute(query: GetConfigQuery) {
    const { agencyId, agentId } = query;
    this.logger.debug(`Getting config: ${agentId} for agency: ${agencyId}`);

    // Check agency-specific first, then default
    const config =
      (await this.configRepo.findOne({
        where: { agencyId, agentId, isActive: true },
      })) ||
      (await this.configRepo.findOne({
        where: { isDefault: true, agentId, isActive: true },
      }));

    return config || null;
  }
}
