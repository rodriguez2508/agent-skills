/**
 * Get Agency Query Handler
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger, NotFoundException } from '@nestjs/common';
import { GetAgencyQuery } from './get-agency.query';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { Agency } from '@modules/agencies/domain/entities/agency.entity';
import { AgencyMember } from '@modules/agencies/domain/entities/agency-member.entity';
import { AgencyTemplate } from '@modules/agencies/domain/entities/agency-template.entity';

export interface GetAgencyResult {
  agency: Agency;
  members: AgencyMember[];
  templates: AgencyTemplate[];
}

@QueryHandler(GetAgencyQuery)
export class GetAgencyHandler
  implements IQueryHandler<GetAgencyQuery, GetAgencyResult>
{
  private readonly logger = new Logger(GetAgencyHandler.name);

  constructor(private readonly agencyRepository: IAgencyRepository) {}

  async execute(query: GetAgencyQuery): Promise<GetAgencyResult> {
    this.logger.debug(`🔍 Fetching agency: ${query.identifier}`);

    const agency = query.bySlug
      ? await this.agencyRepository.findBySlug(query.identifier)
      : await this.agencyRepository.findById(query.identifier);

    if (!agency) {
      throw new NotFoundException(
        `Agency not found: ${query.identifier}`,
      );
    }

    const [members, templates] = await Promise.all([
      this.agencyRepository.findMembersByAgencyId(agency.id),
      this.agencyRepository.findTemplatesByAgencyId(agency.id),
    ]);

    return { agency, members, templates };
  }
}
