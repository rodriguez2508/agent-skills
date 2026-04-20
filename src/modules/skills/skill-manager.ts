export interface SkillConfig {
  id: string; // Identificador único del skill
  agentId: string; // Subagente relacionado
  rules: string[]; // Reglas asociadas
  execute: (inputs: any) => Promise<any>; // Función para ejecutar el skill
}

export class SkillManager {
  private skills: Map<string, SkillConfig> = new Map();

  registerSkill(skill: SkillConfig) {
    this.skills.set(skill.id, skill);
  }

  executeSkill(skillId: string, inputs: any) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }
    return skill.execute(inputs);
  }

  listSkills() {
    return [...this.skills.values()];
  }
}