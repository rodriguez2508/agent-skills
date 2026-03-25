/**
 * Sessions Module
 *
 * Provides session management for chat sessions.
 * Simplified structure: User → Issue → Session (with history JSONB)
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './domain/entities/session.entity';
import { ChatMessage } from './domain/entities/chat-message.entity';
import { SessionRepository } from './infrastructure/persistence/session.repository';
import { SessionCleanupService } from './infrastructure/services/session-cleanup.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Session, ChatMessage])],
  providers: [SessionRepository, SessionCleanupService],
  exports: [SessionRepository, SessionCleanupService, TypeOrmModule],
})
export class SessionsModule {}
