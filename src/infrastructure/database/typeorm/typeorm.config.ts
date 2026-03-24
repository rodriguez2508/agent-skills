/**
 * TypeORM Configuration
 *
 * PostgreSQL configuration for TypeORM.
 */

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const createTypeORMConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isSsl = configService.get<string>('DB_SSL') === 'true';
  const isLogging = configService.get<string>('DB_LOGGING') === 'true';
  const isSynchronize = configService.get<string>('DB_SYNCHRONIZE') === 'true';

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: configService.get<number>('DB_PORT', 5432),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_DATABASE', 'agent_skills'),

    // Auto-load entities from modules (compiled)
    entities: [
      path.join(__dirname, '../../../modules/users/domain/entities/*.entity{.ts,.js}'),
      path.join(__dirname, '../../../modules/sessions/domain/entities/*.entity{.ts,.js}'),
      path.join(__dirname, '../../../modules/issues/domain/entities/*.entity{.ts,.js}'),
    ],

    // Migrations for schema changes
    migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
    migrationsTableName: 'migrations',

    // Synchronize in development only
    synchronize: isSynchronize,

    // Logging
    logging: isLogging,
    logger: 'advanced-console',

    // SSL for production
    ssl: isSsl ? { rejectUnauthorized: false } : false,

    // Connection pool
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
};
