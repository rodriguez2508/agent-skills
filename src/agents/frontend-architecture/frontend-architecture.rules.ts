/**
 * Frontend Architecture Rules
 *
 * Reglas para validar arquitectura frontend Angular con Clean Architecture + CQRS
 *
 * @see ARCHITECTURE.md - Documentación de arquitectura frontend
 */

export interface ArchitectureRule {
  id: string;
  name: string;
  description: string;
  category: 'structure' | 'naming' | 'pattern' | 'convention';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  patterns: string[];
  validators?: RuleValidator[];
  errorMessage: string;
  successMessage: string;
}

export interface RuleValidator {
  type: 'required' | 'forbidden' | 'pattern' | 'count';
  regex?: RegExp;
  min?: number;
  max?: number;
  message: string;
}

/**
 * Reglas de estructura de features
 */
export const FEATURE_STRUCTURE_RULES: ArchitectureRule[] = [
  {
    id: 'feat-001',
    name: 'Feature Required Directories',
    description: 'Cada feature debe tener context/ y views/',
    category: 'structure',
    severity: 'ERROR',
    patterns: ['context', 'views'],
    errorMessage: 'Feature missing required directories (context/, views/)',
    successMessage: 'Feature has all required directories',
  },
  {
    id: 'feat-002',
    name: 'Feature Routes File',
    description: 'Cada feature debe tener un archivo de rutas',
    category: 'structure',
    severity: 'ERROR',
    patterns: ['*.routes.ts'],
    errorMessage: 'Feature missing routes file (*.routes.ts)',
    successMessage: 'Feature has routes file',
  },
];

/**
 * Reglas de estructura de context (Clean Architecture + CQRS)
 */
export const CONTEXT_STRUCTURE_RULES: ArchitectureRule[] = [
  {
    id: 'ctx-001',
    name: 'Domain Layer',
    description: 'context/ debe tener domain/ con entities/ y repositories/',
    category: 'structure',
    severity: 'ERROR',
    patterns: ['domain/entities', 'domain/repositories'],
    errorMessage: 'context/ missing domain layer (entities/, repositories/)',
    successMessage: 'Domain layer correctly structured',
  },
  {
    id: 'ctx-002',
    name: 'Application Layer (CQRS)',
    description: 'context/ debe tener application/ con commands/ y queries/',
    category: 'structure',
    severity: 'ERROR',
    patterns: [
      'application/commands',
      'application/queries',
      'application/facade.ts',
    ],
    errorMessage:
      'context/ missing application layer (commands/, queries/, facade.ts)',
    successMessage: 'Application layer correctly structured with CQRS',
  },
  {
    id: 'ctx-003',
    name: 'Infrastructure Layer',
    description:
      'context/ debe tener infrastructure/ con api/, state/, repositories/',
    category: 'structure',
    severity: 'ERROR',
    patterns: [
      'infrastructure/api',
      'infrastructure/state',
      'infrastructure/repositories',
    ],
    errorMessage:
      'context/ missing infrastructure layer (api/, state/, repositories/)',
    successMessage: 'Infrastructure layer correctly structured',
  },
];

/**
 * Reglas de naming conventions
 */
export const NAMING_CONVENTION_RULES: ArchitectureRule[] = [
  {
    id: 'name-001',
    name: 'Command Naming',
    description:
      'Commands deben seguir patrón: [Verb][Noun] (ej: CreateTravel)',
    category: 'naming',
    severity: 'WARNING',
    patterns: ['application/commands/**/*.command.ts'],
    validators: [
      {
        type: 'pattern',
        regex: /^[A-Z][a-zA-Z]*Command$/,
        message:
          'Command name should be [Verb][Noun]Command (e.g., CreateTravelCommand)',
      },
    ],
    errorMessage: 'Command naming convention violation',
    successMessage: 'Command follows naming convention',
  },
  {
    id: 'name-002',
    name: 'Query Naming',
    description:
      'Queries deben seguir patrón: Get[Noun] (ej: GetActiveTravels)',
    category: 'naming',
    severity: 'WARNING',
    patterns: ['application/queries/**/*.query.ts'],
    validators: [
      {
        type: 'pattern',
        regex: /^Get[A-Z][a-zA-Z]*Query$/,
        message:
          'Query name should be Get[Noun]Query (e.g., GetActiveTravelsQuery)',
      },
    ],
    errorMessage: 'Query naming convention violation',
    successMessage: 'Query follows naming convention',
  },
  {
    id: 'name-003',
    name: 'Store Naming',
    description: 'Stores deben ser en plural (ej: TravelsStore, UsersStore)',
    category: 'naming',
    severity: 'WARNING',
    patterns: ['infrastructure/state/*.store.ts'],
    validators: [
      {
        type: 'pattern',
        regex: /^[A-Z][a-zA-Z]*sStore$/,
        message:
          'Store name should be plural (e.g., TravelsStore, not TravelStore)',
      },
    ],
    errorMessage: 'Store naming convention violation',
    successMessage: 'Store follows naming convention',
  },
  {
    id: 'name-004',
    name: 'Facade Naming',
    description: 'Facade debe llamarse [Feature]Facade (ej: TravelerFacade)',
    category: 'naming',
    severity: 'WARNING',
    patterns: ['application/facade.ts'],
    validators: [
      {
        type: 'pattern',
        regex: /^[A-Z][a-zA-Z]*Facade$/,
        message: 'Facade name should be [Feature]Facade (e.g., TravelerFacade)',
      },
    ],
    errorMessage: 'Facade naming convention violation',
    successMessage: 'Facade follows naming convention',
  },
];

/**
 * Reglas de patrones arquitectónicos
 */
export const ARCHITECTURE_PATTERN_RULES: ArchitectureRule[] = [
  {
    id: 'pattern-001',
    name: 'No God Stores',
    description: 'Stores no deben tener más de 5 señales no relacionadas',
    category: 'pattern',
    severity: 'ERROR',
    patterns: ['*.store.ts'],
    validators: [
      {
        type: 'count',
        max: 5,
        message:
          'Store has too many signals (>5). Consider splitting into smaller stores.',
      },
    ],
    errorMessage: 'God Store detected - consider splitting into smaller stores',
    successMessage: 'Store has appropriate granularity',
  },
  {
    id: 'pattern-002',
    name: 'Facade as Single Entry Point',
    description:
      'Componentes de vistas solo inyectan Facade, NO Stores directamente',
    category: 'pattern',
    severity: 'ERROR',
    patterns: ['views/**/*.component.ts'],
    validators: [
      {
        type: 'forbidden',
        regex: /inject\(\w+Store\)/,
        message: 'Direct Store injection found. Use Facade instead.',
      },
      {
        type: 'required',
        regex: /inject\(\w+Facade\)/,
        message: 'Component should inject Facade as entry point',
      },
    ],
    errorMessage: 'Component violates Facade pattern',
    successMessage: 'Component correctly uses Facade pattern',
  },
  {
    id: 'pattern-003',
    name: 'Sockets Outside Store',
    description:
      'Lógica de sockets debe estar fuera del Store (en infrastructure/socket/)',
    category: 'pattern',
    severity: 'ERROR',
    patterns: ['infrastructure/state/*.store.ts'],
    validators: [
      {
        type: 'forbidden',
        regex: /(socket\.|WebSocket|fromEventPattern.*socket|\.listen\()/i,
        message: 'Socket logic found in Store. Move to infrastructure/socket/',
      },
    ],
    errorMessage: 'Socket logic should not be in Store',
    successMessage: 'Store is free of socket logic',
  },
  {
    id: 'pattern-004',
    name: 'Standalone Components',
    description: 'Todos los componentes deben ser standalone con OnPush',
    category: 'pattern',
    severity: 'ERROR',
    patterns: ['**/*.component.ts'],
    validators: [
      {
        type: 'required',
        regex: /standalone:\s*true/,
        message: 'Component is not standalone',
      },
      {
        type: 'required',
        regex: /ChangeDetectionStrategy\.OnPush/,
        message: 'Component does not use OnPush change detection',
      },
    ],
    errorMessage: 'Component does not follow standalone + OnPush pattern',
    successMessage: 'Component follows standalone + OnPush pattern',
  },
  {
    id: 'pattern-005',
    name: 'No Direct HTTP in Components',
    description: 'Componentes no deben hacer llamadas HTTP directamente',
    category: 'pattern',
    severity: 'ERROR',
    patterns: ['views/**/*.component.ts'],
    validators: [
      {
        type: 'forbidden',
        regex: /(HttpClient|\.get\(|\.post\(|\.put\(|\.delete\()/,
        message:
          'Direct HTTP call in component. Use Facade → Command → API service instead.',
      },
    ],
    errorMessage: 'Component should not make direct HTTP calls',
    successMessage: 'Component does not make direct HTTP calls',
  },
];

/**
 * Reglas de organización de shared
 */
export const SHARED_ORGANIZATION_RULES: ArchitectureRule[] = [
  {
    id: 'shared-001',
    name: 'Global Shared Categories',
    description: 'Shared global debe estar organizado por categorías',
    category: 'convention',
    severity: 'WARNING',
    patterns: ['shared/components/{navigation,cards,info,dialogs,layouts}'],
    errorMessage: 'Shared components should be organized by category',
    successMessage: 'Shared components are properly categorized',
  },
  {
    id: 'shared-002',
    name: 'Feature-Specific Shared',
    description:
      'Componentes específicos de feature deben estar en feature/shared/',
    category: 'convention',
    severity: 'INFO',
    patterns: ['features/*/shared/components'],
    errorMessage: 'Feature-specific components should be in feature/shared/',
    successMessage: 'Feature-specific components are properly located',
  },
];

/**
 * Todas las reglas exportadas
 */
export const ALL_ARCHITECTURE_RULES: ArchitectureRule[] = [
  ...FEATURE_STRUCTURE_RULES,
  ...CONTEXT_STRUCTURE_RULES,
  ...NAMING_CONVENTION_RULES,
  ...ARCHITECTURE_PATTERN_RULES,
  ...SHARED_ORGANIZATION_RULES,
];

/**
 * Reglas críticas (ERROR severity)
 */
export const CRITICAL_RULES = ALL_ARCHITECTURE_RULES.filter(
  (r) => r.severity === 'ERROR',
);

/**
 * Reglas recomendadas (WARNING severity)
 */
export const RECOMMENDED_RULES = ALL_ARCHITECTURE_RULES.filter(
  (r) => r.severity === 'WARNING',
);
