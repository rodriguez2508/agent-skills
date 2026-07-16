import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  MemoryDocument,
  MemoryEntry,
  MemoryFileMetadata,
} from '../interfaces/memory-file.interface';

const MEMORY_DIR = '.agent-skills/memory';

/**
 * Hermes-style L1 Memory Service
 *
 * Manages two persistent files that are ALWAYS injected into context:
 * - MEMORY.md: Project knowledge, decisions, architecture, important facts
 * - USER.md:   User preferences, patterns, goals, personal context
 *
 * Mirrors Hermes Agent's MEMORY.md + USER.md in ~/.hermes/
 * These files are loaded at the start of every session and included
 * in the system prompt so the AI always has context.
 */
@Injectable()
export class MemoryFileService implements OnModuleInit {
  private readonly logger = new Logger(MemoryFileService.name);
  private readonly memoryDir: string;

  // Cache for loaded memories
  private memoryCache: MemoryDocument | null = null;
  private userCache: MemoryDocument | null = null;

  constructor() {
    this.memoryDir = path.join(os.homedir(), MEMORY_DIR);
  }

  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
      this.logger.log(`📁 Memory directory: ${this.memoryDir}`);
      await this.initFileIfMissing('MEMORY.md');
      await this.initFileIfMissing('USER.md');
      await this.refreshCache();
      this.logger.log(
        `📚 Memory loaded: ${this.memoryCache?.entries.length || 0} entries, ${this.userCache?.entries.length || 0} user preferences`,
      );
    } catch (error) {
      this.logger.warn(`Could not initialize memory: ${error.message}`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * Gets the MEMORY.md document (project knowledge).
   */
  async getMemory(): Promise<MemoryDocument> {
    return this.getOrLoadFile('MEMORY.md', (doc) => (this.memoryCache = doc));
  }

  /**
   * Gets the USER.md document (user preferences).
   */
  async getUser(): Promise<MemoryDocument> {
    return this.getOrLoadFile('USER.md', (doc) => (this.userCache = doc));
  }

  /**
   * Adds an entry to MEMORY.md.
   */
  async addMemoryEntry(entry: Omit<MemoryEntry, 'created' | 'updated'>): Promise<MemoryDocument> {
    return this.addEntry('MEMORY.md', entry);
  }

  /**
   * Adds an entry to USER.md.
   */
  async addUserEntry(entry: Omit<MemoryEntry, 'created' | 'updated'>): Promise<MemoryDocument> {
    return this.addEntry('USER.md', entry);
  }

  /**
   * Removes an entry from MEMORY.md by key.
   */
  async removeMemoryEntry(key: string): Promise<MemoryDocument> {
    return this.removeEntry('MEMORY.md', key);
  }

  /**
   * Removes an entry from USER.md by key.
   */
  async removeUserEntry(key: string): Promise<MemoryDocument> {
    return this.removeEntry('USER.md', key);
  }

  /**
   * Builds a context string with all L1 memory content for prompt injection.
   * This is the key Hermes feature — memory is always injected.
   */
  async buildInjectedContext(): Promise<string> {
    const [memory, user] = await Promise.all([this.getMemory(), this.getUser()]);

    const sections: string[] = [];

    if (memory.entries.length > 0) {
      sections.push('📚 **MEMORIA DEL PROYECTO**');
      sections.push('Conocimiento acumulado, decisiones y contexto importante:');
      sections.push('');
      for (const entry of memory.entries) {
        sections.push(`### ${entry.key}`);
        sections.push(`📅 ${entry.updated} | 🏷️ ${entry.tags.join(', ')}`);
        sections.push(entry.content);
        sections.push('');
      }
    }

    if (user.entries.length > 0) {
      sections.push('👤 **MEMORIA DEL USUARIO**');
      sections.push('Preferencias, patrones y contexto personal:');
      sections.push('');
      for (const entry of user.entries) {
        sections.push(`### ${entry.key}`);
        sections.push(`📅 ${entry.updated} | 🏷️ ${entry.tags.join(', ')}`);
        sections.push(entry.content);
        sections.push('');
      }
    }

    if (sections.length === 0) {
      return '';
    }

    return [
      '',
      '─── L1 MEMORY (Auto-inyectado) ───',
      ...sections,
      '─── Fin L1 Memory ───',
      '',
    ].join('\n');
  }

  /**
   * Refreshes the cache by re-reading files from disk.
   */
  async refresh(): Promise<void> {
    await this.refreshCache();
    this.logger.log(
      `🔄 Memory cache refreshed: ${this.memoryCache?.entries.length || 0} entries, ${this.userCache?.entries.length || 0} user preferences`,
    );
  }

  /**
   * Returns the memory directory path.
   */
  getMemoryDir(): string {
    return this.memoryDir;
  }

  // ─── Internal ───────────────────────────────────────────────────

  private async initFileIfMissing(filename: string): Promise<void> {
    const filePath = path.join(this.memoryDir, filename);
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist — create with empty structure
      const initial = this.buildEmptyDocument(filename);
      await fs.writeFile(filePath, initial.raw, 'utf-8');
      this.logger.log(`📄 Created memory file: ${filename}`);
    }
  }

  private async refreshCache(): Promise<void> {
    this.memoryCache = await this.parseFile('MEMORY.md');
    this.userCache = await this.parseFile('USER.md');
  }

  private async getOrLoadFile(
    filename: string,
    setCache: (doc: MemoryDocument) => void,
  ): Promise<MemoryDocument> {
    const cache = filename === 'MEMORY.md' ? this.memoryCache : this.userCache;
    if (cache) return cache;
    const doc = await this.parseFile(filename);
    setCache(doc);
    return doc;
  }

  private async addEntry(
    filename: string,
    entry: Omit<MemoryEntry, 'created' | 'updated'>,
  ): Promise<MemoryDocument> {
    const doc = await this.getOrLoadFile(filename, () => {});
    const now = new Date().toISOString();

    const newEntry: MemoryEntry = {
      ...entry,
      created: now,
      updated: now,
    };

    // Replace if exists with same key, otherwise append
    const existingIdx = doc.entries.findIndex((e) => e.key === entry.key);
    if (existingIdx >= 0) {
      doc.entries[existingIdx] = {
        ...newEntry,
        created: doc.entries[existingIdx].created,
      };
    } else {
      doc.entries.push(newEntry);
    }

    // Rebuild file
    const rebuilt = this.buildDocument(filename, doc.entries);
    await fs.writeFile(rebuilt.filePath, rebuilt.raw, 'utf-8');

    // Update cache
    if (filename === 'MEMORY.md') {
      this.memoryCache = rebuilt;
    } else {
      this.userCache = rebuilt;
    }

    this.logger.log(
      `📝 Memory entry ${existingIdx >= 0 ? 'updated' : 'added'}: ${entry.key} → ${filename}`,
    );
    return rebuilt;
  }

  private async removeEntry(filename: string, key: string): Promise<MemoryDocument> {
    const doc = await this.getOrLoadFile(filename, () => {});
    doc.entries = doc.entries.filter((e) => e.key !== key);

    const rebuilt = this.buildDocument(filename, doc.entries);
    await fs.writeFile(rebuilt.filePath, rebuilt.raw, 'utf-8');

    if (filename === 'MEMORY.md') {
      this.memoryCache = rebuilt;
    } else {
      this.userCache = rebuilt;
    }

    this.logger.log(`🗑️ Memory entry removed: ${key} → ${filename}`);
    return rebuilt;
  }

  private async parseFile(filename: string): Promise<MemoryDocument> {
    const filePath = path.join(this.memoryDir, filename);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return this.parseRaw(raw, filePath);
    } catch {
      const empty = this.buildEmptyDocument(filename);
      await fs.writeFile(filePath, empty.raw, 'utf-8').catch(() => {});
      return empty;
    }
  }

  private parseRaw(raw: string, filePath: string): MemoryDocument {
    const entries: MemoryEntry[] = [];
    const lines = raw.split('\n');
    let currentEntry: Partial<MemoryEntry> | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Detect entry start: "## key"
      const entryMatch = line.match(/^##\s+(.+)$/);
      if (entryMatch) {
        // Save previous entry
        if (currentEntry?.key) {
          entries.push(this.finalizeEntry(currentEntry, currentContent));
        }
        currentEntry = { key: entryMatch[1].trim() };
        currentContent = [];
        continue;
      }

      // Detect metadata: `key: value`
      const metaMatch = line.match(/^`(.+?)`:\s*(.+)$/);
      if (metaMatch && currentEntry) {
        const metaKey = metaMatch[1].toLowerCase();
        const metaValue = metaMatch[2].trim();
        if (metaKey === 'category') currentEntry.category = metaValue;
        else if (metaKey === 'created') currentEntry.created = metaValue;
        else if (metaKey === 'updated') currentEntry.updated = metaValue;
        else if (metaKey === 'tags') currentEntry.tags = metaValue.split(',').map((t) => t.trim());
        continue;
      }

      // Content lines
      if (currentEntry) {
        currentContent.push(line);
      }
    }

    // Save last entry
    if (currentEntry?.key) {
      entries.push(this.finalizeEntry(currentEntry, currentContent));
    }

    const now = new Date().toISOString().split('T')[0];
    return {
      metadata: {
        title: filePath.endsWith('USER.md') ? 'User Memory' : 'Project Memory',
        snapshot: now,
        version: entries.length > 0 ? 1 : 1,
        entryCount: entries.length,
      },
      entries,
      raw,
      filePath,
    };
  }

  private finalizeEntry(entry: Partial<MemoryEntry>, content: string[]): MemoryEntry {
    const now = new Date().toISOString();
    return {
      key: entry.key || 'unknown',
      category: entry.category || 'context',
      content: content
        .filter((l) => !l.match(/^`\w+`:/))
        .join('\n')
        .trim(),
      created: entry.created || now,
      updated: entry.updated || now,
      tags: entry.tags || [],
    };
  }

  private buildDocument(filename: string, entries: MemoryEntry[]): MemoryDocument {
    const lines: string[] = [];
    const now = new Date().toISOString().split('T')[0];

    lines.push(`# ${filename === 'USER.md' ? 'User Memory' : 'Project Memory'}`);
    lines.push('');
    lines.push('> Memoria L1 persistente — siempre inyectada en el contexto del agente.');
    lines.push('');
    lines.push(`Última actualización: ${now}`);
    lines.push(`Total entradas: ${entries.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const entry of entries) {
      lines.push(`## ${entry.key}`);
      lines.push('');
      lines.push('`category`: ' + entry.category);
      lines.push('`created`: ' + entry.created);
      lines.push('`updated`: ' + entry.updated);
      lines.push('`tags`: ' + entry.tags.join(', '));
      lines.push('');
      lines.push(entry.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    const raw = lines.join('\n');
    const filePath = path.join(this.memoryDir, filename);

    return {
      metadata: {
        title: filename === 'USER.md' ? 'User Memory' : 'Project Memory',
        snapshot: now,
        version: entries.length > 0 ? 1 : 1,
        entryCount: entries.length,
      },
      entries,
      raw,
      filePath,
    };
  }

  private buildEmptyDocument(filename: string): MemoryDocument {
    return this.buildDocument(filename, []);
  }
}
