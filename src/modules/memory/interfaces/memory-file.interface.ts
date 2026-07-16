/**
 * Hermes-style Memory L1 System Interfaces
 *
 * L1 Memory = persistent files that are ALWAYS injected into context.
 * Mirrors Hermes Agent's ~/.hermes/memory/ architecture.
 *
 * Two files:
 * - MEMORY.md → Project knowledge, decisions, architecture, important facts
 * - USER.md   → User preferences, patterns, goals, personal context
 */

export interface MemoryFileMetadata {
  /** Brief title/summary of this memory snapshot */
  title: string;
  /** ISO date of snapshot */
  snapshot: string;
  /** Version of the memory format */
  version: number;
  /** Total entry count in this file */
  entryCount: number;
}

export interface MemoryEntry {
  /** Unique key for referencing this entry (e.g., "decisión-arquitectura-auth") */
  key: string;
  /** Category: 'decision' | 'preference' | 'architecture' | 'context' | 'goal' | 'pattern' */
  category: string;
  /** The actual content */
  content: string;
  /** ISO date of creation */
  created: string;
  /** Last updated ISO date */
  updated: string;
  /** Tags for discovery */
  tags: string[];
}

/** The full L1 memory structure */
export interface MemoryDocument {
  metadata: MemoryFileMetadata;
  entries: MemoryEntry[];
  /** Raw markdown text */
  raw: string;
  /** File path on disk */
  filePath: string;
}

/** Result from L2 full-text search */
export interface MemorySearchResult {
  content: string;
  score: number;
  sessionId?: string;
  timestamp: string;
  source: 'chat' | 'context' | 'memory';
}
