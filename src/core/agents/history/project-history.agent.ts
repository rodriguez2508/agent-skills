import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { ContextNodeService, ProjectSummary } from '@modules/contexts/application/services/context-node.service';
import { ProjectsService } from '@modules/projects/application/services/projects.service';

@Injectable()
export class ProjectHistoryAgent extends BaseAgent {
  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly contextNodeService: ContextNodeService,
    private readonly projectsService: ProjectsService,
  ) {
    super('ProjectHistoryAgent', 'Recupera y resume el historial de sesiones y decisiones de un proyecto');
  }

  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    const projectPath = request.options?.projectPath as string | undefined;

    this.agentLogger.info(this.agentId, '📜 Recuperando historial del proyecto', {
      projectPath,
    });

    if (!projectPath) {
      return {
        success: true,
        data: {
          message:
            'No se puede recuperar el historial sin un `projectPath`. ' +
            'Asegúrate de pasar el path absoluto del proyecto en la solicitud.',
        },
      };
    }

    const project = await this.projectsService.findByPath(projectPath);

    if (!project) {
      return {
        success: true,
        data: {
          message:
            `No se encontró el proyecto en la ruta \`${projectPath}\`. ` +
            'Usa la herramienta `register_project` para registrarlo primero.',
        },
      };
    }

    const summary = await this.contextNodeService.getProjectSummary(
      project.id,
      request.input,
    );

    return {
      success: true,
      data: {
        message: this.formatSummary(project.name, summary),
        projectId: project.id,
        projectName: project.name,
        summary,
      },
    };
  }

  private formatSummary(projectName: string, s: ProjectSummary): string {
    const lines: string[] = [
      `## Historial del Proyecto: ${projectName}`,
      '',
      `**Mensajes indexados:** ${s.totalMessages}`,
      '',
    ];

    if (s.issuesWorked.length > 0) {
      lines.push('### Issues trabajados');
      s.issuesWorked.forEach((i) => lines.push(`- ${i}`));
      lines.push('');
    }

    if (s.keyDecisions.length > 0) {
      lines.push('### Decisiones clave');
      s.keyDecisions.slice(0, 8).forEach((d) => lines.push(`- ${d}`));
      lines.push('');
    }

    if (s.modulesModified.length > 0) {
      lines.push('### Módulos modificados');
      s.modulesModified.slice(0, 20).forEach((m) => lines.push(`- \`${m}\``));
      lines.push('');
    }

    if (s.relevantChunks.length > 0) {
      lines.push('### Contexto semántico relevante');
      s.relevantChunks.slice(0, 3).forEach((c) => {
        lines.push(`> ${c.content.replace(/\n/g, ' ').substring(0, 250)}`);
        lines.push('');
      });
    }

    if (
      s.totalMessages === 0 &&
      s.issuesWorked.length === 0 &&
      s.keyDecisions.length === 0
    ) {
      lines.push(
        '_No se encontró historial previo. Las conversaciones futuras quedarán indexadas automáticamente._',
      );
    }

    const result = lines.join('\n');
    // Límite duro de 2000 chars para no saturar el contexto del agente
    return result.length > 2000 ? result.substring(0, 1997) + '…' : result;
  }
}
