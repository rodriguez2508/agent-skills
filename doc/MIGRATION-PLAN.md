# Migration Plan: Gentle AI (Go) → Agent Skills API (NestJS)

## Context

**Source**: `gentle-ai` — Go CLI binary (263 files, TUI-based installer)
**Target**: `agent-skills-api` — NestJS API server (Hexagonal + CQRS architecture)

**Goal**: Migrate the gentle-ai functionality (agent configuration, SDD skills injection, MCP setup, persona management, backup/rollback) into the existing NestJS API so that agent configuration becomes a service layer accessible via HTTP/MCP/gRPC.

---

## Architecture Mapping

### Current gentle-ai (Go)

```
cmd/gentle-ai/main.go          → CLI entrypoint
internal/
  app/                         → Command dispatch
  model/                       → Domain types
  catalog/                     → Registry definitions
  system/                      → OS detection, dependency checks
  cli/                         → Install flags, orchestration
  planner/                     → Dependency graph resolution
  pipeline/                    → Staged execution
  backup/                      → Config snapshot/restore
  components/                  → Per-component logic (engram, sdd, skills, mcp, persona, etc.)
  agents/                      → 9 agent adapters
  tui/                         → Bubbletea TUI
  update/                      → Self-update
  verify/                      → Post-install checks
```

### Target agent-skills-api (NestJS)

```
src/
  core/                        → Domain layer (entities, ports, value objects)
  application/                 → Application layer (CQRS queries/handlers, services)
  infrastructure/              → Infrastructure (adapters, persistence, external services)
  presentation/                → Controllers (HTTP, MCP, gRPC)
  agents/                      → AI agent definitions (already exists)
  modules/                     → Feature modules (auth, users, sessions, issues, projects)
```

---

## Migration Phases

### Phase 1: Domain Layer (Week 1-2)

**Goal**: Port Go domain types and interfaces to NestJS domain layer.

#### 1.1 Create Domain Entities

Create in `src/modules/agents/domain/entities/`:

```typescript
// agent.entity.ts
export class Agent {
  id: string;           // 'claude-code', 'opencode', 'qwen-cli', etc.
  name: string;         // 'Claude Code', 'OpenCode', 'Qwen CLI'
  tier: SupportTier;    // 'full'
  configPath: string;   // '~/.claude', '~/.qwen'
}

// component.entity.ts
export class Component {
  id: string;           // 'engram', 'sdd', 'skills', 'context7', 'persona', 'permissions', 'gga', 'theme'
  name: string;
  description: string;
}

// skill.entity.ts
export class Skill {
  id: string;           // 'sdd-init', 'sdd-apply', 'go-testing', etc.
  name: string;
  category: string;     // 'sdd', 'foundation', 'coding'
  description: string;
}

// preset.entity.ts
export class Preset {
  id: string;           // 'full-gentleman', 'ecosystem-only', 'minimal', 'custom'
  name: string;
  components: Component[];
  skills: Skill[];
}

// persona.entity.ts
export class Persona {
  id: string;           // 'gentleman', 'neutral', 'custom'
  name: string;
  instructions: string;
}

// installation-profile.entity.ts
export class InstallationProfile {
  id: string;
  agents: Agent[];
  components: Component[];
  skills: Skill[];
  persona: Persona;
  preset: Preset;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 1.2 Create Domain Ports (Interfaces)

Create in `src/modules/agents/domain/ports/`:

```typescript
// agent-adapter.port.ts
export interface IAgentAdapter {
  agent(): string;
  tier(): SupportTier;
  detect(homeDir: string): Promise<DetectionResult>;
  globalConfigDir(homeDir: string): string;
  systemPromptFile(homeDir: string): string;
  skillsDir(homeDir: string): string;
  settingsPath(homeDir: string): string;
  systemPromptStrategy(): SystemPromptStrategy;
  mcpStrategy(): MCPStrategy;
  mcpConfigPath(homeDir: string, serverName: string): string;
  supportsSkills(): boolean;
  supportsSystemPrompt(): boolean;
  supportsMCP(): boolean;
}

// component-installer.port.ts
export interface IComponentInstaller {
  component(): string;
  install(profile: InstallationProfile): Promise<void>;
  sync(profile: InstallationProfile): Promise<void>;
}

// skill-registry.port.ts
export interface ISkillRegistry {
  loadSkills(): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | null>;
  getSkillsByCategory(category: string): Promise<Skill[]>;
}

// backup-manager.port.ts
export interface IBackupManager {
  createBackup(profile: InstallationProfile): Promise<BackupSnapshot>;
  restoreBackup(backupId: string): Promise<void>;
  listBackups(): Promise<BackupSnapshot[]>;
  pruneBackups(keep: number): Promise<void>;
}
```

#### 1.3 Create Value Objects

```typescript
// support-tier.vo.ts
export type SupportTier = 'full';

// system-prompt-strategy.vo.ts
export enum SystemPromptStrategy {
  MarkdownSections = 0,   // Claude Code CLAUDE.md
  FileReplace = 1,         // OpenCode AGENTS.md
  AppendToFile = 2,        // Qwen CLI INSTRUCTIONS.md
}

// mcp-strategy.vo.ts
export enum MCPStrategy {
  SeparateFiles = 0,       // ~/.claude/mcp/{server}.json
  MergeIntoSettings = 1,   // OpenCode, Gemini settings.json
  MCPConfigFile = 2,       // Cursor mcp.json, Qwen mcp.json
  TOMLFile = 3,            // Codex config.toml
}
```

---

### Phase 2: Agent Adapters (Week 2-3)

**Goal**: Port all 9 Go agent adapters to TypeScript.

#### 2.1 Create Adapter Infrastructure

Create in `src/infrastructure/adapters/agents/`:

```
agents/
  base.agent.ts              → Abstract base class
  claude.adapter.ts          → Claude Code adapter
  opencode.adapter.ts        → OpenCode adapter
  gemini.adapter.ts          → Gemini CLI adapter
  cursor.adapter.ts          → Cursor adapter
  vscode.adapter.ts          → VS Code Copilot adapter
  codex.adapter.ts           → Codex adapter
  windsurf.adapter.ts        → Windsurf adapter
  antigravity.adapter.ts     → Antigravity adapter
  qwen.adapter.ts            → Qwen CLI adapter (already partially done)
  agent-registry.service.ts  → Registry of all adapters
```

#### 2.2 Example: Qwen CLI Adapter (TypeScript)

```typescript
// src/infrastructure/adapters/agents/qwen.adapter.ts
import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as os from 'os';
import { IAgentAdapter, DetectionResult, SystemPromptStrategy, MCPStrategy } from '@modules/agents/domain/ports/agent-adapter.port';

@Injectable()
export class QwenAdapter implements IAgentAdapter {
  agent(): string { return 'qwen-cli'; }
  tier(): string { return 'full'; }

  async detect(homeDir: string): Promise<DetectionResult> {
    const configPath = this.globalConfigDir(homeDir);
    const binaryPath = await this.findBinary('qwen');
    const configExists = await this.dirExists(configPath);

    return {
      installed: !!binaryPath,
      binaryPath,
      configPath,
      configFound: configExists,
    };
  }

  globalConfigDir(homeDir: string): string {
    return path.join(homeDir, '.qwen');
  }

  systemPromptFile(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'INSTRUCTIONS.md');
  }

  skillsDir(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'skills');
  }

  settingsPath(homeDir: string): string {
    return path.join(homeDir, '.qwen', 'settings.json');
  }

  systemPromptStrategy(): SystemPromptStrategy {
    return SystemPromptStrategy.AppendToFile;
  }

  mcpStrategy(): MCPStrategy {
    return MCPStrategy.MCPConfigFile;
  }

  mcpConfigPath(homeDir: string, _serverName: string): string {
    return path.join(homeDir, '.qwen', 'mcp.json');
  }

  supportsSkills(): boolean { return true; }
  supportsSystemPrompt(): boolean { return true; }
  supportsMCP(): boolean { return true; }

  private async findBinary(name: string): Promise<string | null> {
    // Use which/where or check PATH
  }

  private async dirExists(dir: string): Promise<boolean> {
    // fs.access check
  }
}
```

#### 2.3 Agent Registry Service

```typescript
// src/infrastructure/adapters/agents/agent-registry.service.ts
import { Injectable } from '@nestjs/common';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { ClaudeAdapter } from './claude.adapter';
import { QwenAdapter } from './qwen.adapter';
// ... other adapters

@Injectable()
export class AgentRegistryService {
  private adapters = new Map<string, IAgentAdapter>();

  constructor(
    claude: ClaudeAdapter,
    qwen: QwenAdapter,
    // ... inject all adapters
  ) {
    this.adapters.set(claude.agent(), claude);
    this.adapters.set(qwen.agent(), qwen);
    // ... register all
  }

  getAdapter(agentId: string): IAgentAdapter | undefined {
    return this.adapters.get(agentId);
  }

  getAllAdapters(): IAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  supportedAgents(): string[] {
    return Array.from(this.adapters.keys());
  }
}
```

---

### Phase 3: Component Installers (Week 3-4)

**Goal**: Port Go component logic to NestJS services.

#### 3.1 Create Component Module

```
src/modules/components/
  components.module.ts
  components.service.ts
  domain/
    entities/
      component.entity.ts
    ports/
      component-installer.port.ts
  application/
    services/
      engram-installer.service.ts
      sdd-installer.service.ts
      skills-installer.service.ts
      mcp-installer.service.ts
      persona-installer.service.ts
      permissions-installer.service.ts
      gga-installer.service.ts
      theme-installer.service.ts
```

#### 3.2 Example: SDD Installer Service

```typescript
// src/modules/components/application/services/sdd-installer.service.ts
import { Injectable } from '@nestjs/common';
import { IAgentAdapter } from '@modules/agents/domain/ports/agent-adapter.port';
import { FileMergeService } from '@infrastructure/file-merge/file-merge.service';

@Injectable()
export class SDDInstallerService {
  private readonly SDD_SKILLS = [
    'sdd-init', 'sdd-explore', 'sdd-propose', 'sdd-spec',
    'sdd-design', 'sdd-tasks', 'sdd-apply', 'sdd-verify', 'sdd-archive',
  ];

  constructor(
    private fileMerge: FileMergeService,
  ) {}

  async install(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    const skillsDir = adapter.skillsDir(homeDir);

    for (const skill of this.SDD_SKILLS) {
      const skillContent = await this.loadSkillTemplate(skill);
      const skillPath = path.join(skillsDir, skill, 'SKILL.md');
      await this.fileMerge.writeWithMarkers(skillPath, skillContent, skill);
    }

    // Inject SDD orchestrator into system prompt
    const promptFile = adapter.systemPromptFile(homeDir);
    const orchestratorContent = await this.loadOrchestratorTemplate();
    await this.fileMerge.appendWithMarkers(promptFile, orchestratorContent, 'sdd-orchestrator');
  }

  async sync(adapter: IAgentAdapter, homeDir: string): Promise<void> {
    // Same as install but idempotent — only update if content changed
  }

  private async loadSkillTemplate(skillId: string): Promise<string> {
    // Load from embedded assets or filesystem
  }

  private async loadOrchestratorTemplate(): Promise<string> {
    // Load SDD orchestrator instructions
  }
}
```

#### 3.3 File Merge Service (Marker-based injection)

```typescript
// src/infrastructure/file-merge/file-merge.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';

const MARKER_OPEN = '<!-- gentle-ai:';
const MARKER_CLOSE = '-->';

@Injectable()
export class FileMergeService {
  /**
   * Inject content into a file using markers without clobbering user content.
   *
   * Format:
   * <!-- gentle-ai:sdd-orchestrator -->
   * [content]
   * <!-- gentle-ai:sdd-orchestrator:end -->
   */
  async writeWithMarkers(filePath: string, content: string, sectionId: string): Promise<void> {
    const markerOpen = `${MARKER_OPEN}${sectionId} -->`;
    const markerClose = `${MARKER_OPEN}${sectionId}:end -->`;

    let existing = '';
    try {
      existing = await fs.readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    const sectionRegex = new RegExp(`${this.escapeRegex(markerOpen)}[\\s\\S]*?${this.escapeRegex(markerClose)}`, 'g');

    const newSection = `${markerOpen}\n${content}\n${markerClose}`;

    if (sectionRegex.test(existing)) {
      // Replace existing section
      const updated = existing.replace(sectionRegex, newSection);
      await fs.writeFile(filePath, updated, 'utf-8');
    } else {
      // Append new section
      const updated = existing ? `${existing}\n\n${newSection}` : newSection;
      await fs.writeFile(filePath, updated, 'utf-8');
    }
  }

  async appendWithMarkers(filePath: string, content: string, sectionId: string): Promise<void> {
    return this.writeWithMarkers(filePath, content, sectionId);
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```

---

### Phase 4: API Endpoints (Week 4-5)

**Goal**: Create REST/MCP/gRPC endpoints for agent configuration.

#### 4.1 Agents Controller

```typescript
// src/presentation/controllers/agents/agents.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private agentRegistry: AgentRegistryService,
    private installService: InstallService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all supported agents' })
  async listAgents() {
    return this.agentRegistry.supportedAgents().map(id => ({
      id,
      adapter: this.agentRegistry.getAdapter(id),
    }));
  }

  @Get(':id/detect')
  @ApiOperation({ summary: 'Detect if an agent is installed' })
  async detectAgent(@Param('id') id: string) {
    const adapter = this.agentRegistry.getAdapter(id);
    if (!adapter) return { error: 'Agent not supported' };

    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return adapter.detect(homeDir);
  }

  @Post('install')
  @ApiOperation({ summary: 'Install ecosystem into selected agents' })
  async install(@Body() dto: InstallDto) {
    return this.installService.execute(dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync managed assets to current version' })
  async sync(@Body() dto: SyncDto) {
    return this.installService.sync(dto);
  }
}
```

#### 4.2 Install DTO

```typescript
// src/presentation/dto/install.dto.ts
import { IsArray, IsOptional, IsString } from 'class-validator';

export class InstallDto {
  @IsArray()
  agents: string[];  // ['claude-code', 'qwen-cli']

  @IsOptional()
  @IsString()
  preset?: string;   // 'full-gentleman', 'minimal', 'custom'

  @IsOptional()
  @IsArray()
  components?: string[];  // ['engram', 'sdd', 'skills', 'context7']

  @IsOptional()
  @IsArray()
  skills?: string[];  // ['go-testing', 'branch-pr']

  @IsOptional()
  @IsString()
  persona?: string;  // 'gentleman', 'neutral', 'custom'

  @IsOptional()
  dryRun?: boolean;  // Preview plan without applying
}
```

#### 4.3 MCP Server Integration

The existing MCP controller should be extended to serve agent configuration tools:

```typescript
// Add to existing MCP service
export class McpService {
  // Existing tools...

  @Tool()
  async detect_agents(): Promise<AgentDetection[]> {
    // Return detection results for all agents
  }

  @Tool()
  async install_ecosystem(params: InstallParams): Promise<InstallResult> {
    // Execute installation
  }

  @Tool()
  async sync_ecosystem(params: SyncParams): Promise<SyncResult> {
    // Execute sync
  }

  @Tool()
  async list_skills(): Promise<Skill[]> {
    // Return available skills
  }

  @Tool()
  async list_presets(): Promise<Preset[]> {
    // Return available presets
  }
}
```

---

### Phase 5: Backup & Rollback (Week 5-6)

**Goal**: Port Go backup system to NestJS.

```typescript
// src/modules/backup/backup.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as tar from 'tar';
import * as zlib from 'zlib';

@Injectable()
export class BackupService {
  private readonly BACKUP_DIR = path.join(process.env.HOME || '', '.gentle-ai', 'backups');
  private readonly MAX_BACKUPS = 5;

  async createBackup(profile: InstallationProfile): Promise<BackupSnapshot> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = crypto.randomUUID();
    const backupDir = path.join(this.BACKUP_DIR, backupId);

    await fs.mkdir(backupDir, { recursive: true });

    // Collect config files from all selected agents
    const filesToBackup: string[] = [];
    for (const agentId of profile.agents) {
      const adapter = this.agentRegistry.getAdapter(agentId);
      if (adapter) {
        filesToBackup.push(
          adapter.systemPromptFile(process.env.HOME || ''),
          adapter.settingsPath(process.env.HOME || ''),
          adapter.mcpConfigPath(process.env.HOME || '', ''),
        );
      }
    }

    // Create compressed tar.gz
    const tarball = path.join(backupDir, `backup-${timestamp}.tar.gz`);
    await tar.create(
      { gzip: true, file: tarball, cwd: process.env.HOME },
      filesToBackup.map(f => f.replace(process.env.HOME || '', '.')).filter(f => f !== '.')
    );

    // Dedup: check if identical backup already exists
    const hash = await this.hashFile(tarball);
    // ... dedup logic

    const snapshot: BackupSnapshot = {
      id: backupId,
      timestamp,
      hash,
      profile,
      pinned: false,
    };

    await this.saveManifest(snapshot);
    await this.pruneBackups(this.MAX_BACKUPS);

    return snapshot;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const snapshot = await this.loadManifest(backupId);
    const tarball = path.join(this.BACKUP_DIR, backupId, `backup-${snapshot.timestamp}.tar.gz`);

    await tar.extract({
      file: tarball,
      cwd: process.env.HOME,
    });
  }

  async listBackups(): Promise<BackupSnapshot[]> {
    // Read all manifests
  }

  async pinBackup(backupId: string): Promise<void> {
    // Mark as pinned (excluded from pruning)
  }

  async pruneBackups(keep: number): Promise<void> {
    // Remove oldest non-pinned backups beyond keep limit
  }

  private async hashFile(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

---

### Phase 6: System Detection & Dependencies (Week 6-7)

**Goal**: Port Go system detection to TypeScript.

```typescript
// src/infrastructure/system/system.service.ts
import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DependencyInfo {
  name: string;
  installed: boolean;
  version?: string;
  required: boolean;
}

@Injectable()
export class SystemService {
  async detectDependencies(): Promise<DependencyInfo[]> {
    return [
      await this.checkDependency('git', '2.0', true),
      await this.checkDependency('curl', null, true),
      await this.checkDependency('node', '20.0', false),
      await this.checkDependency('npm', null, false),
      await this.checkDependency('brew', null, false),
      await this.checkDependency('go', '1.24', false),
    ];
  }

  async detectPlatform(): Promise<PlatformInfo> {
    const platform = process.platform;  // 'linux', 'darwin', 'win32'
    const arch = process.arch;          // 'x64', 'arm64'
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    let distro = '';
    if (platform === 'linux') {
      try {
        const { stdout } = await execAsync('cat /etc/os-release');
        distro = stdout.match(/ID="?(\w+)"?/)?.[1] || 'unknown';
      } catch {
        distro = 'unknown';
      }
    }

    return { platform, arch, homeDir, distro };
  }

  private async checkDependency(name: string, minVersion: string | null, required: boolean): Promise<DependencyInfo> {
    try {
      const { stdout } = await execAsync(`${name} --version`);
      const version = stdout.split('\n')[0].match(/[\d.]+/)?.[0];

      if (minVersion && version) {
        // Compare versions
      }

      return { name, installed: true, version, required };
    } catch {
      return { name, installed: false, required };
    }
  }
}
```

---

### Phase 7: TUI Replacement — Web UI or Keep CLI (Week 7-8)

**Options**:

| Approach | Pros | Cons |
|----------|------|------|
| **Keep as API only** | Clean separation, any client can use it | No interactive installer |
| **Add React Web UI** | Beautiful UI, accessible from browser | Extra frontend work |
| **Add CLI with Commander.js** | Familiar CLI experience | Less visual than Bubbletea |
| **Keep Go TUI + call NestJS API** | Best of both worlds | Two binaries |

**Recommendation**: Start with **API + CLI (Commander.js)**, add Web UI later if needed.

```typescript
// src/cli/install.cli.ts
import { Command } from 'commander';
import { InstallService } from '@modules/components/application/install.service';

export const installCommand = new Command('install')
  .description('Install Gentle AI ecosystem into selected agents')
  .option('--agents <agents>', 'Comma-separated agent IDs')
  .option('--preset <preset>', 'Preset: full-gentleman, minimal, custom')
  .option('--dry-run', 'Preview without applying')
  .action(async (opts) => {
    const service = new InstallService();
    const result = await service.execute({
      agents: opts.agents.split(','),
      preset: opts.preset,
      dryRun: opts.dryRun,
    });
    console.log(JSON.stringify(result, null, 2));
  });
```

---

### Phase 8: SDD Orchestrator Integration (Week 8-9)

**Goal**: The SDD orchestrator logic stays as **skill files** (markdown), but the installation/injection logic moves to NestJS.

```typescript
// src/modules/components/application/services/sdd-installer.service.ts
// (continued from Phase 3)

// The SDD skill files are markdown templates that get written to each agent's skills dir.
// The orchestrator itself runs inside the AI agent's context — no server-side execution needed.

// What DOES run server-side:
// 1. Writing skill files to agent config dirs
// 2. Injecting orchestrator instructions into system prompts
// 3. Managing the skill registry (.atl/skill-registry.md)
```

---

## File Structure After Migration

```
agent-skills-api/src/
├── modules/
│   ├── agents/                    # NEW: Agent configuration module
│   │   ├── agents.module.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── agent.entity.ts
│   │   │   │   ├── component.entity.ts
│   │   │   │   ├── skill.entity.ts
│   │   │   │   ├── preset.entity.ts
│   │   │   │   ├── persona.entity.ts
│   │   │   │   └── installation-profile.entity.ts
│   │   │   ├── ports/
│   │   │   │   ├── agent-adapter.port.ts
│   │   │   │   ├── component-installer.port.ts
│   │   │   │   └── skill-registry.port.ts
│   │   │   └── value-objects/
│   │   │       ├── support-tier.vo.ts
│   │   │       ├── system-prompt-strategy.vo.ts
│   │   │       └── mcp-strategy.vo.ts
│   │   ├── application/
│   │   │   ├── services/
│   │   │   │   ├── agent-detection.service.ts
│   │   │   │   ├── install.service.ts
│   │   │   │   └── sync.service.ts
│   │   │   └── dto/
│   │   │       ├── install.dto.ts
│   │   │       └── sync.dto.ts
│   │   └── presentation/
│   │       └── controllers/
│   │           └── agents.controller.ts
│   │
│   ├── components/                # NEW: Component installers
│   │   ├── components.module.ts
│   │   └── application/
│   │       └── services/
│   │           ├── engram-installer.service.ts
│   │           ├── sdd-installer.service.ts
│   │           ├── skills-installer.service.ts
│   │           ├── mcp-installer.service.ts
│   │           ├── persona-installer.service.ts
│   │           ├── permissions-installer.service.ts
│   │           ├── gga-installer.service.ts
│   │           └── theme-installer.service.ts
│   │
│   └── backup/                    # NEW: Backup & rollback
│       ├── backup.module.ts
│       └── backup.service.ts
│
├── infrastructure/
│   ├── adapters/
│   │   └── agents/                # NEW: Agent adapters
│   │       ├── base.agent.ts
│   │       ├── claude.adapter.ts
│   │       ├── opencode.adapter.ts
│   │       ├── gemini.adapter.ts
│   │       ├── cursor.adapter.ts
│   │       ├── vscode.adapter.ts
│   │       ├── codex.adapter.ts
│   │       ├── windsurf.adapter.ts
│   │       ├── antigravity.adapter.ts
│   │       ├── qwen.adapter.ts
│   │       └── agent-registry.service.ts
│   │
│   ├── file-merge/                # NEW: Marker-based file injection
│   │   └── file-merge.service.ts
│   │
│   └── system/                    # NEW: OS detection, dependency checks
│       └── system.service.ts
│
├── assets/                        # NEW: Embedded skill templates
│   ├── sdd/
│   │   ├── sdd-init/SKILL.md
│   │   ├── sdd-explore/SKILL.md
│   │   └── ...
│   ├── foundation/
│   │   ├── go-testing/SKILL.md
│   │   ├── skill-creator/SKILL.md
│   │   └── ...
│   └── orchestrator/
│       └── sdd-orchestrator.md
│
├── cli/                           # NEW: CLI commands
│   ├── install.cli.ts
│   ├── sync.cli.ts
│   └── index.ts
│
└── (existing structure preserved)
    ├── agents/                    # Existing AI agents
    ├── core/                      # Existing domain layer
    ├── application/               # Existing CQRS handlers
    ├── infrastructure/            # Existing adapters
    ├── presentation/              # Existing controllers
    └── modules/                   # Existing feature modules
```

---

## What Stays in Go (gentle-ai)

**Nothing** — the goal is full migration. However, during transition:

| gentle-ai (Go) | agent-skills-api (NestJS) | Status |
|----------------|--------------------------|--------|
| TUI (Bubbletea) | Web UI or CLI (Commander.js) | Replace |
| Agent adapters | TypeScript adapters | Migrate |
| Component installers | NestJS services | Migrate |
| Backup system | NestJS backup service | Migrate |
| System detection | Node.js system detection | Migrate |
| SDD skill files | Embedded assets in NestJS | Migrate |
| Binary distribution | npm package + Docker | Replace |

---

## Testing Strategy

| Test Type | Go (gentle-ai) | NestJS (agent-skills-api) |
|-----------|---------------|--------------------------|
| Unit | `go test ./...` | `jest` |
| E2E | Docker containers | Docker containers (existing) |
| Golden files | `testdata/` | `test/fixtures/` |
| Integration | Pipeline tests | Supertest + test containers |

---

## Migration Order (Priority)

1. **Domain entities + ports** — Foundation for everything else
2. **Agent adapters** — Core functionality, 9 adapters
3. **File merge service** — Needed by all component installers
4. **Component installers** — SDD, skills, MCP, persona, permissions
5. **API endpoints** — HTTP + MCP tools
6. **Backup system** — Safety net
7. **System detection** — Dependency management
8. **CLI** — User interface
9. **Tests** — Parity with Go test coverage

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| File permission issues on Linux/macOS | High | Use proper fs permissions, test on both platforms |
| Path differences (Windows vs Unix) | Medium | Use `path.join`, test cross-platform |
| Config file format differences | Medium | Each adapter handles its own format |
| Losing Go TUI interactivity | Low | Replace with Web UI or good CLI UX |
| Breaking existing agent-skills-api | High | Feature flag the new modules, gradual rollout |

---

## Estimated Effort

| Phase | Complexity | Effort |
|-------|-----------|--------|
| 1. Domain Layer | Low | 1-2 weeks |
| 2. Agent Adapters | Medium | 1-2 weeks |
| 3. Component Installers | Medium | 1-2 weeks |
| 4. API Endpoints | Low | 1 week |
| 5. Backup System | Medium | 1 week |
| 6. System Detection | Low | 1 week |
| 7. CLI/Web UI | Medium | 1-2 weeks |
| 8. SDD Integration | Low | 1 week |
| **Total** | | **8-12 weeks** |

---

## Next Steps

1. **Review this plan** and adjust scope/priority
2. **Create feature branch** in agent-skills-api repo
3. **Start Phase 1** — Domain entities and ports
4. **Iterate** — Build one adapter end-to-end (Qwen CLI is a good candidate since we know its config)
5. **Test** — Ensure parity with Go implementation
