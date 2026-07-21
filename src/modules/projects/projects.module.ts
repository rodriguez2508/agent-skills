/**
 * Projects Module
 *
 * Manages projects that users work on.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './domain/entities/project.entity';
import { ProjectRelationship } from './domain/entities/project-relationship.entity';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectsService } from './application/services/projects.service';
import { ProjectsController } from './presentation/controllers/projects.controller';
import { ProjectPlansController } from './presentation/controllers/project-plans.controller';
import { ProjectChatController } from './presentation/controllers/project-chat.controller';
import { AuthModule } from '@modules/auth/auth.module';
import { PlansModule } from '@modules/plans/plans.module';
import { ContextsModule } from '@modules/contexts/contexts.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectRelationship]), AuthModule, PlansModule, ContextsModule],
  controllers: [ProjectsController, ProjectPlansController, ProjectChatController],
  providers: [ProjectRepository, ProjectsService],
  exports: [TypeOrmModule, ProjectRepository, ProjectsService],
})
export class ProjectsModule {}
