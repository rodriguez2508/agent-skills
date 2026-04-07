import { Injectable, Inject } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { RulesEngine } from '@infrastructure/rules/rules-engine';

/**
 * RulesAgent - Manages and lists available rules
 * Provides access to all code rules in the repository
 */
@Injectable()
export class RulesAgent extends BaseAgent {
  constructor(
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: any,
    private readonly agentLogger: AgentLoggerService,
    private readonly rulesEngine: RulesEngine,
  ) {
    super('RulesAgent', 'Manages and lists available code rules');
  }

  /**
   * Handles rule listing requests
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const category = request.options?.category as string | undefined;
    const limit = (request.options?.limit as number) || 50;

    this.agentLogger.info(this.agentId, 'Listing rules', {
      category,
      limit,
    });

    // Get rules from engine (more complete)
    let rules = category
      ? this.rulesEngine.getRulesByCategory(category)
      : this.rulesEngine.getAllRules();

    // Apply limit
    rules = rules.slice(0, limit);

    this.agentLogger.debug(this.agentId, `Rules obtained: ${rules.length}`);

    if (rules.length === 0) {
      return {
        message:
          "I don't have any rules available at the moment. Check back later as we're constantly adding new best practices!",
        category,
        rules: [],
        suggestion:
          'You can ask about: "Clean Architecture", "CQRS", "NestJS", or "TypeScript" rules',
      };
    }

    // Group by category
    const groupedByCategory = this.groupByCategory(rules);

    // Format response with friendly language
    const formattedRules = rules.map((rule, index) => ({
      position: index + 1,
      id: rule.id,
      name: rule.title,
      category: rule.category,
      tags: rule.tags,
      impact: rule.impact,
    }));

    return {
      message: `Perfect! I have ${rules.length} rule${rules.length === 1 ? '' : 's'} ready to help you write better code:`,
      category,
      total: rules.length,
      rules: formattedRules,
      byCategory: groupedByCategory,
    };
  }

  /**
   * Groups rules by category
   */
  private groupByCategory(rules: any[]): Record<string, any[]> {
    return rules.reduce(
      (acc, rule) => {
        if (!acc[rule.category]) {
          acc[rule.category] = [];
        }
        acc[rule.category].push(rule);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  /**
   * Gets a specific rule by ID
   */
  async getRuleById(id: string): Promise<any> {
    this.agentLogger.info(this.agentId, `Getting rule: ${id}`);

    const rule = this.rulesEngine.getRuleById(id);

    if (!rule) {
      this.agentLogger.warn(this.agentId, `Rule not found: ${id}`);
      return null;
    }

    this.agentLogger.debug(this.agentId, `Rule obtained: ${rule.title}`);

    return {
      id: rule.id,
      name: rule.title,
      category: rule.category,
      content: rule.content,
      tags: rule.tags,
      impact: rule.impact,
    };
  }

  /**
   * Checks if input is about listing rules
   */
  canHandle(input: string): boolean {
    const rulesKeywords = [
      'lista',
      'listar',
      'reglas',
      'rules',
      'disponibles',
      'qué reglas',
      'cuáles reglas',
      'mostrar reglas',
      'list',
      'show rules',
      'available rules',
    ];

    return rulesKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );
  }
}
