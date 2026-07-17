/**
 * Session Guard
 *
 * Validates the session ID from the x-session-id header.
 * Used for CLI authentication without JWT.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserBySessionIdQuery } from '../application/queries/get-user-by-session-id/get-user-by-session-id.query';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(private readonly queryBus: QueryBus) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.headers['x-session-id'] as string;

    if (!sessionId) {
      throw new UnauthorizedException(
        'Session ID required. Provide x-session-id header',
      );
    }

    const user = await this.queryBus.execute<GetUserBySessionIdQuery, any>(
      new GetUserBySessionIdQuery(sessionId),
    );

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (!user.active) {
      throw new UnauthorizedException('User account is not active');
    }

    (request as any)['user'] = user;
    (request as any)['authMethod'] = 'session';

    return true;
  }
}
