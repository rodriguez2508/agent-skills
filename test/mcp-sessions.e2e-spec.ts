/**
 * E2E tests for the new MCP session + agent endpoints.
 *
 * Boots the full AppModule against the real PostgreSQL + Redis services
 * (started via docker-compose). Covers:
 *   - GET  /agents/list            → dynamic registry exposure
 *   - POST /agents/execute         → arbitrary registered agent
 *   - POST /mcp/session/start      → session bootstrap + project detect + agents
 *   - POST /mcp/session/resume     → session recovery by clientId
 *
 * Run with:
 *   pnpm test -- mcp-sessions.e2e-spec
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('MCP Sessions + Agents (e2e)', () => {
  let app: INestApplication;
  let server: any;
  const clientId = `e2e-claude-${Date.now()}`;
  let createdSessionId: string;
  let createdProjectId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /agents/list', () => {
    it('lists registered agents dynamically (no hardcoded enum)', async () => {
      const res = await request(server).get('/agents/list').expect(200);

      expect(res.body).toHaveProperty('count');
      // Should expose far more than the old hardcoded ['router','analysis']
      expect(res.body.count).toBeGreaterThan(5);
      expect(Array.isArray(res.body.agents)).toBe(true);
      const ids = res.body.agents.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining(['SearchAgent', 'CodeAgent', 'AnalysisAgent']));
      // Each entry must include description
      res.body.agents.forEach((a: any) => {
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('description');
      });
    });
  });

  describe('POST /agents/execute', () => {
    it('rejects unknown agents with available list', async () => {
      const res = await request(server)
        .post('/agents/execute')
        .send({ agent: 'definitely-not-real', task: 'hello' })
        .expect(201);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Unknown agent');
      expect(res.body.error).toContain('Available:');
    });

    it('rejects missing required fields', async () => {
      await request(server)
        .post('/agents/execute')
        .send({ agent: 'router' })
        .expect(400);
    });

    it('executes a real registered agent (SearchAgent) successfully', async () => {
      const res = await request(server)
        .post('/agents/execute')
        .send({
          agent: 'SearchAgent',
          task: 'busca reglas sobre CQRS',
        })
        .expect(201);

      // Should not be the "Unknown agent" error — agent IS registered
      expect(res.body.error).toBeUndefined();
      expect(res.body).toHaveProperty('success');
    }, 30000);
  });

  describe('POST /mcp/session/start', () => {
    it('starts a session with project detection from projectPath', async () => {
      const res = await request(server)
        .post('/mcp/session/start')
        .set('x-client-id', clientId)
        .send({
          clientId,
          projectPath: '/home/aajcr/PROYECTOS/agent-skills-api',
          title: 'e2e test session',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.sessionId).toMatch(/^mcp-/);
      expect(res.body.session.userId).toBeDefined();
      expect(res.body.project).toBeDefined();
      expect(res.body.project.name).toBe('agent-skills-api');
      expect(res.body.project.framework).toBe('nestjs');
      // Folder name + localPath must always be persisted in metadata
      expect(res.body.project.metadata).toBeDefined();
      expect(res.body.project.metadata.folderName).toBe('agent-skills-api');
      expect(res.body.project.metadata.localPath).toBe(
        '/home/aajcr/PROYECTOS/agent-skills-api',
      );
      expect(Array.isArray(res.body.availableAgents)).toBe(true);
      expect(res.body.availableAgents.length).toBeGreaterThan(2);

      createdSessionId = res.body.session.sessionId;
      createdProjectId = res.body.project.id;
    }, 30000);

    it('reuses the same session for the same clientId (no duplicates)', async () => {
      const res = await request(server)
        .post('/mcp/session/start')
        .set('x-client-id', clientId)
        .send({
          clientId,
          projectPath: '/home/aajcr/PROYECTOS/agent-skills-api',
        })
        .expect(201);

      expect(res.body.session.sessionId).toBe(createdSessionId);
      expect(res.body.project?.id).toBe(createdProjectId);
    }, 30000);

    it('handles missing projectPath gracefully (no project, agents still listed)', async () => {
      const anonClient = `anon-${Date.now()}`;
      const res = await request(server)
        .post('/mcp/session/start')
        .set('x-client-id', anonClient)
        .send({ clientId: anonClient })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.session.sessionId).toMatch(/^mcp-/);
      expect(res.body.project).toBeNull();
      expect(res.body.availableAgents.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('POST /mcp/session/resume', () => {
    it('resumes a session by clientId', async () => {
      // Must be preceded by the start test above
      expect(createdSessionId).toBeDefined();

      const res = await request(server)
        .post('/mcp/session/resume')
        .set('x-client-id', clientId)
        .send({ clientId, messagesLimit: 5 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.session.sessionId).toBe(createdSessionId);
      expect(res.body.project?.id).toBe(createdProjectId);
      expect(Array.isArray(res.body.messages)).toBe(true);
    }, 15000);

    it('resumes a session by explicit sessionId', async () => {
      const res = await request(server)
        .post('/mcp/session/resume')
        .send({ sessionId: createdSessionId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.session.sessionId).toBe(createdSessionId);
    }, 15000);

    it('returns 400 when neither sessionId nor clientId resolves to a session', async () => {
      await request(server)
        .post('/mcp/session/resume')
        .send({ clientId: `unknown-${Date.now()}` })
        .expect(400);
    });

    it('returns 400 for an unknown explicit sessionId', async () => {
      await request(server)
        .post('/mcp/session/resume')
        .send({ sessionId: 'mcp-does-not-exist-xyz' })
        .expect(400);
    });
  });

  describe('POST /mcp/session/chat (context node indexing)', () => {
    const seedMessages = [
      'Estoy trabajando en una arquitectura hexagonal con NestJS y CQRS',
      'Necesito implementar repositorios con TypeORM y Postgres',
      'La autenticación usa JWT con refresh tokens',
      'El sistema multi-agente enruta por intención usando BM25',
    ];

    it('persists messages and indexes them as context nodes', async () => {
      expect(createdSessionId).toBeDefined();

      for (const text of seedMessages) {
        const res = await request(server)
          .post('/mcp/session/chat')
          .set('x-client-id', clientId)
          .send({ sessionId: createdSessionId, input: text, role: 'user' })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.indexed).toBe(true);
        expect(res.body.messageId).toBeDefined();
        expect(Array.isArray(res.body.relevantContext)).toBe(true);
        expect(res.body.stats?.indexed).toBe(true);
        expect(res.body.stats?.nodeCount).toBeGreaterThan(0);
      }
    }, 30000);

    it('rejects chat without an active session', async () => {
      await request(server)
        .post('/mcp/session/chat')
        .send({ input: 'hola', clientId: `random-${Date.now()}` })
        .expect(400);
    });

    it('rejects empty input', async () => {
      await request(server)
        .post('/mcp/session/chat')
        .set('x-client-id', clientId)
        .send({ sessionId: createdSessionId, input: '   ' })
        .expect(400);
    });
  });

  describe('POST /mcp/session/context/search (BM25 over project history)', () => {
    it('retrieves relevant context nodes for a query', async () => {
      expect(createdProjectId).toBeDefined();

      const res = await request(server)
        .post('/mcp/session/context/search')
        .send({
          projectId: createdProjectId,
          query: 'arquitectura hexagonal NestJS',
          limit: 5,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.projectId).toBe(createdProjectId);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
      // Top result should match the seed message about hexagonal/NestJS
      const top = res.body.results[0];
      expect(top.score).toBeGreaterThan(0);
      expect(String(top.snippet).toLowerCase()).toMatch(/hexagonal|nestjs/);
    }, 15000);

    it('resolves projectId via sessionId fallback', async () => {
      const res = await request(server)
        .post('/mcp/session/context/search')
        .send({ sessionId: createdSessionId, query: 'JWT refresh tokens' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.projectId).toBe(createdProjectId);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(String(res.body.results[0].snippet).toLowerCase()).toMatch(/jwt|tokens/);
    });

    it('rejects search without projectId or sessionId', async () => {
      await request(server)
        .post('/mcp/session/context/search')
        .send({ query: 'anything' })
        .expect(400);
    });

    it('rejects empty query', async () => {
      await request(server)
        .post('/mcp/session/context/search')
        .send({ projectId: createdProjectId, query: '' })
        .expect(400);
    });
  });
});
