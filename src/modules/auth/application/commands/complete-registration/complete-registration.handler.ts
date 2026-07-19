import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { CompleteRegistrationCommand } from './complete-registration.command';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Inject,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UserRepository } from '@modules/users/infrastructure/persistence/user.repository';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.interface';
import {
  RefreshTokenPayload,
  RefreshTokenMetadata,
} from '../../../domain/entities/auth.entity';
import { getJwtConfig } from '../../../const/jwt.constants';
import { OAuth2Client } from 'google-auth-library';
import { IAgencyRepository } from '@modules/agencies/domain/ports/agency-repository.port';
import { AgencyCreatedEvent } from '@modules/agencies/domain/events/agency-created.event';
import { verifyGoogleToken, GoogleTokenPayload } from '../../../utils/google-token-verifier';

export interface CompleteRegistrationResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  agency: {
    id: string;
    name: string;
    slug: string;
    planTier: string;
  };
}

@CommandHandler(CompleteRegistrationCommand)
export class CompleteRegistrationHandler
  implements ICommandHandler<CompleteRegistrationCommand, CompleteRegistrationResult>
{
  private readonly logger = new Logger(CompleteRegistrationHandler.name);
  private readonly googleClientId: string;
  private readonly oauthClient: OAuth2Client;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly agencyRepository: IAgencyRepository,
    private readonly eventBus: EventBus,
    @Inject('RefreshTokenRepository')
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';

    if (!this.googleClientId) {
      this.logger.warn('GOOGLE_CLIENT_ID is not configured. Google registration will fail.');
    }

    this.oauthClient = new OAuth2Client({
      clientId: this.googleClientId,
      clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET') || undefined,
    });
  }

  async execute(command: CompleteRegistrationCommand): Promise<CompleteRegistrationResult> {
    const { dto, ipAddress } = command;

    try {
      // Step 1: Verify Google token (remote with local fallback)
      const googleUserInfo = await verifyGoogleToken(
        this.oauthClient,
        dto.googleToken,
        this.googleClientId,
        this.logger,
      );
      const email = googleUserInfo.email;

      this.logger.log(`📝 Complete registration for: ${email}`);

      // Step 2: Find or create user
      const { userId, userName, userAvatar } = await this.findOrCreateUser(
        email,
        googleUserInfo,
        ipAddress,
        dto.name,
      );

      // Step 3: Create agency
      const slug = dto.agencySlug || this.slugify(dto.agencyName);
      const planTier = dto.planTier || 'free';

      const agency = await this.agencyRepository.create({
        name: dto.agencyName,
        slug,
        ownerId: userId,
        settings: { country: dto.country, phone: dto.phone },
      });

      // Add owner as member with OWNER role
      await this.agencyRepository.addMember({
        agencyId: agency.id,
        userId,
        role: 'owner',
        permissions: {
          canCreateTemplates: true,
          canPublishTemplates: true,
          canManageMembers: true,
          canDeleteAgency: true,
          canConfigureWorkflow: true,
        },
      });

      // Update plan tier if not free
      if (planTier !== 'free') {
        await this.agencyRepository.update(agency.id, { planTier } as any);
      }

      // Emit domain event
      this.eventBus.publish(
        new AgencyCreatedEvent(agency.id, userId, slug, dto.agencyName),
      );

      this.logger.log(`✅ Agency created: ${agency.id} (${slug})`);

      // Step 4: Generate JWT tokens
      const { accessToken, refreshToken } = await this.generateTokens(userId, userName, email, userAvatar);

      this.logger.log(`✅ Complete registration successful: ${userId}`);

      return {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          email,
          name: userName,
          avatar: userAvatar,
        },
        agency: {
          id: agency.id,
          name: dto.agencyName,
          slug,
          planTier,
        },
      };
    } catch (error) {
      this.logger.error(`Complete registration failed: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException || error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An unexpected error occurred during registration.',
      );
    }
  }

  private async findOrCreateUser(
    email: string,
    googleInfo: GoogleTokenPayload,
    ipAddress: string,
    displayName: string,
  ): Promise<{ userId: string; userName: string; userAvatar?: string }> {
    const existingByEmail = await this.userRepository.findByEmail(email);

    if (existingByEmail) {
      // Update existing user with latest info
      await this.userRepository.getRepository().update(existingByEmail.id, {
        name: displayName,
        avatar: googleInfo.picture,
      });

      return {
        userId: existingByEmail.id,
        userName: displayName,
        userAvatar: googleInfo.picture,
      };
    }

    // Create new user
    const { user: newUser } = await this.userRepository.findByIpOrCreate({
      ipAddress,
      email,
      name: displayName,
      avatar: googleInfo.picture,
    });

    return {
      userId: newUser.id,
      userName: displayName,
      userAvatar: googleInfo.picture,
    };
  }

  private async generateTokens(
    userId: string,
    name: string,
    email: string,
    avatar?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      id: userId,
      email,
      name,
      avatar,
      userType: 'user',
      lastConnected: new Date(),
    };
    const accessToken = await this.jwtService.signAsync(payload);

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

    const ttlSeconds = 7 * 24 * 60 * 60;
    const metadata: RefreshTokenMetadata = { jti, issuedAt: Date.now() };
    await this.refreshTokenRepository.storeRefreshToken(userId, metadata, ttlSeconds);

    return { accessToken, refreshToken };
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || `agency-${randomUUID().substring(0, 8)}`;
  }
}
