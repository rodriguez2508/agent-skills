/**
 * Auth Module
 *
 * Provides authentication and session management.
 * Users are grouped by IP address.
 */

import { Module } from '@nestjs/common';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthService } from './application/services/auth.service';
import { UsersModule } from '../users/users.module';
import { SessionsModule } from '../sessions/sessions.module';
import { PasswordHashService } from './infrastructure/services/password-hash.service';
import { TokenService } from './infrastructure/services/token.service';
import { EmailService } from './infrastructure/services/email.service';

@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHashService, TokenService, EmailService],
  exports: [AuthService],
})
export class AuthModule {}
