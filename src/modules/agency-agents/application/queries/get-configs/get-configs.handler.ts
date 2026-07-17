import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetConfigsQuery } from './get-configs.query';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { Logger } from '@nestjs/common';

@QueryHandler(GetConfigsQuery)
export class GetConfigsHandler implements IQueryHandler<GetConfigsQuery> {
  private readonly logger = new Logger(GetConfigsHandler.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  async execute(query: GetConfigsQuery) {
    const { agencyId } = query;
    this.logger.debug(`Getting configs for agency: ${agencyId || 'global'}`);

    const [agencyConfigs, defaults] = await Promise.all([
      this.configRepo.find({
        where: {
          agencyId: agencyId ?? IsNull(),
          isActive: true,
          ...(agencyId ? { isDefault: false } : {}),
        },
        order: { name: 'ASC' },
      }),
      this.configRepo.find({
        where: { isDefault: true, isActive: true },
        order: { name: 'ASC' },
      }),
    ]);

    // Merge: agency configs override defaults by agentId
    const agencyMap = new Map(agencyConfigs.map((c) => [c.agentId, c]));
    const merged = defaults.map((d) => agencyMap.get(d.agentId) || d);
    // Add agency-specific configs that have no default
    for (const ac of agencyConfigs) {
      if (!defaults.some((d) => d.agentId === ac.agentId)) {
        merged.push(ac);
      }
    }

    return merged;
  }
}
