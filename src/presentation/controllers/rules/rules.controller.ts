import { Controller, Get, Post, Body, Query, BadRequestException, Logger } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SearchRulesQuery } from '@application/queries/search-rules/search-rules.query';
import { GetRuleQuery } from '@application/queries/get-rule/get-rule.query';
import { ListRulesQuery } from '@application/queries/list-rules/list-rules.query';
import { SearchRulesDto } from '@presentation/dto/search-rules.dto';
import { RuleResponseDto, RuleResultDto } from '@presentation/dto/rule-response.dto';
import { RulesEngine } from '@infrastructure/rules/rules-engine';

@ApiTags('Rules')
@Controller('rules')
export class RulesController {
  private readonly logger = new Logger(RulesController.name);

  constructor(
    private readonly queryBus: QueryBus,
    private readonly rulesEngine: RulesEngine,
  ) {}

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
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    const limitValue = limit ? parseInt(limit, 10) : 10;
    if (isNaN(limitValue) || limitValue < 1 || limitValue > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const results = await this.queryBus.execute(
      new SearchRulesQuery(query, category, limitValue),
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
    if (!id) {
      throw new BadRequestException('Query parameter "id" is required');
    }

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
    @Query('limit') limit?: string,
  ) {
    const limitValue = limit ? parseInt(limit, 10) : 50;
    if (isNaN(limitValue) || limitValue < 1 || limitValue > 200) {
      throw new BadRequestException('Limit must be between 1 and 200');
    }

    const rules = await this.queryBus.execute(
      new ListRulesQuery(category, limitValue),
    );
    return { rules };
  }

  @Post('reload')
  @ApiOperation({ summary: 'Reload all rules from filesystem (clear cache)' })
  @ApiOkResponse({
    description: 'Rules reloaded successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        count: { type: 'number' },
        rules: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async reloadRules() {
    this.logger.log('🔄 Reloading rules from filesystem...');
    
    // Reload rules from filesystem
    await this.rulesEngine.loadRules();
    
    const allRules = this.rulesEngine.getAllRules();
    
    this.logger.log(`✅ Rules reloaded: ${allRules.length} rules`);
    
    return {
      message: `Rules reloaded successfully: ${allRules.length} rules`,
      count: allRules.length,
      rules: allRules.map(r => `${r.id} (${r.category})`),
    };
  }
}
