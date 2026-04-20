import { Injectable } from '@nestjs/common';

interface Skill {
  id: string;
  agentId: string;
  description?: string;
  rules: string[];
  execute: (inputs: any) => Promise<any>;
}

@Injectable()
export class SkillRegistrationService {
  private skills: Map<string, Skill> = new Map();

  registerSkill(skill: Skill) {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill with id '${skill.id}' already exists.`);
    }
    this.skills.set(skill.id, skill);
  }

  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  executeSkill(skillId: string, inputs: any): Promise<any> {
    const skill = this.getSkill(skillId);
    if (!skill) {
      throw new Error(`Skill with id '${skillId}' not found.`);
    }
    return skill.execute(inputs);
  }
}