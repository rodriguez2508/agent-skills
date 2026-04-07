/**
 * In-Memory Vector Store Implementation
 *
 * Simple implementation for development and testing.
 * Uses cosine similarity for vector search.
 *
 * NOTE: This is NOT persistent. For production, use ChromaDB, Pinecone, etc.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IVectorStore } from './vector-store.interface';
import {
  VectorDocument,
  VectorSearchResult,
  VectorStoreHealth,
  CollectionStats,
  UpsertOptions,
  SearchOptions,
  VectorFilter,
  DistanceMetric,
} from './vector-store.types';

/**
 * Collection data structure
 */
interface VectorCollection {
  name: string;
  documents: Map<string, VectorDocument>;
  dimension?: number;
  distanceMetric: DistanceMetric;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory implementation of IVectorStore
 *
 * @example
 * ```typescript
 * const store = new InMemoryVectorStore();
 * await store.connect();
 * await store.createCollection('rules', 384);
 * await store.upsert({ id: '1', vector: [...], metadata: {...} });
 * const results = await store.search(queryVector, { limit: 5 });
 * ```
 */
@Injectable()
export class InMemoryVectorStore implements IVectorStore {
  readonly type = 'inmemory';

  private readonly logger = new Logger(InMemoryVectorStore.name);
  private collections: Map<string, VectorCollection>;
  private connected = false;
  private readonly defaultDimension = 384;

  constructor() {
    this.collections = new Map();
  }

  async connect(): Promise<void> {
    this.logger.log('📦 [InMemoryVectorStore] Connecting...');
    this.connected = true;
    this.logger.log('✅ [InMemoryVectorStore] Connected successfully');
  }

  async disconnect(): Promise<void> {
    this.logger.log('📦 [InMemoryVectorStore] Disconnecting...');
    this.collections.clear();
    this.connected = false;
    this.logger.log('✅ [InMemoryVectorStore] Disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async createCollection(
    collectionName: string,
    dimension?: number,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    if (this.collections.has(collectionName)) {
      this.logger.warn(`⚠️ Collection '${collectionName}' already exists`);
      return;
    }

    this.collections.set(collectionName, {
      name: collectionName,
      documents: new Map(),
      dimension: dimension || this.defaultDimension,
      distanceMetric: 'cosine',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(
      `📁 [InMemoryVectorStore] Created collection: ${collectionName} (dimension: ${dimension || this.defaultDimension})`,
    );
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection '${collectionName}' does not exist`);
    }

    this.collections.delete(collectionName);
    this.logger.log(
      `🗑️ [InMemoryVectorStore] Deleted collection: ${collectionName}`,
    );
  }

  async listCollections(): Promise<string[]> {
    return Array.from(this.collections.keys());
  }

  async upsert(
    document: VectorDocument,
    options?: UpsertOptions,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collectionName = options?.collectionName || 'default';
    const collection = this.collections.get(collectionName);

    if (!collection) {
      await this.createCollection(collectionName, document.vector.length);
      return this.upsert(document, options);
    }

    // Validate dimension
    if (
      collection.dimension &&
      document.vector.length !== collection.dimension
    ) {
      throw new Error(
        `Vector dimension mismatch. Expected ${collection.dimension}, got ${document.vector.length}`,
      );
    }

    const now = new Date();
    const exists = collection.documents.has(document.id);

    collection.documents.set(document.id, {
      ...document,
      createdAt: exists
        ? collection.documents.get(document.id)!.createdAt
        : now,
      updatedAt: now,
    });

    collection.updatedAt = now;

    this.logger.debug(
      `📝 [InMemoryVectorStore] ${exists ? 'Updated' : 'Inserted'} document ${document.id} in ${collectionName}`,
    );
  }

  async upsertBatch(
    documents: VectorDocument[],
    options?: UpsertOptions,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    this.logger.debug(
      `📦 [InMemoryVectorStore] Upserting batch of ${documents.length} documents`,
    );

    for (const document of documents) {
      await this.upsert(document, options);
    }

    this.logger.log(
      `✅ [InMemoryVectorStore] Batch upsert completed: ${documents.length} documents`,
    );
  }

  async search(
    query: number[],
    options?: SearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collectionName = options?.collectionName || 'default';
    const collection = this.collections.get(collectionName);

    if (!collection) {
      this.logger.warn(`⚠️ Collection '${collectionName}' not found`);
      return [];
    }

    const limit = options?.limit || 5;
    const filter = options?.filter;

    this.logger.debug(
      `🔍 [InMemoryVectorStore] Searching in ${collectionName} (limit: ${limit})`,
    );

    const results: VectorSearchResult[] = [];

    for (const [id, document] of collection.documents) {
      // Apply filter if provided
      if (filter && !this.matchesFilter(document.metadata, filter)) {
        continue;
      }

      const score = this.calculateSimilarity(
        query,
        document.vector,
        collection.distanceMetric,
      );

      results.push({
        document,
        score,
        distance: 1 - score, // Convert similarity to distance
      });
    }

    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    this.logger.debug(
      `✅ [InMemoryVectorStore] Found ${limitedResults.length} results`,
    );

    return limitedResults;
  }

  async getById(
    id: string,
    collectionName?: string,
  ): Promise<VectorDocument | null> {
    const collection = this.collections.get(collectionName || 'default');

    if (!collection) {
      return null;
    }

    return collection.documents.get(id) || null;
  }

  async delete(id: string, collectionName?: string): Promise<boolean> {
    const collection = this.collections.get(collectionName || 'default');

    if (!collection) {
      return false;
    }

    const existed = collection.documents.delete(id);

    if (existed) {
      collection.updatedAt = new Date();
      this.logger.debug(`🗑️ [InMemoryVectorStore] Deleted document ${id}`);
    }

    return existed;
  }

  async deleteByFilter(
    filter: VectorFilter,
    collectionName?: string,
  ): Promise<number> {
    const collection = this.collections.get(collectionName || 'default');

    if (!collection) {
      return 0;
    }

    let deletedCount = 0;

    for (const [id, document] of collection.documents) {
      if (this.matchesFilter(document.metadata, filter)) {
        collection.documents.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      collection.updatedAt = new Date();
      this.logger.log(
        `🗑️ [InMemoryVectorStore] Deleted ${deletedCount} documents by filter`,
      );
    }

    return deletedCount;
  }

  async getStats(collectionName?: string): Promise<CollectionStats> {
    const collection = this.collections.get(collectionName || 'default');

    if (!collection) {
      return {
        count: 0,
      };
    }

    return {
      count: collection.documents.size,
      dimension: collection.dimension,
      distanceMetric: collection.distanceMetric,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    };
  }

  async healthCheck(): Promise<VectorStoreHealth> {
    const startTime = Date.now();

    try {
      if (!this.connected) {
        return {
          status: 'unhealthy',
          type: 'inmemory',
          connected: false,
          error: 'Not connected',
        };
      }

      const collectionCount = this.collections.size;
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        type: 'inmemory',
        connected: true,
        collectionCount,
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: 'inmemory',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clear(collectionName?: string): Promise<void> {
    const collection = this.collections.get(collectionName || 'default');

    if (!collection) {
      return;
    }

    collection.documents.clear();
    collection.updatedAt = new Date();

    this.logger.log(
      `🧹 [InMemoryVectorStore] Cleared collection: ${collectionName || 'default'}`,
    );
  }

  /**
   * Calculate similarity between two vectors
   */
  private calculateSimilarity(
    vector1: number[],
    vector2: number[],
    metric: DistanceMetric = 'cosine',
  ): number {
    switch (metric) {
      case 'cosine':
        return this.cosineSimilarity(vector1, vector2);
      case 'euclidean':
        return this.euclideanSimilarity(vector1, vector2);
      case 'dot':
        return this.dotProduct(vector1, vector2);
      case 'manhattan':
        return this.manhattanSimilarity(vector1, vector2);
      default:
        return this.cosineSimilarity(vector1, vector2);
    }
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(vector1: number[], vector2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < Math.min(vector1.length, vector2.length); i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Euclidean distance converted to similarity
   */
  private euclideanSimilarity(vector1: number[], vector2: number[]): number {
    let sum = 0;

    for (let i = 0; i < Math.min(vector1.length, vector2.length); i++) {
      const diff = vector1[i] - vector2[i];
      sum += diff * diff;
    }

    // Convert distance to similarity (1 / (1 + distance))
    return 1 / (1 + Math.sqrt(sum));
  }

  /**
   * Dot product similarity
   */
  private dotProduct(vector1: number[], vector2: number[]): number {
    let sum = 0;

    for (let i = 0; i < Math.min(vector1.length, vector2.length); i++) {
      sum += vector1[i] * vector2[i];
    }

    // Normalize to 0-1 range
    const maxPossible =
      vector1.length *
      Math.max(...vector1.map(Math.abs)) *
      Math.max(...vector2.map(Math.abs));
    return maxPossible === 0 ? 0 : sum / maxPossible;
  }

  /**
   * Manhattan distance converted to similarity
   */
  private manhattanSimilarity(vector1: number[], vector2: number[]): number {
    let sum = 0;

    for (let i = 0; i < Math.min(vector1.length, vector2.length); i++) {
      sum += Math.abs(vector1[i] - vector2[i]);
    }

    // Convert distance to similarity
    return 1 / (1 + sum);
  }

  /**
   * Check if metadata matches filter
   */
  private matchesFilter(metadata: any, filter: VectorFilter): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'tags' && Array.isArray(value)) {
        // Check if any tag matches
        const metadataTags = metadata.tags || [];
        if (!value.some((tag) => metadataTags.includes(tag))) {
          return false;
        }
      } else if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }
}
