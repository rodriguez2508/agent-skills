import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ExtractIpMiddleware } from './../src/infrastructure/middleware/extract-ip.middleware';
import * as path from 'path';

/**
 * E2E Tests para auto-detección de proyectos
 * 
 * Prueba el flujo completo:
 * 1. Usuario hace request desde un proyecto
 * 2. Sistema detecta IP automáticamente
 * 3. Sistema detecta proyecto desde package.json
 * 4. Crea usuario y proyecto si no existen
 */
describe('Projects Auto-Detect (e2e)', () => {
  let app: INestApplication;
  let testProjectPath: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Usar middleware de extracción de IP
    app.use(ExtractIpMiddleware);
    
    // Usar validación global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    
    // Path al proyecto actual para tests
    testProjectPath = path.resolve(__dirname, '..');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /projects/auto-detect', () => {
    it('should auto-detect project from package.json', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.project).toBeDefined();
      expect(response.body.data.project.name).toBeDefined();
      expect(response.body.data.detection).toBeDefined();
      expect(response.body.data.detection.name).toBe('agent-skills-api');
    });

    it('should create user by IP automatically', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBeDefined();
      expect(response.body.data.ipAddress).toBe('192.168.1.100');
    });

    it('should detect framework from dependencies', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response.body.data.detection.detectedFramework).toBeDefined();
      // El proyecto actual usa NestJS
      expect(response.body.data.detection.detectedFramework).toBe('nestjs');
    });

    it('should return error if package.json not found', async () => {
      const invalidPath = '/tmp/non-existent-project';
      
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .send({ projectPath: invalidPath })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No se pudo detectar');
    });

    it('should handle multiple projects for same user', async () => {
      const ipAddress = '192.168.1.101';
      
      // Primer proyecto
      await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', ipAddress)
        .send({ projectPath: testProjectPath })
        .expect(200);

      // Segundo proyecto (mismo usuario, diferente path)
      const response2 = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', ipAddress)
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.data.userId).toBeDefined();
    });

    it('should handle IPv6 addresses', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', '::ffff:192.168.1.102')
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Debería remover el prefijo IPv6
      expect(response.body.data.ipAddress).toBe('192.168.1.102');
    });

    it('should handle multiple IPs in X-Forwarded-For', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', '192.168.1.103, proxy1, proxy2')
        .send({ projectPath: testProjectPath })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Debería tomar la primera IP
      expect(response.body.data.ipAddress).toBe('192.168.1.103');
    });
  });

  describe('GET /projects', () => {
    it('should list all projects for user by IP', async () => {
      const ipAddress = '192.168.1.104';
      
      // Crear proyecto primero
      await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', ipAddress)
        .send({ projectPath: testProjectPath })
        .expect(200);

      // Listar proyectos
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('X-Forwarded-For', ipAddress)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toBeDefined();
      expect(response.body.data.total).toBeGreaterThan(0);
    });
  });

  describe('GET /projects/:id', () => {
    it('should get project by ID', async () => {
      const ipAddress = '192.168.1.105';
      
      // Crear proyecto primero
      const createResponse = await request(app.getHttpServer())
        .post('/projects/auto-detect')
        .set('X-Forwarded-For', ipAddress)
        .send({ projectPath: testProjectPath })
        .expect(200);

      const projectId = createResponse.body.data.project.id;

      // Obtener proyecto
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.project).toBeDefined();
      expect(response.body.data.project.id).toBe(projectId);
    });

    it('should return error if project not found', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects/non-existent-id')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });
});
