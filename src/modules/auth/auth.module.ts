/**
 * Auth Module
 *
 * Authentication system with hybrid architecture:
 * - JWT (accessToken + refreshToken) for web frontend
 * - Session ID (x-session-id) for CLI
 * - Google OAuth for future frontend integration
 *
 * Refresh tokens are stored in Redis with jti rotation.
 * Session-based auth uses PostgreSQL sessions table.
 */

import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersModule } from '@modules/users/users.module';
import { SessionsModule } from '@modules/sessions/sessions.module';

// Controllers
import { AuthController } from './presenters/controllers/auth.controller';

// Services (none currently - all logic migrated to CQRS handlers)

// Repository implementations
import { RedisRefreshTokenRepository } from './infrastructure/repositories/redis-refresh-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from './di/tokens';

// Commands
import {
  LoginHandler,
  LoginWithGoogleHandler,
  RegisterHandler,
  RefreshTokenHandler,
  LogoutHandler,
  SessionLoginHandler,
} from './application/commands';

// Queries
import {
  VerifyTokenHandler,
  GetUserByIdHandler,
  GetUserBySessionIdHandler,
} from './application/queries';

// Guards
import { AuthGuard } from './guard/auth.guard';
import { SessionGuard } from './guard/session.guard';
import { RefreshGuard } from './guard/refresh.guard';

// JWT Config
import { getJwtConfig } from './const/jwt.constants';

const JwtConfigModule = JwtModule.registerAsync({
  useFactory: (configService: ConfigService) => {
    const jwtConfig = getJwtConfig(configService);
    return {
      secret: jwtConfig.accessSecret,
      signOptions: { expiresIn: jwtConfig.accessExpiresIn as any },
    };
  },
  inject: [ConfigService],
});

const commands: Provider[] = [
  LoginHandler,
  LoginWithGoogleHandler,
  RegisterHandler,
  RefreshTokenHandler,
  LogoutHandler,
  SessionLoginHandler,
];

const queries: Provider[] = [
  VerifyTokenHandler,
  GetUserByIdHandler,
  GetUserBySessionIdHandler,
];

const services: Provider[] = [
  {
    provide: REFRESH_TOKEN_REPOSITORY,
    useClass: RedisRefreshTokenRepository,
  },
];

const guards: Provider[] = [AuthGuard, SessionGuard, RefreshGuard];

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    SessionsModule,
    JwtConfigModule,
  ],
  controllers: [AuthController],
  providers: [...commands, ...queries, ...services, ...guards],
  exports: [AuthGuard, SessionGuard, RefreshGuard, JwtConfigModule, CqrsModule],
})
export class AuthModule {}
