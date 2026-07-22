import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';

import { AgencySkill } from '@agency-resources/domain/entities/agency-skill.entity';
import { AgencyRule } from '@agency-resources/domain/entities/agency-rule.entity';
import { AgencyAgent } from '@agency-resources/domain/entities/agency-agent.entity';
import { AgencyWorkflow } from '@agency-resources/domain/entities/agency-workflow.entity';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';

import { IAgencyResourcesRepository } from '@agency-resources/domain/ports/agency-resources-repository.port';
import { AGENCY_RESOURCES_REPOSITORY } from '@agency-resources/domain/tokens';
import { AgencyResourcesRepository } from '@agency-resources/infrastructure/persistence/agency-resources.repository';
import { AuthModule } from '@modules/auth/auth.module';
import { AgenciesModule } from '@modules/agencies/agencies.module';

import { CreateSkillHandler } from '@agency-resources/application/commands/create-skill/create-skill.handler';
import { UpdateSkillHandler } from '@agency-resources/application/commands/update-skill/update-skill.handler';
import { DeleteSkillHandler } from '@agency-resources/application/commands/delete-skill/delete-skill.handler';
import { CreateRuleHandler } from '@agency-resources/application/commands/create-rule/create-rule.handler';
import { UpdateRuleHandler } from '@agency-resources/application/commands/update-rule/update-rule.handler';
import { DeleteRuleHandler } from '@agency-resources/application/commands/delete-rule/delete-rule.handler';
import { CreateAgentHandler } from '@agency-resources/application/commands/create-agent/create-agent.handler';
import { UpdateAgentHandler } from '@agency-resources/application/commands/update-agent/update-agent.handler';
import { DeleteAgentHandler } from '@agency-resources/application/commands/delete-agent/delete-agent.handler';
import { CreateWorkflowHandler } from '@agency-resources/application/commands/create-workflow/create-workflow.handler';
import { UpdateWorkflowHandler } from '@agency-resources/application/commands/update-workflow/update-workflow.handler';
import { DeleteWorkflowHandler } from '@agency-resources/application/commands/delete-workflow/delete-workflow.handler';

import { GetSkillsByAgencyHandler } from '@agency-resources/application/queries/get-skills-by-agency/get-skills-by-agency.handler';
import { GetSkillByIdHandler } from '@agency-resources/application/queries/get-skill-by-id/get-skill-by-id.handler';
import { GetRulesByAgencyHandler } from '@agency-resources/application/queries/get-rules-by-agency/get-rules-by-agency.handler';
import { GetRulesByCategoryHandler } from '@agency-resources/application/queries/get-rules-by-category/get-rules-by-category.handler';
import { GetRuleByIdHandler } from '@agency-resources/application/queries/get-rule-by-id/get-rule-by-id.handler';
import { GetAgentsByAgencyHandler } from '@agency-resources/application/queries/get-agents-by-agency/get-agents-by-agency.handler';
import { GetAgentByIdHandler } from '@agency-resources/application/queries/get-agent-by-id/get-agent-by-id.handler';
import { GetWorkflowsByAgencyHandler } from '@agency-resources/application/queries/get-workflows-by-agency/get-workflows-by-agency.handler';
import { GetWorkflowByIdHandler } from '@agency-resources/application/queries/get-workflow-by-id/get-workflow-by-id.handler';
import { SearchMarketplaceHandler } from '@agency-resources/application/queries/search-marketplace/search-marketplace.handler';

import { AgencySkillsController } from '@agency-resources/presentation/controllers/agency-skills.controller';
import { AgencyRulesController } from '@agency-resources/presentation/controllers/agency-rules.controller';
import { AgencyAgentsController } from '@agency-resources/presentation/controllers/agency-agents.controller';
import { AgencyWorkflowsController } from '@agency-resources/presentation/controllers/agency-workflows.controller';
import { MarketplaceController } from '@agency-resources/presentation/controllers/marketplace.controller';
import { AgencyResourcesCategoriesController } from '@agency-resources/presentation/controllers/agency-resources-categories.controller';

const Entities = [AgencySkill, AgencyRule, AgencyAgent, AgencyWorkflow, AgentCategory];

const CommandHandlers = [
  CreateSkillHandler,
  UpdateSkillHandler,
  DeleteSkillHandler,
  CreateRuleHandler,
  UpdateRuleHandler,
  DeleteRuleHandler,
  CreateAgentHandler,
  UpdateAgentHandler,
  DeleteAgentHandler,
  CreateWorkflowHandler,
  UpdateWorkflowHandler,
  DeleteWorkflowHandler,
];

const QueryHandlers = [
  GetSkillsByAgencyHandler,
  GetSkillByIdHandler,
  GetRulesByAgencyHandler,
  GetRulesByCategoryHandler,
  GetRuleByIdHandler,
  GetAgentsByAgencyHandler,
  GetAgentByIdHandler,
  GetWorkflowsByAgencyHandler,
  GetWorkflowByIdHandler,
  SearchMarketplaceHandler,
];

@Module({
  imports: [TypeOrmModule.forFeature(Entities), CqrsModule, AuthModule, AgenciesModule],
  controllers: [
    AgencySkillsController,
    AgencyRulesController,
    AgencyAgentsController,
    AgencyWorkflowsController,
    MarketplaceController,
    AgencyResourcesCategoriesController,
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    {
      provide: AGENCY_RESOURCES_REPOSITORY,
      useClass: AgencyResourcesRepository,
    },
  ],
  exports: [AGENCY_RESOURCES_REPOSITORY, TypeOrmModule],
})
export class AgencyResourcesModule {}
