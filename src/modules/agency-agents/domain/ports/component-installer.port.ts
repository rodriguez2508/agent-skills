import { InstallationProfile } from '../entities/installation-profile.entity';

/**
 * Port for installing and syncing a specific component
 * (SDD, skills, MCP, persona, etc.) across agents.
 */
export interface IComponentInstaller {
  /**
   * Unique component identifier.
   */
  component(): string;

  /**
   * Installs the component into the given installation profile's agents.
   */
  install(profile: InstallationProfile): Promise<void>;

  /**
   * Syncs the component to the current version (idempotent).
   * Only updates if content has changed.
   */
  sync(profile: InstallationProfile): Promise<void>;
}
