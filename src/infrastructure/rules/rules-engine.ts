import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RuleFileRepository } from '@infrastructure/persistence/repositories/rule-file.repository';
import { RULE_REPOSITORY } from '@core/domain/ports/rule-repository.token';

export interface Rule {
  id: string;
  title: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactDescription?: string;
  tags: string[];
  content: string;
  category: string;
}

/**
 * RulesEngine - Carga y aplica reglas de código
 * Verifica reglas antes de generar respuestas
 * Uses RuleFileRepository for consistent rule loading across the application.
 */
@Injectable()
export class RulesEngine implements OnModuleInit {
  private readonly logger = new Logger(RulesEngine.name);
  private rules: Map<string, Rule> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @Inject(RULE_REPOSITORY)
    private readonly ruleRepository: RuleFileRepository,
  ) {}

  async onModuleInit() {
    await this.loadRules();
    this.logger.log(`✅ RulesEngine initialized with ${this.rules.size} rules`);
  }

  /**
   * Carga todas las reglas usando RuleFileRepository (fuente única de verdad)
   */
  async loadRules(): Promise<void> {
    try {
      // Clear existing rules cache
      this.rules.clear();

      const allRules = await this.ruleRepository.findAll();

      for (const rule of allRules) {
        this.rules.set(rule.id, {
          id: rule.id,
          title: rule.name,
          impact: rule.impact as Rule['impact'],
          impactDescription: rule.impactDescription,
          tags: rule.tags,
          content: rule.content,
          category: rule.category,
        });
        this.logger.debug(`📄 Loaded rule: ${rule.name}`);
      }

      this.logger.log(
        `📚 Loaded ${this.rules.size} rules from RuleFileRepository`,
      );
    } catch (error) {
      this.logger.error(`Failed to load rules: ${error.message}`);
    }
  }

  /**
   * Obtiene reglas relevantes para un contexto dado
   */
  getRelevantRules(context: string, limit: number = 5): Rule[] {
    const relevantRules: Rule[] = [];
    const contextLower = context.toLowerCase();

    for (const rule of this.rules.values()) {
      const titleMatch = rule.title.toLowerCase().includes(contextLower);
      const contentMatch = rule.content.toLowerCase().includes(contextLower);
      const tagsMatch = rule.tags.some((tag) =>
        tag.toLowerCase().includes(contextLower),
      );

      if (titleMatch || contentMatch || tagsMatch) {
        relevantRules.push(rule);
      }

      if (relevantRules.length >= limit) {
        break;
      }
    }

    return relevantRules;
  }

  /**
   * Obtiene una regla por ID
   */
  getRuleById(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Obtiene todas las reglas
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Obtiene reglas por categoría
   */
  getRulesByCategory(category: string): Rule[] {
    return this.getAllRules().filter((rule) => rule.category === category);
  }

  /**
   * Formatea una respuesta aplicando reglas
   */
  formatResponseWithRules(response: string, context?: string): string {
    const relevantRules = context ? this.getRelevantRules(context) : [];

    if (relevantRules.length === 0) {
      return response;
    }

    const rulesSection =
      '\n\n📋 **Relevant Rules Applied:**\n' +
      relevantRules
        .map((rule) => `- ${rule.title} (${rule.impact})`)
        .join('\n');

    return response + rulesSection;
  }
}
