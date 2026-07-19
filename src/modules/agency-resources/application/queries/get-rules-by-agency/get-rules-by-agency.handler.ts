import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetRulesByAgencyQuery } from './get-rules-by-agency.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyRuleDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetRulesByAgencyQuery)
export class GetRulesByAgencyHandler implements IQueryHandler<GetRulesByAgencyQuery> {
  private readonly logger = new Logger(GetRulesByAgencyHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetRulesByAgencyQuery): Promise<AgencyRuleDto[]> {
    const rules = await this.repo.findRulesByAgencyId(query.agencyId);
    return rules.map(AgencyRuleDto.fromEntity);
  }
}
