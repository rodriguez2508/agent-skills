/**
 * Auth Guard (Hybrid: JWT + Session ID + IP-based for SSE)
 *
 * Supports three authentication methods:
 * 1. JWT Bearer token (for web frontend) - Authorization: Bearer <token>
 * 2. Session ID (for CLI) - x-session-id: <session-id>
 * 3. IP-based (for SSE/CLI connections only) - auto-detects user by IP
 *
 * Strategy 3 (IP) is ONLY used for /mcp/sse and /mcp/message connections.
 */

import { JwtService } from '@nestjs/jwt';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request } from 'express';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserByIdQuery } from '../application/queries/get-user-by-id/get-user-by-id.query';
import { GetUserBySessionIdQuery } from '../application/queries/get-user-by-session-id/get-user-by-session-id.query';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { RedisService } from '@infrastructure/database/redis/redis.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private agencyRepository: IAgencyRepository;
  private redisService: RedisService;

  constructor(
    private readonly jwtService: JwtService,
    private readonly queryBus: QueryBus,
    private readonly userRepository: UserRepository,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getAgencyRepository(): IAgencyRepository {
    if (!this.agencyRepository) {
      this.agencyRepository = this.moduleRef.get(IAgencyRepository, {
        strict: false,
      });
    }
    return this.agencyRepository;
  }

  private getRedisService(): RedisService {
    if (!this.redisService) {
      this.redisService = this.moduleRef.get(RedisService, { strict: false });
    }
    return this.redisService;
  }

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

    // Strategy 3: Token as query param (for SSE/EventSource with token)
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

    // Strategy 4: IP-based auth (SSE/CLI connections ONLY)
    // Applies to /mcp/sse (new connection) and /mcp/message (messages from SSE session)
    const isMcpPath =
      request.path === '/mcp/sse' || request.path === '/mcp/message';

    if (isMcpPath) {
      try {
        // For /mcp/message: try to resolve user from SSE session via Redis
        if (request.path === '/mcp/message') {
          const msgSessionId = (request.query as Record<string, string>)
            ?.sessionId;
          if (msgSessionId) {
            try {
              const redis = this.getRedisService();
              const cachedUserId = await redis.get<string>(
                `session:${msgSessionId}:userId`,
              );
              const cachedAgencyId = await redis.get<string>(
                `session:${msgSessionId}:agencyId`,
              );

              if (cachedUserId) {
                const user = await this.queryBus.execute<
                  GetUserByIdQuery,
                  any
                >(new GetUserByIdQuery(cachedUserId));
                if (user) {
                  (request as any)['user'] = user;
                  (request as any)['authMethod'] = 'ip';
                  (request as any)['agencyId'] = cachedAgencyId || null;
                  return true;
                }
              }
            } catch (redisErr) {
              this.logger.debug(
                `Redis session lookup failed: ${redisErr.message}`,
              );
            }
          }
        }

        // For /mcp/sse or fallback: resolve user by IP
        const clientIp =
          (request.headers['x-forwarded-for'] as string)
            ?.split(',')[0]
            ?.trim() ||
          request.ip ||
          'unknown';

        const { user } = await this.userRepository.findByIpOrCreate({
          ipAddress: clientIp,
        });

        if (user) {
          const agencyRepo = this.getAgencyRepository();
          const agencies = await agencyRepo.findAgenciesByMemberId(user.id);
          const agency = agencies[0] || null;

          (request as any)['user'] = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            active: user.active,
          };
          (request as any)['authMethod'] = 'ip';
          (request as any)['agencyId'] = agency?.id || null;

          this.logger.log(
            `IP auth: user ${user.id} (IP: ${clientIp}) → agency: ${agency?.id || 'none'}`,
          );
          return true;
        }
      } catch (error) {
        this.logger.warn(`IP auth failed: ${error.message}`);
      }
    }

    this.logger.warn(
      'Authentication failed: no valid token or session-id provided',
    );
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
