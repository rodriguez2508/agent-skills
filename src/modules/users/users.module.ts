/**
 * Users Module
 *
 * Provides user management with IP-based grouping.
 */

import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { User } from './domain/entities/user.entity';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { UsersService } from './application/services/users.service';
import { UsersController } from './presentation/controllers/users.controller';
import { AuthModule } from '@modules/auth/auth.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    CqrsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UserRepository, UsersService],
  exports: [UserRepository, UsersService, TypeOrmModule],
})
export class UsersModule {}
