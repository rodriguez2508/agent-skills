import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { RefreshTokenCommand } from './refresh-token.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import {
  RefreshTokenPayload,
  RefreshTokenMetadata,
} from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand>
{
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(command: RefreshTokenCommand) {
    this.logger.debug('Processing refresh token request...');

    try {
      const { refreshToken } = command;

      // Verify refresh token
      let refreshPayload: RefreshTokenPayload;
      try {
        refreshPayload = (await this.jwtService.verifyAsync(refreshToken, {
          secret: getJwtConfig(this.configService).refreshSecret,
        })) as RefreshTokenPayload;
      } catch {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      this.logger.debug(`Refresh token verified for userId: ${refreshPayload.userId}`);

      // Check stored metadata against incoming token's jti
      const storedMetadata = await this.refreshTokenRepository.getRefreshToken(
        refreshPayload.userId,
      );

      if (storedMetadata && refreshPayload.jti) {
        if (storedMetadata.jti !== refreshPayload.jti) {
          this.logger.warn(
            `jti mismatch for userId: ${refreshPayload.userId}. Possible token reuse.`,
          );
        }
      }

      // Generate new access token
      const newAccessToken = await this.jwtService.signAsync({
        id: refreshPayload.userId,
        userType: 'user',
        lastConnected: new Date(),
      });

      // Generate new refresh token with new jti
      const newJti = randomUUID();
      const newRefreshPayload: RefreshTokenPayload = {
        userId: refreshPayload.userId,
        userType: 'user',
        jti: newJti,
      };
      const newRefreshToken = await this.jwtService.signAsync(
        newRefreshPayload as unknown as Record<string, unknown>,
        {
          secret: getJwtConfig(this.configService).refreshSecret,
          expiresIn: getJwtConfig(this.configService).refreshExpiresIn as any,
        },
      );

      // Store new refresh token metadata
      const ttlSeconds = 7 * 24 * 60 * 60;
      const metadata: RefreshTokenMetadata = {
        jti: newJti,
        issuedAt: Date.now(),
      };
      await this.refreshTokenRepository.storeRefreshToken(
        refreshPayload.userId,
        metadata,
        ttlSeconds,
      );

      this.logger.debug(`Tokens refreshed for userId: ${refreshPayload.userId}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Refresh token failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error refreshing token');
    }
  }
}
