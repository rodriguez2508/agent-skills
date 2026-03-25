/**
 * TypeORM Module
 *
 * Provides TypeORM database connection with PostgreSQL.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTypeORMConfig } from './typeorm.config';

// Entities - from domain modules
import { User } from '@modules/users/domain/entities/user.entity';
import { Session } from '@modules/sessions/domain/entities/session.entity';
import { ChatMessage } from '@modules/sessions/domain/entities/chat-message.entity';

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
