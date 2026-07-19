/**
 * Agencies Module
 *
 * Multi-tenancy agency system with pure CQRS.
 * Each agency has its own skills, rules, workflows, and members.
 * Templates can be published to a marketplace and installed by other agencies.
 *
 * Architecture:
 *   Controller → CommandBus/QueryBus → Handler → Repository → TypeORM
 *   Handler → EventBus → Domain Events (for side effects)
 */

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '@modules/auth/auth.module';

// Entities
import { Agency } from './domain/entities/agency.entity';
import { AgencyMember } from './domain/entities/agency-member.entity';
import { AgencyTemplate } from './domain/entities/agency-template.entity';

// Ports
import { IAgencyRepository } from './domain/ports/agency-repository.port';

// Repository Implementation
import { AgencyRepository } from './infrastructure/persistence/agency.repository';

// Controllers
import { AgenciesController } from './presentation/controllers/agencies.controller';

// Command Handlers
import { CreateAgencyHandler } from './application/commands/create-agency/create-agency.handler';
import { PublishTemplateHandler } from './application/commands/publish-template/publish-template.handler';
import { InstallTemplateHandler } from './application/commands/install-template/install-template.handler';

// Query Handlers
import { GetAgencyHandler } from './application/queries/get-agency/get-agency.handler';
import { SearchTemplatesHandler } from './application/queries/search-templates/search-templates.handler';

// Guards
import { AgencyGuard } from './guard/agency.guard';

const CommandHandlers = [
  CreateAgencyHandler,
  PublishTemplateHandler,
  InstallTemplateHandler,
];

const QueryHandlers = [GetAgencyHandler, SearchTemplatesHandler];

const Guards = [AgencyGuard];

@Module({
  imports: [
    CqrsModule,
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([Agency, AgencyMember, AgencyTemplate]),
  ],
  controllers: [AgenciesController],
  providers: [
    // Repository (port → implementation binding)
    {
      provide: IAgencyRepository,
      useClass: AgencyRepository,
    },

    // CQRS Handlers
    ...CommandHandlers,
    ...QueryHandlers,

    // Guards
    ...Guards,
  ],
  exports: [IAgencyRepository, TypeOrmModule, AgencyGuard],
})
export class AgenciesModule {}
