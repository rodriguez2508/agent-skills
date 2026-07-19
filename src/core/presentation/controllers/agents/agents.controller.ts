/**
 * Agents Controller
 *
 * Endpoints para ejecutar agentes desde MCP externo
 */

import { Controller, Post, Body, Get, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentRegistry } from '@core/agents/agent-registry';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentRegistry: AgentRegistry) {}

  @Post('execute')
  @ApiOperation({ summary: 'Execute any registered agent dynamically' })
  async executeAgent(
    @Body()
    body: {
      agent: string;
      task: string;
      projectPath?: string;
      clearContext?: boolean;
      sessionId?: string;
      userId?: string;
      issueId?: string;
    },
  ) {
    const { agent, task, projectPath, clearContext, sessionId, userId, issueId } = body;

    if (!agent || !task) {
      throw new BadRequestException('agent and task are required');
    }

    const target = this.agentRegistry.getAgent(agent);
    if (!target) {
      return {
        success: false,
        error: `Unknown agent: ${agent}. Available: ${this.agentRegistry.getAgentIds().join(', ')}`,
      };
    }

    return target.execute({
      input: task,
      options: { projectPath, clearContext, sessionId, userId, issueId },
    });
  }

  @Get('list')
  @ApiOperation({ summary: 'List all registered agents' })
  listAgents() {
    return {
      count: this.agentRegistry.count(),
      agents: this.agentRegistry.listAgents().map((a) => ({
        id: a.agentId,
        description: a.description,
      })),
    };
  }
}
