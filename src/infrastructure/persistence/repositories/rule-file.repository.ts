import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Rule, RuleImpact } from '../../../core/domain/entities/rule.entity';
import { RuleRepository } from '../../../core/domain/ports/rule-repository.port';
import bm25Config from '../../search/bm25/bm25.config';

@Injectable()
export class RuleFileRepository implements RuleRepository {
  private readonly rulesPath: string;
  private cache: Map<string, Rule> = new Map();

  constructor(
    @Inject(bm25Config.KEY)
    private readonly config: ConfigType<typeof bm25Config>,
  ) {
    this.rulesPath = process.env.RULES_PATH || path.join(process.cwd(), 'rules');
    this.ensureRulesPathExists();
  }

  async findById(id: string): Promise<Rule | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    const rule = await this.loadRuleFromFile(id);
    if (rule) {
      this.cache.set(id, rule);
    }
    return rule;
  }

  async findAll(): Promise<Rule[]> {
    this.invalidateCache();
    const rules: Rule[] = [];
    const categories = await this.getCategories();

    for (const category of categories) {
      const categoryRules = await this.findByCategory(category);
      rules.push(...categoryRules);
    }

    return rules;
  }

  async findByCategory(category: string): Promise<Rule[]> {
    this.invalidateCache();
    const categoryPath = path.join(this.rulesPath, category.toLowerCase());
    const rules: Rule[] = [];

    if (!fs.existsSync(categoryPath)) {
      return rules;
    }

    const files = fs.readdirSync(categoryPath).filter((file) => file.endsWith('.md'));

    for (const file of files) {
      const rule = await this.loadRuleFromFileFile(category, file);
      if (rule) {
        rules.push(rule);
      }
    }

    return rules;
  }

  async save(rule: Rule): Promise<void> {
    const categoryPath = path.join(this.rulesPath, rule.category);
    if (!fs.existsSync(categoryPath)) {
      fs.mkdirSync(categoryPath, { recursive: true });
    }

    const filePath = path.join(categoryPath, `${rule.id}.md`);
    const content = `# ${rule.name}\n\n${rule.content}`;
    fs.writeFileSync(filePath, content, 'utf-8');

    this.cache.set(rule.id, rule);
  }

  async delete(id: string): Promise<void> {
    const rule = await this.findById(id);
    if (!rule) return;

    const filePath = path.join(
      this.rulesPath,
      rule.category,
      `${rule.id}.md`,
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    this.cache.delete(id);
  }

  private async loadRuleFromFile(id: string): Promise<Rule | null> {
    for (const category of await this.getCategories()) {
      const filePath = path.join(this.rulesPath, category, `${id}.md`);
      if (fs.existsSync(filePath)) {
        return this.parseRuleFile(filePath, category, id);
      }
    }
    return null;
  }

  private async loadRuleFromFileFile(
    category: string,
    file: string,
  ): Promise<Rule | null> {
    const filePath = path.join(this.rulesPath, category, file);
    const id = path.basename(file, '.md');
    return this.parseRuleFile(filePath, category, id);
  }

  private parseRuleFile(
    filePath: string,
    category: string,
    id: string,
  ): Rule | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = this.extractTitle(content);
      const body = content.replace(/^# .+\n+/, '').trim();
      const tags = this.extractTags(body);

      return new Rule({
        id,
        name,
        content: body,
        category,
        tags,
        impact: RuleImpact.MEDIUM,
      });
    } catch {
      return null;
    }
  }

  private extractTitle(content: string): string {
    const match = content.match(/^# (.+)$/m);
    return match ? match[1].trim() : 'Untitled Rule';
  }

  private extractTags(content: string): string[] {
    const match = content.match(/tags:\s*\[(.+)\]/i);
    if (match) {
      return match[1].split(',').map((tag) => tag.trim());
    }
    return [];
  }

  private async getCategories(): Promise<string[]> {
    if (!fs.existsSync(this.rulesPath)) {
      return [];
    }
    return fs.readdirSync(this.rulesPath).filter((item) => {
      const itemPath = path.join(this.rulesPath, item);
      return fs.statSync(itemPath).isDirectory();
    });
  }

  private ensureRulesPathExists(): void {
    if (!fs.existsSync(this.rulesPath)) {
      fs.mkdirSync(this.rulesPath, { recursive: true });
    }
  }

  private invalidateCache(): void {
    this.cache.clear();
  }
}
