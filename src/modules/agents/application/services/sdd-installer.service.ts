import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import { AssetLoaderService } from '@infrastructure/assets/asset-loader.service';

/**
 * SDD (Spec-Driven Development) installer service.
 * Installs SDD skill files and injects the orchestrator into system prompts.
 */
@Injectable()
export class SddInstallerService {
  private readonly logger = new Logger(SddInstallerService.name);

  private readonly SDD_SKILLS = [
    'sdd-init',
    'sdd-explore',
    'sdd-propose',
    'sdd-spec',
    'sdd-design',
    'sdd-tasks',
    'sdd-apply',
    'sdd-verify',
    'sdd-archive',
  ];

  constructor(
    private readonly fileMerge: FileMergeService,
    private readonly assetLoader: AssetLoaderService,
  ) {}

  /**
   * Installs SDD skills and orchestrator into an agent.
   */
  async install(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    if (!adapter.supportsSkills()) {
      this.logger.debug(`Agent ${adapter.agent()} does not support skills. Skipping SDD install.`);
      return;
    }

    // Install SDD skill files
    await this.installSkills(adapter, homeDir);

    // Inject SDD orchestrator into system prompt
    await this.injectOrchestrator(adapter, homeDir);

    this.logger.log(`SDD installed for agent: ${adapter.agent()}`);
  }

  /**
   * Syncs SDD skills and orchestrator (idempotent).
   */
  async sync(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    if (!adapter.supportsSkills()) return;

    await this.installSkills(adapter, homeDir);
    await this.injectOrchestrator(adapter, homeDir);

    this.logger.debug(`SDD synced for agent: ${adapter.agent()}`);
  }

  /**
   * Installs individual SDD skill files into the agent's skills directory.
   */
  private async installSkills(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    const skillsDir = adapter.skillsDir(homeDir);

    for (const skillId of this.SDD_SKILLS) {
      const skillContent = await this.assetLoader.loadSkill(skillId, 'sdd');
      if (!skillContent) {
        this.logger.warn(`SDD skill template not found: ${skillId}`);
        continue;
      }

      const skillPath = path.join(skillsDir, skillId, 'SKILL.md');
      await this.fileMerge.writeWithMarkers(skillPath, skillContent, skillId);
      this.logger.debug(`Installed SDD skill: ${skillId} → ${skillPath}`);
    }
  }

  /**
   * Injects the SDD orchestrator into the agent's system prompt file.
   * Uses prepend to ensure it's read FIRST.
   */
  private async injectOrchestrator(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    if (!adapter.supportsSystemPrompt()) return;

    const orchestratorContent = await this.assetLoader.loadSddOrchestrator();
    if (!orchestratorContent) {
      this.logger.warn('SDD orchestrator template not found');
      return;
    }

    const promptFile = adapter.systemPromptFile(homeDir);
    await this.fileMerge.prependWithMarkers(
      promptFile,
      orchestratorContent,
      'sdd-orchestrator',
    );
    this.logger.debug(`Prepended SDD orchestrator into: ${promptFile}`);
  }
}
