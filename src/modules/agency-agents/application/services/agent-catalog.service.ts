import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCatalog } from '@modules/agency-agents/domain/entities/agent-catalog.entity';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';
import { AgentSessionContext } from '@modules/agency-agents/domain/entities/agent-session-context.entity';

export interface AgentCatalogEntry {
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

@Injectable()
export class AgentCatalogService {
  private readonly logger = new Logger(AgentCatalogService.name);

  constructor(
    @InjectRepository(AgentCatalog)
    private readonly catalogRepo: Repository<AgentCatalog>,
    @InjectRepository(AgentCategory)
    private readonly categoryRepo: Repository<AgentCategory>,
    @InjectRepository(AgentSessionContext)
    private readonly contextRepo: Repository<AgentSessionContext>,
  ) {}

  async getAll(): Promise<AgentCatalogEntry[]> {
    const agents = await this.catalogRepo.find({
      where: { isActive: true },
      order: { priority: 'DESC' },
    });
    return agents.map(this.toEntry);
  }

  async getByCategory(categorySlug: string): Promise<AgentCatalogEntry[]> {
    const category = await this.categoryRepo.findOne({ where: { slug: categorySlug } });
    if (!category) return [];
    const agents = await this.catalogRepo.find({
      where: { categoryId: category.id, isActive: true },
      order: { priority: 'DESC' },
    });
    return agents.map(this.toEntry);
  }

  async getByAgentId(agentId: string): Promise<AgentCatalog | null> {
    return this.catalogRepo.findOne({ where: { agentId } });
  }

  /** Obtiene o crea el contexto de un agente para una sesión+proyecto específicos */
  async getOrCreateSessionContext(
    agentId: string,
    sessionId: string,
    projectId?: string,
  ): Promise<AgentSessionContext> {
    let ctx = await this.contextRepo.findOne({ where: { agentId, sessionId } });
    if (!ctx) {
      const agent = await this.getByAgentId(agentId);
      ctx = this.contextRepo.create({
        agentId,
        sessionId,
        projectId,
        loadedSkills: agent?.skillIds ?? [],
        loadedRules: [],
        messages: [],
        invocationCount: 0,
      });
      ctx = await this.contextRepo.save(ctx);
    }
    return ctx;
  }

  /** Registra una invocación del agente y persiste el mensaje */
  async recordInvocation(
    agentId: string,
    sessionId: string,
    projectId: string | undefined,
    userMessage: string,
    assistantResponse: string,
    appliedRules: Array<{ id: string; name: string; category: string }>,
  ): Promise<void> {
    const ctx = await this.getOrCreateSessionContext(agentId, sessionId, projectId);

    const messages = ctx.messages ?? [];
    messages.push(
      { role: 'user', content: userMessage.substring(0, 500), timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantResponse.substring(0, 500), timestamp: new Date().toISOString() },
    );

    await this.contextRepo.update(ctx.id, {
      messages: messages.slice(-40), // mantener últimos 40 mensajes
      invocationCount: ctx.invocationCount + 1,
      lastInvokedAt: new Date(),
      loadedRules: appliedRules,
    });
  }

  /** Devuelve el catálogo resumido para respuestas JSON al CLI */
  async getSummaryForCli(): Promise<AgentCatalogEntry[]> {
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
