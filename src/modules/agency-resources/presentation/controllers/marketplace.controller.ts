import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AuthGuard } from '../../../auth/guard/auth.guard';
import { SearchMarketplaceQuery } from '@agency-resources/application/queries/search-marketplace/search-marketplace.query';
import {
  AgencySkillDto,
  AgencyRuleDto,
  AgencyAgentDto,
  AgencyWorkflowDto,
} from '../dto/agency-resources-response.dto';

@Controller('v1/agency/marketplace')
export class MarketplaceController {
  private readonly logger = new Logger(MarketplaceController.name);

  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async search(
    @Query('agencyId') agencyId?: string,
  ): Promise<{
    skills: AgencySkillDto[];
    rules: AgencyRuleDto[];
    agents: AgencyAgentDto[];
    workflows: AgencyWorkflowDto[];
  }> {
    return this.queryBus.execute(new SearchMarketplaceQuery(agencyId));
  }
}
