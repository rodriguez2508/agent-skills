/**
 * Vector Storage Types for Multi-Backend Support
 * Inspired by Cipher's vector_storage implementation
 */

/**
 * Represents a vector with its metadata
 */
export interface VectorDocument {
  id: string;
  vector: number[];
  metadata: VectorMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Metadata associated with a vector document
 */
export interface VectorMetadata {
  ruleId: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

/**
 * Configuration for vector store connection
 */
export interface VectorStoreConfig {
  type: VectorStoreType;
  connectionString?: string;
  apiKey?: string;
  apiUrl?: string;
  collectionName?: string;
  dimension?: number;
  distanceMetric?: DistanceMetric;
  [key: string]: any;
}

/**
 * Supported vector store backends
 */
export type VectorStoreType =
  | 'inmemory'      // In-memory for development
  | 'sqlite'        // Local development with sqlite-vec
  | 'chromadb'      // ChromaDB
  | 'pinecone'      // Pinecone
  | 'faiss'         // FAISS (Facebook AI Similarity Search)
  | 'redis'         // Redis with RedisVL
  | 'weaviate'      // Weaviate
  | 'qdrant'        // Qdrant
  | 'milvus'        // Milvus
  | 'pgvector';     // PostgreSQL with pgvector

/**
 * Distance metric for similarity search
 */
export type DistanceMetric =
  | 'cosine'       // Cosine similarity (default)
  | 'euclidean'    // Euclidean (L2) distance
  | 'dot'          // Dot product
  | 'manhattan';   // Manhattan (L1) distance

/**
 * Options for upsert operation
 */
export interface UpsertOptions {
  collectionName?: string;
  metadata?: Record<string, any>;
}

/**
 * Options for search operation
 */
export interface SearchOptions {
  collectionName?: string;
  filter?: VectorFilter;
  limit?: number;
  includeMetadata?: boolean;
  includeVectors?: boolean;
}

/**
 * Filter for vector search
 */
export interface VectorFilter {
  category?: string;
  ruleId?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  count: number;
  dimension?: number;
  distanceMetric?: DistanceMetric;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Health check result
 */
export interface VectorStoreHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  type: VectorStoreType;
  connected: boolean;
  collectionCount?: number;
  latency?: number;
  error?: string;
}
