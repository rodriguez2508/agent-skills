import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Rule, RuleImpact } from '@core/domain/entities/rule.entity';
import { RULE_REPOSITORY, RuleRepository } from '@core/domain/ports/rule-repository.token';

@Injectable()
export class RuleFileRepository implements RuleRepository {
  private readonly logger = new Logger(RuleFileRepository.name);
  private readonly rulesPath: string;
  private cache: Map<string, Rule> = new Map();

  constructor(private readonly configService: ConfigService) {
    const rulesPathConfig = this.configService.get<string>('RULES_PATH', './src/rules');
    // Convertir a ruta absoluta si es relativa
    this.rulesPath = rulesPathConfig.startsWith('/')
      ? rulesPathConfig
      : path.join(process.cwd(), rulesPathConfig);
    this.ensureRulesPathExists();
    this.logger.log(`📂 Rules path initialized: ${this.rulesPath}`);
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
    
    // Check if we have subdirectories (category-based) or flat structure
    const hasSubdirs = await this.hasCategorySubdirectories();
    
    if (hasSubdirs) {
      const categories = await this.getCategories();
      for (const category of categories) {
        const categoryRules = await this.findByCategory(category);
        rules.push(...categoryRules);
      }
    } else {
      // Flat structure - read all .md files from rulesPath
      const files = fs.readdirSync(this.rulesPath).filter((file) => file.endsWith('.md') && !file.startsWith('_'));
      for (const file of files) {
        const rule = await this.loadRuleFromFlatFile(file);
        if (rule) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  async findByCategory(category: string): Promise<Rule[]> {
    this.invalidateCache();
    const rules: Rule[] = [];
    
    // Check if we have subdirectories (category-based) or flat structure
    const hasSubdirs = await this.hasCategorySubdirectories();
    
    if (hasSubdirs) {
      const categoryPath = path.join(this.rulesPath, category.toLowerCase());
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
    } else {
      // Flat structure - filter by category extracted from filename or content
      const files = fs.readdirSync(this.rulesPath).filter((file) => file.endsWith('.md') && !file.startsWith('_'));
      for (const file of files) {
        const rule = await this.loadRuleFromFlatFile(file);
        if (rule && rule.category.toLowerCase() === category.toLowerCase()) {
          rules.push(rule);
        }
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
    // First try category-based structure
    for (const category of await this.getCategories()) {
      const filePath = path.join(this.rulesPath, category, `${id}.md`);
      if (fs.existsSync(filePath)) {
        return this.parseRuleFile(filePath, category, id);
      }
    }
    // Try flat structure
    const filePath = path.join(this.rulesPath, `${id}.md`);
    if (fs.existsSync(filePath)) {
      return this.loadRuleFromFlatFile(path.basename(filePath));
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

  private async loadRuleFromFlatFile(file: string): Promise<Rule | null> {
    const filePath = path.join(this.rulesPath, file);
    const id = path.basename(file, '.md');
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = this.extractTitle(content);
      const body = content.replace(/^# .+\n+/, '').trim();
      const tags = this.extractTags(body);
      const category = this.extractCategoryFromFilename(id);

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

  private extractCategoryFromFilename(filename: string): string {
    // Extract category from filename prefix (e.g., "api-use-dto" -> "api")
    const prefix = filename.split('-')[0];
    
    const categoryMap: Record<string, string> = {
      'api': 'api',
      'arch': 'architecture',
      'clean': 'clean-architecture',
      'cqrs': 'cqrs',
      'db': 'database',
      'dependency': 'dependency-injection',
      'dev': 'development',
      'di': 'dependency-injection',
      'error': 'error-handling',
      'git': 'git',
      'hex': 'hexagonal',
      'micro': 'microservices',
      'perf': 'performance',
      'qwen': 'qwen',
      'security': 'security',
      'test': 'testing',
      'type': 'typescript',
    };

    return categoryMap[prefix] || 'general';
  }

  private hasCategorySubdirectories(): boolean {
    if (!fs.existsSync(this.rulesPath)) {
      return false;
    }
    const items = fs.readdirSync(this.rulesPath);
    return items.some((item) => {
      const itemPath = path.join(this.rulesPath, item);
      return fs.statSync(itemPath).isDirectory();
    });
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
