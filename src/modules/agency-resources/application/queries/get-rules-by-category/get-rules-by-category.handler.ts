import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetRulesByCategoryQuery } from './get-rules-by-category.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyRuleDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetRulesByCategoryQuery)
export class GetRulesByCategoryHandler implements IQueryHandler<GetRulesByCategoryQuery> {
  private readonly logger = new Logger(GetRulesByCategoryHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetRulesByCategoryQuery): Promise<AgencyRuleDto[]> {
    const rules = await this.repo.findRulesByCategory(query.agencyId, query.category);
    return rules.map(AgencyRuleDto.fromEntity);
  }
}
