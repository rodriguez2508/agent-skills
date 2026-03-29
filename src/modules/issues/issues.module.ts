/**
 * Issues Module
 *
 * Manages GitHub/GitLab issues and workflow tracking.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from '@modules/issues/domain/entities/issue.entity';
import { IssueService } from './application/services/issue.service';
import { IssueRepository } from '@infrastructure/persistence/repositories/issue.repository';
import { IssuesController } from './presentation/controllers/issues.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Issue])],
  controllers: [IssuesController],
  providers: [IssueService, IssueRepository],
  exports: [IssueService, IssueRepository],
})
export class IssuesModule {}
