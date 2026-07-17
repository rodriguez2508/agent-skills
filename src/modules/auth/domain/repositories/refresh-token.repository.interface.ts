import { RefreshTokenMetadata } from '../entities/auth.entity';

export interface RefreshTokenRepository {
  storeRefreshToken(
    userId: string,
    metadata: RefreshTokenMetadata,
    ttlSeconds: number,
  ): Promise<void>;
  getRefreshToken(userId: string): Promise<RefreshTokenMetadata | null>;
  deleteRefreshToken(userId: string): Promise<void>;
}
