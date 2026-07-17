/**
 * Auth Guard (Hybrid: JWT + Session ID)
 *
 * Supports two authentication methods:
 * 1. JWT Bearer token (for web frontend) - Authorization: Bearer <token>
 * 2. Session ID (for CLI) - x-session-id: <session-id>
 *
 * Falls back gracefully between methods.
 */

import { JwtService } from '@nestjs/jwt';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserByIdQuery } from '../application/queries/get-user-by-id/get-user-by-id.query';
import { GetUserBySessionIdQuery } from '../application/queries/get-user-by-session-id/get-user-by-session-id.query';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly queryBus: QueryBus,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Strategy 1: JWT Bearer token (for web frontend)
    const token = this.extractTokenFromHeader(request);
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const user = await this.queryBus.execute<GetUserByIdQuery, any>(
          new GetUserByIdQuery(payload.id || payload.userId),
        );
        if (user) {
          (request as any)['user'] = user;
          (request as any)['authMethod'] = 'jwt';
          return true;
        }
      } catch (error) {
        this.logger.debug(`JWT verification failed: ${error.message}`);
      }
    }

    // Strategy 2: Session ID (for CLI)
    const sessionId = request.headers['x-session-id'] as string;
    if (sessionId) {
      try {
        const user = await this.queryBus.execute<GetUserBySessionIdQuery, any>(
          new GetUserBySessionIdQuery(sessionId),
        );
        if (user && user.active) {
          (request as any)['user'] = user;
          (request as any)['authMethod'] = 'session';
          return true;
        }
      } catch (error) {
        this.logger.debug(`Session auth failed: ${error.message}`);
      }
    }

    // Strategy 3: Token as query param (for SSE/EventSource)
    const queryToken = (request.query as Record<string, string>)?.token;
    if (queryToken) {
      try {
        const payload = await this.jwtService.verifyAsync(queryToken);
        const user = await this.queryBus.execute<GetUserByIdQuery, any>(
          new GetUserByIdQuery(payload.id || payload.userId),
        );
        if (user) {
          (request as any)['user'] = user;
          (request as any)['authMethod'] = 'jwt';
          return true;
        }
      } catch {
        // Not valid
      }
    }

    this.logger.warn('Authentication failed: no valid token or session-id provided');
    throw new UnauthorizedException(
      'Authentication required. Provide Authorization: Bearer <token> or x-session-id header',
    );
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer') return token;
    return undefined;
  }
}
