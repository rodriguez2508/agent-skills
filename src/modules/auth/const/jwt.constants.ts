/**
 * JWT Configuration
 */
import { ConfigService } from '@nestjs/config';

const DEFAULT_ACCESS_SECRET = 'agency-skills-default-access-secret';
const DEFAULT_REFRESH_SECRET = 'agency-skills-default-refresh-secret';

export const getJwtConfig = (configService: ConfigService) => {
  const accessSecret =
    configService.get<string>('JWT_ACCESS_SECRET') || DEFAULT_ACCESS_SECRET;
  const refreshSecret =
    configService.get<string>('JWT_REFRESH_SECRET') || DEFAULT_REFRESH_SECRET;

  return {
    accessSecret,
    accessExpiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshSecret,
    refreshExpiresIn: configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
  };
};
