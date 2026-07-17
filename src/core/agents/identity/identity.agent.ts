import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * IdentityAgent - Gestiona la identidad y contexto MCP
 * Aplica el prefijo "🎓 Según CodeMentor MCP" y gestiona preferencias
 */
@Injectable()
export class IdentityAgent extends BaseAgent {
  private readonly mcpPrefix = '🎓 **Según CodeMentor MCP**';

  constructor(private readonly agentLogger: AgentLoggerService) {
    super(
      'IdentityAgent',
      'Gestiona la identidad MCP y aplica formato a las respuestas',
    );
  }

  /**
   * Maneja la solicitud aplicando identidad MCP
   */
  protected async handle(request: AgentRequest): Promise<any> {
    const content = request.input;
    const context = request.context || {};

    this.agentLogger.info(this.agentId, 'Aplicando identidad MCP', {
      contentLength: content.length,
      context,
    });

    // Aplicar prefijo MCP
    const formattedContent = this.applyMcpPrefix(content);

    // Agregar contexto de usuario si existe
    if (context.userPreferences) {
      this.agentLogger.debug(
        this.agentId,
        'Preferencias de usuario aplicadas',
        {
          language: context.userPreferences.language,
        },
      );
    }

    return {
      original: content,
      formatted: formattedContent,
      mcpPrefix: this.mcpPrefix,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Aplica el prefijo MCP a un contenido
   */
  applyMcpPrefix(content: string): string {
    return `${this.mcpPrefix}: ${content}`;
  }

  /**
   * Obtiene el prefijo MCP
   */
  getMcpPrefix(): string {
    return this.mcpPrefix;
  }

  /**
   * Formatea una respuesta de agente con identidad MCP
   */
  formatAgentResponse(agentName: string, content: string): string {
    const header = `${this.mcpPrefix} (${agentName})`;
    return `${header}:\n\n${content}`;
  }

  /**
   * Verifica si el input es sobre identidad MCP
   */
  canHandle(input: string): boolean {
    const identityKeywords = [
      'quién eres',
      'quien eres',
      'identidad',
      'prefijo',
      'mcp',
      'codementor',
      'tu nombre',
    ];

    return identityKeywords.some((keyword) =>
      input.toLowerCase().includes(keyword),
    );
  }
}
