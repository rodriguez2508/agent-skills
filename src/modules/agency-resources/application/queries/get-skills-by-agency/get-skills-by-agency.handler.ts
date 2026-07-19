import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetSkillsByAgencyQuery } from './get-skills-by-agency.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencySkillDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetSkillsByAgencyQuery)
export class GetSkillsByAgencyHandler implements IQueryHandler<GetSkillsByAgencyQuery> {
  private readonly logger = new Logger(GetSkillsByAgencyHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetSkillsByAgencyQuery): Promise<AgencySkillDto[]> {
    const skills = await this.repo.findSkillsByAgencyId(query.agencyId);
    return skills.map(AgencySkillDto.fromEntity);
  }
}
