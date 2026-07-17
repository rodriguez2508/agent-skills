import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * AnalysisAgent - Agente especializado en análisis de código
 * Analiza código existente y detecta problemas potenciales
 * AUTOMATICALLY applies relevant rules from the MCP rule system
 */
@Injectable()
export class AnalysisAgent extends BaseAgent {
  constructor(private readonly agentLogger: AgentLoggerService) {
    super('AnalysisAgent', 'Analiza código y detecta problemas potenciales');
  }

  /**
   * Maneja el análisis de código
   * AUTOMATICALLY applies relevant rules passed from RouterAgent
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const analysisRequest = request.input;

    // EXTRACT RULES CONTEXT from RouterAgent
    const relevantRules = (request.options?.relevantRules as any[]) || [];
    const rulesContext = (request.options?.rulesContext as string) || '';

    this.agentLogger.info(this.agentId, 'Analizando código', {
      request: analysisRequest.substring(0, 50),
      rulesApplied: relevantRules.length,
    });

    // ANALYZE with rule-aware context
    const findings = this.analyzeWithRules(analysisRequest, relevantRules);

    return {
      message: `✅ Análisis completado aplicando ${relevantRules.length} reglas relevantes:`,
      findings,
      appliedRules: relevantRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        impact: rule.impact,
        violation: this.checkRuleViolation(analysisRequest, rule),
      })),
      rulesContext: rulesContext || undefined,
    };
  }

  /**
   * Analyzes code applying relevant rules
   */
  private analyzeWithRules(request: string, rules: any[]): any {
    const issues: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check each rule for potential violations
    for (const rule of rules) {
      const violation = this.checkRuleViolation(request, rule);

      if (violation.detected) {
        if (rule.impact === 'CRITICAL') {
          issues.push(`⚠️ [CRITICAL] ${rule.name}: ${violation.reason}`);
        } else if (rule.impact === 'HIGH') {
          warnings.push(`🔶 [HIGH] ${rule.name}: ${violation.reason}`);
        } else {
          suggestions.push(`📋 ${rule.name}: ${violation.reason}`);
        }
      }
    }

    // Default findings if no rules matched
    if (
      issues.length === 0 &&
      warnings.length === 0 &&
      suggestions.length === 0
    ) {
      suggestions.push('Considera agregar más tests unitarios');
      suggestions.push('Algunas funciones podrían ser más pequeñas');
      suggestions.push('Aplica el principio de responsabilidad única');
    }

    return {
      issues,
      warnings,
      suggestions,
      rulesCount: rules.length,
    };
  }

  /**
   * Checks if a rule is violated in the request
   */
  private checkRuleViolation(
    request: string,
    rule: any,
  ): { detected: boolean; reason: string } {
    const requestLower = request.toLowerCase();
    const contentLower = rule.content.toLowerCase();

    // Check for dependency injection violations
    if (rule.id.includes('di-') || rule.id.includes('dependency')) {
      if (requestLower.includes('new ') && requestLower.includes('service')) {
        return {
          detected: true,
          reason:
            'Posible acoplamiento fuerte - considera usar inyección de dependencias',
        };
      }
    }

    // Check for clean architecture violations
    if (rule.id.includes('clean') || rule.id.includes('layers')) {
      if (
        requestLower.includes('controller') &&
        requestLower.includes('database')
      ) {
        return {
          detected: true,
          reason:
            'El controller no debería acceder directamente a la base de datos',
        };
      }
    }

    // Check for repository pattern violations
    if (rule.id.includes('repository')) {
      if (
        requestLower.includes('find') &&
        requestLower.includes('controller')
      ) {
        return {
          detected: true,
          reason:
            'El controller debería usar un repositorio, no acceder directamente',
        };
      }
    }

    return { detected: false, reason: '' };
  }

  /**
   * Verifica si el input es sobre análisis
   */
  canHandle(input: string): boolean {
    const analysisKeywords = [
      'analiza',
      'analizar',
      'análisis',
      'revisa',
      'verifica',
      'encuentra problemas',
      'detecta',
      'evalúa',
      'revisar código',
    ];

    return analysisKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );
  }
}
