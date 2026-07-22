/**
 * Agency DTOs
 */

import { Agency } from '../../domain/entities/agency.entity';
import { AgencyMember } from '../../domain/entities/agency-member.entity';
import { AgencyTemplate } from '../../domain/entities/agency-template.entity';

// ───────────────────────────────
//  Request DTOs
// ───────────────────────────────

export interface CreateAgencyRequestDto {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  settings?: Record<string, any>;
}

export interface UpdateAgencyRequestDto {
  name?: string;
  slug?: string;
  description?: string;
  logo?: string;
  isPublic?: boolean;
  settings?: Record<string, any>;
  planTier?: string;
}

export interface CreateTemplateRequestDto {
  name: string;
  description?: string;
  category?: string;
  skills?: string[];
  rules?: string[];
  workflow?: Record<string, any>;
  persona?: Record<string, any>;
}

export interface UpdateTemplateRequestDto {
  name?: string;
  description?: string;
  category?: string;
  skills?: string[];
  rules?: string[];
  workflow?: Record<string, any>;
  persona?: Record<string, any>;
  version?: string;
}

export interface PublishTemplateRequestDto {
  price?: number;
}

export interface AddMemberRequestDto {
  userId: string;
  role?: string;
}

// ───────────────────────────────
//  Response DTOs
// ───────────────────────────────

export interface AgencyStatsDto {
  totalAgents: number;
  totalProjects: number;
  totalSessions: number;
  totalMemoryItems: number;
  totalSkills: number;
}

export interface SessionSummaryDto {
  id: string;
  sessionId: string;
  status: string;
  title?: string;
  messageCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  lastActivityAt?: Date;
}

export interface AgencyResponseDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  ownerId: string;
  ownerEmail?: string;
  planTier: string;
  isActive: boolean;
  isPublic: boolean;
  settings?: Record<string, any>;
  stats?: AgencyStatsDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgencyDetailResponseDto extends AgencyResponseDto {
  members: AgencyMemberDto[];
  templates: AgencyTemplateDto[];
}

export interface AgencyMemberDto {
  id: string;
  userId: string;
  role: string;
  permissions?: Record<string, any>;
  createdAt: Date;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  lastIpAddress?: string;
}

export interface AgencyTemplateDto {
  id: string;
  agencyId: string;
  name: string;
  description?: string;
  category: string;
  skills?: string[];
  rules?: string[];
  workflow?: Record<string, any>;
  persona?: Record<string, any>;
  price: number;
  isPublished: boolean;
  downloadCount: number;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

// ───────────────────────────────
//  Mappers
// ───────────────────────────────

export function toAgencyResponse(
  agency: Agency,
  extras?: { ownerEmail?: string; stats?: AgencyStatsDto },
): AgencyResponseDto {
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.slug,
    description: agency.description,
    logo: agency.logo,
    ownerId: agency.ownerId,
    ownerEmail: extras?.ownerEmail,
    planTier: agency.planTier,
    isActive: true,
    isPublic: agency.isPublic,
    settings: agency.settings as Record<string, any> | undefined,
    stats: extras?.stats,
    createdAt: agency.createdAt,
    updatedAt: agency.updatedAt,
  };
}

export function toAgencyDetailResponse(
  agency: Agency,
  members: AgencyMember[],
  templates: AgencyTemplate[],
): AgencyDetailResponseDto {
  return {
    ...toAgencyResponse(agency),
    members: members.map(toMemberDto),
    templates: templates.map(toTemplateDto),
  };
}

export function toMemberDto(member: AgencyMember): AgencyMemberDto {
  return {
    id: member.id,
    userId: member.userId,
    role: member.role,
    permissions: member.permissions as Record<string, any> | undefined,
    createdAt: member.createdAt,
  };
}

export function toTemplateDto(
  template: AgencyTemplate,
): AgencyTemplateDto {
  return {
    id: template.id,
    agencyId: template.agencyId,
    name: template.name,
    description: template.description,
    category: template.category,
    skills: template.skills,
    rules: template.rules,
    workflow: template.workflow as Record<string, any> | undefined,
    persona: template.persona as Record<string, any> | undefined,
    price: template.price,
    isPublished: template.isPublished,
    downloadCount: template.downloadCount,
    version: template.version,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
