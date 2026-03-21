import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SearchRulesQuery } from '../../../application/queries/search-rules/search-rules.query';
import { GetRuleQuery } from '../../../application/queries/get-rule/get-rule.query';
import { ListRulesQuery } from '../../../application/queries/list-rules/list-rules.query';
import { SearchRulesDto } from '../../dto/search-rules.dto';
import { RuleResponseDto, RuleResultDto } from '../../dto/rule-response.dto';

@ApiTags('Rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Post('search')
  @ApiOperation({ summary: 'Search rules using BM25 algorithm' })
  @ApiOkResponse({
    description: 'List of rules matching the search query',
    type: [RuleResultDto],
  })
  async search(@Body() dto: SearchRulesDto) {
    const results = await this.queryBus.execute(
      new SearchRulesQuery(dto.query, dto.category, dto.limit),
    );
    return { results };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search rules using query params' })
  @ApiOkResponse({
    description: 'List of rules matching the search query',
    type: [RuleResultDto],
  })
  async searchGet(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    const results = await this.queryBus.execute(
      new SearchRulesQuery(query, category, limit ? parseInt(limit.toString(), 10) : 10),
    );
    return { results };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific rule by ID' })
  @ApiOkResponse({
    description: 'Rule details',
    type: RuleResponseDto,
  })
  async getRule(@Query('id') id: string) {
    const rule = await this.queryBus.execute(new GetRuleQuery(id));
    return { rule };
  }

  @Get()
  @ApiOperation({ summary: 'List all rules' })
  @ApiOkResponse({
    description: 'List of all rules',
    type: [RuleResponseDto],
  })
  async listRules(
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    const rules = await this.queryBus.execute(
      new ListRulesQuery(category, limit ? parseInt(limit.toString(), 10) : 50),
    );
    return { rules };
  }
}
