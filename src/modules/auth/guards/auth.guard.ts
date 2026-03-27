/**
 * Auth Guard
 *
 * Protects routes by validating session ID.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../application/services/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.headers['x-session-id'] as string;

    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }

    const user = await this.authService.getUserBySessionId(sessionId);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    if (!user.active) {
      throw new UnauthorizedException('User account is not active');
    }

    // Attach user to request object
    request['user'] = user;

    return true;
  }
}
