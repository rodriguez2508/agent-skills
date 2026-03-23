/**
 * Users Module
 *
 * Provides user management with IP-based grouping.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './domain/entities/user.entity';
import { UserRepository } from './infrastructure/persistence/user.repository';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserRepository],
  exports: [UserRepository, TypeOrmModule],
})
export class UsersModule {}
