/**
 * ChromaDB Vector Store Implementation
 *
 * Production-ready vector store using ChromaDB.
 * @see https://docs.trychroma.com/
 *
 * Features:
 * - Persistent storage
 * - HNSW index for fast similarity search
 * - Metadata filtering
 * - Multiple collections
 *
 * Installation:
 * ```bash
 * pnpm add chromadb
 * ```
 *
 * Usage:
 * ```typescript
 * const store = new ChromaDBVectorStore({
 *   path: 'http://localhost:8000',
 *   collectionName: 'rules',
 * });
 * await store.connect();
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { IVectorStore } from './vector-store.interface';
import {
  VectorDocument,
  VectorSearchResult,
  VectorStoreConfig,
  VectorStoreHealth,
  CollectionStats,
  UpsertOptions,
  SearchOptions,
  VectorFilter,
} from './vector-store.types';

// Dynamic import for chromadb (optional dependency)
let ChromaClient: any;
let Collection: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const chromadb = require('chromadb');
  ChromaClient = chromadb.ChromaClient;
  Collection = chromadb.Collection;
} catch {
  // Chromadb not installed
}

@Injectable()
export class ChromaDBVectorStore implements IVectorStore {
  readonly type = 'chromadb';

  private readonly logger = new Logger(ChromaDBVectorStore.name);
  private client: any;
  private collections: Map<string, any>;
  private config: VectorStoreConfig;
  private connected = false;

  constructor(config?: VectorStoreConfig) {
    this.config = {
      type: 'chromadb',
      path: config?.path || 'http://localhost:8000',
      collectionName: config?.collectionName || 'default',
      dimension: config?.dimension || 384,
      distanceMetric: config?.distanceMetric || 'cosine',
      ...config,
    };

    this.collections = new Map();
  }

  async connect(): Promise<void> {
    if (!ChromaClient) {
      throw new Error('ChromaDB is not installed. Run: pnpm add chromadb');
    }

    this.logger.log(
      `📦 [ChromaDBVectorStore] Connecting to ${this.config.path}...`,
    );

    try {
      this.client = new ChromaClient({
        path: this.config.path,
        auth: this.config.apiKey
          ? { provider: 'token', token: this.config.apiKey }
          : undefined,
      });

      // Test connection
      await this.client.heartbeat();

      this.connected = true;
      this.logger.log('✅ [ChromaDBVectorStore] Connected successfully');
    } catch (error) {
      this.logger.error(
        `❌ [ChromaDBVectorStore] Connection failed: ${error instanceof Error ? error.message : error}`,
      );
      throw new Error(
        `Failed to connect to ChromaDB: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.logger.log('📦 [ChromaDBVectorStore] Disconnecting...');
    this.collections.clear();
    this.connected = false;
    this.client = null;
    this.logger.log('✅ [ChromaDBVectorStore] Disconnected');
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

    try {
      // Check if collection exists
      const existing = await this.client.getCollection({
        name: collectionName,
      });

      if (existing) {
        this.logger.warn(`⚠️ Collection '${collectionName}' already exists`);
        this.collections.set(collectionName, existing);
        return;
      }
    } catch {
      // Collection doesn't exist, create it
    }

    // Create collection with metadata
    const collection = await this.client.createCollection({
      name: collectionName,
      metadata: {
        dimension: dimension || this.config.dimension,
        distanceMetric: this.config.distanceMetric,
      },
    });

    this.collections.set(collectionName, collection);

    this.logger.log(
      `📁 [ChromaDBVectorStore] Created collection: ${collectionName}`,
    );
  }

  async deleteCollection(collectionName: string): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    await this.client.deleteCollection({ name: collectionName });
    this.collections.delete(collectionName);

    this.logger.log(
      `🗑️ [ChromaDBVectorStore] Deleted collection: ${collectionName}`,
    );
  }

  async listCollections(): Promise<string[]> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collections = await this.client.listCollections();
    return collections.map((c: any) => c.name);
  }

  async upsert(
    document: VectorDocument,
    options?: UpsertOptions,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collectionName =
      options?.collectionName ||
      this.config.collectionName ||
      'default' ||
      'default' ||
      'default';
    let collection = this.collections.get(collectionName);

    if (!collection) {
      await this.createCollection(collectionName, document.vector.length);
      collection = this.collections.get(collectionName);
    }

    try {
      await collection.upsert({
        ids: [document.id],
        embeddings: [document.vector],
        metadatas: [
          {
            ...document.metadata,
            tags: document.metadata.tags?.join(',') || '',
          },
        ],
      });

      this.logger.debug(
        `📝 [ChromaDBVectorStore] Upserted document ${document.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to upsert document: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  async upsertBatch(
    documents: VectorDocument[],
    options?: UpsertOptions,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collectionName =
      options?.collectionName ||
      this.config.collectionName ||
      'default' ||
      'default' ||
      'default';
    let collection = this.collections.get(collectionName);

    if (!collection) {
      await this.createCollection(collectionName, documents[0]?.vector.length);
      collection = this.collections.get(collectionName);
    }

    this.logger.debug(
      `📦 [ChromaDBVectorStore] Upserting batch of ${documents.length} documents`,
    );

    try {
      await collection.upsert({
        ids: documents.map((d) => d.id),
        embeddings: documents.map((d) => d.vector),
        metadatas: documents.map((d) => ({
          ...d.metadata,
          tags: d.metadata.tags?.join(',') || '',
        })),
      });

      this.logger.log(
        `✅ [ChromaDBVectorStore] Batch upsert completed: ${documents.length} documents`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to upsert batch: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  async search(
    query: number[],
    options?: SearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (!this.connected) {
      throw new Error('VectorStore not connected. Call connect() first.');
    }

    const collectionName =
      options?.collectionName ||
      this.config.collectionName ||
      'default' ||
      'default';
    const collection = this.collections.get(collectionName);

    if (!collection) {
      this.logger.warn(`⚠️ Collection '${collectionName}' not found`);
      return [];
    }

    const limit = options?.limit || 5;
    const filter = options?.filter;

    this.logger.debug(
      `🔍 [ChromaDBVectorStore] Searching in ${collectionName} (limit: ${limit})`,
    );

    try {
      // Build where filter
      const where: Record<string, any> = {};

      if (filter) {
        if (filter.category) {
          where.category = filter.category;
        }
        if (filter.ruleId) {
          where.ruleId = filter.ruleId;
        }
        if (
          filter.tags &&
          Array.isArray(filter.tags) &&
          filter.tags.length > 0
        ) {
          where.tags = { $contains: filter.tags[0] }; // Simplified for first tag
        }
      }

      const results = await collection.query({
        queryEmbeddings: [query],
        nResults: limit,
        where: Object.keys(where).length > 0 ? where : undefined,
        include: ['embeddings', 'metadatas', 'documents'],
      });

      // Transform results
      const searchResults: VectorSearchResult[] = [];

      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas?.[0]?.[i] || {};

          searchResults.push({
            document: {
              id: results.ids[0][i],
              vector: results.embeddings?.[0]?.[i] || [],
              metadata: {
                ruleId: metadata.ruleId,
                title: metadata.title,
                category: metadata.category,
                content: metadata.content || '',
                tags: metadata.tags ? metadata.tags.split(',') : [],
                ...metadata,
              },
            },
            score: 1 - (results.distances?.[0]?.[i] || 0), // Convert distance to similarity
            distance: results.distances?.[0]?.[i] || 0,
          });
        }
      }

      this.logger.debug(
        `✅ [ChromaDBVectorStore] Found ${searchResults.length} results`,
      );

      return searchResults;
    } catch (error) {
      this.logger.error(
        `Search failed: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  async getById(
    id: string,
    collectionName?: string,
  ): Promise<VectorDocument | null> {
    const collection = this.collections.get(
      collectionName || this.config.collectionName || 'default',
    );

    if (!collection) {
      return null;
    }

    try {
      const results = await collection.get({
        ids: [id],
        include: ['embeddings', 'metadatas'],
      });

      if (!results.ids || results.ids.length === 0) {
        return null;
      }

      const metadata = results.metadatas?.[0] || {};

      return {
        id: results.ids[0],
        vector: results.embeddings?.[0] || [],
        metadata: {
          ruleId: metadata.ruleId,
          title: metadata.title,
          category: metadata.category,
          content: metadata.content || '',
          tags: metadata.tags ? metadata.tags.split(',') : [],
          ...metadata,
        },
      };
    } catch {
      return null;
    }
  }

  async delete(id: string, collectionName?: string): Promise<boolean> {
    const collection = this.collections.get(
      collectionName || this.config.collectionName || 'default',
    );

    if (!collection) {
      return false;
    }

    try {
      await collection.delete({ ids: [id] });
      this.logger.debug(`🗑️ [ChromaDBVectorStore] Deleted document ${id}`);
      return true;
    } catch {
      return false;
    }
  }

  async deleteByFilter(
    filter: VectorFilter,
    collectionName?: string,
  ): Promise<number> {
    const collection = this.collections.get(
      collectionName || this.config.collectionName || 'default',
    );

    if (!collection) {
      return 0;
    }

    try {
      // Get IDs matching filter
      const where: Record<string, any> = {};

      if (filter.category) {
        where.category = filter.category;
      }
      if (filter.ruleId) {
        where.ruleId = filter.ruleId;
      }

      const results = await collection.get({
        where,
        include: [],
      });

      if (!results.ids || results.ids.length === 0) {
        return 0;
      }

      await collection.delete({ ids: results.ids });

      this.logger.log(
        `🗑️ [ChromaDBVectorStore] Deleted ${results.ids.length} documents by filter`,
      );

      return results.ids.length;
    } catch {
      return 0;
    }
  }

  async getStats(collectionName?: string): Promise<CollectionStats> {
    const collection = this.collections.get(
      collectionName || this.config.collectionName || 'default',
    );

    if (!collection) {
      return { count: 0 };
    }

    try {
      const count = await collection.count();

      return {
        count,
        dimension: this.config.dimension,
        distanceMetric: this.config.distanceMetric,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch {
      return { count: 0 };
    }
  }

  async healthCheck(): Promise<VectorStoreHealth> {
    const startTime = Date.now();

    try {
      if (!this.connected) {
        return {
          status: 'unhealthy',
          type: 'chromadb',
          connected: false,
          error: 'Not connected',
        };
      }

      // Test connection
      await this.client.heartbeat();

      const collectionCount = this.collections.size;
      const latency = Date.now() - startTime;

      return {
        status: 'healthy',
        type: 'chromadb',
        connected: true,
        collectionCount,
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        type: 'chromadb',
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clear(collectionName?: string): Promise<void> {
    const collection = this.collections.get(
      collectionName || this.config.collectionName || 'default',
    );

    if (!collection) {
      return;
    }

    try {
      // ChromaDB doesn't have a clear method, so we delete and recreate
      const name: string =
        collectionName || this.config.collectionName || 'default';
      await this.deleteCollection(name);
      await this.createCollection(name);

      this.logger.log(`🧹 [ChromaDBVectorStore] Cleared collection: ${name}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear collection: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }
}
