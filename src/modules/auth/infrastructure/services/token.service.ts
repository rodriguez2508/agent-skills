/**
 * Token Service
 *
 * Handles token generation and verification for email verification and password reset.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly tokenExpirationHours: number;

  constructor(private readonly configService: ConfigService) {
    this.tokenExpirationHours =
      this.configService.get<number>('TOKEN_EXPIRATION_HOURS') || 24;
  }

  /**
   * Generate a random token
   */
  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash a token (for storage)
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get token expiration date
   */
  getTokenExpirationDate(): Date {
    const now = new Date();
    now.setHours(now.getHours() + this.tokenExpirationHours);
    return now;
  }

  /**
   * Check if a token is expired
   */
  isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(): {
    token: string;
    hashedToken: string;
    expires: Date;
  } {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = this.getTokenExpirationDate();

    return { token, hashedToken, expires };
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(): {
    token: string;
    hashedToken: string;
    expires: Date;
  } {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = this.getTokenExpirationDate();

    return { token, hashedToken, expires };
  }

  /**
   * Verify a token against a hashed token
   */
  verifyToken(token: string, hashedToken: string): boolean {
    const providedHashedToken = this.hashToken(token);
    return providedHashedToken === hashedToken;
  }
}
