import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RestoreBackupCommand } from './restore-backup.command';
import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';

@CommandHandler(RestoreBackupCommand)
export class RestoreBackupHandler implements ICommandHandler<RestoreBackupCommand> {
  private readonly logger = new Logger(RestoreBackupHandler.name);
  private readonly backupDir: string;

  constructor() {
    this.backupDir = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.agent-skills-api',
      'backups',
    );
  }

  async execute(command: RestoreBackupCommand) {
    const { backupId } = command;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const backupPath = path.join(this.backupDir, backupId);

    this.logger.log(`Restoring backup: ${backupId}`);

    // Load manifest
    let manifest: any;
    try {
      const manifestPath = path.join(backupPath, 'manifest.json');
      const raw = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch {
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
}
