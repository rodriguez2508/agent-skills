/**
 * Vector Storage Module
 * 
 * NestJS module for vector storage with multi-backend support.
 * Provides dependency injection for vector stores and embeddings.
 */

import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { VectorStoreFactory } from './vector-store.factory';
import { InMemoryVectorStore } from './inmemory-vector.store';
import { ChromaDBVectorStore } from './chromadb-vector.store';
import { EmbeddingService } from './embedding.service';
import { VectorStoreConfig, VectorStoreType } from './vector-store.types';

/**
 * Options for configuring the vector storage module
 */
export interface VectorStorageModuleOptions {
  /**
   * Default vector store type
   * @default 'inmemory'
   */
  type?: VectorStoreType;
  
  /**
   * Configuration for the vector store
   */
  config?: VectorStoreConfig;
  
  /**
   * Whether to use global module
   * @default true
   */
  global?: boolean;
}

/**
 * Async options for configuring the vector storage module
 */
export interface VectorStorageModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<VectorStorageModuleOptions> | VectorStorageModuleOptions;
  inject?: any[];
}

/**
 * Vector Storage Module
 * 
 * Provides vector storage capabilities with multi-backend support.
 * 
 * @example
 * ```typescript
 * // Synchronous configuration
 * @Module({
 *   imports: [
 *     VectorStorageModule.forRoot({
 *       type: 'chromadb',
 *       config: { path: 'http://localhost:8000' },
 *     }),
 *   ],
 * })
 * 
 * // Async configuration
 * @Module({
 *   imports: [
 *     VectorStorageModule.forRootAsync({
 *       useFactory: (configService: ConfigService) => ({
 *         type: configService.get('VECTOR_STORE_TYPE') || 'inmemory',
 *         config: {
 *           path: configService.get('CHROMADB_URL'),
 *         },
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * ```
 */
@Global()
@Module({
  providers: [VectorStoreFactory, EmbeddingService],
  exports: [VectorStoreFactory, EmbeddingService],
})
export class VectorStorageModule {
  /**
   * Synchronous module configuration
   */
  static forRoot(options: VectorStorageModuleOptions = {}): DynamicModule {
    const { type = 'inmemory', config, global = true } = options;

    const providers: Provider[] = [
      VectorStoreFactory,
      EmbeddingService,
      {
        provide: 'VECTOR_STORE_OPTIONS',
        useValue: { type, config },
      },
    ];

    // Register default vector store
    if (type === 'inmemory') {
      providers.push({
        provide: 'DEFAULT_VECTOR_STORE',
        useClass: InMemoryVectorStore,
      });
    } else if (type === 'chromadb') {
      providers.push({
        provide: 'DEFAULT_VECTOR_STORE',
        useFactory: async () => {
          const store = new ChromaDBVectorStore(config);
          await store.connect();
          return store;
        },
      });
    }

    return {
      module: VectorStorageModule,
      global,
      providers,
      exports: [VectorStoreFactory, EmbeddingService, 'DEFAULT_VECTOR_STORE'],
    };
  }

  /**
   * Asynchronous module configuration
   */
  static forRootAsync(options: VectorStorageModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      VectorStoreFactory,
      EmbeddingService,
      {
        provide: 'VECTOR_STORE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];

    return {
      module: VectorStorageModule,
      global: true,
      providers,
      exports: [VectorStoreFactory, EmbeddingService],
    };
  }
}
