export class RuleCategory {
  private static readonly VALID_CATEGORIES = [
    'angular',
    'nestjs',
    'typescript',
    'nodejs',
    'general',
  ];

  constructor(public readonly value: string) {
    const normalizedValue = value.toLowerCase().trim();
    if (!RuleCategory.VALID_CATEGORIES.includes(normalizedValue)) {
      throw new Error(
        `Invalid category "${value}". Valid categories are: ${RuleCategory.VALID_CATEGORIES.join(', ')}`,
      );
    }
    this.value = normalizedValue;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RuleCategory): boolean {
    return this.value === other.value;
  }
}
