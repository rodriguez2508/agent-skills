import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { Rule, RuleImpact } from '@core/domain/entities/rule.entity';
import {
  RULE_REPOSITORY,
  RuleRepository,
} from '@core/domain/ports/rule-repository.token';

@Injectable()
export class RuleFileRepository implements RuleRepository {
  private readonly logger = new Logger(RuleFileRepository.name);
  private readonly rulesPath: string;
  private cache: Map<string, Rule> = new Map();

  constructor(private readonly configService: ConfigService) {
    const rulesPathConfig = this.configService.get<string>(
      'RULES_PATH',
      './src/rules',
    );
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
      const files = fs
        .readdirSync(this.rulesPath)
        .filter((file) => file.endsWith('.md') && !file.startsWith('_'));
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
      // Nueva estructura jerárquica: buscar recursivamente en el directorio de categoría
      const categoryPath = path.join(this.rulesPath, category.toLowerCase());
      if (!fs.existsSync(categoryPath)) {
        return rules;
      }

      // Buscar recursivamente todos los archivos .md en el directorio y subdirectorios
      const files = this.findAllMdFiles(categoryPath);
      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const rule = await this.loadRuleFromPath(filePath, category);
        if (rule) {
          rules.push(rule);
        }
      }
    } else {
      // Flat structure - filter by category extracted from filename or content
      const files = fs
        .readdirSync(this.rulesPath)
        .filter((file) => file.endsWith('.md') && !file.startsWith('_'));
      for (const file of files) {
        const rule = await this.loadRuleFromFlatFile(file);
        if (rule && rule.category.toLowerCase() === category.toLowerCase()) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  /**
   * Encuentra recursivamente todos los archivos .md en un directorio
   */
  private findAllMdFiles(dirPath: string, relativePath: string = ''): string[] {
    const files: string[] = [];
    
    if (!fs.existsSync(dirPath)) {
      return files;
    }

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Ignorar directorios que empiezan con _
        if (item.startsWith('_')) continue;
        
        const subRelativePath = relativePath 
          ? path.join(relativePath, item) 
          : item;
        const subFiles = this.findAllMdFiles(itemPath, subRelativePath);
        files.push(...subFiles);
      } else if (item.endsWith('.md') && !item.startsWith('_')) {
        const relativeFilePath = relativePath 
          ? path.join(relativePath, item) 
          : item;
        files.push(relativeFilePath);
      }
    }

    return files;
  }

  /**
   * Carga una regla desde una ruta completa
   */
  private async loadRuleFromPath(filePath: string, category: string): Promise<Rule | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const id = path.basename(filePath, '.md');
      const name = this.extractTitle(content);
      const body = content.replace(/^# .+\n+/, '').trim();
      const tags = this.extractTags(content);
      const impact = this.extractImpact(content);
      const impactDescription = this.extractImpactDescription(content);

      return new Rule({
        id,
        name,
        content: body,
        category,
        tags,
        impact,
        impactDescription,
      });
    } catch {
      return null;
    }
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

    const filePath = path.join(this.rulesPath, rule.category, `${rule.id}.md`);
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
      const tags = this.extractTags(content);
      // Usar el directorio padre como categoría principal
      const category = this.extractCategoryFromPath(filePath);
      const impact = this.extractImpact(content);
      const impactDescription = this.extractImpactDescription(content);

      return new Rule({
        id,
        name,
        content: body,
        category,
        tags,
        impact,
      });
    } catch {
      return null;
    }
  }

  private extractImpact(content: string): RuleImpact {
    // Try frontmatter format first: impact: VALUE
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const impactMatch = frontmatter.match(/impact:\s*(.+)/i);
      if (impactMatch) {
        const impact = impactMatch[1].trim().toUpperCase();
        if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(impact)) {
          return impact as RuleImpact;
        }
      }
    }
    return RuleImpact.MEDIUM;
  }

  private extractImpactDescription(content: string): string | undefined {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descMatch = frontmatter.match(
        /impactDescription:\s*["']?(.+?)["']?/i,
      );
      if (descMatch) {
        return descMatch[1].trim();
      }
    }
    return undefined;
  }

  private extractCategoryFromFilename(filename: string): string {
    // First try frontmatter: category: value
    // Note: This needs to be passed from the content, so we'll handle it in the caller

    // Extract category from filename prefix (e.g., "api-use-dto" -> "api")
    const prefix = filename.split('-')[0];

    const categoryMap: Record<string, string> = {
      api: 'api',
      arch: 'architecture',
      clean: 'clean-architecture',
      cqrs: 'cqrs',
      db: 'database',
      dependency: 'dependency-injection',
      dev: 'development',
      di: 'dependency-injection',
      error: 'error-handling',
      git: 'git',
      hex: 'hexagonal',
      micro: 'microservices',
      perf: 'performance',
      qwen: 'qwen',
      security: 'security',
      test: 'testing',
      type: 'typescript',
    };

    return categoryMap[prefix] || 'general';
  }

  /**
   * Extrae la categoría desde la ruta del archivo (para estructura jerárquica)
   * Ejemplos:
   * - foundations/type-checking.md -> foundations
   * - architecture/clean-architecture/clean-layers.md -> architecture
   * - cqrs/core/cqrs-commands.md -> cqrs
   */
  private extractCategoryFromPath(filePath: string): string {
    // Obtener el directorio relativo desde rulesPath
    const relativePath = path.relative(this.rulesPath, filePath);
    const parts = relativePath.split(path.sep);
    
    // El primer elemento es la categoría principal
    const mainCategory = parts[0];
    
    // Mapeo de categorías principales a nombres amigables
    const categoryMap: Record<string, string> = {
      foundations: 'foundations',
      architecture: 'architecture',
      cqrs: 'cqrs',
      api: 'api',
      data: 'data',
      performance: 'performance',
      security: 'security',
      testing: 'testing',
      operations: 'operations',
      microservices: 'microservices',
      development: 'development',
      organization: 'organization',
    };
    
    return categoryMap[mainCategory] || mainCategory;
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
      const tags = this.extractTags(content);
      const impact = this.extractImpact(content);
      const impactDescription = this.extractImpactDescription(content);

      return new Rule({
        id,
        name,
        content: body,
        category,
        tags,
        impact,
        impactDescription,
      });
    } catch {
      return null;
    }
  }

  private extractTitle(content: string): string {
    // First try frontmatter: title: value
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const titleMatch = frontmatter.match(/title:\s*(.+)/i);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
    }

    // Then try markdown heading: # Title
    const match = content.match(/^# (.+)$/m);
    return match ? match[1].trim() : 'Untitled Rule';
  }

  private extractTags(content: string): string[] {
    // Try frontmatter format first: tags: value1, value2, value3
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const tagsMatch = frontmatter.match(/tags:\s*(.+)/i);
      if (tagsMatch) {
        return tagsMatch[1].split(',').map((t: string) => t.trim());
      }
    }

    // Try bracket format: tags: [value1, value2]
    const bracketMatch = content.match(/tags:\s*\[(.+)\]/i);
    if (bracketMatch) {
      return bracketMatch[1].split(',').map((tag) => tag.trim());
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
