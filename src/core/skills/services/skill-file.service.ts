import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  SkillDocument,
  SkillMetadata,
  SkillSummary,
  SkillPatch,
  SkillMatch,
} from '../interfaces/skill-file.interface';

const SKILLS_DIR = '.agent-skills/skills';
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/**
 * Hermes-style File-based Skill Service
 *
 * Skills are stored as Markdown files in ~/.agent-skills/skills/
 * Each file has YAML frontmatter with metadata and a Markdown body.
 *
 * Features:
 * - Progressive disclosure (summaries first, full content on demand)
 * - Patch operations (not full rewrites)
 * - Relevance matching via keyword search
 * - Usage tracking for auto-evolution
 *
 * Mirrors Hermes Agent's ~/.hermes/skills/ architecture.
 */
@Injectable()
export class SkillFileService implements OnModuleInit {
  private readonly logger = new Logger(SkillFileService.name);
  private readonly skillsDir: string;
  private cache = new Map<string, SkillDocument>();

  constructor() {
    this.skillsDir = path.join(os.homedir(), SKILLS_DIR);
  }

  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(this.skillsDir, { recursive: true });
      this.logger.log(`📁 Skills directory: ${this.skillsDir}`);
      await this.refreshCache();
      this.logger.log(`📚 Loaded ${this.cache.size} skills from disk`);
    } catch (error) {
      this.logger.warn(`Could not initialize skills directory: ${error.message}`);
    }
  }

  // ─── CRUD Operations ────────────────────────────────────────────

  /**
   * Creates a new skill file on disk from markdown content.
   * If content doesn't include frontmatter, a minimal one is generated.
   */
  async createSkill(
    name: string,
    description: string,
    body: string,
    tags: string[] = [],
    agents?: string[],
    overwrite = false,
  ): Promise<SkillDocument> {
    // Check if skill already exists
    const existing = await this.getSkill(name);
    if (existing && !overwrite) {
      throw new Error(
        `Skill "${name}" ya existe. Usa overwrite=true para sobrescribir, o skill_patch para modificar.`,
      );
    }

    const now = new Date().toISOString().split('T')[0];
    const metadata: SkillMetadata = {
      name,
      description,
      tags,
      created: existing ? existing.metadata.created : now,
      updated: now,
      usageCount: existing ? existing.metadata.usageCount : 0,
      version: existing ? existing.metadata.version + 1 : 1,
      agents,
      source: overwrite ? 'overwrite' : 'manual',
    };

    const frontmatter = this.buildFrontmatter(metadata);
    const raw = `${frontmatter}\n${body.trim()}\n`;
    const filePath = path.join(this.skillsDir, `${name}.md`);

    await fs.writeFile(filePath, raw, 'utf-8');
    const doc: SkillDocument = { metadata, body: body.trim(), filePath, raw };
    this.cache.set(name, doc);

    const action = existing ? (overwrite ? 'sobrescrito' : 'actualizado') : 'creado';
    this.logger.log(`✨ Skill ${action}: ${name} (${description})`);
    return doc;
  }

  /**
   * Reads a skill by name from disk/cache.
   */
  async getSkill(name: string): Promise<SkillDocument | null> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Read from disk
    const filePath = path.join(this.skillsDir, `${name}.md`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const doc = this.parseSkillFile(raw, filePath);
      if (doc) {
        this.cache.set(name, doc);
      }
      return doc;
    } catch {
      return null;
    }
  }

  /**
   * Lists all skill summaries (progressive disclosure — no body content).
   * Mirrors Hermes: only names + descriptions in context initially.
   */
  async listSkills(): Promise<SkillSummary[]> {
    if (this.cache.size === 0) {
      await this.refreshCache();
    }
    return Array.from(this.cache.values()).map((doc) => ({
      name: doc.metadata.name,
      description: doc.metadata.description,
      tags: doc.metadata.tags,
      usageCount: doc.metadata.usageCount,
      version: doc.metadata.version,
    }));
  }

  /**
   * Deletes a skill file from disk.
   */
  async deleteSkill(name: string): Promise<boolean> {
    const filePath = path.join(this.skillsDir, `${name}.md`);
    try {
      await fs.unlink(filePath);
      this.cache.delete(name);
      this.logger.log(`🗑️ Skill deleted: ${name}`);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Hermes-style Patch Operations ─────────────────────────────

  /**
   * Patches an existing skill (instead of full rewrite).
   * Hermes uses patch to avoid breaking existing functionality.
   */
  async patchSkill(name: string, patch: SkillPatch): Promise<SkillDocument | null> {
    const existing = await this.getSkill(name);
    if (!existing) {
      this.logger.warn(`Cannot patch unknown skill: ${name}`);
      return null;
    }

    const { metadata, body } = existing;
    let newBody = body;

    // Apply section patches (add/replace sections)
    if (patch.sections) {
      for (const [heading, content] of Object.entries(patch.sections)) {
        const sectionRegex = new RegExp(
          `(## ${this.escapeRegex(heading)}[\\s\\S]*?)(?=\\n## |\\n$)`,
          'g',
        );
        const newSection = `## ${heading}\n\n${content.trim()}`;

        if (sectionRegex.test(newBody)) {
          // Replace existing section
          newBody = newBody.replace(sectionRegex, newSection);
        } else {
          // Append as new section
          newBody += `\n\n${newSection}`;
        }
      }
    }

    // Update metadata
    const updated: SkillMetadata = {
      ...metadata,
      description: patch.description || metadata.description,
      tags: [...new Set([...metadata.tags, ...(patch.addTags || [])])],
      updated: new Date().toISOString().split('T')[0],
      version: metadata.version + 1,
      source: 'patch',
    };

    const frontmatter = this.buildFrontmatter(updated);
    const raw = `${frontmatter}\n${newBody.trim()}\n`;
    const filePath = path.join(this.skillsDir, `${name}.md`);

    await fs.writeFile(filePath, raw, 'utf-8');
    const doc: SkillDocument = { metadata: updated, body: newBody.trim(), filePath, raw };
    this.cache.set(name, doc);

    this.logger.log(`🩹 Skill patched: ${name} → v${updated.version}`);
    return doc;
  }

  // ─── Relevance & Discovery ─────────────────────────────────────

  /**
   * Searches skills by keyword relevance (simple BM25-like scoring).
   * Returns matches sorted by score descending.
   */
  async searchSkills(query: string, limit = 5): Promise<SkillMatch[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const summaries = await this.listSkills();
    const matches: SkillMatch[] = [];

    for (const summary of summaries) {
      const searchText = `${summary.name} ${summary.description} ${summary.tags.join(' ')}`.toLowerCase();
      const matchedTerms: string[] = [];
      let score = 0;

      for (const term of terms) {
        if (searchText.includes(term)) {
          matchedTerms.push(term);
          // Name matches are worth more
          if (summary.name.toLowerCase().includes(term)) {
            score += 0.5;
          }
          // Description matches
          if (summary.description.toLowerCase().includes(term)) {
            score += 0.3;
          }
          // Tag matches
          if (summary.tags.some((t) => t.toLowerCase().includes(term))) {
            score += 0.2;
          }
        }
      }

      if (matchedTerms.length > 0) {
        // Boost by usage count (popularity)
        score += Math.min(summary.usageCount / 10, 0.3);
        matches.push({
          skill: summary,
          score: Math.min(score, 1),
          matchedTerms,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Gets the most relevant skills for a given task description.
   * Used for auto-injection into system context.
   */
  async getRelevantSkills(task: string, limit = 3): Promise<SkillDocument[]> {
    const matches = await this.searchSkills(task, limit);
    const docs: SkillDocument[] = [];

    for (const match of matches) {
      const doc = await this.getSkill(match.skill.name);
      if (doc) docs.push(doc);
    }

    return docs;
  }

  /**
   * Generates a context string with relevant skills for injection into prompts.
   * Progressive disclosure: only includes summaries, full content on demand.
   */
  async buildSkillsContext(task: string, limit = 3): Promise<string> {
    const relevant = await this.searchSkills(task, limit);
    if (relevant.length === 0) return '';

    let context = '\n\n📚 **Skills disponibles:**\n';
    for (const match of relevant) {
      context += `- **${match.skill.name}**: ${match.skill.description} (v${match.skill.version}, usada ${match.skill.usageCount}x)\n`;
    }
    context += '\nUsa `skill_apply <name>` para cargar el skill completo.\n';

    return context;
  }

  // ─── Usage Tracking ────────────────────────────────────────────

  /**
   * Increments the usage counter for a skill.
   */
  async recordUsage(name: string): Promise<void> {
    const doc = await this.getSkill(name);
    if (!doc) return;

    const updated: SkillMetadata = {
      ...doc.metadata,
      usageCount: doc.metadata.usageCount + 1,
      lastUsed: new Date().toISOString(),
      updated: new Date().toISOString().split('T')[0],
    };

    const frontmatter = this.buildFrontmatter(updated);
    const raw = `${frontmatter}\n${doc.body}\n`;
    await fs.writeFile(doc.filePath, raw, 'utf-8');
    doc.metadata = updated;
    this.cache.set(name, doc);
  }

  /**
   * Gets skills directory path for external use.
   */
  getSkillsDir(): string {
    return this.skillsDir;
  }

  /**
   * Returns total skill count.
   */
  get count(): number {
    return this.cache.size;
  }

  // ─── Internal Helpers ──────────────────────────────────────────

  private async refreshCache(): Promise<void> {
    this.cache.clear();
    try {
      const files = await fs.readdir(this.skillsDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(this.skillsDir, file);
        try {
          const raw = await fs.readFile(filePath, 'utf-8');
          const doc = this.parseSkillFile(raw, filePath);
          if (doc) {
            this.cache.set(doc.metadata.name, doc);
          }
        } catch (err) {
          this.logger.warn(`Error reading skill file ${file}: ${err.message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not read skills directory: ${error.message}`);
    }
  }

  private parseSkillFile(raw: string, filePath: string): SkillDocument | null {
    const match = raw.match(FRONTMATTER_REGEX);
    if (!match) {
      // No frontmatter — infer minimal metadata from filename
      const name = path.basename(filePath, '.md');
      return {
        metadata: {
          name,
          description: name.replace(/-/g, ' '),
          tags: [],
          created: new Date().toISOString().split('T')[0],
          updated: new Date().toISOString().split('T')[0],
          usageCount: 0,
          version: 1,
        },
        body: raw,
        filePath,
        raw,
      };
    }

    try {
      const frontmatterLines = match[1].split('\n');
      const metadata = this.parseFrontmatter(frontmatterLines);
      return {
        metadata,
        body: match[2].trim(),
        filePath,
        raw,
      };
    } catch (error) {
      this.logger.warn(`Error parsing skill ${filePath}: ${error.message}`);
      return null;
    }
  }

  private parseFrontmatter(lines: string[]): SkillMetadata {
    const data: Record<string, any> = {};
    for (const line of lines) {
      const sepIndex = line.indexOf(':');
      if (sepIndex === -1) continue;
      const key = line.slice(0, sepIndex).trim();
      let value: any = line.slice(sepIndex + 1).trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
      }
      // Parse numbers
      else if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      }
      // Parse booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;

      data[key] = value;
    }

    return {
      name: data.name || 'unknown',
      description: data.description || '',
      tags: data.tags || [],
      created: data.created || new Date().toISOString().split('T')[0],
      updated: data.updated || new Date().toISOString().split('T')[0],
      usageCount: data.usageCount || 0,
      lastUsed: data.lastUsed || undefined,
      version: data.version || 1,
      agents: data.agents || undefined,
      source: data.source || 'manual',
    };
  }

  private buildFrontmatter(meta: SkillMetadata): string {
    const lines = ['---'];
    lines.push(`name: ${meta.name}`);
    lines.push(`description: ${meta.description}`);
    lines.push(`tags: [${meta.tags.join(', ')}]`);
    lines.push(`created: ${meta.created}`);
    lines.push(`updated: ${meta.updated}`);
    lines.push(`usageCount: ${meta.usageCount}`);
    if (meta.lastUsed) lines.push(`lastUsed: ${meta.lastUsed}`);
    lines.push(`version: ${meta.version}`);
    if (meta.agents?.length) lines.push(`agents: [${meta.agents.join(', ')}]`);
    if (meta.source) lines.push(`source: ${meta.source}`);
    lines.push('---');
    return lines.join('\n');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
