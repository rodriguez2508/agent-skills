import { Injectable, Logger } from '@nestjs/common';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';
import { AssetLoaderService } from '@infrastructure/assets/asset-loader.service';

/**
 * Persona installer Service.
 * Injects persona instructions into agent system prompts.
 */
@Injectable()
export class PersonaInstallerService {
  private readonly logger = new Logger(PersonaInstallerService.name);

  constructor(
    private readonly fileMerge: FileMergeService,
    private readonly assetLoader: AssetLoaderService,
  ) {}

  /**
   * Installs a persona into an agent's system prompt.
   *
   * @param adapter - The agent adapter
   * @param homeDir - User's home directory
   * @param personaId - Persona identifier (e.g., 'gentleman', 'neutral')
   */
  async install(
    adapter: IAgentAdapter,
    homeDir: string,
    personaId: string,
  ): Promise<void> {
    if (!adapter.supportsSystemPrompt()) {
      this.logger.debug(`Agent ${adapter.agent()} does not support system prompts. Skipping persona.`);
      return;
    }

    const instructions = await this.assetLoader.loadPersona(personaId);
    if (!instructions) {
      this.logger.warn(`Persona template not found: ${personaId}`);
      return;
    }

    const promptFile = adapter.systemPromptFile(homeDir);
    await this.fileMerge.appendWithMarkers(
      promptFile,
      instructions,
      `persona-${personaId}`,
    );

    this.logger.log(`Persona '${personaId}' installed for agent: ${adapter.agent()}`);
  }

  /**
   * Removes a persona from an agent's system prompt.
   */
  async remove(
    adapter: IAgentAdapter,
    homeDir: string,
    personaId: string,
  ): Promise<void> {
    if (!adapter.supportsSystemPrompt()) return;

    const promptFile = adapter.systemPromptFile(homeDir);
    await this.fileMerge.removeSection(promptFile, `persona-${personaId}`);

    this.logger.log(`Persona '${personaId}' removed from agent: ${adapter.agent()}`);
  }

  /**
   * Syncs persona (idempotent).
   */
  async sync(
    adapter: IAgentAdapter,
    homeDir: string,
    personaId: string,
  ): Promise<void> {
    return this.install(adapter, homeDir, personaId);
  }
}
