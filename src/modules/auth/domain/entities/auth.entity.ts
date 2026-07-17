/**
 * Auth Domain Entities
 *
 * Defines the payload structures for JWT tokens.
 */

export interface TokenPayload {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  userType: 'user';
  lastIpAddress?: string;
  lastConnected: Date;
}

export interface RefreshTokenPayload {
  userId: string;
  userType: 'user';
  tokenVersion?: number;
  jti?: string; // JWT ID - unique identifier for token reuse detection
}

/** Metadata stored in Redis for refresh token validation */
export interface RefreshTokenMetadata {
  jti: string;
  issuedAt: number; // Unix timestamp
}
