import { Injectable } from '@nestjs/common';

interface RuleMapping {
  skillId: string;
  rules: string[]; // List of rule file paths or descriptions.
}

@Injectable()
export class SkillRulesMappingService {
  private mappings: Map<string, RuleMapping> = new Map();

  addMapping(skillId: string, rules: string[]) {
    this.mappings.set(skillId, { skillId, rules });
  }

  getMapping(skillId: string): RuleMapping | undefined {
    return this.mappings.get(skillId);
  }

  listMappings(): RuleMapping[] {
    return Array.from(this.mappings.values());
  }

  validateRules(skillId: string): boolean {
    const mapping = this.getMapping(skillId);
    if (!mapping) {
      throw new Error(`No rules found for Skill ID: ${skillId}`);
    }
    // Add actual validation logic here if needed.
    console.log(`Validated rules for Skill ID: ${skillId}`);
    return true;
  }
}