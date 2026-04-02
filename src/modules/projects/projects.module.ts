/**
 * Projects Module
 *
 * Manages projects that users work on.
 */

import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './domain/entities/project.entity';
import { ProjectRepository } from './infrastructure/persistence/project.repository';
import { ProjectsService } from './application/services/projects.service';
import { ProjectsController } from './presentation/controllers/projects.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  controllers: [ProjectsController],
  providers: [ProjectRepository, ProjectsService],
  exports: [TypeOrmModule, ProjectRepository, ProjectsService],
})
export class ProjectsModule {}
