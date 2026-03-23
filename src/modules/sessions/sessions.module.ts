/**
 * Sessions Module
 *
 * Provides session management for chat sessions.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './domain/entities/session.entity';
import { ChatMessage } from './domain/entities/chat-message.entity';
import { SessionPurpose } from './domain/entities/session-purpose.entity';
import { SessionRepository } from './infrastructure/persistence/session.repository';
import { SessionPurposeRepository } from '@infrastructure/persistence/repositories/session-purpose.repository';
import { SessionCleanupService } from './infrastructure/services/session-cleanup.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Session, ChatMessage, SessionPurpose])],
  providers: [SessionRepository, SessionPurposeRepository, SessionCleanupService],
  exports: [SessionRepository, SessionPurposeRepository, SessionCleanupService, TypeOrmModule],
})
export class SessionsModule {}
