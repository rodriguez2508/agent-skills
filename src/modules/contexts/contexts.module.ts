/**
 * Contexts Module
 *
 * Manages conversation contexts for issues.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Context } from './domain/entities/context.entity';
import { ContextRepository } from './infrastructure/persistence/context.repository';
import { ContextService } from './application/services/context.service';

@Module({
  imports: [TypeOrmModule.forFeature([Context])],
  providers: [ContextRepository, ContextService],
  exports: [ContextRepository, ContextService],
})
export class ContextsModule {}
