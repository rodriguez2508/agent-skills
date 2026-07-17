/**
 * Skill Resolver Service
 *
 * Resolves skills from two sources:
 * 1. Public skills stored on disk (core/skills/) — available to all agencies
 * 2. Agency-specific skills stored in DB (agency_templates) — custom per agency
 *
 * Priority: agency custom skills override public ones with the same name.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SkillFileService } from './skill-file.service';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';

export interface ResolvedSkill {
  name: string;
  description: string;
  source: 'public' | 'agency';
  templateId?: string;
  category?: string;
  skills?: string[];
  rules?: string[];
  workflow?: Record<string, any>;
  persona?: Record<string, any>;
  body?: string;
  version?: string;
  score?: number;
}

export interface ResolvedSkillResult {
  total: number;
  skills: ResolvedSkill[];
}

@Injectable()
export class SkillResolverService {
  private readonly logger = new Logger(SkillResolverService.name);

  constructor(
    private readonly skillFileService: SkillFileService,
    private readonly agencyRepository: IAgencyRepository,
  ) {}

  /**
   * Resolves ALL available skills for an agency (public + custom).
   * Agency custom skills with the same name as public ones override them.
   */
  async resolveAll(agencyId: string): Promise<ResolvedSkillResult> {
    // 1. Get public skills from disk
    const publicSkills = await this.skillFileService.listSkills();

    // 2. Get agency templates from DB
    const templates = await this.agencyRepository.findTemplatesByAgencyId(agencyId);

    // 3. Build lookup map for agency skills (by name)
    const agencySkillNames = new Set<string>();
    const agencySkills: ResolvedSkill[] = [];

    for (const template of templates) {
      agencySkillNames.add(template.name);
      agencySkills.push({
        name: template.name,
        description: template.description || template.name,
        source: 'agency',
        templateId: template.id,
        category: template.category,
        skills: template.skills,
        rules: template.rules,
        workflow: template.workflow as Record<string, any> | undefined,
        persona: template.persona as Record<string, any> | undefined,
        version: template.version,
      });
    }

    // 4. Merge: public skills + agency skills (agency overrides public by name)
    const merged: ResolvedSkill[] = [
      ...publicSkills
        .filter((s) => !agencySkillNames.has(s.name)) // exclude overridden
        .map((s) => ({
          name: s.name,
          description: s.description,
          source: 'public' as const,
        })),
      ...agencySkills,
    ];

    this.logger.debug(
      `Resolved ${merged.length} skills for agency ${agencyId}: ` +
        `${merged.length - agencySkills.length} public, ${agencySkills.length} custom`,
    );

    return { total: merged.length, skills: merged };
  }

  /**
   * Searches skills across both sources for an agency.
   * Returns combined results sorted by relevance.
   */
  async search(
    agencyId: string,
    query: string,
    limit = 10,
  ): Promise<ResolvedSkillResult> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.resolveAll(agencyId);

    // 1. Search public skills via BM25-like scoring
    const publicMatches = await this.skillFileService.searchSkills(query, limit);

    // 2. Get all agency templates and score them
    const templates = await this.agencyRepository.findTemplatesByAgencyId(agencyId);
    const scoredTemplates: ResolvedSkill[] = [];

    for (const template of templates) {
      const searchText = `${template.name} ${template.description || ''} ${(template.skills || []).join(' ')}`.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (searchText.includes(term)) {
          if (template.name.toLowerCase().includes(term)) score += 0.5;
          if ((template.description || '').toLowerCase().includes(term)) score += 0.3;
          if ((template.skills || []).some((s) => s.toLowerCase().includes(term))) score += 0.2;
        }
      }

      if (score > 0) {
        scoredTemplates.push({
          name: template.name,
          description: template.description || template.name,
          source: 'agency',
          templateId: template.id,
          category: template.category,
          skills: template.skills,
          rules: template.rules,
          workflow: template.workflow as Record<string, any> | undefined,
          persona: template.persona as Record<string, any> | undefined,
          version: template.version,
          score: score,
        });
      }
    }

    // 3. Build agency name set for dedup
    const agencyNames = new Set(scoredTemplates.map((t) => t.name));

    // 4. Merge: public (exclude overridden by agency) + agency templates
    const merged: ResolvedSkill[] = [
      ...publicMatches
        .filter((m) => !agencyNames.has(m.skill.name))
        .map((m) => ({
          name: m.skill.name,
          description: m.skill.description,
          source: 'public' as const,
          score: m.score,
        })),
      ...scoredTemplates,
    ];

    // 5. Sort by score descending, then name ascending
    merged.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return a.name.localeCompare(b.name);
    });

    const result = merged.slice(0, limit);

    this.logger.debug(
      `Searched skills for agency ${agencyId}: "${query}" → ${merged.length} total, returning ${result.length}`,
    );

    return { total: merged.length, skills: result };
  }

  /**
   * Gets a specific skill by name for an agency.
   * Checks agency templates first, then falls back to public.
   */
  async resolveByName(agencyId: string, name: string): Promise<ResolvedSkill | null> {
    // 1. Check agency templates first (custom overrides public)
    const templates = await this.agencyRepository.findTemplatesByAgencyId(agencyId);
    const match = templates.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );

    if (match) {
      return {
        name: match.name,
        description: match.description || match.name,
        source: 'agency',
        templateId: match.id,
        category: match.category,
        skills: match.skills,
        rules: match.rules,
        workflow: match.workflow as Record<string, any> | undefined,
        persona: match.persona as Record<string, any> | undefined,
        version: match.version,
      };
    }

    // 2. Fall back to public skill
    const publicSkill = await this.skillFileService.getSkill(name);
    if (publicSkill) {
      return {
        name: publicSkill.metadata.name,
        description: publicSkill.metadata.description,
        source: 'public',
        body: publicSkill.body,
        version: `v${publicSkill.metadata.version}`,
      };
    }

    return null;
  }
}
