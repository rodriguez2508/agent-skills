export class RuleId {
  constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Rule ID cannot be empty');
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: RuleId): boolean {
    return this.value === other.value;
  }
}
