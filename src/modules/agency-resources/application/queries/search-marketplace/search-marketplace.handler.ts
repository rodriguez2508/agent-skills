import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { SearchMarketplaceQuery } from './search-marketplace.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import {
  AgencySkillDto,
  AgencyRuleDto,
  AgencyAgentDto,
  AgencyWorkflowDto,
} from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(SearchMarketplaceQuery)
export class SearchMarketplaceHandler implements IQueryHandler<SearchMarketplaceQuery> {
  private readonly logger = new Logger(SearchMarketplaceHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: SearchMarketplaceQuery): Promise<{
    skills: AgencySkillDto[];
    rules: AgencyRuleDto[];
    agents: AgencyAgentDto[];
    workflows: AgencyWorkflowDto[];
  }> {
    const result = await this.repo.findMarketplaceResources(query.agencyId);
    return {
      skills: result.skills.map(AgencySkillDto.fromEntity),
      rules: result.rules.map(AgencyRuleDto.fromEntity),
      agents: result.agents.map(AgencyAgentDto.fromEntity),
      workflows: result.workflows.map(AgencyWorkflowDto.fromEntity),
    };
  }
}
