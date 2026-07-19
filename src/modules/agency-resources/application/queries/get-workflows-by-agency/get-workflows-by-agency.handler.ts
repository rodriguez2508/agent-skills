import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetWorkflowsByAgencyQuery } from './get-workflows-by-agency.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyWorkflowDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetWorkflowsByAgencyQuery)
export class GetWorkflowsByAgencyHandler implements IQueryHandler<GetWorkflowsByAgencyQuery> {
  private readonly logger = new Logger(GetWorkflowsByAgencyHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetWorkflowsByAgencyQuery): Promise<AgencyWorkflowDto[]> {
    const workflows = await this.repo.findWorkflowsByAgencyId(query.agencyId);
    return workflows.map(AgencyWorkflowDto.fromEntity);
  }
}
