import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import which from 'which';
import { IAgentAdapter, DetectionResult } from '@modules/agents/domain/ports/agent-adapter.port';
import { SupportTier } from '@modules/agents/domain/value-objects/support-tier.vo';
import { SystemPromptStrategy } from '@modules/agents/domain/value-objects/system-prompt-strategy.vo';
import { MCPStrategy } from '@modules/agents/domain/value-objects/mcp-strategy.vo';

/**
 * Abstract base class for all agent adapters.
 * Provides common utility methods for file system operations and binary detection.
 */
export abstract class BaseAgentAdapter implements IAgentAdapter {
  protected readonly logger = new Logger(this.constructor.name);

  // ── Must be implemented by concrete adapters ──────────────────────────

  abstract agent(): string;
  abstract tier(): SupportTier;
  abstract globalConfigDir(homeDir: string): string;
  abstract systemPromptFile(homeDir: string): string;
  abstract skillsDir(homeDir: string): string;
  abstract settingsPath(homeDir: string): string;
  abstract systemPromptStrategy(): SystemPromptStrategy;
  abstract mcpStrategy(): MCPStrategy;
  abstract mcpConfigPath(homeDir: string, serverName: string): string;
  abstract supportsSkills(): boolean;
  abstract supportsSystemPrompt(): boolean;
  abstract supportsMCP(): boolean;

  // ── Common detection logic ────────────────────────────────────────────

  /**
   * Detects if this agent is installed on the system.
   * Concrete adapters can override for custom detection logic.
   */
  async detect(homeDir: string): Promise<DetectionResult> {
    const binaryName = this.getBinaryName();
    const configPath = this.globalConfigDir(homeDir);

    const [binaryPath, configFound] = await Promise.all([
      this.findBinary(binaryName),
      this.dirExists(configPath),
    ]);

    // If binary not found in PATH, try common alternative locations
    let resolvedBinaryPath = binaryPath;
    if (!resolvedBinaryPath) {
      resolvedBinaryPath = await this.findBinaryInCommonLocations(binaryName, homeDir);
    }

    let version: string | undefined;
    if (resolvedBinaryPath) {
      version = await this.getVersion(resolvedBinaryPath);
    }

    // Consider installed if either binary exists OR config directory exists
    const installed = !!resolvedBinaryPath || configFound;

    return {
      installed,
      binaryPath: resolvedBinaryPath,
      configPath,
      configFound,
      version,
    };
  }

  // ── Utility methods ───────────────────────────────────────────────────

  /**
   * Returns the binary name for this agent (e.g., 'qwen', 'claude').
   * Override in concrete adapters if different from agent ID.
   */
  protected getBinaryName(): string {
    return this.agent();
  }

  /**
   * Finds the absolute path of a binary in the system PATH.
   */
  protected async findBinary(name: string): Promise<string | null> {
    try {
      return await which(name);
    } catch {
      this.logger.debug(`Binary not found in PATH: ${name}`);
      return null;
    }
  }

  /**
   * Tries to find a binary in common alternative locations.
   * Useful for pnpm, nvm, and other non-standard PATH setups.
   */
  protected async findBinaryInCommonLocations(
    name: string,
    homeDir: string,
  ): Promise<string | null> {
    const candidates = [
      // pnpm global bin locations
      path.join(homeDir, '.local', 'share', 'pnpm', name),
      path.join(homeDir, '.pnpm-global', name),
      // nvm
      path.join(homeDir, '.nvm', 'versions', 'node', 'current', 'bin', name),
      // npm global
      path.join(homeDir, '.npm-global', 'bin', name),
      // Homebrew (macOS)
      '/opt/homebrew/bin/' + name,
      '/usr/local/bin/' + name,
      // Linux local
      '/usr/local/bin/' + name,
    ];

    for (const candidate of candidates) {
      try {
        await fs.access(candidate, fsSync.constants.X_OK);
        this.logger.debug(`Found binary in alternative location: ${candidate}`);
        return candidate;
      } catch {
        // Not found or not executable
      }
    }

    return null;
  }

  /**
   * Checks if a directory exists.
   */
  protected async dirExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Checks if a file exists.
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Reads a file's content. Returns null if not found.
   */
  protected async readFile(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Writes content to a file, creating directories if needed.
   */
  protected async writeFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Ensures a directory exists, creating it if necessary.
   */
  protected async ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Extracts version from binary output. Override for agent-specific logic.
   */
  protected async getVersion(_binaryPath: string): Promise<string | undefined> {
    // Default: try --version
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`${this.getBinaryName()} --version`);
      return stdout.trim().split('\n')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Expands ~ to home directory in a path.
   */
  protected expandHome(filePath: string, homeDir: string): string {
    if (filePath.startsWith('~')) {
      return path.join(homeDir, filePath.slice(1));
    }
    return filePath;
  }
}
