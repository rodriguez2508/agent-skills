import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetAgentsByAgencyQuery } from './get-agents-by-agency.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyAgentDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetAgentsByAgencyQuery)
export class GetAgentsByAgencyHandler implements IQueryHandler<GetAgentsByAgencyQuery> {
  private readonly logger = new Logger(GetAgentsByAgencyHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetAgentsByAgencyQuery): Promise<AgencyAgentDto[]> {
    const agents = await this.repo.findAgentsByAgencyId(query.agencyId);
    return agents.map(AgencyAgentDto.fromEntity);
  }
}
