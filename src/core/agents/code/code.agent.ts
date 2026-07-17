import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * CodeAgent - Agente especializado en generación de código
 * Genera snippets de código y valida mejores prácticas
 * AUTOMATICALLY applies relevant rules from the MCP rule system
 */
@Injectable()
export class CodeAgent extends BaseAgent {
  constructor(private readonly agentLogger: AgentLoggerService) {
    super('CodeAgent', 'Genera y valida código siguiendo mejores prácticas');
  }

  /**
   * Maneja la generación de código
   * AUTOMATICALLY applies relevant rules passed from RouterAgent
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const codeRequest = request.input;
    const language = (request.options?.language as string) || 'typescript';

    // EXTRACT RULES CONTEXT from RouterAgent
    const relevantRules = (request.options?.relevantRules as any[]) || [];
    const rulesContext = (request.options?.rulesContext as string) || '';

    this.agentLogger.info(this.agentId, 'Generando código', {
      request: codeRequest.substring(0, 50),
      language,
      rulesApplied: relevantRules.length,
    });

    // GENERATE CODE with rule-aware context
    const codeSnippet = this.generateCodeWithRules(codeRequest, relevantRules);

    // EXTRACT RULES TO APPLY from the relevant rules
    const appliedRules = relevantRules
      .map((rule) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        appliedTo: this.getRuleApplication(rule, codeRequest),
      }))
      .filter((rule) => rule.appliedTo !== null);

    return {
      message: `✅ Código generado siguiendo ${appliedRules.length} reglas relevantes:`,
      language,
      snippet: codeSnippet,
      appliedRules: appliedRules.length > 0 ? appliedRules : undefined,
      rulesContext: rulesContext || undefined,
      bestPractices: this.getBestPracticesFromRules(relevantRules),
    };
  }

  /**
   * Generates code applying relevant rules
   */
  private generateCodeWithRules(request: string, rules: any[]): string {
    // Check for specific rule patterns and apply them
    const hasDependencyInjection = rules.some(
      (r) =>
        r.id.includes('di-') ||
        r.id.includes('dependency') ||
        r.content.toLowerCase().includes('dependency injection'),
    );

    const hasCleanArchitecture = rules.some(
      (r) =>
        r.id.includes('clean') ||
        r.content.toLowerCase().includes('clean architecture'),
    );

    const hasRepositoryPattern = rules.some(
      (r) =>
        r.id.includes('repository') ||
        r.content.toLowerCase().includes('repository'),
    );

    let code = `// Código generado para: ${request}\n`;
    code += `// Reglas aplicadas: ${rules.length}\n\n`;

    if (hasDependencyInjection) {
      code += `// ✅ Applying Dependency Injection pattern\n`;
      code += `@Injectable()\n`;
      code += `export class GeneratedService {\n`;
      code += `  constructor(\n`;
      code += `    @InjectRepository(Entity)\n`;
      code += `    private readonly repository: Repository<Entity>,\n`;
      code += `  ) {}\n`;
      code += `}\n\n`;
    }

    if (hasCleanArchitecture) {
      code += `// ✅ Applying Clean Architecture layers\n`;
      code += `// Domain Layer\n`;
      code += `export interface IGeneratedEntity {\n`;
      code += `  id: string;\n`;
      code += `  createdAt: Date;\n`;
      code += `}\n\n`;
    }

    if (hasRepositoryPattern) {
      code += `// ✅ Applying Repository Pattern\n`;
      code += `export interface IGeneratedRepository {\n`;
      code += `  findById(id: string): Promise<IGeneratedEntity | null>;\n`;
      code += `  save(entity: IGeneratedEntity): Promise<void>;\n`;
      code += `}\n\n`;
    }

    // Default code if no specific rules matched
    if (
      !hasDependencyInjection &&
      !hasCleanArchitecture &&
      !hasRepositoryPattern
    ) {
      code += `export class GeneratedClass {\n`;
      code += `  // Implementation for: ${request}\n`;
      code += `}\n`;
    }

    return code;
  }

  /**
   * Gets best practices from relevant rules
   */
  private getBestPracticesFromRules(rules: any[]): string[] {
    if (rules.length === 0) {
      return [
        'Usa tipos explícitos',
        'Aplica principios SOLID',
        'Incluye tests unitarios',
      ];
    }

    return rules.map((rule) => {
      if (rule.impact === 'CRITICAL') {
        return `⚠️ [CRITICAL] ${rule.name}`;
      }
      if (rule.impact === 'HIGH') {
        return `🔶 [HIGH] ${rule.name}`;
      }
      return `📋 ${rule.name}`;
    });
  }

  /**
   * Determines how a rule applies to the request
   */
  private getRuleApplication(rule: any, request: string): string | null {
    const requestLower = request.toLowerCase();
    const contentLower = rule.content.toLowerCase();

    // Check if rule content mentions keywords from the request
    const keywords = requestLower.split(/\s+/).filter((w) => w.length > 3);
    const matches = keywords.some((keyword) => contentLower.includes(keyword));

    if (matches) {
      return `Applied to: "${request.substring(0, 50)}..."`;
    }

    return null;
  }

  /**
   * Verifica si el input es sobre generación de código
   */
  canHandle(input: string): boolean {
    const codeKeywords = [
      'crear',
      'generar',
      'código',
      'implementar',
      'escribe',
      'haz un',
      'función',
      'clase',
      'método',
      'servicio',
      'controlador',
    ];

    return codeKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );
  }
}
