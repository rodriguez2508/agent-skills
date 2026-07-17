/**
 * Search Templates Query Handler
 */

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { SearchTemplatesQuery } from './search-templates.query';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { AgencyTemplate } from '@modules/agencies/domain/entities/agency-template.entity';

export interface SearchTemplatesResult {
  templates: AgencyTemplate[];
  total: number;
}

@QueryHandler(SearchTemplatesQuery)
export class SearchTemplatesHandler
  implements IQueryHandler<SearchTemplatesQuery, SearchTemplatesResult>
{
  private readonly logger = new Logger(SearchTemplatesHandler.name);

  constructor(private readonly agencyRepository: IAgencyRepository) {}

  async execute(query: SearchTemplatesQuery): Promise<SearchTemplatesResult> {
    this.logger.debug(
      `🔍 Searching templates: "${query.query || '*'}" category=${query.category || 'all'}`,
    );

    const templates = await this.agencyRepository.searchTemplates(
      query.query || '',
      query.category,
      query.limit || 20,
    );

    return {
      templates,
      total: templates.length,
    };
  }
}
