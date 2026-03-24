export enum RuleImpact {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface RuleData {
  id: string;
  name: string;
  content: string;
  category: string;
  tags: string[];
  impact: RuleImpact;
  impactDescription?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Rule {
  public readonly id: string;
  public readonly name: string;
  public readonly content: string;
  public readonly category: string;
  public readonly tags: string[];
  public readonly impact: RuleImpact;
  public readonly impactDescription?: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(data: RuleData) {
    this.id = data.id;
    this.name = data.name;
    this.content = data.content;
    this.category = data.category;
    this.tags = data.tags;
    this.impact = data.impact;
    this.impactDescription = data.impactDescription;
    this.createdAt = data.createdAt ?? new Date();
    this.updatedAt = data.updatedAt ?? new Date();
  }

  toObject(): RuleData {
    return {
      id: this.id,
      name: this.name,
      content: this.content,
      category: this.category,
      tags: this.tags,
      impact: this.impact,
      impactDescription: this.impactDescription,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
