import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile, stat, mkdir, writeFile } from 'fs/promises';
import { Dirent } from 'fs';
import * as path from 'path';

export interface NoteInfo {
  path: string;
  title: string;
  tags: string[];
  links: string[];
  modifiedAt: Date;
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  snippet: string;
}

@Injectable()
export class ObsidianVaultService {
  private readonly logger = new Logger(ObsidianVaultService.name);

  private async findMdFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return files;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...(await this.findMdFiles(fullPath)));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  async listNotes(vaultPath: string, folder?: string): Promise<NoteInfo[]> {
    const searchDir = folder ? path.join(vaultPath, folder) : vaultPath;
    const files = await this.findMdFiles(searchDir);
    const notes: NoteInfo[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const fileStat = await stat(file);
      const relativePath = path.relative(vaultPath, file);
      notes.push({
        path: relativePath,
        title: this.extractTitle(content, relativePath),
        tags: this.extractTags(content),
        links: this.extractLinks(content),
        modifiedAt: fileStat.mtime,
      });
    }

    return notes;
  }

  async readNote(vaultPath: string, notePath: string): Promise<string | null> {
    const fullPath = path.join(vaultPath, notePath);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  async writeNote(
    vaultPath: string,
    notePath: string,
    content: string,
  ): Promise<void> {
    const fullPath = path.join(vaultPath, notePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
    this.logger.log(`Note written: ${notePath}`);
  }

  async search(
    vaultPath: string,
    query: string,
    limit = 10,
  ): Promise<SearchResult[]> {
    const files = await this.findMdFiles(vaultPath);
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const lowerContent = content.toLowerCase();
      let score = 0;

      if (lowerContent.includes(lowerQuery)) {
        score += lowerContent.split(lowerQuery).length - 1;
      }

      const title = this.extractTitle(content, path.relative(vaultPath, file));
      if (title.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }

      const tags = this.extractTags(content);
      if (tags.some((t) => t.toLowerCase().includes(lowerQuery))) {
        score += 3;
      }

      if (score > 0) {
        const idx = lowerContent.indexOf(lowerQuery);
        const snippet =
          idx >= 0
            ? content.substring(Math.max(0, idx - 80), idx + 80 + query.length)
            : content.substring(0, 160);

        results.push({
          path: path.relative(vaultPath, file),
          title,
          score,
          snippet: snippet.replace(/\n/g, ' ').trim(),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async getTags(vaultPath: string): Promise<string[]> {
    const files = await this.findMdFiles(vaultPath);
    const tagSet = new Set<string>();

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const tags = this.extractTags(content);
      tags.forEach((t) => tagSet.add(t));
    }

    return Array.from(tagSet).sort();
  }

  async getBacklinks(vaultPath: string, notePath: string): Promise<NoteInfo[]> {
    const targetPath = notePath.replace(/\.md$/, '');
    const targetName = path.basename(targetPath);
    const files = await this.findMdFiles(vaultPath);
    const backlinks: NoteInfo[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const links = this.extractLinks(content);
      if (links.some((l) => l === targetName || l === targetPath)) {
        const fileStat = await stat(file);
        backlinks.push({
          path: path.relative(vaultPath, file),
          title: this.extractTitle(content, path.relative(vaultPath, file)),
          tags: this.extractTags(content),
          links: this.extractLinks(content),
          modifiedAt: fileStat.mtime,
        });
      }
    }

    return backlinks;
  }

  private extractTitle(content: string, filePath: string): string {
    const h1 = content.match(/^#\s+(.+)/m);
    if (h1) return h1[1].trim();
    return path.basename(filePath, '.md');
  }

  private extractTags(content: string): string[] {
    const tagRegex = /#([\w\u00C0-\u024F\/.-]+)/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      if (!match[1].startsWith('http') && !match[1].includes(' ')) {
        tags.push(match[1]);
      }
    }

    return [...new Set(tags)];
  }

  private extractLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push(match[1].split('|')[0].split('#')[0].trim());
    }

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      links.push(match[2]);
    }

    return [...new Set(links)];
  }
}
