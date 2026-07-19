/**
 * Agency Repository (TypeORM Implementation)
 *
 * Handles agency persistence with PostgreSQL for multi-tenancy.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Agency } from '../../domain/entities/agency.entity';
import { AgencyMember } from '../../domain/entities/agency-member.entity';
import { AgencyTemplate } from '../../domain/entities/agency-template.entity';
import {
  IAgencyRepository,
  CreateAgencyData,
  CreateAgencyMemberData,
  CreateAgencyTemplateData,
} from '../../domain/ports/agency-repository.port';

@Injectable()
export class AgencyRepository implements IAgencyRepository {
  private readonly logger = new Logger(AgencyRepository.name);

  constructor(
    @InjectRepository(Agency)
    private readonly agencyRepo: Repository<Agency>,
    @InjectRepository(AgencyMember)
    private readonly memberRepo: Repository<AgencyMember>,
    @InjectRepository(AgencyTemplate)
    private readonly templateRepo: Repository<AgencyTemplate>,
  ) {}

  // ───────────────────────────────
  //  Agencies
  // ───────────────────────────────

  async create(data: CreateAgencyData): Promise<Agency> {
    const agency = this.agencyRepo.create({
      name: data.name,
      slug: data.slug,
      ownerId: data.ownerId,
      description: data.description,
      logo: data.logo,
      settings: data.settings as any,
      isPublic: false,
      planTier: 'free' as any,
    });
    const saved = await this.agencyRepo.save(agency);
    this.logger.debug(`🏢 Agency created: ${saved.id} (${saved.slug})`);
    return saved;
  }

  async findById(id: string): Promise<Agency | null> {
    return this.agencyRepo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Agency | null> {
    return this.agencyRepo.findOne({ where: { slug } });
  }

  async findByOwnerId(ownerId: string): Promise<Agency[]> {
    return this.agencyRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAgenciesByMemberId(userId: string): Promise<Agency[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['agency'],
    });
    return memberships
      .map((m) => m.agency)
      .filter(Boolean) as Agency[];
  }

  async findAll(limit = 50): Promise<Agency[]> {
    return this.agencyRepo.find({
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findPublic(limit = 50): Promise<Agency[]> {
    return this.agencyRepo.find({
      where: { isPublic: true },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, data: Partial<Agency>): Promise<Agency> {
    await this.agencyRepo.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Agency not found after update: ${id}`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const agency = await this.findById(id);
    if (agency) {
      await this.agencyRepo.remove(agency);
      this.logger.debug(`🗑️ Agency deleted: ${id}`);
    }
  }

  async count(): Promise<number> {
    return this.agencyRepo.count();
  }

  // ───────────────────────────────
  //  Members
  // ───────────────────────────────

  async addMember(data: CreateAgencyMemberData): Promise<AgencyMember> {
    const member = this.memberRepo.create({
      agencyId: data.agencyId,
      userId: data.userId,
      role: data.role as any,
      permissions: data.permissions as any,
    });
    const saved = await this.memberRepo.save(member);
    this.logger.debug(`👤 Member added: ${saved.userId} → agency ${saved.agencyId}`);
    return saved;
  }

  async findMembersByAgencyId(agencyId: string): Promise<AgencyMember[]> {
    return this.memberRepo.find({
      where: { agencyId },
      order: { createdAt: 'ASC' },
    });
  }

  async findMemberByUserId(
    agencyId: string,
    userId: string,
  ): Promise<AgencyMember | null> {
    return this.memberRepo.findOne({
      where: { agencyId, userId },
    });
  }

  async updateMemberRole(
    agencyId: string,
    userId: string,
    role: string,
  ): Promise<AgencyMember> {
    await this.memberRepo.update({ agencyId, userId }, { role: role as any });
    const updated = await this.findMemberByUserId(agencyId, userId);
    if (!updated) {
      throw new Error(`Member not found: agency=${agencyId}, user=${userId}`);
    }
    return updated;
  }

  async removeMember(agencyId: string, userId: string): Promise<void> {
    const member = await this.findMemberByUserId(agencyId, userId);
    if (member) {
      await this.memberRepo.remove(member);
      this.logger.debug(`👋 Member removed: ${userId} from agency ${agencyId}`);
    }
  }

  // ───────────────────────────────
  //  Templates
  // ───────────────────────────────

  async createTemplate(data: CreateAgencyTemplateData): Promise<AgencyTemplate> {
    const template = this.templateRepo.create({
      agencyId: data.agencyId,
      name: data.name,
      description: data.description,
      category: (data.category || 'workflow') as any,
      skills: data.skills || [],
      rules: data.rules || [],
      workflow: data.workflow as any,
      persona: data.persona as any,
      isPublished: false,
      version: data.version || '1.0.0',
      price: 0,
      downloadCount: 0,
    });
    const saved = await this.templateRepo.save(template);
    this.logger.debug(`📄 Template created: ${saved.id} (${saved.name})`);
    return saved;
  }

  async findTemplateById(id: string): Promise<AgencyTemplate | null> {
    return this.templateRepo.findOne({ where: { id } });
  }

  async findTemplatesByAgencyId(agencyId: string): Promise<AgencyTemplate[]> {
    return this.templateRepo.find({
      where: { agencyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findPublishedTemplates(
    category?: string,
    limit = 50,
  ): Promise<AgencyTemplate[]> {
    const where: any = { isPublished: true };
    if (category) {
      where.category = category;
    }
    return this.templateRepo.find({
      where,
      take: limit,
      order: { downloadCount: 'DESC', createdAt: 'DESC' },
    });
  }

  async searchTemplates(
    query: string,
    category?: string,
    limit = 20,
  ): Promise<AgencyTemplate[]> {
    const where: any = { isPublished: true };

    if (query) {
      where.name = Like(`%${query}%`);
    }
    if (category) {
      where.category = category;
    }

    return this.templateRepo.find({
      where,
      take: limit,
      order: { downloadCount: 'DESC', createdAt: 'DESC' },
    });
  }

  async updateTemplate(
    id: string,
    data: Partial<AgencyTemplate>,
  ): Promise<AgencyTemplate> {
    await this.templateRepo.update(id, data);
    const updated = await this.findTemplateById(id);
    if (!updated) {
      throw new Error(`Template not found after update: ${id}`);
    }
    return updated;
  }

  async incrementTemplateDownloads(id: string): Promise<void> {
    await this.templateRepo.increment({ id }, 'downloadCount', 1);
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = await this.findTemplateById(id);
    if (template) {
      await this.templateRepo.remove(template);
      this.logger.debug(`🗑️ Template deleted: ${id}`);
    }
  }
}
