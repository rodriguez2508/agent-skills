/**
 * Exa Search Adapter
 *
 * Adapter para Exa AI Search API - Implementa el puerto de búsqueda web
 * Sigue arquitectura Hexagonal (Ports & Adapters)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Exa } from 'exa-js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published?: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  category?:
    | 'news'
    | 'pdf'
    | 'company'
    | 'research paper'
    | 'personal site'
    | 'financial report'
    | 'people';
}

@Injectable()
export class ExaSearchAdapter {
  private readonly logger = new Logger(ExaSearchAdapter.name);
  private exa: Exa | null = null;
  private enabled: boolean = false;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('EXA_API_KEY');
    this.enabled = this.configService.get<string>('EXA_ENABLED') === 'true';

    if (this.enabled && apiKey) {
      this.exa = new Exa(apiKey);
      this.logger.log('✅ Exa Search adapter initialized');
    } else if (this.enabled && !apiKey) {
      this.logger.warn('⚠️ EXA_ENABLED=true but EXA_API_KEY not set');
    } else {
      this.logger.log('ℹ️ Exa Search adapter disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.exa !== null;
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isEnabled()) {
      throw new Error('Exa Search is not enabled or not configured');
    }

    try {
      const limit = options.limit || 10;

      const response = await this.exa!.search(options.query, {
        numResults: limit,
      });

      return response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.text,
        published: result.published,
      }));
    } catch (error) {
      this.logger.error(`Exa search failed: ${error.message}`);
      throw error;
    }
  }

  async findSimilar(url: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isEnabled()) {
      throw new Error('Exa Search is not enabled or not configured');
    }

    try {
      const response = await this.exa!.findSimilar(url, {
        numResults: limit,
      });

      return response.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.text,
        published: result.published,
      }));
    } catch (error) {
      this.logger.error(`Exa find similar failed: ${error.message}`);
      throw error;
    }
  }
}
