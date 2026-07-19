import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Logger, Inject } from '@nestjs/common';
import { GetSkillByIdQuery } from './get-skill-by-id.query';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AgencySkillDto } from '@agency-resources/presentation/dto/agency-resources-response.dto';

@QueryHandler(GetSkillByIdQuery)
export class GetSkillByIdHandler implements IQueryHandler<GetSkillByIdQuery> {
  private readonly logger = new Logger(GetSkillByIdHandler.name);

  constructor(
    @Inject(AGENCY_RESOURCES_REPOSITORY)
    private readonly repo: IAgencyResourcesRepository,
  ) {}

  async execute(query: GetSkillByIdQuery): Promise<AgencySkillDto | null> {
    const skill = await this.repo.findSkillById(query.skillId);
    if (!skill || skill.agencyId !== query.agencyId) return null;
    return AgencySkillDto.fromEntity(skill);
  }
}
