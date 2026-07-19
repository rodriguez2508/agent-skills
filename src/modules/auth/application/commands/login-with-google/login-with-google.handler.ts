import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { LoginWithGoogleCommand } from './login-with-google.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Inject,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import {
  RefreshTokenPayload,
  RefreshTokenMetadata,
} from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';
import { OAuth2Client } from 'google-auth-library';
import { verifyGoogleToken, GoogleTokenPayload } from '../../../utils/google-token-verifier';

@CommandHandler(LoginWithGoogleCommand)
export class LoginWithGoogleHandler
  implements ICommandHandler<LoginWithGoogleCommand>
{
  private readonly logger = new Logger(LoginWithGoogleHandler.name);
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    this.googleClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';

    if (!this.googleClientId) {
      this.logger.warn('GOOGLE_CLIENT_ID is not configured. Google login will fail.');
    }

    this.oauthClient = new OAuth2Client({
      clientId: this.googleClientId,
      clientSecret: this.googleClientSecret || undefined,
    });
  }

  private normalizeIp(ip: string): string {
    if (!ip || ip === 'unknown') return ip;
    if (ip === '::1') return '127.0.0.1';
    const ipv4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (ipv4Match) return ipv4Match[1];
    return ip;
  }

  async execute(command: LoginWithGoogleCommand) {
    try {
      const { loginGoogleDto, ipAddress } = command;
      const { googleToken } = loginGoogleDto;

      // Normalize IP for consistent lookups (::1 → 127.0.0.1, ::ffff:x → x)
      const normalizedIp = this.normalizeIp(ipAddress);

      this.logger.debug(`Verifying Google token from IP: ${normalizedIp}...`);

      // Verify Google token (remote with local fallback)
      const googleUserInfo = await verifyGoogleToken(
        this.oauthClient,
        googleToken,
        this.googleClientId,
        this.logger,
      );

      this.logger.log(
        `Google token verified for: ${googleUserInfo.email} (${googleUserInfo.name})`,
      );

      const email = googleUserInfo.email;

      // Strategy: find user by email first, then by IP, then create
      let userId: string;
      let userEmail: string;
      let userName: string | undefined;
      let userAvatar: string | undefined;

      // 1. Try to find by email (already registered via Google or email/password)
      const existingByEmail = await this.userRepository.findByEmail(email);

      if (existingByEmail) {
        userId = existingByEmail.id;
        userEmail = existingByEmail.email;
        userName = existingByEmail.name;
        userAvatar = existingByEmail.avatar;
        this.logger.log(`✅ Found existing user by email: ${userId}`);
      } else {
        // 2. Try to find by IP (user previously used CLI)
        const { user: ipUser, isNew } = await this.userRepository.findByIpOrCreate({
          ipAddress: normalizedIp,
          email: email,
          name: googleUserInfo.name,
          avatar: googleUserInfo.picture,
        });

        if (isNew) {
          // 3. New user created — set Google info
          userId = ipUser.id;
          userEmail = ipUser.email;
          userName = ipUser.name;
          userAvatar = ipUser.avatar;
          this.logger.log(`✅ New user created from Google: ${userId}`);
        } else {
          // 4. User existed by IP (from CLI) — UPDATE their Google info
          await this.userRepository.getRepository().update(ipUser.id, {
            email: email,
            name: googleUserInfo.name,
            avatar: googleUserInfo.picture,
          });
          userId = ipUser.id;
          userEmail = email;
          userName = googleUserInfo.name;
          userAvatar = googleUserInfo.picture;
          this.logger.log(`✅ Found existing user by IP: ${userId} — merged Google info`);
        }
      }

      // Generate access token
      const payload = {
        id: userId,
        email: userEmail,
        name: userName,
        avatar: userAvatar,
        userType: 'user',
        lastConnected: new Date(),
      };
      const accessToken = await this.jwtService.signAsync(payload);

      // Generate refresh token
      const jti = randomUUID();
      const refreshPayload: RefreshTokenPayload = {
        userId,
        userType: 'user',
        jti,
      };
      const refreshToken = await this.jwtService.signAsync(
        refreshPayload as unknown as Record<string, unknown>,
        {
          secret: getJwtConfig(this.configService).refreshSecret,
          expiresIn: getJwtConfig(this.configService).refreshExpiresIn as any,
        },
      );

      // Store refresh token in Redis
      const ttlSeconds = 7 * 24 * 60 * 60;
      const metadata: RefreshTokenMetadata = { jti, issuedAt: Date.now() };
      await this.refreshTokenRepository.storeRefreshToken(
        userId,
        metadata,
        ttlSeconds,
      );

      this.logger.log(`✅ Google login successful: ${userId}`);

      return {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          email: userEmail,
          name: userName,
          avatar: userAvatar,
        },
      };
    } catch (error) {
      this.logger.error(`Google login failed: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An unexpected error occurred during Google login.',
      );
    }
  }
}
