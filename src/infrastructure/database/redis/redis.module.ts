/**
 * Redis Module
 * 
 * Provides Redis connection with ioredis.
 * Used for caching, sessions, and rate limiting.
 */

import { Module, Global, DynamicModule, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RedisModuleOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

@Global()
@Module({})
export class RedisModule {
  static forRoot(options?: RedisModuleOptions): DynamicModule {
    const redisProvider: Provider = {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', options?.host || 'localhost'),
          port: configService.get<number>('REDIS_PORT', options?.port || 6379),
          password: configService.get<string>('REDIS_PASSWORD') || options?.password || undefined,
          db: configService.get<number>('REDIS_DB', options?.db || 0),
          retryStrategy: (times: number) => {
            if (times > 3) {
              return null; // Stop retrying
            }
            return Math.min(times * 200, 2000);
          },
        });
      },
      inject: [ConfigService],
    };

    return {
      module: RedisModule,
      imports: [ConfigModule.forRoot()],
      providers: [redisProvider],
      exports: [redisProvider],
    };
  }
}
