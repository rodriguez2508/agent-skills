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

@Module({
  imports: [TypeOrmModule.forFeature([Issue])],
  providers: [IssueService, IssueRepository],
  exports: [IssueService, IssueRepository],
})
export class IssuesModule {}
