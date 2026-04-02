import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ExtractIpMiddleware } from '@infrastructure/middleware/extract-ip.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global middleware (use instance, not class)
  app.use((req, res, next) => {
    const middleware = new ExtractIpMiddleware();
    middleware.use(req, res, next);
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Agent Skills API')
    .setDescription(
      'API para búsqueda de reglas usando BM25 con arquitectura Hexagonal + CQRS',
    )
    .setVersion('1.0.0')
    .addTag('health', 'Health check endpoints')
    .addTag('rules', 'Rule management and search')
    .addTag('projects', 'Project detection and management')
    .addTag('users', 'User management by IP')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 8004;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api`);
  console.log(
    `Auto-detect endpoint: POST http://localhost:${port}/projects/auto-detect`,
  );
}
bootstrap();
