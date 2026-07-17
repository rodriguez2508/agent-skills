import { Component } from './component.entity';
import { Skill } from './skill.entity';

/**
 * Represents a preset configuration bundle.
 * Presets define which components and skills should be installed together.
 * Examples: full-gentleman, ecosystem-only, minimal, custom
 */
export class Preset {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly components: Component[],
    public readonly skills: Skill[],
  ) {}
}
