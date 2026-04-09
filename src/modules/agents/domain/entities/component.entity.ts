/**
 * Represents a configurable component of the Gentle AI ecosystem.
 * Examples: engram, sdd, skills, context7, persona, permissions, gga, theme
 */
export class Component {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
  ) {}
}
