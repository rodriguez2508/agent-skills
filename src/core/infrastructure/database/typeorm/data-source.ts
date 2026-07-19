/**
 * TypeORM Data Source for Migrations
 *
 * Used for generating and running migrations via CLI.
 *
 * Usage:
 *   pnpm run db:generate -- src/infrastructure/database/typeorm/migrations/CreateTables
 *   pnpm run db:migrate
 *   pnpm run db:migrate:revert
 */

import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

const configService = new ConfigService();

interface ParsedDbUrl {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: false | { rejectUnauthorized: false };
}

function parseDbUrl(url: string): ParsedDbUrl | null {
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

const dbUrlConfig = process.env.DB_URL ? parseDbUrl(process.env.DB_URL) : null;

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: dbUrlConfig?.host || process.env.DB_HOST || 'localhost',
  port: dbUrlConfig?.port ?? parseInt(process.env.DB_PORT || '5432', 10),
  username: dbUrlConfig?.username || process.env.DB_USERNAME || 'postgres',
  password: dbUrlConfig?.password || process.env.DB_PASSWORD || 'postgres',
  database: dbUrlConfig?.database || process.env.DB_DATABASE || 'agent_skills',
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
      '../../../modules/agencies/domain/entities/*.entity{.ts,.js}',
    ),
    path.join(
      __dirname,
      '../../../modules/agency-agents/domain/entities/*.entity{.ts,.js}',
    ),
    path.join(
      __dirname,
      '../../../modules/plans/domain/entities/*.entity{.ts,.js}',
    ),
  ],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false, // Never use synchronize with migrations
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export const dataSource = new DataSource(dataSourceOptions);
