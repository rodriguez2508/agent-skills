import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCatalog } from '@modules/agents/domain/entities/agent-catalog.entity';
import { AgentCategory } from '@modules/agents/domain/entities/agent-category.entity';

interface CategorySeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface AgentSeed {
  agentId: string;
  categorySlug: string;
  name: string;
  description: string;
  purpose: string;
  ruleCategories: string[];
  intentPatterns: string[];
  priority: number;
}

const CATEGORIES: CategorySeed[] = [
  { slug: 'backend',      name: 'Backend',       description: 'Desarrollo backend y API',                icon: '⚙️' },
  { slug: 'frontend',     name: 'Frontend',      description: 'Desarrollo de interfaces y Angular',      icon: '🖥️' },
  { slug: 'architecture', name: 'Arquitectura',  description: 'Diseño y validación de arquitectura',     icon: '🏗️' },
  { slug: 'management',   name: 'Gestión',       description: 'Product management e issues',             icon: '📋' },
  { slug: 'devops',       name: 'DevOps',         description: 'GitHub, CI/CD y despliegue',             icon: '🚀' },
  { slug: 'analysis',     name: 'Análisis',      description: 'Análisis de código e historial',          icon: '🔍' },
  { slug: 'knowledge',    name: 'Conocimiento',  description: 'Búsqueda de reglas y documentación',      icon: '📚' },
  { slug: 'general',      name: 'General',       description: 'Agentes de propósito general',            icon: '🤖' },
];

const AGENTS: AgentSeed[] = [
  {
    agentId: 'CodeAgent',
    categorySlug: 'backend',
    name: 'Code Agent',
    description: 'Genera e implementa código NestJS siguiendo arquitectura hexagonal',
    purpose: 'Crear, modificar y revisar código TypeScript/NestJS con patrones CQRS y clean architecture',
    ruleCategories: ['foundations', 'cqrs', 'architecture', 'backend'],
    intentPatterns: ['crear', 'generar', 'código', 'implementar', 'escribe', 'haz'],
    priority: 80,
  },
  {
    agentId: 'ArchitectureAgent',
    categorySlug: 'architecture',
    name: 'Architecture Agent',
    description: 'Valida y diseña arquitectura de sistemas',
    purpose: 'Analizar y proponer arquitecturas clean, hexagonal y CQRS para proyectos NestJS',
    ruleCategories: ['architecture', 'microservices', 'cqrs'],
    intentPatterns: ['arquitectura', 'architecture', 'estructura', 'patrón', 'clean', 'hexagonal'],
    priority: 75,
  },
  {
    agentId: 'FrontendArchitectureAgent',
    categorySlug: 'frontend',
    name: 'Frontend Architecture Agent',
    description: 'Valida arquitectura Angular y patrones frontend',
    purpose: 'Revisar estructura, módulos y patrones de proyectos Angular',
    ruleCategories: ['frontend'],
    intentPatterns: ['angular', 'frontend architecture', 'arquitectura angular', 'analiza el proyecto'],
    priority: 75,
  },
  {
    agentId: 'PMAgent',
    categorySlug: 'management',
    name: 'PM Agent',
    description: 'Crea issues, user stories y criterios de aceptación',
    purpose: 'Gestión de producto: crear issues GitHub, historias de usuario, PRDs y criterios de aceptación',
    ruleCategories: ['development'],
    intentPatterns: ['crear issue', 'historia de usuario', 'user story', 'criterios de aceptación', 'prd'],
    priority: 70,
  },
  {
    agentId: 'IssueWorkflowAgent',
    categorySlug: 'management',
    name: 'Issue Workflow Agent',
    description: 'Gestiona el workflow de 9 pasos de issues',
    purpose: 'Controlar el ciclo de vida de issues: READ → ANALYZE → PLAN → CODE → TEST → COMMIT → PUSH → PR',
    ruleCategories: ['development'],
    intentPatterns: ['issue', 'ticket', 'workflow', 'iniciar issue', 'continuar issue'],
    priority: 65,
  },
  {
    agentId: 'GitHubAgent',
    categorySlug: 'devops',
    name: 'GitHub Agent',
    description: 'Opera con GitHub: issues, PRs y repos',
    purpose: 'Leer y crear issues/PRs en GitHub, consultar repositorios y estado de CI/CD',
    ruleCategories: ['development'],
    intentPatterns: ['github', 'pull request', 'pr', 'repositorio', 'repo'],
    priority: 60,
  },
  {
    agentId: 'ProjectHistoryAgent',
    categorySlug: 'analysis',
    name: 'Project History Agent',
    description: 'Recupera historial de sesiones y decisiones del proyecto',
    purpose: 'Resumir el trabajo previo: issues trabajados, decisiones clave y módulos modificados',
    ruleCategories: ['analysis'],
    intentPatterns: ['historial del proyecto', 'dame el historial', 'qué se ha hecho', 'resumen del proyecto'],
    priority: 70,
  },
  {
    agentId: 'AnalysisAgent',
    categorySlug: 'analysis',
    name: 'Analysis Agent',
    description: 'Análisis general de código y calidad',
    purpose: 'Revisar y analizar código existente, detectar problemas y sugerir mejoras',
    ruleCategories: ['analysis', 'foundations', 'security'],
    intentPatterns: ['revisa', 'verifica', 'revisar', 'verificar', 'analiza'],
    priority: 55,
  },
  {
    agentId: 'SearchAgent',
    categorySlug: 'knowledge',
    name: 'Search Agent',
    description: 'Busca reglas de código relevantes por BM25',
    purpose: 'Encontrar reglas y patrones de código relevantes para una consulta',
    ruleCategories: [],
    intentPatterns: ['buscar', 'encuentra', 'search', 'mostrar reglas'],
    priority: 40,
  },
  {
    agentId: 'WebSearchAgent',
    categorySlug: 'knowledge',
    name: 'Web Search Agent',
    description: 'Busca información en internet usando Exa AI',
    purpose: 'Obtener información actualizada de la web sobre tecnologías, librerías y mejores prácticas',
    ruleCategories: [],
    intentPatterns: ['buscar en internet', 'busca en google', 'web search', 'qué es', 'información sobre'],
    priority: 40,
  },
  {
    agentId: 'Context7Agent',
    categorySlug: 'knowledge',
    name: 'Context7 Agent',
    description: 'Obtiene documentación oficial de librerías',
    purpose: 'Consultar documentación actualizada de cualquier librería o framework',
    ruleCategories: [],
    intentPatterns: ['documentación de', 'docs de', 'cómo usar', 'context7', 'library docs'],
    priority: 50,
  },
  {
    agentId: 'IdentityAgent',
    categorySlug: 'general',
    name: 'Identity Agent',
    description: 'Proporciona información sobre el sistema MCP',
    purpose: 'Responder preguntas sobre identidad, capacidades y configuración del sistema',
    ruleCategories: [],
    intentPatterns: ['quién eres', 'identidad', 'qué puedes hacer'],
    priority: 10,
  },
  {
    agentId: 'MetricsAgent',
    categorySlug: 'analysis',
    name: 'Metrics Agent',
    description: 'Muestra métricas y estadísticas de uso',
    purpose: 'Reportar estadísticas de sesiones, tokens consumidos y rendimiento del sistema',
    ruleCategories: [],
    intentPatterns: ['métricas', 'estadísticas', 'uso', 'rendimiento'],
    priority: 20,
  },
];

@Injectable()
export class AgentCatalogSeederService implements OnModuleInit {
  private readonly logger = new Logger(AgentCatalogSeederService.name);

  constructor(
    @InjectRepository(AgentCatalog)
    private readonly catalogRepo: Repository<AgentCatalog>,
    @InjectRepository(AgentCategory)
    private readonly categoryRepo: Repository<AgentCategory>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seed();
    } catch (e) {
      this.logger.warn(`Seeder skipped (table may not exist yet): ${e.message}`);
    }
  }

  private async seed(): Promise<void> {
    const categoryMap = await this.seedCategories();
    await this.seedAgents(categoryMap);
    this.logger.log(`✅ Agent catalog seeded: ${AGENTS.length} agents, ${CATEGORIES.length} categories`);
  }

  private async seedCategories(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const cat of CATEGORIES) {
      let entity = await this.categoryRepo.findOne({ where: { slug: cat.slug } });
      if (!entity) {
        entity = await this.categoryRepo.save(
          this.categoryRepo.create({ slug: cat.slug, name: cat.name, description: cat.description, icon: cat.icon }),
        );
        this.logger.debug(`  + category: ${cat.slug}`);
      }
      map.set(cat.slug, entity.id);
    }
    return map;
  }

  private async seedAgents(categoryMap: Map<string, string>): Promise<void> {
    for (const agent of AGENTS) {
      const existing = await this.catalogRepo.findOne({ where: { agentId: agent.agentId } });
      const categoryId = categoryMap.get(agent.categorySlug);

      if (!existing) {
        await this.catalogRepo.save(
          this.catalogRepo.create({
            agentId: agent.agentId,
            categoryId,
            name: agent.name,
            description: agent.description,
            purpose: agent.purpose,
            ruleCategories: agent.ruleCategories,
            intentPatterns: agent.intentPatterns,
            skillIds: [],
            priority: agent.priority,
            isActive: true,
          }),
        );
        this.logger.debug(`  + agent: ${agent.agentId}`);
      } else {
        // Actualiza purpose e intentPatterns si cambiaron, pero no sobreescribe config manual
        await this.catalogRepo.update(existing.id, {
          categoryId,
          purpose: agent.purpose,
          ruleCategories: agent.ruleCategories,
          intentPatterns: agent.intentPatterns,
          priority: agent.priority,
        });
      }
    }
  }
}
