import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateBackupCommand } from './create-backup.command';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as tar from 'tar';

@CommandHandler(CreateBackupCommand)
export class CreateBackupHandler implements ICommandHandler<CreateBackupCommand> {
  private readonly logger = new Logger(CreateBackupHandler.name);
  private readonly backupDir: string;
  private readonly maxBackups = 5;

  constructor(
    private readonly registry: AgentConfigRegistryService,
  ) {
    this.backupDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.agent-skills-api',
      'backups',
    );
  }

  async execute(command: CreateBackupCommand) {
    const { profile } = command;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = crypto.randomUUID();
    const backupPath = path.join(this.backupDir, backupId);

    this.logger.log(`Creating backup with ${profile.agents.length} agent(s)`);

    await fs.mkdir(backupPath, { recursive: true });

    // Collect config files from all selected agents
    const filesToBackup: string[] = [];
    for (const agent of profile.agents) {
      const adapter = this.registry.getAdapter(agent.id);
      if (!adapter) continue;

      const candidates = [
        adapter.systemPromptFile(homeDir),
        adapter.settingsPath(homeDir),
        adapter.mcpConfigPath(homeDir, ''),
        adapter.skillsDir(homeDir),
      ];

      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          filesToBackup.push(candidate);
        } catch {
          // File doesn't exist, skip
        }
      }
    }

    if (filesToBackup.length === 0) {
      this.logger.warn('No config files found to backup');
      return {
        id: backupId,
        timestamp,
        hash: '',
        profile,
        pinned: false,
        sizeBytes: 0,
      };
    }

    // Create compressed tar.gz
    const tarball = path.join(backupPath, `backup-${timestamp}.tar.gz`);
    await tar.create(
      {
        gzip: true,
        file: tarball,
        cwd: homeDir,
      },
      filesToBackup.map((f) => f.replace(homeDir, '.').replace(/^\//, '')),
    );

    // Calculate hash for dedup
    const content = await fs.readFile(tarball);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const stat = await fs.stat(tarball);

    const snapshot = {
      id: backupId,
      timestamp,
      hash,
      profile,
      pinned: false,
      sizeBytes: stat.size,
    };

    // Save manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(snapshot, null, 2), 'utf-8');

    // Prune old backups
    await this.pruneBackups(this.maxBackups);

    this.logger.log(`Backup created: ${backupId} (${stat.size} bytes, ${filesToBackup.length} files)`);
    return snapshot;
  }

  private async pruneBackups(keep: number): Promise<void> {
    const backups = await this.listBackups();
    const nonPinned = backups.filter((b) => !b.pinned);

    if (nonPinned.length <= keep) return;

    const toRemove = nonPinned.slice(keep);

    for (const backup of toRemove) {
      const backupPath = path.join(this.backupDir, backup.id);
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
        this.logger.log(`Pruned backup: ${backup.id}`);
      } catch (error) {
        this.logger.warn(`Failed to prune backup ${backup.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }

  private async listBackups(): Promise<any[]> {
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
