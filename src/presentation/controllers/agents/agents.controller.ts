/**
 * Agents Controller
 *
 * Endpoints para ejecutar agentes desde MCP externo
 */

import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebSearchAgent } from '@agents/web-search/web-search.agent';
import { RouterAgent } from '@agents/router/router.agent';
import { AnalysisAgent } from '@agents/analysis/analysis.agent';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly webSearchAgent: WebSearchAgent,
    private readonly routerAgent: RouterAgent,
    private readonly analysisAgent: AnalysisAgent,
  ) {}

  @Post('web-search')
  @ApiOperation({ summary: 'Execute web search agent' })
  async webSearch(@Body() body: { input: string; limit?: number }) {
    const result = await this.webSearchAgent.execute({
      input: body.input,
      options: { limit: body.limit || 10 },
    });
    return result;
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute a specific agent (router or analysis)' })
  async executeAgent(
    @Body()
    body: {
      agent: 'router' | 'analysis';
      task: string;
      projectPath?: string;
      clearContext?: boolean;
    },
  ) {
    const { agent, task, projectPath, clearContext } = body;

    // Execute the specified agent with clean context if requested
    const request = {
      input: task,
      options: {
        projectPath,
        clearContext,
      },
    };

    let result;
    if (agent === 'router') {
      result = await this.routerAgent.execute(request);
    } else if (agent === 'analysis') {
      result = await this.analysisAgent.execute(request);
    } else {
      return {
        success: false,
        error: `Unknown agent: ${agent}`,
      };
    }

    return result;
  }

  @Get('list')
  @ApiOperation({ summary: 'List all available agents' })
  listAgents() {
    return {
      agents: ['WebSearchAgent', 'RouterAgent', 'AnalysisAgent'],
    };
  }
}
