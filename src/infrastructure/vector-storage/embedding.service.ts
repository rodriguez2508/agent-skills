/**
 * Embedding Service
 * 
 * Generates vector embeddings from text.
 * For development: uses simple TF-IDF based embeddings.
 * For production: integrate with OpenAI, Ollama, or other embedding providers.
 * 
 * Inspired by Cipher's embedding implementation.
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * Tokenized text with frequency
 */
interface TokenFrequency {
  token: string;
  frequency: number;
}

/**
 * Document statistics for TF-IDF
 */
interface DocumentStats {
  id: string;
  tokenFrequencies: Map<string, number>;
  totalTokens: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  vector: number[];
  dimension: number;
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Embedding options
 */
export interface EmbeddingOptions {
  dimension?: number;
  normalize?: boolean;
}

/**
 * Simple Embedding Service using TF-IDF for development
 * 
 * @example
 * ```typescript
 * const embeddingService = new EmbeddingService();
 * const result = await embeddingService.generate('Hello world');
 * console.log(result.vector); // [0.1, 0.5, -0.3, ...]
 * ```
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly dimension = 384;
  private documentStats: DocumentStats[] = [];
  private idfScores: Map<string, number> = new Map();
  private vocabulary: Set<string> = new Set();

  constructor() {}

  /**
   * Generate embedding for text
   * 
   * @param text - Input text
   * @param options - Embedding options
   * @returns Embedding result with vector
   */
  async generate(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
    const dimension = options?.dimension || this.dimension;
    
    this.logger.debug(`🧮 [EmbeddingService] Generating embedding (dimension: ${dimension})`);

    // Tokenize text
    const tokens = this.tokenize(text);
    
    // Calculate term frequencies
    const tfMap = new Map<string, number>();
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) || 0) + 1);
    }

    // Normalize TF scores
    const normalizedTf = new Map<string, number>();
    for (const [token, freq] of tfMap) {
      normalizedTf.set(token, freq / tokens.length);
    }

    // Generate vector using hash-based dimensionality reduction
    const vector = new Array(dimension).fill(0);
    
    for (const [token, tf] of normalizedTf) {
      const idf = this.getIDF(token);
      const tfidf = tf * idf;
      
      // Hash token to multiple dimensions
      const indices = this.hashToken(token, dimension);
      
      for (const index of indices) {
        vector[index] += tfidf;
      }
    }

    // Normalize vector if requested
    if (options?.normalize !== false) {
      this.normalizeVector(vector);
    }

    this.logger.debug(`✅ [EmbeddingService] Generated embedding (non-zero: ${vector.filter(v => v !== 0).length}/${dimension})`);

    return {
      vector,
      dimension,
      model: 'tfidf-simple',
      usage: {
        promptTokens: tokens.length,
        totalTokens: tokens.length,
      },
    };
  }

  /**
   * Generate embeddings for multiple texts
   * 
   * @param texts - Array of texts
   * @param options - Embedding options
   * @returns Array of embedding results
   */
  async generateBatch(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
    this.logger.debug(`📦 [EmbeddingService] Generating batch embeddings (${texts.length} texts)`);
    
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.generate(text, options));
    }
    
    this.logger.log(`✅ [EmbeddingService] Batch embedding completed: ${results.length} vectors`);
    
    return results;
  }

  /**
   * Index a document for better IDF calculations
   * 
   * @param id - Document ID
   * @param text - Document text
   */
  indexDocument(id: string, text: string): void {
    const tokens = this.tokenize(text);
    const tokenFrequencies = new Map<string, number>();
    
    for (const token of tokens) {
      tokenFrequencies.set(token, (tokenFrequencies.get(token) || 0) + 1);
      this.vocabulary.add(token);
    }
    
    this.documentStats.push({
      id,
      tokenFrequencies,
      totalTokens: tokens.length,
    });
    
    // Update IDF scores
    this.updateIDF();
  }

  /**
   * Clear indexed documents
   */
  clear(): void {
    this.documentStats = [];
    this.idfScores.clear();
    this.vocabulary.clear();
    this.logger.debug('🧹 [EmbeddingService] Cleared indexed documents');
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }

  /**
   * Get IDF score for a token
   */
  private getIDF(token: string): number {
    if (this.idfScores.has(token)) {
      return this.idfScores.get(token)!;
    }
    
    // Default IDF (assume token appears in all documents)
    return 1;
  }

  /**
   * Update IDF scores for all tokens
   */
  private updateIDF(): void {
    const totalDocs = this.documentStats.length;
    
    if (totalDocs === 0) return;
    
    // Count document frequency for each token
    const docFrequency = new Map<string, number>();
    
    for (const doc of this.documentStats) {
      for (const token of doc.tokenFrequencies.keys()) {
        docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
      }
    }
    
    // Calculate IDF
    for (const [token, df] of docFrequency) {
      const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
      this.idfScores.set(token, idf);
    }
    
    this.logger.debug(`📊 [EmbeddingService] Updated IDF scores for ${this.idfScores.size} tokens`);
  }

  /**
   * Hash token to vector indices
   */
  private hashToken(token: string, dimension: number): number[] {
    const indices: number[] = [];
    const numIndices = 3; // Each token affects 3 dimensions
    
    for (let i = 0; i < numIndices; i++) {
      let hash = 0;
      const str = token + i;
      
      for (let j = 0; j < str.length; j++) {
        const char = str.charCodeAt(j);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      indices.push(Math.abs(hash) % dimension);
    }
    
    return indices;
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): void {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vector dimensions must match');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
