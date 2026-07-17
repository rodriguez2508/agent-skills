import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetBackupsQuery } from './get-backups.query';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@QueryHandler(GetBackupsQuery)
export class GetBackupsHandler implements IQueryHandler<GetBackupsQuery> {
  private readonly logger = new Logger(GetBackupsHandler.name);
  private readonly backupDir: string;

  constructor() {
    this.backupDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.agent-skills-api',
      'backups',
    );
  }

  async execute(_query: GetBackupsQuery) {
    this.logger.debug('Listing all backups');
    const backups: any[] = [];

    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const manifestPath = path.join(this.backupDir, entry.name, 'manifest.json');
          const raw = await fs.readFile(manifestPath, 'utf-8');
          backups.push(JSON.parse(raw));
        } catch {
          // No manifest, skip
        }
      }
    } catch {
      // Backup directory doesn't exist yet
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
}
