import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest } from '@core/agents/agent-response';
import { ObsidianVaultService } from './obsidian-vault.service';

@Injectable()
export class ObsidianAgent extends BaseAgent {
  constructor(private readonly vaultService: ObsidianVaultService) {
    super(
      'ObsidianAgent',
      'Segundo cerebro persistente: lee, escribe y busca en vaults Obsidian',
    );
  }

  protected async handle(request: AgentRequest): Promise<any> {
    const input = request.input.toLowerCase();
    const options = request.options || {};
    const vaultPath = options.vaultPath || options.projectPath || process.cwd();

    if (
      input.includes('search') ||
      input.includes('buscar') ||
      input.includes('encuentra')
    ) {
      const query = this.extractQuery(input, ['search', 'buscar', 'encuentra']);
      const results = await this.vaultService.search(vaultPath, query);
      if (results.length === 0) {
        return { message: `No encontré notas con "${query}" en el vault.` };
      }
      return {
        message: `Encontré ${results.length} nota(s) con "${query}":\n\n${results
          .map(
            (r, i) =>
              `${i + 1}. **${r.title}** (${r.path})\n   ...${r.snippet}...`,
          )
          .join('\n\n')}`,
      };
    }

    if (
      input.includes('read') ||
      input.includes('leer') ||
      input.includes('abrir')
    ) {
      const notePath = this.extractPath(input);
      if (!notePath)
        return {
          message: 'Especifica la ruta de la nota. Ej: leer docs/nota.md',
        };
      const content = await this.vaultService.readNote(vaultPath, notePath);
      if (!content) return { message: `Nota no encontrada: ${notePath}` };
      return { message: `# ${notePath}\n\n${content}` };
    }

    if (
      input.includes('write') ||
      input.includes('escribir') ||
      input.includes('crear nota')
    ) {
      const [notePath, ...contentParts] = request.input
        .split('\n')
        .filter((l) => l.trim());
      const pathMatch = notePath?.match(
        /(?:write|escribir|crear nota)\s+(.+)/i,
      );
      const resolvedPath = pathMatch ? pathMatch[1].trim() : 'untitled.md';
      const content = contentParts.join('\n').trim() || '(empty note)';
      await this.vaultService.writeNote(vaultPath, resolvedPath, content);
      return { message: `Nota creada: ${resolvedPath}` };
    }

    if (input.includes('tags') || input.includes('etiquetas')) {
      const tags = await this.vaultService.getTags(vaultPath);
      if (tags.length === 0)
        return { message: 'No hay etiquetas en el vault.' };
      return {
        message: `Etiquetas (${tags.length}):\n${tags.map((t) => `- #${t}`).join('\n')}`,
      };
    }

    if (
      input.includes('backlinks') ||
      input.includes('backlinks de') ||
      input.includes('enlaces de vuelta')
    ) {
      const notePath = this.extractPath(input);
      if (!notePath) return { message: 'Especifica la ruta de la nota.' };
      const backlinks = await this.vaultService.getBacklinks(
        vaultPath,
        notePath,
      );
      if (backlinks.length === 0)
        return { message: `Sin backlinks para: ${notePath}` };
      return {
        message: `Backlinks para "${notePath}":\n${backlinks.map((b) => `- **${b.title}** (${b.path})`).join('\n')}`,
      };
    }

    if (
      input.includes('list') ||
      input.includes('listar') ||
      input.includes('notas') ||
      input.includes('vault')
    ) {
      const folder = this.extractFolder(input);
      const notes = await this.vaultService.listNotes(vaultPath, folder);
      if (notes.length === 0) return { message: 'No hay notas en el vault.' };
      return {
        message: `Notas (${notes.length}):\n${notes
          .map(
            (n) =>
              `- **${n.title}** (${n.path}) ${n.tags.length ? n.tags.map((t) => `#${t}`).join(' ') : ''}`,
          )
          .join('\n')}`,
      };
    }

    return { message: 'Comandos: search, read, write, list, tags, backlinks' };
  }

  canHandle(input: string): boolean {
    const lower = input.toLowerCase();
    return (
      lower.includes('obsidian') ||
      lower.includes('vault') ||
      lower.includes('notas') ||
      lower.includes('segundo cerebro')
    );
  }

  private extractQuery(input: string, keywords: string[]): string {
    for (const kw of keywords) {
      const idx = input.indexOf(kw);
      if (idx >= 0) {
        return (
          input
            .substring(idx + kw.length)
            .trim()
            .replace(/^["']|["']$/g, '') || '.*'
        );
      }
    }
    return input;
  }

  private extractPath(input: string): string | null {
    const match = input.match(/(?:leer|read|abrir|backlinks de)\s+(.+)/i);
    if (match) return match[1].trim();
    const linkMatch = input.match(/\[\[([^\]]+)\]\]/);
    if (linkMatch) return linkMatch[1] + '.md';
    return null;
  }

  private extractFolder(input: string): string | undefined {
    const match = input.match(/(?:folder|carpeta|en)\s+"?([^"]+)"?/i);
    return match ? match[1].trim() : undefined;
  }
}
