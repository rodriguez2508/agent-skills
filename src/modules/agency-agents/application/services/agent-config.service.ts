import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentConfig } from '@modules/agency-agents/domain/entities/agent-config.entity';
import { DbAgentAdapter } from '@modules/agency-agents/infrastructure/adapters/db-agent.adapter';

/**
 * Service for managing agent configurations per agency.
 * Replaces hardcoded adapters with DB-stored configs.
 */
@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);

  constructor(
    @InjectRepository(AgentConfig)
    private readonly configRepo: Repository<AgentConfig>,
  ) {}

  /**
   * Returns all agent configs for an agency, merged with defaults.
   * Agency-specific configs override defaults with the same agentId.
   */
  async getConfigsForAgency(agencyId: string | null): Promise<AgentConfig[]> {
    const [agencyConfigs, defaults] = await Promise.all([
      this.configRepo.find({
        where: {
          agencyId: agencyId ?? IsNull(),
          isActive: true,
          // Skip defaults when querying for a specific agency
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

  /**
   * Gets a specific agent config for an agency.
   */
  async getConfig(
    agencyId: string,
    agentId: string,
  ): Promise<AgentConfig | null> {
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

  /**
   * Creates or updates an agent config for an agency.
   */
  async upsertConfig(
    agencyId: string,
    data: Partial<AgentConfig> & { agentId: string; name: string },
  ): Promise<AgentConfig> {
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

  /**
   * Deletes an agency-specific config (falls back to default).
   */
  async deleteConfig(agencyId: string, agentId: string): Promise<void> {
    const config = await this.configRepo.findOne({
      where: { agencyId, agentId },
    });
    if (!config) {
      throw new NotFoundException(
        `Agent config '${agentId}' not found for agency '${agencyId}'`,
      );
    }
    await this.configRepo.delete(config.id);
  }

  /**
   * Creates DbAgentAdapter instances from DB configs for an agency.
   * Used by AgentConfigRegistryService to replace hardcoded adapters.
   */
  async createAdaptersForAgency(agencyId: string | null): Promise<DbAgentAdapter[]> {
    const configs = await this.getConfigsForAgency(agencyId);
    return configs.map((config) => new DbAgentAdapter(config));
  }

  /**
   * Seeds default agent configs if none exist.
   * Called on module init.
   */
  async seedDefaultsIfEmpty(): Promise<void> {
    const count = await this.configRepo.count({ where: { isDefault: true } });
    if (count > 0) {
      this.logger.log(`✅ ${count} default agent configs already seeded`);
      return;
    }

    const defaults: Partial<AgentConfig>[] = [
      {
        agentId: 'qwen-cli',
        name: 'Qwen CLI',
        binaryName: 'qwen',
        description: 'Alibaba Qwen CLI - AI coding assistant',
        configDir: '~/.qwen',
        systemPromptFile: '~/.qwen/INSTRUCTIONS.md',
        skillsDir: '~/.qwen/skills',
        settingsPath: '~/.qwen/settings.json',
        mcpConfigPath: '~/.qwen/mcp/{serverName}.json',
        systemPromptStrategy: 2, // AppendToFile
        mcpStrategy: 1, // MergeIntoSettings
        supportsSkills: true,
        supportsSystemPrompt: true,
        supportsMCP: true,
        tier: 'full',
        isDefault: true,
        isActive: true,
      },
      {
        agentId: 'claude-code',
        name: 'Claude Code',
        binaryName: 'claude',
        description: 'Anthropic Claude Code CLI - AI coding assistant',
        configDir: '~/.claude',
        systemPromptFile: '~/.claude/CLAUDE.md',
        skillsDir: '~/.claude/commands',
        settingsPath: '~/.claude.json',
        mcpConfigPath: null,
        systemPromptStrategy: 0, // MarkdownSections
        mcpStrategy: 1, // MergeIntoSettings
        supportsSkills: true,
        supportsSystemPrompt: true,
        supportsMCP: true,
        tier: 'full',
        isDefault: true,
        isActive: true,
      },
      {
        agentId: 'opencode',
        name: 'OpenCode',
        binaryName: 'opencode',
        description: 'OpenCode CLI - AI coding assistant',
        configDir: '~/.opencode',
        systemPromptFile: '~/.opencode/AGENTS.md',
        skillsDir: '~/.opencode/skills',
        settingsPath: '~/.opencode/settings.json',
        mcpConfigPath: null,
        systemPromptStrategy: 1, // FileReplace
        mcpStrategy: 1, // MergeIntoSettings
        supportsSkills: true,
        supportsSystemPrompt: true,
        supportsMCP: true,
        tier: 'full',
        isDefault: true,
        isActive: true,
      },
    ];

    await this.configRepo.save(defaults as AgentConfig[]);
    this.logger.log(`✅ Seeded ${defaults.length} default agent configs`);
  }

  /**
   * Gets all default configs.
   */
  async getDefaults(): Promise<AgentConfig[]> {
    return this.configRepo.find({
      where: { isDefault: true, isActive: true },
      order: { name: 'ASC' },
    });
  }
}
