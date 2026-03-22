/**
 * Database Module (PostgreSQL + Redis)
 * 
 * Provides database connections and repositories.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTypeORMConfig } from './typeorm/typeorm.config';

// Entities
import { User } from './typeorm/entities/user.entity';
import { Session } from './typeorm/entities/session.entity';
import { ChatMessage } from './typeorm/entities/chat-message.entity';

// Redis
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

// Repositories
import { SessionRepository } from '../persistence/repositories/session.repository';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createTypeORMConfig,
    }),
    TypeOrmModule.forFeature([User, Session, ChatMessage]),
    RedisModule.forRoot(),
  ],
  providers: [SessionRepository, RedisService],
  exports: [TypeOrmModule, RedisModule, SessionRepository, RedisService],
})
export class DatabaseModule {}
