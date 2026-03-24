import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchEngine, SearchResult } from '@application/ports/search-engine.port';
import { Rule } from '@core/domain/entities/rule.entity';

export interface BM25Config {
  k1: number;
  b: number;
}

@Injectable()
export class BM25Engine implements SearchEngine {
  private invertedIndex: Map<string, Map<string, number>> = new Map();
  private docLengths: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private rules: Map<string, Rule> = new Map();
  private readonly k1: number;
  private readonly b: number;

  constructor(private readonly configService: ConfigService) {
    this.k1 = this.configService.get<number>('BM25_K1', 1.5);
    this.b = this.configService.get<number>('BM25_B', 0.75);
  }

  index(rule: Rule): void {
    this.rules.set(rule.id, rule);
    // Include impactDescription in the indexed content for better search relevance
    const searchableContent = `${rule.name} ${rule.content} ${rule.tags.join(' ')} ${rule.impactDescription || ''}`;
    const content = this.tokenize(searchableContent);
    this.docLengths.set(rule.id, content.length);

    for (const token of content) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Map());
      }
      const termMap = this.invertedIndex.get(token)!;
      termMap.set(rule.id, (termMap.get(rule.id) || 0) + 1);
    }

    this.updateAvgDocLength();
  }

  search(query: string, limit: number = 10): SearchResult[] {
    const tokens = this.tokenize(query.toLowerCase());
    const scores = new Map<string, number>();

    for (const token of tokens) {
      const docs = this.invertedIndex.get(token);
      if (!docs) continue;

      const idf = this.calculateIDF(docs.size);

      for (const [docId, termFreq] of docs.entries()) {
        const score = this.bm25Score(termFreq, docId, idf);
        scores.set(docId, (scores.get(docId) || 0) + score);
      }
    }

    const results: SearchResult[] = [];
    scores.forEach((score, ruleId) => {
      const rule = this.rules.get(ruleId);
      if (rule && score > 0) {
        results.push({ rule, score });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  searchByCategory(query: string, category: string, limit: number = 10): SearchResult[] {
    const allResults = this.search(query, limit * 3);
    return allResults
      .filter((result) => result.rule.category.toLowerCase() === category.toLowerCase())
      .slice(0, limit);
  }

  remove(ruleId: string): void {
    this.rules.delete(ruleId);
    this.docLengths.delete(ruleId);

    for (const termMap of this.invertedIndex.values()) {
      termMap.delete(ruleId);
    }

    this.updateAvgDocLength();
  }

  clear(): void {
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.rules.clear();
    this.avgDocLength = 0;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length > 0)
      .filter((token) => !this.isStopWord(token));
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
    ];
    return stopWords.includes(word);
  }

  private calculateIDF(docCount: number): number {
    const totalDocs = this.rules.size;
    return Math.log((totalDocs - docCount + 0.5) / (docCount + 0.5) + 1);
  }

  private bm25Score(termFreq: number, docId: string, idf: number): number {
    const docLength = this.docLengths.get(docId) || 0;
    const numerator = termFreq * (this.k1 + 1);
    const denominator =
      termFreq +
      this.k1 * (1 - this.b + (this.b * docLength) / this.avgDocLength);
    return idf * (numerator / denominator);
  }

  private updateAvgDocLength(): void {
    const lengths = Array.from(this.docLengths.values());
    this.avgDocLength =
      lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  }
}
