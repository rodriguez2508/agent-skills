import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAgentCatalogQuery } from './get-catalog.query';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCatalog } from '@modules/agency-agents/domain/entities/agent-catalog.entity';
import { Logger } from '@nestjs/common';

interface AgentCatalogEntry {
  agentId: string;
  name: string;
  description: string;
  purpose: string;
  category: string;
  categoryIcon: string;
  ruleCategories: string[];
  intentPatterns: string[];
  priority: number;
}

@QueryHandler(GetAgentCatalogQuery)
export class GetAgentCatalogHandler implements IQueryHandler<GetAgentCatalogQuery> {
  private readonly logger = new Logger(GetAgentCatalogHandler.name);

  constructor(
    @InjectRepository(AgentCatalog)
    private readonly catalogRepo: Repository<AgentCatalog>,
  ) {}

  async execute(query: GetAgentCatalogQuery) {
    const { filter } = query;

    if (filter === 'summary') return this.getSummaryForCli();
    if (typeof filter === 'string') return this.getAll();

    // filter is an object: { category: string } | { agentId: string }
    if ('category' in filter) {
      return this.getByCategory(filter.category);
    }

    return this.getAll();
  }

  private async getAll(): Promise<AgentCatalogEntry[]> {
    const agents = await this.catalogRepo.find({
      where: { isActive: true },
      order: { priority: 'DESC' },
      relations: ['category'],
    });
    return agents.map(this.toEntry);
  }

  private async getByCategory(categorySlug: string): Promise<AgentCatalogEntry[]> {
    const agents = await this.catalogRepo.find({
      where: { isActive: true },
      order: { priority: 'DESC' },
      relations: ['category'],
    });
    return agents
      .filter((a) => a.category?.slug === categorySlug)
      .map(this.toEntry);
  }

  private async getSummaryForCli(): Promise<AgentCatalogEntry[]> {
    return this.getAll();
  }

  private toEntry(agent: AgentCatalog): AgentCatalogEntry {
    return {
      agentId: agent.agentId,
      name: agent.name,
      description: agent.description ?? '',
      purpose: agent.purpose ?? '',
      category: agent.category?.slug ?? 'general',
      categoryIcon: agent.category?.icon ?? '🤖',
      ruleCategories: agent.ruleCategories ?? [],
      intentPatterns: agent.intentPatterns ?? [],
      priority: agent.priority,
    };
  }
}
