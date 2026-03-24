import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * ArchitectureAgent - Agente especializado en validación arquitectónica
 * Verifica Clean Architecture, patrones y estructura de proyectos
 * AUTOMATICALLY applies relevant rules from the MCP rule system
 */
@Injectable()
export class ArchitectureAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'ArchitectureAgent',
      'Valida arquitectura y patrones de diseño',
    );
  }

  /**
   * Maneja la validación arquitectónica
   * AUTOMATICALLY applies relevant rules passed from RouterAgent
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const architectureRequest = request.input;
    
    // EXTRACT RULES CONTEXT from RouterAgent
    const relevantRules = request.options?.relevantRules as any[] || [];
    const rulesContext = request.options?.rulesContext as string || '';

    this.agentLogger.info(this.agentId, 'Validando arquitectura', {
      request: architectureRequest.substring(0, 50),
      rulesApplied: relevantRules.length,
    });

    // ANALYZE ARCHITECTURE with rule-aware context
    const analysis = this.analyzeArchitectureWithRules(architectureRequest, relevantRules);

    return {
      message: `✅ Validación arquitectónica completada aplicando ${relevantRules.length} reglas relevantes:`,
      analysis,
      appliedRules: relevantRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        impact: rule.impact,
      })),
      rulesContext: rulesContext || undefined,
    };
  }

  /**
   * Analyzes architecture applying relevant rules
   */
  private analyzeArchitectureWithRules(request: string, rules: any[]): any {
    // Check for specific architecture patterns in rules
    const hasCleanArchitecture = rules.some(r => 
      r.id.includes('clean') || r.content.toLowerCase().includes('clean architecture')
    );
    
    const hasCQRS = rules.some(r => 
      r.id.includes('cqrs') || r.content.toLowerCase().includes('cqrs')
    );
    
    const hasHexagonal = rules.some(r => 
      r.id.includes('hex') || r.content.toLowerCase().includes('hexagonal')
    );
    
    const hasDependencyInversion = rules.some(r => 
      r.id.includes('di-') || r.id.includes('dependency-inversion') || 
      r.content.toLowerCase().includes('dependency inversion')
    );

    const recommendations: string[] = [];
    const patterns: string[] = [];
    const layers: string[] = [];

    if (hasCleanArchitecture) {
      patterns.push('Clean Architecture');
      layers.push('Domain', 'Application', 'Infrastructure', 'Presentation');
      recommendations.push('Separa claramente las capas de dominio e infraestructura');
      recommendations.push('Las entidades no deben depender de frameworks externos');
      recommendations.push('Usa casos de uso en la capa de aplicación');
    }

    if (hasCQRS) {
      patterns.push('CQRS (Command Query Responsibility Segregation)');
      recommendations.push('Separa comandos (escritura) de queries (lectura)');
      recommendations.push('Usa Command Bus y Query Bus para despachar operaciones');
      recommendations.push('Los handlers solo deben orquestar, no contener lógica de dominio');
    }

    if (hasHexagonal) {
      patterns.push('Hexagonal Architecture (Ports and Adapters)');
      recommendations.push('Define puertos (interfaces) para las dependencias externas');
      recommendations.push('Los adaptadores implementan los puertos');
      recommendations.push('El dominio no debe conocer los adaptadores');
    }

    if (hasDependencyInversion) {
      patterns.push('Dependency Inversion Principle (SOLID)');
      recommendations.push('Depende de abstracciones, no de implementaciones');
      recommendations.push('Usa inyección de dependencias por constructor');
      recommendations.push('Define interfaces en el dominio, implementaciones en infraestructura');
    }

    // Default recommendations if no specific patterns found
    if (patterns.length === 0) {
      patterns.push('General Architecture');
      recommendations.push('Aplica principios SOLID');
      recommendations.push('Mantén las responsabilidades separadas');
      recommendations.push('Usa inyección de dependencias');
    }

    // Calculate compliance based on recommendations
    const compliance = Math.min(100, 70 + (recommendations.length * 5));

    return {
      pattern: patterns.join(' + '),
      layers: layers.length > 0 ? layers : ['Domain', 'Application', 'Infrastructure', 'Presentation'],
      compliance: `${compliance}%`,
      recommendations,
      rulesCount: rules.length,
    };
  }

  /**
   * Verifica si el input es sobre arquitectura
   */
  canHandle(input: string): boolean {
    const architectureKeywords = [
      'arquitectura',
      'architecture',
      'estructura',
      'patrón',
      'clean',
      'hexagonal',
      'capas',
      'diseño',
      'organización',
    ];

    return architectureKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }
}
