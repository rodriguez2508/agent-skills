import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { GraphifyExecutorService } from './graphify-executor.service';

@Injectable()
export class GraphifyAgent extends BaseAgent {
  constructor(private readonly graphifyExecutor: GraphifyExecutorService) {
    super(
      'GraphifyAgent',
      'Construye y consulta grafos de conocimiento del proyecto usando Graphify CLI',
    );
  }

  protected async handle(request: AgentRequest): Promise<any> {
    const input = request.input.toLowerCase();
    const options = request.options || {};
    const projectPath = options.projectPath || process.cwd();

    if (input.includes('graphify path') || input.includes('camino entre')) {
      const match = input.match(
        /(?:path|camino entre)\s+"?([^"]+)"?\s+(?:y|and|to)\s+"?([^"]+)"?/i,
      );
      if (match) {
        const result = await this.graphifyExecutor.path(
          match[1].trim(),
          match[2].trim(),
        );
        return {
          message: `Camino más corto entre "${match[1]}" y "${match[2]}":\n${result.path.join('\n')}`,
        };
      }
      return { message: 'Usa: graphify path "NodoA" "NodoB"' };
    }

    if (input.includes('graphify explain') || input.includes('explica')) {
      const match = input.match(/(?:explain|explica)\s+"?([^"]+)"?/i);
      if (match) {
        const result = await this.graphifyExecutor.explain(match[1].trim());
        return { message: result.explanation };
      }
      return { message: 'Usa: graphify explain "Nodo"' };
    }

    if (
      input.includes('graphify query') ||
      input.includes('pregunta') ||
      input.includes('consulta')
    ) {
      const match = input.match(/(?:query|pregunta|consulta)\s+"?([^"]+)"?/i);
      if (match) {
        const result = await this.graphifyExecutor.query(match[1].trim());
        return { message: result.answer };
      }
      return { message: 'Usa: graphify query "tu pregunta"' };
    }

    const mode = input.includes('deep') ? 'deep' : 'standard';
    const update = input.includes('update') || input.includes('actualizar');
    const obsidian = input.includes('obsidian');
    const wiki = input.includes('wiki');

    const result = await this.graphifyExecutor.buildGraph({
      path: projectPath,
      mode,
      update,
      obsidian,
      wiki,
    });

    return {
      message: `Grafo de conocimiento construido para ${projectPath}\n\n${result}`,
      graphPath: `${projectPath}/graphify-out`,
    };
  }

  canHandle(input: string): boolean {
    const lower = input.toLowerCase();
    return (
      lower.includes('graphify') ||
      lower.includes('grafo') ||
      lower.includes('knowledge graph')
    );
  }
}
