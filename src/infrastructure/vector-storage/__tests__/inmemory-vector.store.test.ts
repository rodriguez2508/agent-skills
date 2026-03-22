/**
 * In-Memory Vector Store Tests
 */

import { InMemoryVectorStore } from '../inmemory-vector.store';
import { VectorDocument } from '../vector-store.types';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(async () => {
    store = new InMemoryVectorStore();
    await store.connect();
  });

  afterEach(async () => {
    await store.disconnect();
  });

  describe('Connection', () => {
    it('should connect successfully', async () => {
      expect(store.isConnected()).toBe(true);
      const health = await store.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await store.disconnect();
      expect(store.isConnected()).toBe(false);
    });
  });

  describe('Collection Management', () => {
    it('should create a collection', async () => {
      await store.createCollection('test-collection', 384);
      const collections = await store.listCollections();
      expect(collections).toContain('test-collection');
    });

    it('should delete a collection', async () => {
      await store.createCollection('test-collection', 384);
      await store.deleteCollection('test-collection');
      const collections = await store.listCollections();
      expect(collections).not.toContain('test-collection');
    });

    it('should list all collections', async () => {
      await store.createCollection('collection-1', 384);
      await store.createCollection('collection-2', 384);
      const collections = await store.listCollections();
      expect(collections).toHaveLength(2);
    });
  });

  describe('Upsert Operations', () => {
    it('should upsert a document', async () => {
      await store.createCollection('test', 3);
      
      const document: VectorDocument = {
        id: 'doc-1',
        vector: [0.1, 0.5, -0.3],
        metadata: {
          ruleId: 'rule-1',
          title: 'Test Rule',
          category: 'test',
          content: 'Test content',
        },
      };

      await store.upsert(document, { collectionName: 'test' });
      const retrieved = await store.getById('doc-1', 'test');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('doc-1');
    });

    it('should update an existing document', async () => {
      await store.createCollection('test', 3);
      
      const document: VectorDocument = {
        id: 'doc-1',
        vector: [0.1, 0.5, -0.3],
        metadata: {
          ruleId: 'rule-1',
          title: 'Test Rule',
          category: 'test',
          content: 'Test content',
        },
      };

      await store.upsert(document, { collectionName: 'test' });
      
      // Update
      const updatedDoc: VectorDocument = {
        ...document,
        metadata: { ...document.metadata, title: 'Updated Rule' },
      };
      await store.upsert(updatedDoc, { collectionName: 'test' });
      
      const retrieved = await store.getById('doc-1', 'test');
      expect(retrieved?.metadata.title).toBe('Updated Rule');
    });

    it('should upsert batch documents', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = [
        {
          id: 'doc-1',
          vector: [0.1, 0.5, -0.3],
          metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' },
        },
        {
          id: 'doc-2',
          vector: [0.4, -0.2, 0.8],
          metadata: { ruleId: 'rule-2', title: 'Rule 2', category: 'test', content: 'Content 2' },
        },
      ];

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      const stats = await store.getStats('test');
      expect(stats.count).toBe(2);
    });
  });

  describe('Search Operations', () => {
    it('should search similar vectors', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = [
        {
          id: 'doc-1',
          vector: [1, 0, 0],
          metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' },
        },
        {
          id: 'doc-2',
          vector: [0, 1, 0],
          metadata: { ruleId: 'rule-2', title: 'Rule 2', category: 'test', content: 'Content 2' },
        },
      ];

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      // Search with a vector similar to doc-1
      const results = await store.search([0.9, 0.1, 0], { limit: 5, collectionName: 'test' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document.id).toBe('doc-1');
    });

    it('should filter search results', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = [
        {
          id: 'doc-1',
          vector: [1, 0, 0],
          metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'nestjs', content: 'Content 1' },
        },
        {
          id: 'doc-2',
          vector: [0, 1, 0],
          metadata: { ruleId: 'rule-2', title: 'Rule 2', category: 'angular', content: 'Content 2' },
        },
      ];

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      const results = await store.search([0.5, 0.5, 0], {
        limit: 5,
        collectionName: 'test',
        filter: { category: 'angular' },
      });
      
      expect(results.length).toBe(1);
      expect(results[0].document.metadata.category).toBe('angular');
    });

    it('should respect limit parameter', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = Array.from({ length: 10 }, (_, i) => ({
        id: `doc-${i}`,
        vector: [Math.random(), Math.random(), Math.random()],
        metadata: { ruleId: `rule-${i}`, title: `Rule ${i}`, category: 'test', content: `Content ${i}` },
      }));

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      const results = await store.search([0.5, 0.5, 0.5], { limit: 3, collectionName: 'test' });
      
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Delete Operations', () => {
    it('should delete a document by ID', async () => {
      await store.createCollection('test', 3);
      
      const document: VectorDocument = {
        id: 'doc-1',
        vector: [0.1, 0.5, -0.3],
        metadata: { ruleId: 'rule-1', title: 'Test Rule', category: 'test', content: 'Test content' },
      };

      await store.upsert(document, { collectionName: 'test' });
      
      const deleted = await store.delete('doc-1', 'test');
      expect(deleted).toBe(true);
      
      const retrieved = await store.getById('doc-1', 'test');
      expect(retrieved).toBeNull();
    });

    it('should delete documents by filter', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = [
        {
          id: 'doc-1',
          vector: [1, 0, 0],
          metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' },
        },
        {
          id: 'doc-2',
          vector: [0, 1, 0],
          metadata: { ruleId: 'rule-2', title: 'Rule 2', category: 'test', content: 'Content 2' },
        },
        {
          id: 'doc-3',
          vector: [0, 0, 1],
          metadata: { ruleId: 'rule-3', title: 'Rule 3', category: 'other', content: 'Content 3' },
        },
      ];

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      const deletedCount = await store.deleteByFilter({ category: 'test' }, 'test');
      expect(deletedCount).toBe(2);
      
      const stats = await store.getStats('test');
      expect(stats.count).toBe(1);
    });
  });

  describe('Stats and Health', () => {
    it('should return collection stats', async () => {
      await store.createCollection('test', 384);
      
      const documents: VectorDocument[] = Array.from({ length: 5 }, (_, i) => ({
        id: `doc-${i}`,
        vector: Array(384).fill(0).map(() => Math.random()),
        metadata: { ruleId: `rule-${i}`, title: `Rule ${i}`, category: 'test', content: `Content ${i}` },
      }));

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      const stats = await store.getStats('test');
      
      expect(stats.count).toBe(5);
      expect(stats.dimension).toBe(384);
    });

    it('should return health status', async () => {
      const health = await store.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.type).toBe('inmemory');
      expect(health.connected).toBe(true);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all documents from collection', async () => {
      await store.createCollection('test', 3);
      
      const documents: VectorDocument[] = [
        { id: 'doc-1', vector: [1, 0, 0], metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' } },
        { id: 'doc-2', vector: [0, 1, 0], metadata: { ruleId: 'rule-2', title: 'Rule 2', category: 'test', content: 'Content 2' } },
      ];

      await store.upsertBatch(documents, { collectionName: 'test' });
      
      await store.clear('test');
      
      const stats = await store.getStats('test');
      expect(stats.count).toBe(0);
    });
  });

  describe('Similarity Calculations', () => {
    it('should calculate cosine similarity correctly', async () => {
      await store.createCollection('test', 3);
      
      // Identical vectors should have similarity close to 1
      const doc1: VectorDocument = {
        id: 'doc-1',
        vector: [1, 0, 0],
        metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' },
      };
      
      await store.upsert(doc1, { collectionName: 'test' });
      
      const results = await store.search([1, 0, 0], { limit: 1, collectionName: 'test' });
      
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should handle orthogonal vectors', async () => {
      await store.createCollection('test', 3);
      
      const doc1: VectorDocument = {
        id: 'doc-1',
        vector: [1, 0, 0],
        metadata: { ruleId: 'rule-1', title: 'Rule 1', category: 'test', content: 'Content 1' },
      };
      
      await store.upsert(doc1, { collectionName: 'test' });
      
      const results = await store.search([0, 1, 0], { limit: 1, collectionName: 'test' });
      
      expect(results[0].score).toBeCloseTo(0, 5);
    });
  });
});
