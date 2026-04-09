import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import { AssetLoaderService } from '@infrastructure/assets/asset-loader.service';

/**
 * Generic skills installer service.
 * Installs individual skill files into agent skills directories.
 */
@Injectable()
export class SkillsInstallerService {
  private readonly logger = new Logger(SkillsInstallerService.name);

  constructor(
    private readonly fileMerge: FileMergeService,
    private readonly assetLoader: AssetLoaderService,
  ) {}

  /**
   * Installs a list of skills into an agent.
   *
   * @param adapter - The agent adapter
   * @param homeDir - User's home directory
   * @param skillIds - List of skill IDs to install
   * @param category - Optional category for asset lookup
   */
  async install(
    adapter: IAgentAdapter,
    homeDir: string,
    skillIds: string[],
    category?: string,
  ): Promise<void> {
    if (!adapter.supportsSkills()) {
      this.logger.debug(`Agent ${adapter.agent()} does not support skills. Skipping.`);
      return;
    }

    const skillsDir = adapter.skillsDir(homeDir);

    for (const skillId of skillIds) {
      const skillContent = await this.assetLoader.loadSkill(skillId, category);
      if (!skillContent) {
        this.logger.warn(`Skill template not found: ${skillId}`);
        continue;
      }

      const skillPath = path.join(skillsDir, skillId, 'SKILL.md');
      await this.fileMerge.writeWithMarkers(skillPath, skillContent, skillId);
      this.logger.debug(`Installed skill: ${skillId} → ${skillPath}`);
    }

    this.logger.log(`Installed ${skillIds.length} skills for agent: ${adapter.agent()}`);
  }

  /**
   * Syncs skills (idempotent — only updates if content changed).
   */
  async sync(
    adapter: IAgentAdapter,
    homeDir: string,
    skillIds: string[],
    category?: string,
  ): Promise<void> {
    return this.install(adapter, homeDir, skillIds, category);
  }
}
