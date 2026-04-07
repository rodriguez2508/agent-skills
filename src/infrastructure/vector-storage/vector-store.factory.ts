/**
 * Vector Store Factory
 *
 * Creates vector store instances based on configuration.
 * Factory pattern for multi-backend support.
 */

import { Injectable, Logger } from '@nestjs/common';
import { IVectorStore } from './vector-store.interface';
import { InMemoryVectorStore } from './inmemory-vector.store';
import { ChromaDBVectorStore } from './chromadb-vector.store';
import { VectorStoreConfig, VectorStoreType } from './vector-store.types';

/**
 * Factory configuration for vector store
 */
export interface VectorStoreFactoryConfig {
  type: VectorStoreType;
  config?: VectorStoreConfig;
}

/**
 * Vector Store Factory
 *
 * Creates and manages vector store instances.
 *
 * @example
 * ```typescript
 * const factory = new VectorStoreFactory();
 *
 * // Create in-memory store for development
 * const store = await factory.create({ type: 'inmemory' });
 *
 * // Create ChromaDB store for production
 * const store = await factory.create({
 *   type: 'chromadb',
 *   config: { path: 'http://localhost:8000' },
 * });
 * ```
 */
@Injectable()
export class VectorStoreFactory {
  private readonly logger = new Logger(VectorStoreFactory.name);
  private stores: Map<string, IVectorStore>;

  constructor() {
    this.stores = new Map();
  }

  /**
   * Create a vector store instance
   *
   * @param config - Factory configuration
   * @returns Configured vector store instance
   */
  async create(config: VectorStoreFactoryConfig): Promise<IVectorStore> {
    const storeKey = config.type;

    // Return cached instance if exists
    if (this.stores.has(storeKey)) {
      this.logger.debug(
        `♻️ [VectorStoreFactory] Reusing existing ${config.type} store`,
      );
      return this.stores.get(storeKey)!;
    }

    this.logger.log(
      `🏭 [VectorStoreFactory] Creating ${config.type} vector store...`,
    );

    let store: IVectorStore;

    switch (config.type) {
      case 'inmemory':
        store = new InMemoryVectorStore();
        break;

      case 'chromadb':
        store = new ChromaDBVectorStore(config.config);
        break;

      // TODO: Implement additional backends
      case 'pinecone':
        throw new Error('Pinecone vector store not yet implemented');

      case 'faiss':
        throw new Error('FAISS vector store not yet implemented');

      case 'redis':
        throw new Error('Redis vector store not yet implemented');

      case 'weaviate':
        throw new Error('Weaviate vector store not yet implemented');

      case 'qdrant':
        throw new Error('Qdrant vector store not yet implemented');

      case 'milvus':
        throw new Error('Milvus vector store not yet implemented');

      case 'pgvector':
        throw new Error('Pgvector store not yet implemented');

      case 'sqlite':
        throw new Error('SQLite vector store not yet implemented');

      default:
        throw new Error(`Unknown vector store type: ${config.type}`);
    }

    // Connect to the store
    try {
      await store.connect();
      this.stores.set(storeKey, store);
      this.logger.log(
        `✅ [VectorStoreFactory] ${config.type} store connected successfully`,
      );
      return store;
    } catch (error) {
      this.logger.error(
        `❌ [VectorStoreFactory] Failed to connect: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  }

  /**
   * Get an existing vector store instance
   *
   * @param type - Vector store type
   * @returns Existing store or undefined
   */
  get(type: VectorStoreType): IVectorStore | undefined {
    return this.stores.get(type);
  }

  /**
   * Get all registered stores
   */
  getAll(): Map<string, IVectorStore> {
    return new Map(this.stores);
  }

  /**
   * Disconnect and remove a store
   *
   * @param type - Vector store type
   */
  async remove(type: VectorStoreType): Promise<void> {
    const store = this.stores.get(type);

    if (store) {
      await store.disconnect();
      this.stores.delete(type);
      this.logger.log(`🗑️ [VectorStoreFactory] Removed ${type} store`);
    }
  }

  /**
   * Disconnect all stores
   */
  async removeAll(): Promise<void> {
    this.logger.log('🏭 [VectorStoreFactory] Disconnecting all stores...');

    for (const [type, store] of this.stores) {
      await store.disconnect();
      this.logger.debug(`✅ [VectorStoreFactory] Disconnected ${type}`);
    }

    this.stores.clear();
    this.logger.log('✅ [VectorStoreFactory] All stores disconnected');
  }

  /**
   * Check if a store exists
   *
   * @param type - Vector store type
   */
  has(type: VectorStoreType): boolean {
    return this.stores.has(type);
  }

  /**
   * Get health status of all stores
   */
  async healthCheck(): Promise<Map<string, any>> {
    const healthMap = new Map<string, any>();

    for (const [type, store] of this.stores) {
      try {
        const health = await store.healthCheck();
        healthMap.set(type, health);
      } catch (error) {
        healthMap.set(type, {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return healthMap;
  }
}
