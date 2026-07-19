import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetWorkflowByIdQuery } from './get-workflow-by-id.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencyWorkflowDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetWorkflowByIdQuery)
export class GetWorkflowByIdHandler implements IQueryHandler<GetWorkflowByIdQuery> {
  private readonly logger = new Logger(GetWorkflowByIdHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetWorkflowByIdQuery): Promise<AgencyWorkflowDto | null> {
    const workflow = await this.repo.findWorkflowById(query.workflowId);
    if (!workflow || workflow.agencyId !== query.agencyId) return null;
    return AgencyWorkflowDto.fromEntity(workflow);
  }
}
