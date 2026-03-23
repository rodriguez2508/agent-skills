/**
 * Database Module (PostgreSQL + Redis)
 *
 * Provides database connections and repositories.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTypeORMConfig } from './typeorm/typeorm.config';

// Redis
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createTypeORMConfig,
    }),
    RedisModule.forRoot(),
  ],
  providers: [RedisService],
  exports: [TypeOrmModule, RedisModule, RedisService],
})
export class DatabaseModule {}
