import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Information about a system dependency.
 */
export interface DependencyInfo {
  name: string;
  installed: boolean;
  version?: string;
  required: boolean;
}

/**
 * Information about the current platform.
 */
export interface PlatformInfo {
  platform: string;
  arch: string;
  homeDir: string;
  distro?: string;
  nodeVersion: string;
}

/**
 * System detection service.
 * Detects OS platform, distribution, and required dependencies.
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  /**
   * Detects platform information.
   */
  async detectPlatform(): Promise<PlatformInfo> {
    const platform = process.platform;
    const arch = process.arch;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const nodeVersion = process.version;

    let distro: string | undefined;
    if (platform === 'linux') {
      distro = await this.detectDistro();
    }

    return { platform, arch, homeDir, distro, nodeVersion };
  }

  /**
   * Detects all relevant system dependencies.
   */
  async detectDependencies(): Promise<DependencyInfo[]> {
    return Promise.all([
      this.checkDependency('git', '2.0', true),
      this.checkDependency('curl', null, true),
      this.checkDependency('node', '20.0', false),
      this.checkDependency('npm', null, false),
      this.checkDependency('pnpm', null, false),
      this.checkDependency('brew', null, false),
      this.checkDependency('go', '1.24', false),
    ]);
  }

  /**
   * Detects a single dependency.
   */
  async detectDependency(name: string): Promise<DependencyInfo> {
    return this.checkDependency(name, null, false);
  }

  /**
   * Checks if a dependency is installed and meets minimum version.
   */
  private async checkDependency(
    name: string,
    minVersion: string | null,
    required: boolean,
  ): Promise<DependencyInfo> {
    try {
      const { stdout } = await execAsync(`${name} --version`);
      const version = stdout.trim().split('\n')[0].match(/[\d.]+/)?.[0];

      if (minVersion && version) {
        const meetsMin = this.compareVersions(version, minVersion) >= 0;
        return {
          name,
          installed: meetsMin,
          version,
          required,
        };
      }

      return { name, installed: true, version, required };
    } catch {
      return { name, installed: false, required };
    }
  }

  /**
   * Detects Linux distribution from /etc/os-release.
   */
  private async detectDistro(): Promise<string> {
    try {
      const { stdout } = await execAsync('cat /etc/os-release');
      const match = stdout.match(/ID="?(\w+)"?/);
      return match?.[1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Compares two version strings.
   * Returns: negative if a < b, 0 if a === b, positive if a > b.
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const valA = partsA[i] || 0;
      const valB = partsB[i] || 0;
      if (valA !== valB) return valA - valB;
    }

    return 0;
  }
}
