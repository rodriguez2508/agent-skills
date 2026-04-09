import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for loading skill templates and asset files.
 * Reads from src/assets/skills/ directory structure.
 */
@Injectable()
export class AssetLoaderService implements OnModuleInit {
  private readonly logger = new Logger(AssetLoaderService.name);
  private readonly assetsBasePath: string;
  private cache = new Map<string, string>();

  constructor() {
    // Assets are relative to the project root
    this.assetsBasePath = path.join(process.cwd(), 'src', 'assets', 'skills');
  }

  async onModuleInit(): Promise<void> {
    try {
      await fs.access(this.assetsBasePath);
      this.logger.log(`Assets directory found: ${this.assetsBasePath}`);
    } catch {
      this.logger.warn(
        `Assets directory not found: ${this.assetsBasePath}. Skills will not be available.`,
      );
    }
  }

  /**
   * Loads a skill template by its ID.
   * Expected path: src/assets/skills/{category}/{skillId}/SKILL.md
   */
  async loadSkill(skillId: string, category?: string): Promise<string | null> {
    const cacheKey = `skill:${category || 'unknown'}:${skillId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Try with category first
    if (category) {
      const skillPath = path.join(this.assetsBasePath, category, skillId, 'SKILL.md');
      const content = await this.tryReadFile(skillPath);
      if (content) {
        this.cache.set(cacheKey, content);
        return content;
      }
    }

    // Try without category (flat structure)
    const flatPath = path.join(this.assetsBasePath, skillId, 'SKILL.md');
    const content = await this.tryReadFile(flatPath);
    if (content) {
      this.cache.set(cacheKey, content);
      return content;
    }

    this.logger.debug(`Skill template not found: ${skillId}`);
    return null;
  }

  /**
   * Loads the SDD orchestrator template.
   */
  async loadSddOrchestrator(): Promise<string | null> {
    const cacheKey = 'orchestrator:sdd';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const orchestratorPath = path.join(
      this.assetsBasePath,
      'orchestrator',
      'sdd-orchestrator.md',
    );
    const content = await this.tryReadFile(orchestratorPath);
    if (content) {
      this.cache.set(cacheKey, content);
    }
    return content;
  }

  /**
   * Loads a persona template by its ID.
   */
  async loadPersona(personaId: string): Promise<string | null> {
    const cacheKey = `persona:${personaId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const personaPath = path.join(this.assetsBasePath, 'personas', `${personaId}.md`);
    const content = await this.tryReadFile(personaPath);
    if (content) {
      this.cache.set(cacheKey, content);
    }
    return content;
  }

  /**
   * Lists all available skill IDs.
   */
  async listAvailableSkills(): Promise<{ id: string; category: string }[]> {
    const skills: { id: string; category: string }[] = [];

    try {
      const categories = await fs.readdir(this.assetsBasePath, { withFileTypes: true });

      for (const category of categories) {
        if (!category.isDirectory()) continue;

        const categoryPath = path.join(this.assetsBasePath, category.name);
        const items = await fs.readdir(categoryPath, { withFileTypes: true });

        for (const item of items) {
          if (!item.isDirectory()) continue;

          const skillPath = path.join(categoryPath, item.name, 'SKILL.md');
          try {
            await fs.access(skillPath);
            skills.push({ id: item.name, category: category.name });
          } catch {
            // No SKILL.md in this directory
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Error listing skills: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return skills;
  }

  /**
   * Clears the asset cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Tries to read a file, returns null if not found.
   */
  private async tryReadFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
}
