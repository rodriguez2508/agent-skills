import { AgentConfig } from './agent-config.entity';
import { Component } from './component.entity';
import { Skill } from './skill.entity';
import { Persona } from './persona.entity';
import { Preset } from './preset.entity';

/**
 * Aggregate root representing a complete installation profile.
 * Tracks which agents, components, skills, and personas are configured.
 */
export class InstallationProfile {
  constructor(
    public readonly id: string,
    public readonly agents: AgentConfig[],
    public readonly components: Component[],
    public readonly skills: Skill[],
    public readonly persona: Persona | null,
    public readonly preset: Preset | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Creates a new installation profile with current timestamps.
   */
  static create(
    id: string,
    agents: AgentConfig[],
    components: Component[],
    skills: Skill[],
    persona: Persona | null = null,
    preset: Preset | null = null,
  ): InstallationProfile {
    const now = new Date();
    return new InstallationProfile(id, agents, components, skills, persona, preset, now, now);
  }

  /**
   * Returns all agent IDs in this profile.
   */
  getAgentIds(): string[] {
    return this.agents.map((a) => a.id);
  }

  /**
   * Returns all component IDs in this profile.
   */
  getComponentIds(): string[] {
    return this.components.map((c) => c.id);
  }

  /**
   * Returns all skill IDs in this profile.
   */
  getSkillIds(): string[] {
    return this.skills.map((s) => s.id);
  }

  /**
   * Updates the updatedAt timestamp.
   */
  touch(): InstallationProfile {
    return new InstallationProfile(
      this.id,
      this.agents,
      this.components,
      this.skills,
      this.persona,
      this.preset,
      this.createdAt,
      new Date(),
    );
  }
}
