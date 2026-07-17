/**
 * Refresh Guard
 *
 * Validates the refresh token from the request body or cookie.
 * Attaches the decoded payload to request['refreshUser'].
 */

import { JwtService } from '@nestjs/jwt';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { getJwtConfig } from '../const/jwt.constants';

@Injectable()
export class RefreshGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Try to get refresh token from cookies first, then body
    const token =
      request.cookies?.['refreshToken'] || request.body?.refreshToken;

    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: getJwtConfig(this.configService).refreshSecret,
      });
      (request as any)['refreshUser'] = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return true;
  }
}
