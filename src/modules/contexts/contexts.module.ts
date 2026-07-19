/**
 * Contexts Module
 *
 * Manages conversation contexts for issues.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Context } from './domain/entities/context.entity';
import { ContextRepository } from './infrastructure/persistence/context.repository';
import { ContextService } from './application/services/context.service';
import { ContextNodeService } from './application/services/context-node.service';
import { ChatMessage } from '@modules/sessions/domain/entities/chat-message.entity';
import { Session } from '@modules/sessions/domain/entities/session.entity';
import { DatabaseModule } from '@infrastructure/database/database.module';

@Module({
  imports: [TypeOrmModule.forFeature([Context, ChatMessage, Session]), DatabaseModule],
  providers: [ContextRepository, ContextService, ContextNodeService],
  exports: [ContextRepository, ContextService, ContextNodeService],
})
export class ContextsModule {}
