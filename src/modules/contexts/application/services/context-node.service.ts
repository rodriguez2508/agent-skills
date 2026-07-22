/**
 * ContextNodeService
 *
 * Indexa cada mensaje del chat como un "nodo de contexto" usando BM25
 * por proyecto. Permite recuperar fragmentos de conversaciones pasadas
 * relevantes al input actual para enriquecer respuestas del agente.
 *
 * Diseño:
 *   - Un índice BM25 por projectId, lazy-built al primer acceso desde
 *     `chat_messages` (filtrando por sessions del proyecto).
 *   - `indexMessage()` agrega un nodo nuevo al índice activo.
 *   - `search()` retorna top-K nodos relevantes ordenados por score.
 *   - No requiere migración: usa la tabla `chat_messages` existente.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '@modules/sessions/domain/entities/session.entity';
import { RedisService } from '@infrastructure/database/redis/redis.service';

export interface ProjectSummary {
  totalMessages: number;
  issuesWorked: string[];
  keyDecisions: string[];
  modulesModified: string[];
  relevantChunks: { content: string; score: number }[];
}

export interface ContextNode {
  id: string;
  projectId: string;
  sessionId: string;
  issueId?: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ContextSearchResult {
  node: ContextNode;
  score: number;
  snippet: string;
}

interface ProjectIndex {
  invertedIndex: Map<string, Map<string, number>>; // term → (nodeId → tf)
  docLengths: Map<string, number>;
  nodes: Map<string, ContextNode>;
  avgDocLength: number;
  hydratedAt: Date;
}

interface SerializedIndex {
  invertedIndex: Record<string, Record<string, number>>;
  docLengths: Record<string, number>;
  nodes: Record<string, unknown>;
  avgDocLength: number;
  hydratedAt: string;
}

@Injectable()
export class ContextNodeService {
  private readonly logger = new Logger(ContextNodeService.name);
  private readonly indices: Map<string, ProjectIndex> = new Map();
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private readonly maxHistorySize = 500;

  private readonly BM25_CACHE_TTL = 60 * 60 * 24 * 7; // 7 días

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Indexa un mensaje como nodo de contexto para su proyecto.
   * Si el índice del proyecto no existe, se hidrata primero desde DB.
   */
  async indexMessage(message: {
    id: string;
    projectId: string;
    sessionId: string;
    issueId?: string;
    role: string;
    content: string;
    createdAt?: Date;
  }): Promise<void> {
    if (!message.projectId || !message.content?.trim()) return;

    const index = await this.getOrHydrateIndex(message.projectId);
    const node: ContextNode = {
      id: message.id,
      projectId: message.projectId,
      sessionId: message.sessionId,
      issueId: message.issueId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt || new Date(),
    };
    this.addNodeToIndex(index, node);
  }

  /**
   * Busca los top-K nodos de contexto más relevantes para una query
   * dentro del proyecto especificado.
   */
  async search(
    projectId: string,
    query: string,
    limit = 5,
  ): Promise<ContextSearchResult[]> {
    if (!projectId || !query?.trim()) return [];
    const index = await this.getOrHydrateIndex(projectId);
    if (index.nodes.size === 0) return [];

    const tokens = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const token of tokens) {
      const docs = index.invertedIndex.get(token);
      if (!docs) continue;
      const idf = this.calculateIDF(index.nodes.size, docs.size);
      for (const [nodeId, tf] of docs.entries()) {
        const score = this.bm25Score(index, tf, nodeId, idf);
        scores.set(nodeId, (scores.get(nodeId) || 0) + score);
      }
    }

    const results: ContextSearchResult[] = [];
    scores.forEach((score, nodeId) => {
      const node = index.nodes.get(nodeId);
      if (node && score > 0) {
        results.push({
          node,
          score,
          snippet: this.buildSnippet(node.content, tokens),
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Fuerza la rehidratación del índice de un proyecto desde DB.
   * Útil tras restart o cuando se sospecha desincronización.
   */
  async rehydrate(projectId: string): Promise<number> {
    this.indices.delete(projectId);
    const index = await this.getOrHydrateIndex(projectId);
    return index.nodes.size;
  }

  /**
   * Devuelve estadísticas del índice (debug/observabilidad).
   */
  getStats(projectId: string): {
    indexed: boolean;
    nodeCount: number;
    termCount: number;
    avgDocLength: number;
    hydratedAt?: Date;
  } {
    const index = this.indices.get(projectId);
    if (!index) {
      return { indexed: false, nodeCount: 0, termCount: 0, avgDocLength: 0 };
    }
    return {
      indexed: true,
      nodeCount: index.nodes.size,
      termCount: index.invertedIndex.size,
      avgDocLength: index.avgDocLength,
      hydratedAt: index.hydratedAt,
    };
  }

  /** Limpia el índice de un proyecto (útil para tests). */
  clear(projectId?: string): void {
    if (projectId) this.indices.delete(projectId);
    else this.indices.clear();
  }

  /**
   * Genera un resumen estructurado del historial de un proyecto.
   * Extrae issues, decisiones clave y módulos modificados.
   */
  async getProjectSummary(projectId: string, query?: string): Promise<ProjectSummary> {
    const index = await this.getOrHydrateIndex(projectId);
    const totalMessages = index.nodes.size;

    const searchQuery = query?.trim() ||
      'implementé decidí módulo arquitectura refactoricé cambiamos solución';
    const topResults = totalMessages > 0
      ? await this.search(projectId, searchQuery, 8)
      : [];

    const allNodes = Array.from(index.nodes.values());
    const assistantNodes = allNodes.filter((n) => n.role === 'assistant');

    const issuesWorked = this.extractIssues(assistantNodes);
    const keyDecisions = this.extractDecisions(assistantNodes);
    const modulesModified = this.extractModules(assistantNodes);

    const relevantChunks = topResults.map((r) => ({
      content: r.snippet,
      score: r.score,
    }));

    return { totalMessages, issuesWorked, keyDecisions, modulesModified, relevantChunks };
  }

  // ---------- internals ----------

  private extractIssues(nodes: ContextNode[]): string[] {
    const set = new Set<string>();
    const issuePattern = /#[\w-]+|CTX-\d+|ISS-\d+/gi;
    for (const n of nodes) {
      const matches = n.content.match(issuePattern);
      if (matches) matches.forEach((m) => set.add(m));
      if (n.issueId) set.add(n.issueId);
    }
    return Array.from(set).slice(0, 20);
  }

  private extractDecisions(nodes: ContextNode[]): string[] {
    const decisionKeywords = [
      'decidí', 'decidimos', 'implementé', 'implementamos',
      'refactoricé', 'cambiamos', 'solución fue', 'optamos',
      'elegimos', 'migramos', 'agregamos', 'removimos',
    ];
    const decisions: string[] = [];
    for (const n of nodes) {
      const lines = n.content.split(/[.\n]/);
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (decisionKeywords.some((k) => lower.includes(k))) {
          const trimmed = line.trim();
          if (trimmed.length > 20 && trimmed.length < 300) {
            decisions.push(trimmed);
          }
        }
      }
      if (decisions.length >= 10) break;
    }
    return [...new Set(decisions)].slice(0, 10);
  }

  private extractModules(nodes: ContextNode[]): string[] {
    const set = new Set<string>();
    const filePattern = /src\/[\w/.-]+\.(ts|js|tsx|jsx)/g;
    for (const n of nodes) {
      const matches = n.content.match(filePattern);
      if (matches) matches.forEach((m) => set.add(m));
      if (set.size >= 30) break;
    }
    return Array.from(set).slice(0, 30);
  }

  private async getOrHydrateIndex(projectId: string): Promise<ProjectIndex> {
    const existing = this.indices.get(projectId);
    if (existing) return existing;

    // Intentar cargar desde Redis primero
    if (this.redisService) {
      try {
        const cached = await this.redisService.get<SerializedIndex>(
          `bm25:index:${projectId}`,
        );
        if (cached) {
          const index = this.deserializeIndex(cached);
          this.indices.set(projectId, index);
          this.logger.debug(
            `📦 Loaded BM25 index from Redis for project ${projectId}: ${index.nodes.size} nodes`,
          );
          return index;
        }
      } catch (e) {
        this.logger.warn(`Redis BM25 cache miss for ${projectId}: ${e.message}`);
      }
    }

    const index: ProjectIndex = {
      invertedIndex: new Map(),
      docLengths: new Map(),
      nodes: new Map(),
      avgDocLength: 0,
      hydratedAt: new Date(),
    };
    this.indices.set(projectId, index);
    return index;
  }

  private serializeIndex(index: ProjectIndex): SerializedIndex {
    return {
      invertedIndex: Object.fromEntries(
        Array.from(index.invertedIndex.entries()).map(([term, docs]) => [
          term,
          Object.fromEntries(docs.entries()),
        ]),
      ),
      docLengths: Object.fromEntries(index.docLengths.entries()),
      nodes: Object.fromEntries(
        Array.from(index.nodes.entries()).map(([id, n]) => [
          id,
          { ...n, createdAt: n.createdAt.toISOString() },
        ]),
      ),
      avgDocLength: index.avgDocLength,
      hydratedAt: index.hydratedAt.toISOString(),
    };
  }

  private deserializeIndex(data: SerializedIndex): ProjectIndex {
    const invertedIndex = new Map<string, Map<string, number>>(
      Object.entries(data.invertedIndex).map(([term, docs]) => [
        term,
        new Map(Object.entries(docs)),
      ]),
    );
    const docLengths = new Map<string, number>(Object.entries(data.docLengths));
    const nodes = new Map<string, ContextNode>(
      Object.entries(data.nodes).map(([id, n]) => {
        const raw = n as Record<string, any>;
        const node: ContextNode = {
          id: raw.id,
          projectId: raw.projectId,
          sessionId: raw.sessionId,
          issueId: raw.issueId,
          role: raw.role,
          content: raw.content,
          createdAt: new Date(raw.createdAt),
        };
        return [id, node];
      }),
    );
    return {
      invertedIndex,
      docLengths,
      nodes,
      avgDocLength: data.avgDocLength,
      hydratedAt: new Date(data.hydratedAt),
    };
  }

  private addNodeToIndex(index: ProjectIndex, node: ContextNode): void {
    if (index.nodes.has(node.id)) return; // idempotent
    const tokens = this.tokenize(node.content);
    if (tokens.length === 0) return;

    index.nodes.set(node.id, node);
    index.docLengths.set(node.id, tokens.length);

    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    for (const [term, tf] of freq.entries()) {
      let posting = index.invertedIndex.get(term);
      if (!posting) {
        posting = new Map();
        index.invertedIndex.set(term, posting);
      }
      posting.set(node.id, tf);
    }
    this.recomputeAvgDocLength(index);
  }

  private recomputeAvgDocLength(index: ProjectIndex): void {
    if (index.docLengths.size === 0) {
      index.avgDocLength = 0;
      return;
    }
    let total = 0;
    for (const l of index.docLengths.values()) total += l;
    index.avgDocLength = total / index.docLengths.size;
  }

  private calculateIDF(totalDocs: number, docsWithTerm: number): number {
    return Math.log(
      (totalDocs - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1,
    );
  }

  private bm25Score(
    index: ProjectIndex,
    tf: number,
    nodeId: string,
    idf: number,
  ): number {
    const docLen = index.docLengths.get(nodeId) || 0;
    const numerator = tf * (this.k1 + 1);
    const denominator =
      tf +
      this.k1 *
        (1 - this.b + this.b * (docLen / (index.avgDocLength || 1)));
    return idf * (numerator / denominator);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s-]/gi, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  }

  private buildSnippet(content: string, queryTokens: string[]): string {
    const text = content.replace(/\s+/g, ' ').trim();
    if (text.length <= 200) return text;
    const lower = text.toLowerCase();
    const firstHit = queryTokens
      .map((t) => lower.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    if (firstHit === undefined) return text.substring(0, 200) + '…';
    const start = Math.max(0, firstHit - 60);
    const end = Math.min(text.length, firstHit + 160);
    return (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '');
  }
}

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','de','el','en','for','from','has','have','i','in','is',
  'it','la','las','los','no','of','on','or','para','que','se','si','su','sus','the','this','to','un',
  'una','unas','unos','was','were','will','with','y','you','yo','tu','con','del','al','le','lo',
]);
