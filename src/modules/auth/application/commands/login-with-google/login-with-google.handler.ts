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

/**
 * Google token verification response payload
 */
interface GoogleTokenPayload {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified: boolean;
  locale?: string;
}

@CommandHandler(LoginWithGoogleCommand)
export class LoginWithGoogleHandler
  implements ICommandHandler<LoginWithGoogleCommand>
{
  private readonly logger = new Logger(LoginWithGoogleHandler.name);
  private readonly googleClientId: string;
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';

    if (!this.googleClientId) {
      this.logger.warn('GOOGLE_CLIENT_ID is not configured. Google login will fail.');
    }

    this.oauthClient = new OAuth2Client(this.googleClientId);
  }

  async execute(command: LoginWithGoogleCommand) {
    try {
      const { loginGoogleDto, ipAddress } = command;
      const { googleToken } = loginGoogleDto;

      this.logger.debug(`Verifying Google token from IP: ${ipAddress}...`);

      // Verify Google token
      const googleUserInfo = await this.verifyGoogleToken(googleToken);

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
          ipAddress,
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

  /**
   * Verifies Google ID token using the official google-auth-library
   */
  private async verifyGoogleToken(token: string): Promise<GoogleTokenPayload> {
    try {
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: this.googleClientId,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google token');
      }

      return {
        sub: payload.sub,
        name: payload.name || '',
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        email: payload.email || '',
        email_verified: payload.email_verified || false,
        locale: payload.locale,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Google token verification failed: ${error.message}`);

      if (error.message?.includes('Token used too late')) {
        throw new UnauthorizedException('Google token has expired');
      }

      if (error.message?.includes('Invalid token')) {
        throw new UnauthorizedException('Invalid Google token');
      }

      throw new UnauthorizedException(
        `Failed to verify Google token: ${error.message}`,
      );
    }
  }
}
