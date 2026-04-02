/**
 * Agents Controller
 *
 * Endpoints para ejecutar agentes desde MCP externo
 */

import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebSearchAgent } from '@agents/web-search/web-search.agent';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly webSearchAgent: WebSearchAgent) {}

  @Post('web-search')
  @ApiOperation({ summary: 'Execute web search agent' })
  async webSearch(@Body() body: { input: string; limit?: number }) {
    const result = await this.webSearchAgent.execute({
      input: body.input,
      options: { limit: body.limit || 10 },
    });
    return result;
  }

  @Get('list')
  @ApiOperation({ summary: 'List all available agents' })
  listAgents() {
    return {
      agents: [
        'WebSearchAgent',
        // Add more as they're implemented
      ],
    };
  }
}
