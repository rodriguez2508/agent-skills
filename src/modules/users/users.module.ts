/**
 * Users Module
 *
 * Provides user management with IP-based grouping.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './domain/entities/user.entity';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { UsersService } from './application/services/users.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserRepository, UsersService],
  exports: [UserRepository, UsersService, TypeOrmModule],
})
export class UsersModule {}
