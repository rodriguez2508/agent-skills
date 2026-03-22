/**
 * Vector Store Interface
 * 
 * Abstract interface for multi-backend vector storage.
 * Inspired by Cipher's vector_storage implementation.
 */

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

/**
 * Abstract interface for vector storage backends
 * 
 * @interface IVectorStore
 */
export abstract class IVectorStore {
  /**
   * Vector store type identifier
   */
  abstract readonly type: string;

  /**
   * Initialize connection to the vector store
   */
  abstract connect(): Promise<void>;

  /**
   * Close connection to the vector store
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if the vector store is connected
   */
  abstract isConnected(): boolean;

  /**
   * Create or get a collection
   * 
   * @param collectionName - Name of the collection
   * @param dimension - Dimension of vectors (optional, will be inferred)
   */
  abstract createCollection(collectionName: string, dimension?: number): Promise<void>;

  /**
   * Delete a collection
   * 
   * @param collectionName - Name of the collection
   */
  abstract deleteCollection(collectionName: string): Promise<void>;

  /**
   * List all collections
   */
  abstract listCollections(): Promise<string[]>;

  /**
   * Insert or update a vector document
   * 
   * @param document - Vector document to upsert
   * @param options - Upsert options
   */
  abstract upsert(document: VectorDocument, options?: UpsertOptions): Promise<void>;

  /**
   * Insert or update multiple vector documents
   * 
   * @param documents - Array of vector documents
   * @param options - Upsert options
   */
  abstract upsertBatch(documents: VectorDocument[], options?: UpsertOptions): Promise<void>;

  /**
   * Search for similar vectors
   * 
   * @param query - Query vector
   * @param options - Search options
   * @returns Array of search results sorted by score
   */
  abstract search(query: number[], options?: SearchOptions): Promise<VectorSearchResult[]>;

  /**
   * Get a vector document by ID
   * 
   * @param id - Document ID
   * @param collectionName - Collection name
   */
  abstract getById(id: string, collectionName?: string): Promise<VectorDocument | null>;

  /**
   * Delete a vector document by ID
   * 
   * @param id - Document ID
   * @param collectionName - Collection name
   */
  abstract delete(id: string, collectionName?: string): Promise<boolean>;

  /**
   * Delete multiple documents by filter
   * 
   * @param filter - Filter criteria
   * @param collectionName - Collection name
   */
  abstract deleteByFilter(filter: VectorFilter, collectionName?: string): Promise<number>;

  /**
   * Get collection statistics
   * 
   * @param collectionName - Collection name
   */
  abstract getStats(collectionName?: string): Promise<CollectionStats>;

  /**
   * Perform health check
   */
  abstract healthCheck(): Promise<VectorStoreHealth>;

  /**
   * Clear all data from collection
   * 
   * @param collectionName - Collection name
   */
  abstract clear(collectionName?: string): Promise<void>;
}
