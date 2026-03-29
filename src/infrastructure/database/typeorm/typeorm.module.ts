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
import { Project } from '@modules/projects/domain/entities/project.entity';
import { Issue } from '@modules/issues/domain/entities/issue.entity';
import { Context } from '@modules/contexts/domain/entities/context.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createTypeORMConfig,
    }),
    TypeOrmModule.forFeature([
      User,
      Session,
      ChatMessage,
      Project,
      Issue,
      Context,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
