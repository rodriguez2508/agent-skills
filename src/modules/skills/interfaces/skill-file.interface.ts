/**
 * Hermes-style Skill System Interfaces
 *
 * Skills are stored as Markdown files on disk with YAML frontmatter.
 * This mirrors Hermes Agent's approach: ~/.hermes/skills/ → ~/.agent-skills/skills/
 */

export interface SkillMetadata {
  /** Unique skill identifier (kebab-case, e.g. "code-review", "nest-service") */
  name: string;
  /** One-line description of what this skill does */
  description: string;
  /** Categorization tags for discovery */
  tags: string[];
  /** ISO date of creation */
  created: string;
  /** ISO date of last update */
  updated: string;
  /** How many times this skill has been applied */
  usageCount: number;
  /** ISO date of last use */
  lastUsed?: string;
  /** Auto-incrementing version for patch tracking */
  version: number;
  /** Which agent(s) this skill is relevant to */
  agents?: string[];
  /** Source of creation: 'auto' | 'manual' | 'patch' */
  source?: 'auto' | 'manual' | 'patch';
}

/**
 * Full skill representation with parsed frontmatter + content
 */
export interface SkillDocument {
  metadata: SkillMetadata;
  /** Raw markdown body (without frontmatter) */
  body: string;
  /** Full file path on disk */
  filePath: string;
  /** Raw file content (frontmatter + body) */
  raw: string;
}

/**
 * Lightweight skill summary for progressive disclosure.
 * Hermes loads only these initially to save context.
 */
export interface SkillSummary {
  name: string;
  description: string;
  tags: string[];
  usageCount: number;
  version: number;
}

/**
 * Patch operation for updating existing skills.
 * Instead of rewriting the whole file, Hermes applies patches.
 */
export interface SkillPatch {
  /** Sections to add or replace. Key = section heading, Value = new content */
  sections?: Record<string, string>;
  /** Tags to append (deduplicated) */
  addTags?: string[];
  /** Description update */
  description?: string;
}

/**
 * Result from relevance matching
 */
export interface SkillMatch {
  skill: SkillSummary;
  /** Relevance score 0-1 */
  score: number;
  /** Which terms matched */
  matchedTerms: string[];
}
