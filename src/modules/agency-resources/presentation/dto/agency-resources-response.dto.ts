import { AgencySkill } from '@agency-resources/domain/entities/agency-skill.entity';
import { AgencyRule } from '@agency-resources/domain/entities/agency-rule.entity';
import { AgencyAgent } from '@agency-resources/domain/entities/agency-agent.entity';
import { AgencyWorkflow } from '@agency-resources/domain/entities/agency-workflow.entity';

export class AgencySkillDto {
  id!: string;
  agencyId!: string;
  name!: string;
  description!: string;
  promptTemplate!: string;
  agentType!: string;
  tags!: string[];
  usageCount!: number;
  rating!: number;
  inputVariables!: string[];
  isPublished!: boolean;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: AgencySkill): AgencySkillDto {
    const dto = new AgencySkillDto();
    dto.id = entity.id;
    dto.agencyId = entity.agencyId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.promptTemplate = entity.promptTemplate;
    dto.agentType = entity.agentType;
    dto.tags = entity.tags;
    dto.usageCount = entity.usageCount;
    dto.rating = Number(entity.rating);
    dto.inputVariables = entity.inputVariables;
    dto.isPublished = entity.isPublished;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AgencyRuleDto {
  id!: string;
  agencyId!: string;
  name!: string;
  description!: string;
  category!: string;
  ruleContent!: string;
  enforcementLevel!: string;
  priority!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: AgencyRule): AgencyRuleDto {
    const dto = new AgencyRuleDto();
    dto.id = entity.id;
    dto.agencyId = entity.agencyId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.category = entity.category;
    dto.ruleContent = entity.ruleContent;
    dto.enforcementLevel = entity.enforcementLevel;
    dto.priority = entity.priority;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AgencyAgentDto {
  id!: string;
  agencyId!: string;
  name!: string;
  description!: string;
  systemPrompt!: string;
  tools!: string[];
  type!: string;
  skillIds!: string[];
  ruleIds!: string[];
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: AgencyAgent): AgencyAgentDto {
    const dto = new AgencyAgentDto();
    dto.id = entity.id;
    dto.agencyId = entity.agencyId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.systemPrompt = entity.systemPrompt;
    dto.tools = entity.tools;
    dto.type = entity.type;
    dto.skillIds = entity.skillIds;
    dto.ruleIds = entity.ruleIds;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

export class AgencyWorkflowDto {
  id!: string;
  agencyId!: string;
  name!: string;
  description!: string;
  steps!: any;
  triggerType!: string;
  triggerConfig!: any;
  executionCount!: number;
  successCount!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromEntity(entity: AgencyWorkflow): AgencyWorkflowDto {
    const dto = new AgencyWorkflowDto();
    dto.id = entity.id;
    dto.agencyId = entity.agencyId;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.steps = entity.steps;
    dto.triggerType = entity.triggerType;
    dto.triggerConfig = entity.triggerConfig;
    dto.executionCount = entity.executionCount;
    dto.successCount = entity.successCount;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
