/**
 * TypeORM Configuration
 *
 * PostgreSQL configuration for TypeORM.
 */

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

/** Parse a PostgreSQL connection URL into individual config fields */
function parseDbUrl(
  url: string,
): { host: string; port: number; username: string; password: string; database: string; ssl: false | { rejectUnauthorized: false } } | null {
  try {
    const parsed = new URL(url);
    const sslMode = parsed.searchParams.get('sslmode');
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 5432,
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      ssl: sslMode === 'disable' ? false : { rejectUnauthorized: false },
    };
  } catch {
    return null;
  }
}

export const createTypeORMConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isLogging = configService.get<string>('DB_LOGGING') === 'true';
  const isSynchronize = configService.get<string>('DB_SYNCHRONIZE') === 'true';

  // Try DB_URL first, fall back to individual fields
  const dbUrl = configService.get<string>('DB_URL', '');
  const dbUrlConfig = dbUrl ? parseDbUrl(dbUrl) : null;

  const host = dbUrlConfig?.host ?? configService.get<string>('DB_HOST', 'localhost');
  const port = dbUrlConfig?.port ?? configService.get<number>('DB_PORT', 5432);
  const username = dbUrlConfig?.username ?? configService.get<string>('DB_USERNAME', 'postgres');
  const password = dbUrlConfig?.password ?? configService.get<string>('DB_PASSWORD', 'postgres');
  const database = dbUrlConfig?.database ?? configService.get<string>('DB_DATABASE', 'agent_skills');
  const ssl = dbUrlConfig?.ssl ?? (configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false);

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,

    // Auto-load entities from modules via forFeature()
    autoLoadEntities: true,
    entities: [
      path.join(
        __dirname,
        '../../../modules/users/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/sessions/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/projects/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/issues/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/contexts/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/agency-agents/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/plans/domain/entities/*.entity{.ts,.js}',
      ),
      path.join(
        __dirname,
        '../../../modules/agencies/domain/entities/*.entity{.ts,.js}',
      ),
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
    ssl,

    // Connection pool
    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  };
};
