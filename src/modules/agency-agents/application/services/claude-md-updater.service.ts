import { Injectable, Logger } from '@nestjs/common';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const SECTION_ID = 'sdd-orchestrator';

export interface UpdateClaudeMdResult {
  path: string;
  wasNew: boolean;
  sectionUpdated: boolean;
  duplicatesRemoved: number;
}

@Injectable()
export class ClaudeMdUpdaterService {
  private readonly logger = new Logger(ClaudeMdUpdaterService.name);

  private readonly templatePath = path.join(process.cwd(), 'src', 'assets', 'claude-md-template.md');

  constructor(private readonly fileMerge: FileMergeService) {}

  async update(targetPath?: string): Promise<UpdateClaudeMdResult> {
    const claudeMdPath = targetPath ?? path.join(os.homedir(), '.claude', 'CLAUDE.md');

    // Load master template
    const template = await fs.readFile(this.templatePath, 'utf-8');

    // Check if file exists before update (to report wasNew)
    const wasNew = !(await this.fileMerge.hasSection(claudeMdPath, SECTION_ID));

    // prependWithMarkers: updates section if exists, prepends if new — user content is preserved
    await this.fileMerge.prependWithMarkers(claudeMdPath, template, SECTION_ID);

    // Clean up duplicate end markers that may have accumulated from previous versions
    const duplicatesRemoved = await this.removeDuplicateMarkers(claudeMdPath, SECTION_ID);

    this.logger.log(
      `✅ CLAUDE.md updated | path: ${claudeMdPath} | wasNew: ${wasNew} | dupes removed: ${duplicatesRemoved}`,
    );

    return { path: claudeMdPath, wasNew, sectionUpdated: true, duplicatesRemoved };
  }

  /**
   * Removes extra end markers left by previous partial updates.
   * Keeps only the first occurrence of each marker pair.
   */
  private async removeDuplicateMarkers(filePath: string, sectionId: string): Promise<number> {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return 0;
    }

    const endMarker = `<!-- gentle-ai:${sectionId}:end -->`;
    const parts = content.split(endMarker);

    // If only one split → no duplicates
    if (parts.length <= 2) return 0;

    // Keep first occurrence, merge the rest
    const cleaned = parts[0] + endMarker + parts.slice(1).join('').replace(/^\n+/, '\n');
    await fs.writeFile(filePath, cleaned, 'utf-8');

    return parts.length - 2;
  }
}
