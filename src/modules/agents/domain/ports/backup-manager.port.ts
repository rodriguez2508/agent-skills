import { InstallationProfile } from '../entities/installation-profile.entity';

/**
 * Represents a backup snapshot of agent configurations.
 */
export interface BackupSnapshot {
  id: string;
  timestamp: string;
  hash: string;
  profile: InstallationProfile;
  pinned: boolean;
  sizeBytes?: number;
}

/**
 * Port for creating, restoring, listing, and pruning configuration backups.
 */
export interface IBackupManager {
  /**
   * Creates a backup of all config files in the given profile.
   */
  createBackup(profile: InstallationProfile): Promise<BackupSnapshot>;

  /**
   * Restores a backup by its ID.
   */
  restoreBackup(backupId: string): Promise<void>;

  /**
   * Lists all available backups.
   */
  listBackups(): Promise<BackupSnapshot[]>;

  /**
   * Removes oldest backups beyond the keep limit.
   * Pinned backups are never removed.
   */
  pruneBackups(keep: number): Promise<void>;

  /**
   * Pins a backup so it's never pruned.
   */
  pinBackup(backupId: string): Promise<void>;
}
