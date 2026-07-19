/**
 * Agency Repository Port
 *
 * Defines the contract for agency persistence.
 */

import { Agency } from '../entities/agency.entity';
import { AgencyMember } from '../entities/agency-member.entity';
import { AgencyTemplate } from '../entities/agency-template.entity';

export interface CreateAgencyData {
  name: string;
  slug: string;
  ownerId: string;
  description?: string;
  logo?: string;
  settings?: Record<string, any>;
}

export interface CreateAgencyMemberData {
  agencyId: string;
  userId: string;
  role: string;
  permissions?: Record<string, any>;
}

export interface CreateAgencyTemplateData {
  agencyId: string;
  name: string;
  description?: string;
  category?: string;
  skills?: string[];
  rules?: string[];
  workflow?: Record<string, any>;
  persona?: Record<string, any>;
  version?: string;
}

export abstract class IAgencyRepository {
  // Agencies
  abstract create(data: CreateAgencyData): Promise<Agency>;
  abstract findById(id: string): Promise<Agency | null>;
  abstract findBySlug(slug: string): Promise<Agency | null>;
  abstract findByOwnerId(ownerId: string): Promise<Agency[]>;
  abstract findAgenciesByMemberId(userId: string): Promise<Agency[]>;
  abstract findAll(limit?: number): Promise<Agency[]>;
  abstract findPublic(limit?: number): Promise<Agency[]>;
  abstract update(id: string, data: Partial<Agency>): Promise<Agency>;
  abstract delete(id: string): Promise<void>;
  abstract count(): Promise<number>;

  // Members
  abstract addMember(data: CreateAgencyMemberData): Promise<AgencyMember>;
  abstract findMembersByAgencyId(agencyId: string): Promise<AgencyMember[]>;
  abstract findMemberByUserId(
    agencyId: string,
    userId: string,
  ): Promise<AgencyMember | null>;
  abstract updateMemberRole(
    agencyId: string,
    userId: string,
    role: string,
  ): Promise<AgencyMember>;
  abstract removeMember(agencyId: string, userId: string): Promise<void>;

  // Templates
  abstract createTemplate(
    data: CreateAgencyTemplateData,
  ): Promise<AgencyTemplate>;
  abstract findTemplateById(id: string): Promise<AgencyTemplate | null>;
  abstract findTemplatesByAgencyId(
    agencyId: string,
  ): Promise<AgencyTemplate[]>;
  abstract findPublishedTemplates(
    category?: string,
    limit?: number,
  ): Promise<AgencyTemplate[]>;
  abstract searchTemplates(
    query: string,
    category?: string,
    limit?: number,
  ): Promise<AgencyTemplate[]>;
  abstract updateTemplate(
    id: string,
    data: Partial<AgencyTemplate>,
  ): Promise<AgencyTemplate>;
  abstract incrementTemplateDownloads(id: string): Promise<void>;
  abstract deleteTemplate(id: string): Promise<void>;
}
