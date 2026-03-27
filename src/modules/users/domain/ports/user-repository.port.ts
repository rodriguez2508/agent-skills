/**
 * User Repository Port
 */

export interface CreateUserDto {
  email: string;
  name?: string;
  avatar?: string;
  ipAddress?: string;
  password?: string;
  preferences?: {
    defaultCategory?: string;
    searchLimit?: number;
    theme?: 'light' | 'dark';
    language?: string;
  };
}

export interface FindUserByIpResult {
  user: any;
  isNew: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  usersByIp: number;
}

export abstract class IUserRepository {
  abstract findByIpOrCreate(data: {
    ipAddress: string;
    email?: string;
    name?: string;
    avatar?: string;
    password?: string;
  }): Promise<FindUserByIpResult>;

  abstract findById(id: string): Promise<any | null>;

  abstract findByEmail(email: string): Promise<any | null>;

  abstract findByEmailWithPassword(email: string): Promise<any | null>;

  abstract findByEmailVerificationToken(token: string): Promise<any | null>;

  abstract findByResetPasswordToken(token: string): Promise<any | null>;

  abstract findByIpAddresses(ipAddresses: string[]): Promise<any[]>;

  abstract updateIpAddress(userId: string, ipAddress: string): Promise<any>;

  abstract updatePassword(userId: string, hashedPassword: string): Promise<any>;

  abstract setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void>;

  abstract clearEmailVerificationToken(userId: string): Promise<void>;

  abstract markEmailAsVerified(userId: string): Promise<void>;

  abstract setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<void>;

  abstract clearPasswordResetToken(userId: string): Promise<void>;

  abstract updatePreferences(userId: string, preferences: any): Promise<any>;

  abstract incrementSessionCount(userId: string): Promise<any>;

  abstract incrementSearchCount(userId: string): Promise<any>;

  abstract findAll(limit?: number): Promise<any[]>;

  abstract findActive(limit?: number): Promise<any[]>;

  abstract getStats(): Promise<UserStats>;

  abstract delete(userId: string): Promise<void>;
}
