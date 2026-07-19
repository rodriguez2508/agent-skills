import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetRuleByIdQuery } from './get-rule-by-id.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyRuleDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetRuleByIdQuery)
export class GetRuleByIdHandler implements IQueryHandler<GetRuleByIdQuery> {
  private readonly logger = new Logger(GetRuleByIdHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetRuleByIdQuery): Promise<AgencyRuleDto | null> {
    const rule = await this.repo.findRuleById(query.ruleId);
    if (!rule || rule.agencyId !== query.agencyId) return null;
    return AgencyRuleDto.fromEntity(rule);
  }
}
