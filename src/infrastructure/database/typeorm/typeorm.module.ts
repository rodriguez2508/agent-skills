/**
 * TypeORM Module
 * 
 * Provides TypeORM database connection with PostgreSQL.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTypeORMConfig } from './typeorm.config';

// Entities
import { User } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { ChatMessage } from './entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createTypeORMConfig,
    }),
    TypeOrmModule.forFeature([User, Session, ChatMessage]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
