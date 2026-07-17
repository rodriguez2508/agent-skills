/**
 * Represents a skill that can be installed into an agent.
 * Skills are markdown files (SKILL.md) that teach agents specific capabilities.
 */
export class Skill {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly category: string,
    public readonly description: string,
  ) {}
}
