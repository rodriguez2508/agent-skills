import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class GitHubAgent extends BaseAgent {
  private readonly githubToken: string | undefined;
  private readonly githubOwner: string | undefined;
  private readonly githubRepo: string | undefined;

  private readonly ALLOWED_GH_COMMANDS = [
    'gh issue view',
    'gh issue list',
    'gh issue comment',
    'gh pr view',
    'gh pr list',
    'gh pr status',
    'gh repo view',
    'gh run list',
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
      'Gestiona interacciones con GitHub: leer issues, PRs, ejecutar comandos gh controlados',
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

  private provideHelp(): any {
    return {
      message: `🔧 **GitHub Agent - Comandos disponibles**\n\n**Lectura:**\n- "Lee el issue #123" - Lee un issue específico\n- "Lee el PR #456" - Lee un pull request\n- "Lista los issues" - Lista issues abiertos\n- "Lista los PRs" - Lista pull requests\n- "Analiza el repo" - Muestra estadísticas del repositorio\n\n**Comandos gh (controlados):**\n- gh issue view #123\n- gh issue list\n- gh pr view #123\n- gh pr list\n\n⚠️ Comandos de escritura (close, merge, delete) están bloqueados por seguridad.`,
      availableActions: [
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
    ];
    return keywords.some((k) => input.toLowerCase().includes(k));
  }
}
