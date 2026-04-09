/**
 * Represents a persona configuration for AI agents.
 * Personas define the behavioral instructions injected into system prompts.
 * Examples: gentleman, neutral, custom
 */
export class Persona {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly instructions: string,
  ) {}
}
