/**
 * Sessions Module
 *
 * Provides session management for chat sessions.
 * Simplified structure: User → Issue → Session (with history JSONB)
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './domain/entities/session.entity';
import { SessionRepository } from './infrastructure/persistence/session.repository';
import { SessionCleanupService } from './infrastructure/services/session-cleanup.service';
import { ChatMessagesService } from './application/services/chat-messages.service';
import { DatabaseModule } from '@infrastructure/database/database.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Session]), DatabaseModule],
  providers: [SessionRepository, SessionCleanupService, ChatMessagesService],
  exports: [SessionRepository, SessionCleanupService, ChatMessagesService, TypeOrmModule],
})
export class SessionsModule {}
