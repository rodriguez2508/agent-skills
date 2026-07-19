import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetAgentByIdQuery } from './get-agent-by-id.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyAgentDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetAgentByIdQuery)
export class GetAgentByIdHandler implements IQueryHandler<GetAgentByIdQuery> {
  private readonly logger = new Logger(GetAgentByIdHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetAgentByIdQuery): Promise<AgencyAgentDto | null> {
    const agent = await this.repo.findAgentById(query.agentId);
    if (!agent || agent.agencyId !== query.agencyId) return null;
    return AgencyAgentDto.fromEntity(agent);
  }
}
