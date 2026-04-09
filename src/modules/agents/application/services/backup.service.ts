import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as tar from 'tar';
import { AgentConfigRegistryService } from '@infrastructure/adapters/agent-config/agent-config-registry.service';
import { IBackupManager, BackupSnapshot } from '@modules/agents/domain/ports/backup-manager.port';
import { InstallationProfile } from '@modules/agents/domain/entities/installation-profile.entity';

/**
 * Backup and rollback service for agent configurations.
 * Creates compressed tar.gz snapshots of config files before modifications.
 */
@Injectable()
export class BackupService implements IBackupManager {
  private readonly logger = new Logger(BackupService.name);
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

  /**
   * Creates a backup of all config files in the given profile.
   */
  async createBackup(profile: InstallationProfile): Promise<BackupSnapshot> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = crypto.randomUUID();
    const backupPath = path.join(this.backupDir, backupId);

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
    const hash = await this.hashFile(tarball);
    const stat = await fs.stat(tarball);

    const snapshot: BackupSnapshot = {
      id: backupId,
      timestamp,
      hash,
      profile,
      pinned: false,
      sizeBytes: stat.size,
    };

    // Save manifest
    await this.saveManifest(backupPath, snapshot);

    // Prune old backups
    await this.pruneBackups(this.maxBackups);

    this.logger.log(`Backup created: ${backupId} (${stat.size} bytes, ${filesToBackup.length} files)`);
    return snapshot;
  }

  /**
   * Restores a backup by its ID.
   */
  async restoreBackup(backupId: string): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const backupPath = path.join(this.backupDir, backupId);
    const manifest = await this.loadManifest(backupPath);

    if (!manifest) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const tarball = path.join(backupPath, `backup-${manifest.timestamp}.tar.gz`);
    try {
      await fs.access(tarball);
    } catch {
      throw new Error(`Backup tarball not found: ${tarball}`);
    }

    await tar.extract({
      file: tarball,
      cwd: homeDir,
    });

    this.logger.log(`Backup restored: ${backupId}`);
  }

  /**
   * Lists all available backups.
   */
  async listBackups(): Promise<BackupSnapshot[]> {
    const backups: BackupSnapshot[] = [];

    try {
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const manifest = await this.loadManifest(path.join(this.backupDir, entry.name));
        if (manifest) {
          backups.push(manifest);
        }
      }
    } catch {
      // Backup directory doesn't exist yet
    }

    // Sort by timestamp descending (newest first)
    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Pins a backup so it's never pruned.
   */
  async pinBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupId);
    const manifest = await this.loadManifest(backupPath);

    if (!manifest) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    manifest.pinned = true;
    await this.saveManifest(backupPath, manifest);

    this.logger.log(`Backup pinned: ${backupId}`);
  }

  /**
   * Removes oldest non-pinned backups beyond the keep limit.
   */
  async pruneBackups(keep: number): Promise<void> {
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
        this.logger.warn(
          `Failed to prune backup ${backup.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }
  }

  /**
   * Calculates SHA256 hash of a file.
   */
  private async hashFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Saves a backup manifest as JSON.
   */
  private async saveManifest(backupPath: string, snapshot: BackupSnapshot): Promise<void> {
    const manifestPath = path.join(backupPath, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  /**
   * Loads a backup manifest from JSON.
   */
  private async loadManifest(backupPath: string): Promise<BackupSnapshot | null> {
    try {
      const manifestPath = path.join(backupPath, 'manifest.json');
      const raw = await fs.readFile(manifestPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
