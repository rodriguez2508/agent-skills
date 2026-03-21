import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface Rule {
  id: string;
  title: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactDescription?: string;
  tags: string[];
  content: string;
  category: string;
}

/**
 * RulesEngine - Carga y aplica reglas de código
 * Verifica reglas antes de generar respuestas
 */
@Injectable()
export class RulesEngine implements OnModuleInit {
  private readonly logger = new Logger(RulesEngine.name);
  private readonly rulesPath: string;
  private rules: Map<string, Rule> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.rulesPath = this.configService.get<string>('RULES_PATH', './src/rules');
  }

  async onModuleInit() {
    await this.loadRules();
    this.logger.log(`✅ RulesEngine initialized with ${this.rules.size} rules`);
  }

  /**
   * Carga todas las reglas desde archivos .md
   */
  async loadRules(): Promise<void> {
    const rulesDir = path.join(process.cwd(), this.rulesPath);

    if (!fs.existsSync(rulesDir)) {
      this.logger.warn(`Rules directory not found: ${rulesDir}`);
      return;
    }

    const files = fs.readdirSync(rulesDir).filter((file) => file.endsWith('.md') && !file.startsWith('_'));

    for (const file of files) {
      const filePath = path.join(rulesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const rule = this.parseRuleFile(file, content);

      if (rule) {
        this.rules.set(rule.id, rule);
        this.logger.debug(`📄 Loaded rule: ${rule.title}`);
      }
    }

    this.logger.log(`📚 Loaded ${this.rules.size} rules from ${rulesDir}`);
  }

  /**
   * Obtiene reglas relevantes para un contexto dado
   */
  getRelevantRules(context: string, limit: number = 5): Rule[] {
    const relevantRules: Rule[] = [];
    const contextLower = context.toLowerCase();

    for (const rule of this.rules.values()) {
      const titleMatch = rule.title.toLowerCase().includes(contextLower);
      const contentMatch = rule.content.toLowerCase().includes(contextLower);
      const tagsMatch = rule.tags.some((tag) => tag.toLowerCase().includes(contextLower));

      if (titleMatch || contentMatch || tagsMatch) {
        relevantRules.push(rule);
      }

      if (relevantRules.length >= limit) {
        break;
      }
    }

    return relevantRules;
  }

  /**
   * Obtiene una regla por ID
   */
  getRuleById(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Obtiene todas las reglas
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Obtiene reglas por categoría
   */
  getRulesByCategory(category: string): Rule[] {
    return this.getAllRules().filter((rule) => rule.category === category);
  }

  /**
   * Formatea una respuesta aplicando reglas
   */
  formatResponseWithRules(response: string, context?: string): string {
    const relevantRules = context ? this.getRelevantRules(context) : [];

    if (relevantRules.length === 0) {
      return response;
    }

    const rulesSection = '\n\n📋 **Relevant Rules Applied:**\n' +
      relevantRules.map((rule) => `- ${rule.title} (${rule.impact})`).join('\n');

    return response + rulesSection;
  }

  /**
   * Parsea un archivo de regla
   */
  private parseRuleFile(filename: string, content: string): Rule | null {
    try {
      // Extraer metadata del frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        return null;
      }

      const frontmatter = frontmatterMatch[1];
      const titleMatch = frontmatter.match(/title:\s*(.+)/);
      const impactMatch = frontmatter.match(/impact:\s*(.+)/);
      const impactDescMatch = frontmatter.match(/impactDescription:\s*["']?(.+?)["']?/);
      const tagsMatch = frontmatter.match(/tags:\s*(.+)/);

      const id = path.basename(filename, '.md');
      const category = this.extractCategory(filename);

      return {
        id,
        title: titleMatch ? titleMatch[1].trim() : id,
        impact: (impactMatch ? impactMatch[1].trim() : 'MEDIUM') as Rule['impact'],
        impactDescription: impactDescMatch ? impactDescMatch[1].trim() : undefined,
        tags: tagsMatch ? tagsMatch[1].split(',').map((t: string) => t.trim()) : [],
        content: content.replace(frontmatterMatch[0], '').trim(),
        category,
      };
    } catch (error) {
      this.logger.error(`Failed to parse rule file: ${filename}`, error);
      return null;
    }
  }

  /**
   * Extrae la categoría del nombre del archivo
   */
  private extractCategory(filename: string): string {
    const prefix = filename.split('-')[0];

    const categoryMap: Record<string, string> = {
      'api': 'api',
      'arch': 'architecture',
      'clean': 'clean-architecture',
      'cqrs': 'cqrs',
      'db': 'database',
      'error': 'error-handling',
      'naming': 'naming',
      'security': 'security',
      'testing': 'testing',
      'validation': 'validation',
    };

    return categoryMap[prefix] || 'general';
  }
}
