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

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'agent_skills',
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
  ],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false, // Never use synchronize with migrations
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

export const dataSource = new DataSource(dataSourceOptions);
