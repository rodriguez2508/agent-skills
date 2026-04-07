import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  labels: { name: string; color: string }[];
  comments: number;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string };
  base: { ref: string };
  changed_files: number;
  additions: number;
  deletions: number;
}

interface CommitValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
}

@Injectable()
export class GitHubAgent extends BaseAgent {
  private readonly githubToken: string | undefined;
  private readonly githubOwner: string | undefined;
  private readonly githubRepo: string | undefined;

  private readonly PROTECTED_BRANCHES = [
    'main',
    'master',
    'development',
    'dev',
    'production',
    'prod',
  ];

  private readonly COMMIT_TYPES = [
    'feat',
    'fix',
    'docs',
    'style',
    'refactor',
    'test',
    'chore',
    'perf',
    'ci',
    'build',
    'revert',
  ];

  private readonly ALLOWED_GH_COMMANDS = [
    'gh issue view',
    'gh issue list',
    'gh issue comment',
    'gh issue create',
    'gh pr view',
    'gh pr list',
    'gh pr status',
    'gh pr create',
    'gh repo view',
    'gh run list',
    'gh auth status',
  ];

  private readonly BLOCKED_GH_COMMANDS = [
    'gh issue close',
    'gh issue reopen',
    'gh issue delete',
    'gh pr close',
    'gh pr merge',
    'gh pr reopen',
    'gh pr delete',
    'gh repo delete',
    'gh run cancel',
    'gh run rerun',
  ];

  constructor(
    private readonly agentLogger: AgentLoggerService,
    private readonly configService: ConfigService,
  ) {
    super(
      'GitHubAgent',
      'Gestiona interacciones con GitHub: leer issues, PRs, crear commits validados, crear PRs, ejecutar comandos gh controlados',
    );

    this.githubToken = this.configService.get<string>('GITHUB_TOKEN');
    this.githubOwner = this.configService.get<string>('GITHUB_OWNER');
    this.githubRepo = this.configService.get<string>('GITHUB_REPO');
  }

  protected async handle(request: AgentRequest): Promise<any> {
    const input = request.input.toLowerCase();
    const options = request.options || {};

    this.agentLogger.info(this.agentId, '🔍 GitHub request', {
      input: input.substring(0, 100),
    });

    // Commit operations
    if (this.matchesPattern(input, ['commit', 'hacer commit', 'crear commit'])) {
      return this.handleCommit(request);
    }

    // PR creation
    if (
      this.matchesPattern(input, [
        'crear pr',
        'crear pull request',
        'hacer pr',
        'hacer pull request',
      ])
    ) {
      return this.handleCreatePR(request);
    }

    // Git operations
    if (this.matchesPattern(input, ['git status', 'git branch', 'git log'])) {
      return this.handleGitCommand(request);
    }

    if (this.matchesPattern(input, ['leer issue', 'read issue', 'issue'])) {
      return this.readIssue(input, options);
    }

    if (this.matchesPattern(input, ['leer pr', 'read pr', 'pull request'])) {
      return this.readPullRequest(input, options);
    }

    if (
      this.matchesPattern(input, ['listar issues', 'list issues', 'issues'])
    ) {
      return this.listIssues(input, options);
    }

    if (this.matchesPattern(input, ['listar prs', 'list prs', 'prs'])) {
      return this.listPullRequests(input, options);
    }

    if (this.matchesPattern(input, ['gh ', 'comando gh'])) {
      return this.executeGhCommand(input, options);
    }

    if (this.matchesPattern(input, ['analizar repo', 'analyze repo', 'repo'])) {
      return this.analyzeRepository(options);
    }

    return this.provideHelp();
  }

  private async readIssue(input: string, options: any): Promise<any> {
    const issueNumber = this.extractIssueNumber(input);

    if (!issueNumber) {
      return {
        message:
          '🔍 **Leer Issue de GitHub**\n\nPor favor especifica el número del issue o la URL.\n\nEjemplos:\n- "Lee el issue #123"\n- "Lee el issue https://github.com/owner/repo/issues/456"',
        usage: 'read_issue',
      };
    }

    const { owner, repo } = this.extractOwnerRepo(input, options);
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          message: `❌ Error: No se pudo obtener el issue #${issueNumber}. Código: ${response.status}`,
          error: response.statusText,
        };
      }

      const issue: GitHubIssue = await response.json();

      return {
        message: this.formatIssue(issue, owner, repo),
        issue: {
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          author: issue.user.login,
          created: issue.created_at,
          updated: issue.updated_at,
          labels: issue.labels.map((l) => l.name),
          comments: issue.comments,
        },
      };
    } catch (error: any) {
      this.agentLogger.error(
        this.agentId,
        `Error reading issue: ${error.message}`,
      );
      return { message: `❌ Error: ${error.message}` };
    }
  }

  private async readPullRequest(input: string, options: any): Promise<any> {
    const prNumber = this.extractPrNumber(input);

    if (!prNumber) {
      return {
        message:
          '🔍 **Leer Pull Request de GitHub**\n\nPor favor especifica el número del PR o la URL.\n\nEjemplos:\n- "Lee el PR #123"\n- "Lee el PR https://github.com/owner/repo/pull/456"',
        usage: 'read_pr',
      };
    }

    const { owner, repo } = this.extractOwnerRepo(input, options);
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          message: `❌ Error: No se pudo obtener el PR #${prNumber}. Código: ${response.status}`,
          error: response.statusText,
        };
      }

      const pr: GitHubPullRequest = await response.json();

      return {
        message: this.formatPullRequest(pr, owner, repo),
        pullRequest: {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          author: pr.user.login,
          created: pr.created_at,
          merged: pr.merged_at,
          branch: pr.head.ref,
          targetBranch: pr.base.ref,
          changes: {
            files: pr.changed_files,
            additions: pr.additions,
            deletions: pr.deletions,
          },
        },
      };
    } catch (error: any) {
      this.agentLogger.error(
        this.agentId,
        `Error reading PR: ${error.message}`,
      );
      return { message: `❌ Error: ${error.message}` };
    }
  }

  private async listIssues(input: string, options: any): Promise<any> {
    const { owner, repo } = this.extractOwnerRepo(input, options);
    const state = input.includes('closed') ? 'closed' : 'open';
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=10`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { message: `❌ Error: ${response.statusText}` };
      }

      const issues: GitHubIssue[] = await response.json();
      const prs = issues.filter((i: any) => i.pull_request);
      const realIssues = issues.filter((i: any) => !i.pull_request);

      return {
        message: this.formatIssueList(realIssues, owner, repo, state),
        issues: realIssues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          url: i.html_url,
          labels: i.labels.map((l) => l.name),
        })),
      };
    } catch (error: any) {
      return { message: `❌ Error: ${error.message}` };
    }
  }

  private async listPullRequests(input: string, options: any): Promise<any> {
    const { owner, repo } = this.extractOwnerRepo(input, options);
    const state = input.includes('closed') ? 'closed' : 'open';
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=10`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { message: `❌ Error: ${response.statusText}` };
      }

      const prs: GitHubPullRequest[] = await response.json();

      return {
        message: this.formatPRList(prs, owner, repo, state),
        pullRequests: prs.map((pr) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          author: pr.user.login,
          branch: pr.head.ref,
        })),
      };
    } catch (error: any) {
      return { message: `❌ Error: ${error.message}` };
    }
  }

  private async executeGhCommand(input: string, options: any): Promise<any> {
    const command = this.extractGhCommand(input);

    if (!command) {
      return {
        message:
          '🔧 **Comandos GH Permitidos**\n\nEstos son los comandos que puedes ejecutar:\n\n📋 Issues:\n- gh issue view #123\n- gh issue list\n- gh issue comment #123 "comment"\n\n🔀 Pull Requests:\n- gh pr view #123\n- gh pr list\n- gh pr status\n\n📦 Repositorio:\n- gh repo view\n\n⚠️ **Bloqueados**: close, merge, delete, cancel, rerun',
        allowedCommands: this.ALLOWED_GH_COMMANDS,
        blockedCommands: this.BLOCKED_GH_COMMANDS,
      };
    }

    const isBlocked = this.BLOCKED_GH_COMMANDS.some((blocked) =>
      command.toLowerCase().includes(blocked.replace('gh ', '')),
    );

    if (isBlocked) {
      return {
        message: `❌ **Comando bloqueado por seguridad**\n\nEl comando "${command}" no está permitido.\n\nComandos permitidos:\n${this.ALLOWED_GH_COMMANDS.map((c) => `- ${c}`).join('\n')}`,
        blocked: true,
        command,
      };
    }

    const isAllowed = this.ALLOWED_GH_COMMANDS.some((allowed) =>
      command.toLowerCase().startsWith(allowed.toLowerCase()),
    );

    if (!isAllowed) {
      return {
        message: `❌ **Comando no permitido**\n\n"${command}" no está en la lista de comandos permitidos.\n\nComandos permitidos:\n${this.ALLOWED_GH_COMMANDS.map((c) => `- ${c}`).join('\n')}`,
        allowed: false,
        command,
      };
    }

    return {
      message: `✅ **Comando validado**\n\nEl comando "${command}" está permitido.\n\n⚠️ Para ejecutar este comando, necesitas:\n1. Tener gh CLI instalado\n2. Estar autenticado con: gh auth login\n3. Ejecutar manualmente en tu terminal`,
      command,
      requiresManualExecution: true,
    };
  }

  private async analyzeRepository(options: any): Promise<any> {
    const { owner, repo } = this.extractOwnerRepo('', options);

    try {
      const [repoRes, issuesRes, prsRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: this.getHeaders(),
        }),
        fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=5`,
          { headers: this.getHeaders() },
        ),
        fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=5`,
          { headers: this.getHeaders() },
        ),
      ]);

      const repoData = await repoRes.json();
      const issuesData = await issuesRes.json();
      const prsData = await prsRes.json();

      return {
        message: `📊 **Análisis de Repositorio**\n\n**${owner}/${repo}**\n\n⭐ Stars: ${repoData.stargazers_count || 0}\n🍴 Forks: ${repoData.forks_count || 0}\n👁️ Watchers: ${repoData.watchers_count || 0}\n📝 Issues Abiertos: ${repoData.open_issues_count || 0}\n📅 Creado: ${new Date(repoData.created_at).toLocaleDateString()}\n\n**Últimos Issues:**\n${
          issuesData
            .slice(0, 3)
            .map((i: any) => `- #${i.number}: ${i.title}`)
            .join('\n') || 'Ninguno'
        }\n\n**PRs Abiertos:**\n${
          prsData
            .slice(0, 3)
            .map((p: any) => `- #${p.number}: ${p.title}`)
            .join('\n') || 'Ninguno'
        }`,
        repository: {
          name: repoData.name,
          owner: repoData.owner?.login,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          openIssues: repoData.open_issues_count,
          description: repoData.description,
          url: repoData.html_url,
        },
      };
    } catch (error: any) {
      return { message: `❌ Error: ${error.message}` };
    }
  }

  /**
   * Maneja solicitudes de commit validando las reglas de git-commit.md
   */
  private async handleCommit(request: AgentRequest): Promise<any> {
    const input = request.input;
    const options = request.options || {};

    this.agentLogger.info(this.agentId, '💾 Commit request', {
      input: input.substring(0, 100),
    });

    // Step 1: Check current branch
    const currentBranch = this.getCurrentBranch();
    const branchValidation = this.validateBranch(currentBranch);

    if (!branchValidation.isValid) {
      return {
        message: `❌ **No puedes committear en esta rama**\n\nRama actual: \`${currentBranch}\`\n\n${branchValidation.errors.join('\n')}\n\n**Solución:**\n\`\`\`bash\ngit checkout -b feature/ISSUE-XXX-descripcion-corta\n\`\`\`\n\nLuego intenta hacer commit nuevamente.`,
        requiresBranchChange: true,
        currentBranch,
        suggestedAction: 'create_feature_branch',
      };
    }

    // Step 2: Get git status
    const status = this.getGitStatus();
    if (status.trim() === '') {
      return {
        message: '⚠️ **No hay cambios para committear**\n\nEl directorio de trabajo está limpio.',
        noChanges: true,
      };
    }

    // Step 3: Extract or generate commit message
    let commitMessage = this.extractCommitMessage(input);

    // Step 4: Validate commit message
    const validation = this.validateCommitMessage(commitMessage);

    if (!validation.isValid) {
      const suggestion = this.generateCommitMessageSuggestion(status, input);
      return {
        message: `❌ **El mensaje del commit no cumple las reglas**\n\n${validation.errors.join('\n')}\n\n${
          validation.suggestions?.length
            ? `**Sugerencias:**\n${validation.suggestions.map((s) => `- ${s}`).join('\n')}`
            : ''
        }\n\n**Mensaje sugerido:**\n\`\`\`\n${suggestion}\n\`\`\`\n\n¿Quieres que use este mensaje?`,
        validationFailed: true,
        suggestedMessage: suggestion,
      };
    }

    // Step 5: Ask for confirmation
    return {
      message: `✅ **Commit listo para crear**\n\n**Rama:** \`${currentBranch}\`\n\n**Cambios:**\n\`\`\`\n${status.substring(0, 500)}\n\`\`\`\n\n**Mensaje:**\n\`\`\`\n${commitMessage}\n\`\`\`\n\n**Reglas validadas:**\n✅ Rama permitida\n✅ Mensaje en inglés\n✅ Formato convencional (<type>: <description>)\n✅ Máximo 8 bullet points\n\n¿Procedo con el commit?`,
      readyToCommit: true,
      branch: currentBranch,
      commitMessage: commitMessage,
      changes: status,
      requiresConfirmation: true,
    };
  }

  /**
   * Crea un Pull Request usando gh CLI
   */
  private async handleCreatePR(request: AgentRequest): Promise<any> {
    const input = request.input;
    const options = request.options || {};

    this.agentLogger.info(this.agentId, '🔀 PR creation request', {
      input: input.substring(0, 100),
    });

    // Step 1: Check current branch
    const currentBranch = this.getCurrentBranch();
    if (this.PROTECTED_BRANCHES.includes(currentBranch)) {
      return {
        message: `❌ **No puedes crear PR desde esta rama**\n\nRama actual: \`${currentBranch}\`\n\nDebes estar en una rama feature/fix/hotfix.`,
        requiresBranchChange: true,
      };
    }

    // Step 2: Check if there are uncommitted changes
    const status = this.getGitStatus();
    if (status.trim() !== '') {
      return {
        message: `⚠️ **Tienes cambios sin committear**\n\n\`\`\`\n${status.substring(0, 300)}\n\`\`\`\n\nPrimero haz commit, luego crea el PR.`,
        hasUncommittedChanges: true,
      };
    }

    // Step 3: Extract PR info
    const prTitle = this.extractPRTitle(input) || 'Auto-generated PR';
    const prBody = this.extractPRBody(input) || this.generatePRBody();

    // Step 4: Check if PR.md exists or create it
    const hasPRmd = this.checkPRmd();

    if (!hasPRmd) {
      const prmdContent = this.generatePRmd(prTitle, currentBranch);
      return {
        message: `⚠️ **Falta PR.md**\n\nAntes de crear el PR, necesitas un archivo \`PR.md\` con el resumen en español.\n\n**Contenido sugerido:**\n\`\`\`markdown\n${prmdContent}\n\`\`\`\n\n¿Quieres que cree este archivo?`,
        requiresPRmd: true,
        suggestedPRmd: prmdContent,
      };
    }

    // Step 5: Ready to create PR
    return {
      message: `🔀 **PR listo para crear**\n\n**Título:** ${prTitle}\n**Rama:** ${currentBranch}\n**Base:** main/development\n\n**Comando:**\n\`\`\`bash\ngh pr create --title "${prTitle}" --body-file PR.md --head ${currentBranch}\n\`\`\`\n\n¿Procedo?`,
      readyToCreatePR: true,
      title: prTitle,
      branch: currentBranch,
      command: `gh pr create --title "${prTitle}" --body-file PR.md --head ${currentBranch}`,
    };
  }

  /**
   * Ejecuta comandos git básicos
   */
  private async handleGitCommand(request: AgentRequest): Promise<any> {
    const input = request.input;

    try {
      if (input.includes('git status')) {
        const status = this.getGitStatus();
        return Promise.resolve({
          message: `📊 **Git Status**\n\n\`\`\`\n${status}\n\`\`\``,
          status,
        });
      }

      if (input.includes('git branch')) {
        const branches = this.getBranches();
        const current = this.getCurrentBranch();
        return Promise.resolve({
          message: `🌿 **Ramas Git**\n\nRama actual: \`${current}\`\n\n\`\`\`\n${branches}\n\`\`\``,
          currentBranch: current,
          branches,
        });
      }

      if (input.includes('git log')) {
        const log = this.getGitLog(5);
        return Promise.resolve({
          message: `📜 **Últimos Commits**\n\n\`\`\`\n${log}\n\`\`\``,
          log,
        });
      }
    } catch (error: any) {
      this.agentLogger.error(this.agentId, `Git command error: ${error.message}`);
      return Promise.resolve({ message: `❌ Error: ${error.message}` });
    }

    return Promise.resolve(this.provideHelp());
  }

  // ==================== VALIDATION METHODS ====================

  /**
   * Valida que la rama no sea protegida
   */
  private validateBranch(branch: string): CommitValidationResult {
    const isProtected = this.PROTECTED_BRANCHES.some(
      (p) => p.toLowerCase() === branch.toLowerCase(),
    );

    if (isProtected) {
      return {
        isValid: false,
        errors: [
          `❌ No se puede committear directamente en \`${branch}\``,
          '❌ Las ramas protegidas son: main, master, development, dev, production',
        ],
        suggestions: ['Crea una rama feature: `git checkout -b feature/ISSUE-XXX-descripcion`'],
      };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Valida el mensaje del commit según git-commit.md
   */
  private validateCommitMessage(message: string): CommitValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Check 1: Must be in English (simple heuristic - no Spanish common words)
    const spanishWords = [
      'el',
      'la',
      'los',
      'las',
      'un',
      'una',
      'con',
      'para',
      'por',
      'que',
      'de',
      'del',
      'al',
      'y',
      'o',
      'en',
      'agregado',
      'agregada',
      'fix',
      'arreglado',
      'cambiado',
      'actualizado',
    ];
    const lowerMessage = message.toLowerCase();
    const hasSpanish = spanishWords.some(
      (word) =>
        new RegExp(`\\b${word}\\b`, 'i').test(lowerMessage) &&
        !['fix', 'feat', 'docs', 'refactor', 'test', 'chore', 'style'].includes(word),
    );

    if (hasSpanish) {
      errors.push('❌ El mensaje debe estar en **inglés**');
      suggestions.push('Traduce el mensaje a inglés');
    }

    // Check 2: Must start with conventional commit type
    const typeRegex = new RegExp(`^(${this.COMMIT_TYPES.join('|')})(\\([^)]+\\))?:`);
    if (!typeRegex.test(message.split('\n')[0])) {
      errors.push('❌ Debe empezar con un tipo convencional (feat, fix, docs, refactor, test, chore, etc.)');
      suggestions.push(`Ejemplo: \`feat: add new feature\` o \`fix(auth): resolve login bug\``);
    }

    // Check 3: Subject max 50 chars
    const subject = message.split('\n')[0];
    if (subject.length > 50) {
      errors.push(`❌ El subject es muy largo (${subject.length} chars, máx 50)`);
      suggestions.push('Acorta el título a máximo 50 caracteres');
    }

    // Check 4: Max 8 bullet points
    const bulletPoints = message.split('\n').filter((line) => line.trim().startsWith('-'));
    if (bulletPoints.length > 8) {
      errors.push(`❌ Demasiados bullet points (${bulletPoints.length}, máx 8)`);
      suggestions.push('Reduce a máximo 8 puntos o agrupa cambios relacionados');
    }

    // Check 5: Body lines max 72 chars (soft check)
    const longLines = message
      .split('\n')
      .slice(1)
      .filter((line) => line.trim().length > 72 && !line.trim().startsWith('-'));
    if (longLines.length > 0) {
      suggestions.push('Las líneas del body deberían tener máx 72 caracteres');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions,
    };
  }

  // ==================== GIT OPERATIONS ====================

  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch (error: any) {
      this.agentLogger.error(this.agentId, `Error getting branch: ${error.message}`);
      return 'unknown';
    }
  }

  private getBranches(): string {
    try {
      return execSync('git branch', { encoding: 'utf8' }).trim();
    } catch (error: any) {
      return 'Error getting branches';
    }
  }

  private getGitStatus(): string {
    try {
      return execSync('git status --short', { encoding: 'utf8' }).trim();
    } catch (error: any) {
      return '';
    }
  }

  private getGitLog(limit: number = 5): string {
    try {
      return execSync(`git log -n ${limit} --oneline`, { encoding: 'utf8' }).trim();
    } catch (error: any) {
      return 'Error getting log';
    }
  }

  private executeGitCommand(command: string): boolean {
    try {
      execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      return true;
    } catch (error: any) {
      this.agentLogger.error(this.agentId, `Git command failed: ${error.message}`);
      return false;
    }
  }

  // ==================== COMMIT MESSAGE HELPERS ====================

  private extractCommitMessage(input: string): string {
    // Try to extract message after "commit" keyword
    const match = input.match(/commit\s+(?:-m\s+["']?)?(.+?)(?:["']?)?$/i);
    if (match) {
      return match[1].trim();
    }

    // If input has more than just "commit", use it as base
    if (input.toLowerCase().replace('commit', '').trim().length > 0) {
      return input.replace(/commit/i, '').trim();
    }

    return '';
  }

  private generateCommitMessageSuggestion(status: string, input: string): string {
    const files = status
      .split('\n')
      .map((line) => line.substring(2).split(' ')[0])
      .slice(0, 5);

    const type = this.inferCommitType(input);
    const scope = this.inferScope(files);

    let subject = `${type}${scope ? `(${scope})` : ''}: `;
    subject += this.generateSubject(input, files);

    const bullets = files.map((f) => `- Update ${f}`).slice(0, 8);

    return [subject, ...bullets].join('\n');
  }

  private inferCommitType(input: string): string {
    const lower = input.toLowerCase();
    if (lower.includes('fix') || lower.includes('arregl') || lower.includes('bug')) return 'fix';
    if (lower.includes('feat') || lower.includes('nuev') || lower.includes('agreg')) return 'feat';
    if (lower.includes('docs') || lower.includes('document')) return 'docs';
    if (lower.includes('refactor') || lower.includes('mejor')) return 'refactor';
    if (lower.includes('test')) return 'test';
    return 'chore';
  }

  private inferScope(files: string[]): string {
    const file = files[0] || '';
    if (file.includes('auth')) return 'auth';
    if (file.includes('user')) return 'user';
    if (file.includes('controller')) return 'controller';
    if (file.includes('service')) return 'service';
    if (file.includes('module')) return 'module';
    if (file.includes('dto')) return 'dto';
    return '';
  }

  private generateSubject(input: string, files: string[]): string {
    const lower = input.toLowerCase();
    if (lower.includes('auth')) return 'update authentication logic';
    if (lower.includes('migrat')) return 'migrate to new architecture';
    if (lower.includes('fix')) return 'resolve reported issues';
    if (lower.includes('improv')) return 'improve code quality';
    return 'apply requested changes';
  }

  // ==================== PR HELPERS ====================

  private extractPRTitle(input: string): string | null {
    const match = input.match(/title[:\s]+(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : null;
  }

  private extractPRBody(input: string): string | null {
    const match = input.match(/body[:\s]+([\s\S]*?)(?:\n\n|$)/i);
    return match ? match[1].trim() : null;
  }

  private checkPRmd(): boolean {
    try {
      execSync('test -f PR.md', { encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }

  private generatePRmd(title: string, branch: string): string {
    const issueNumber = branch.match(/ISSUE-(\d+)/)?.[1] || 'XXX';

    return `# Pull Request: #${issueNumber} - ${title}

## Resumen
[Descripción breve en español de qué hace este PR y por qué es necesario]

## Cambios Realizados

### Archivos Modificados
${this.getGitStatus()
  .split('\n')
  .filter((f) => f.startsWith('M'))
  .map((f) => `- \`${f.substring(2).split(' ')[0]}\` - Descripción del cambio`)
  .join('\n') || '- Sin archivos modificados'}

## Tipo de Cambio
- [ ] 🚀 New feature
- [ ] 🐛 Bug fix
- [ ] 📝 Documentation
- [ ] ♻️ Refactor
- [ ] ⚡ Performance
- [ ] 🧪 Tests
- [ ] 🔧 Chore

## Checklist de Calidad
- [ ] ✅ Type check passed
- [ ] ✅ Build passed
- [ ] ✅ Tests pass
- [ ] ✅ No console.log() de debug
- [ ] ✅ Clean Architecture

## Issue Relacionado
- Closes #${issueNumber}

## Comandos para Probar
\`\`\`bash
pnpm run typecheck
pnpm run build
pnpm test
\`\`\``;
  }

  private generatePRBody(): string {
    return `## Changes\n\n- Auto-generated PR\n\n## Testing\n\n- [ ] Tests pass\n- [ ] Type check passes\n- [ ] Build succeeds`;
  }

  private provideHelp(): any {
    return {
      message: `🔧 **GitHub Agent - Comandos disponibles**

**Git Operations:**
- "Commit these changes" - Crea commit validando reglas (rama, inglés, ≤8 bullets)
- "Crear PR" - Crea Pull Request con PR.md en español
- "Git status" - Muestra estado del repositorio
- "Git branch" - Muestra ramas disponibles
- "Git log" - Muestra últimos commits

**Lectura:**
- "Lee el issue #123" - Lee un issue específico
- "Lee el PR #456" - Lee un pull request
- "Lista los issues" - Lista issues abiertos
- "Lista los PRs" - Lista pull requests
- "Analiza el repo" - Muestra estadísticas del repositorio

**Comandos gh (controlados):**
- gh issue view #123
- gh issue list
- gh issue create
- gh pr view #123
- gh pr list
- gh pr create
- gh auth status

⚠️ **Comandos bloqueados**: close, merge, delete, cancel, rerun`,
      availableActions: [
        'commit',
        'create_pr',
        'git_status',
        'git_branch',
        'git_log',
        'read_issue',
        'read_pr',
        'list_issues',
        'list_prs',
        'analyze_repo',
        'gh_command',
      ],
    };
  }

  private extractIssueNumber(input: string): number | null {
    const urlMatch = input.match(/issues\/(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1], 10);

    const hashMatch = input.match(/#(\d+)/);
    if (hashMatch) return parseInt(hashMatch[1], 10);

    return null;
  }

  private extractPrNumber(input: string): number | null {
    const urlMatch = input.match(/pull\/(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1], 10);

    const prMatch = input.match(/pr\s*#?(\d+)/i);
    if (prMatch) return parseInt(prMatch[1], 10);

    const hashMatch = input.match(/#(\d+)/);
    if (hashMatch) return parseInt(hashMatch[1], 10);

    return null;
  }

  private extractOwnerRepo(
    input: string,
    options: any,
  ): { owner: string; repo: string } {
    const urlMatch = input.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (urlMatch) {
      return { owner: urlMatch[1], repo: urlMatch[2].replace(/\/.*$/, '') };
    }

    return {
      owner: options?.githubOwner || this.githubOwner || 'owner',
      repo: options?.githubRepo || this.githubRepo || 'repo',
    };
  }

  private extractGhCommand(input: string): string | null {
    const match = input.match(/gh\s+[\w\s-]+/i);
    return match ? match[0].trim() : null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    return headers;
  }

  private formatIssue(issue: GitHubIssue, owner: string, repo: string): string {
    const labels =
      issue.labels.length > 0
        ? issue.labels.map((l) => `\`${l.name}\``).join(' ')
        : '';

    return `📋 **Issue #${issue.number}**: ${issue.title}

**Estado**: ${issue.state.toUpperCase()}
**Autor**: @${issue.user.login}
**Fecha**: ${new Date(issue.created_at).toLocaleDateString()}
${labels ? `**Labels**: ${labels}` : ''}

${issue.body?.substring(0, 1000) || '*Sin descripción*'}

💬 **Comentarios**: ${issue.comments}
🔗 **URL**: ${issue.html_url}`;
  }

  private formatPullRequest(
    pr: GitHubPullRequest,
    owner: string,
    repo: string,
  ): string {
    return `🔀 **PR #${pr.number}**: ${pr.title}

**Estado**: ${pr.state.toUpperCase()}${pr.merged_at ? ' (MERGED)' : ''}
**Autor**: @${pr.user.login}
**Rama**: ${pr.head.ref} → ${pr.base.ref}
**Fecha**: ${new Date(pr.created_at).toLocaleDateString()}

📊 **Cambios**:
- Archivos: ${pr.changed_files}
- +${pr.additions} / -${pr.deletions}

${pr.body?.substring(0, 800) || '*Sin descripción*'}

🔗 **URL**: ${pr.html_url}`;
  }

  private formatIssueList(
    issues: GitHubIssue[],
    owner: string,
    repo: string,
    state: string,
  ): string {
    if (issues.length === 0) {
      return `📋 **Issues ${state}**\n\nNo hay issues ${state}s en ${owner}/${repo}`;
    }

    return `📋 **Issues ${state}** (${owner}/${repo})

${issues
  .map(
    (i) => `**#${i.number}** ${i.title}
   - Autor: @${i.user.login}
   - Labels: ${i.labels.map((l) => l.name).join(', ') || 'none'}
`,
  )
  .join('\n')}`;
  }

  private formatPRList(
    prs: GitHubPullRequest[],
    owner: string,
    repo: string,
    state: string,
  ): string {
    if (prs.length === 0) {
      return `🔀 **PRs ${state}**\n\nNo hay PRs ${state}s en ${owner}/${repo}`;
    }

    return `🔀 **PRs ${state}** (${owner}/${repo})

${prs
  .map(
    (pr) => `**#${pr.number}** ${pr.title}
   - Autor: @${pr.user.login}
   - Rama: ${pr.head.ref} → ${pr.base.ref}
`,
  )
  .join('\n')}`;
  }

  private matchesPattern(input: string, patterns: string[]): boolean {
    return patterns.some((pattern) => input.includes(pattern));
  }

  canHandle(input: string): boolean {
    const keywords = [
      'github',
      'issue',
      'pr',
      'pull request',
      'repo',
      'repository',
      'gh ',
      'leer issue',
      'leer pr',
      'lista',
      'analizar',
      'commit',
      'hacer commit',
      'crear pr',
      'crear pull request',
      'git status',
      'git branch',
      'git log',
    ];
    return keywords.some((k) => input.toLowerCase().includes(k));
  }
}
