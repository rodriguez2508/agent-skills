import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ArchitectureRule, RuleValidator } from './frontend-architecture.rules';

export interface ValidationResult {
  rule: ArchitectureRule;
  passed: boolean;
  file?: string;
  message: string;
  details?: string[];
}

export interface FeatureValidationResult {
  feature: string;
  featurePath: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  results: ValidationResult[];
}

/**
 * Servicio de validación de arquitectura frontend
 *
 * Valida que un proyecto Angular cumpla con las reglas de arquitectura
 */
@Injectable()
export class FrontendValidationService {
  private readonly logger = new Logger(FrontendValidationService.name);

  /**
   * Valida la estructura de un feature
   */
  async validateFeature(featurePath: string): Promise<FeatureValidationResult> {
    const feature = path.basename(featurePath);
    const result: FeatureValidationResult = {
      feature,
      featurePath,
      passed: true,
      errors: [],
      warnings: [],
      results: [],
    };

    // Validar directorios requeridos
    const requiredDirs = ['context', 'views'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(featurePath, dir);
      const exists = await this.directoryExists(dirPath);

      if (!exists) {
        result.passed = false;
        result.errors.push(`❌ Missing required directory: ${dir}/`);
        result.results.push({
          rule: {
            id: 'feat-001',
            name: 'Feature Required Directories',
            description: '',
            category: 'structure',
            severity: 'ERROR',
            patterns: [],
            errorMessage: '',
            successMessage: '',
          },
          passed: false,
          message: `Missing directory: ${dir}/`,
        });
      } else {
        result.results.push({
          rule: {
            id: 'feat-001',
            name: 'Feature Required Directories',
            description: '',
            category: 'structure',
            severity: 'ERROR',
            patterns: [],
            errorMessage: '',
            successMessage: '',
          },
          passed: true,
          message: `Directory exists: ${dir}/`,
        });
      }
    }

    // Validar archivo de rutas
    const routesFile = path.join(featurePath, `${feature}.routes.ts`);
    const routesExists = await this.fileExists(routesFile);

    if (!routesExists) {
      result.passed = false;
      result.errors.push(`❌ Missing routes file: ${feature}.routes.ts`);
    } else {
      result.results.push({
        rule: {
          id: 'feat-002',
          name: 'Feature Routes File',
          description: '',
          category: 'structure',
          severity: 'ERROR',
          patterns: [],
          errorMessage: '',
          successMessage: '',
        },
        passed: true,
        message: `Routes file exists: ${feature}.routes.ts`,
      });
    }

    // Validar estructura de context
    const contextPath = path.join(featurePath, 'context');
    if (await this.directoryExists(contextPath)) {
      const contextResults = await this.validateContextStructure(contextPath);
      result.results.push(...contextResults);

      const contextErrors = contextResults.filter(
        (r) => !r.passed && r.rule.severity === 'ERROR',
      );
      if (contextErrors.length > 0) {
        result.passed = false;
        result.errors.push(...contextErrors.map((e) => e.message));
      }
    }

    // Validar reglas en archivos
    const fileResults = await this.validateFiles(featurePath);
    result.results.push(...fileResults);

    const fileErrors = fileResults.filter(
      (r) => !r.passed && r.rule.severity === 'ERROR',
    );
    const fileWarnings = fileResults.filter(
      (r) => !r.passed && r.rule.severity === 'WARNING',
    );

    if (fileErrors.length > 0) {
      result.passed = false;
      result.errors.push(
        ...fileErrors.map((e) => `${e.message} in ${e.file || 'unknown'}`),
      );
    }

    if (fileWarnings.length > 0) {
      result.warnings.push(
        ...fileWarnings.map((w) => `${w.message} in ${w.file || 'unknown'}`),
      );
    }

    return result;
  }

  /**
   * Valida la estructura del context (Clean Architecture + CQRS)
   */
  private async validateContextStructure(
    contextPath: string,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Domain layer
    const domainEntities = await this.directoryExists(
      path.join(contextPath, 'domain/entities'),
    );
    const domainRepos = await this.directoryExists(
      path.join(contextPath, 'domain/repositories'),
    );

    results.push({
      rule: {
        id: 'ctx-001',
        name: 'Domain Layer',
        description: '',
        category: 'structure',
        severity: 'ERROR',
        patterns: [],
        errorMessage: '',
        successMessage: '',
      },
      passed: domainEntities && domainRepos,
      message:
        domainEntities && domainRepos
          ? 'Domain layer correctly structured'
          : 'Missing domain/entities/ or domain/repositories/',
    });

    // Application layer
    const appCommands = await this.directoryExists(
      path.join(contextPath, 'application/commands'),
    );
    const appQueries = await this.directoryExists(
      path.join(contextPath, 'application/queries'),
    );
    const appFacade = await this.fileExists(
      path.join(contextPath, 'application/facade.ts'),
    );

    results.push({
      rule: {
        id: 'ctx-002',
        name: 'Application Layer (CQRS)',
        description: '',
        category: 'structure',
        severity: 'ERROR',
        patterns: [],
        errorMessage: '',
        successMessage: '',
      },
      passed: appCommands && appQueries && appFacade,
      message:
        appCommands && appQueries && appFacade
          ? 'Application layer correctly structured with CQRS'
          : 'Missing application/commands/, application/queries/, or application/facade.ts',
    });

    // Infrastructure layer
    const infraApi = await this.directoryExists(
      path.join(contextPath, 'infrastructure/api'),
    );
    const infraState = await this.directoryExists(
      path.join(contextPath, 'infrastructure/state'),
    );
    const infraRepos = await this.directoryExists(
      path.join(contextPath, 'infrastructure/repositories'),
    );

    results.push({
      rule: {
        id: 'ctx-003',
        name: 'Infrastructure Layer',
        description: '',
        category: 'structure',
        severity: 'ERROR',
        patterns: [],
        errorMessage: '',
        successMessage: '',
      },
      passed: infraApi && infraState && infraRepos,
      message:
        infraApi && infraState && infraRepos
          ? 'Infrastructure layer correctly structured'
          : 'Missing infrastructure/api/, infrastructure/state/, or infrastructure/repositories/',
    });

    return results;
  }

  /**
   * Valida reglas en archivos específicos
   */
  private async validateFiles(
    featurePath: string,
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Buscar todos los archivos TypeScript
    const tsFiles = await this.findFiles(featurePath, '.ts');

    for (const file of tsFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(featurePath, file);

      // Validar stores (No God Stores)
      if (relativePath.includes('.store.ts')) {
        const signalCount = (content.match(/signal</g) || []).length;

        if (signalCount > 5) {
          results.push({
            rule: {
              id: 'pattern-001',
              name: 'No God Stores',
              description: '',
              category: 'pattern',
              severity: 'ERROR',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: `God Store detected: ${signalCount} signals found (>5)`,
          });
        }

        // Validar que no haya lógica de sockets en stores
        const hasSocketLogic =
          /(socket\.|WebSocket|fromEventPattern.*socket|\.listen\()/i.test(
            content,
          );
        if (hasSocketLogic) {
          results.push({
            rule: {
              id: 'pattern-003',
              name: 'Sockets Outside Store',
              description: '',
              category: 'pattern',
              severity: 'ERROR',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message:
              'Socket logic found in Store. Move to infrastructure/socket/',
          });
        }
      }

      // Validar componentes de vistas
      if (
        relativePath.includes('views/') &&
        relativePath.endsWith('.component.ts')
      ) {
        // Validar standalone + OnPush
        const isStandalone = /standalone:\s*true/.test(content);
        const isOnPush = /ChangeDetectionStrategy\.OnPush/.test(content);

        if (!isStandalone || !isOnPush) {
          results.push({
            rule: {
              id: 'pattern-004',
              name: 'Standalone Components',
              description: '',
              category: 'pattern',
              severity: 'ERROR',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: `Component must be standalone + OnPush. standalone: ${isStandalone}, OnPush: ${isOnPush}`,
          });
        }

        // Validar que no inyecte Stores directamente
        const injectsStore = /inject\(\w+Store\)/.test(content);
        if (injectsStore) {
          results.push({
            rule: {
              id: 'pattern-002',
              name: 'Facade as Single Entry Point',
              description: '',
              category: 'pattern',
              severity: 'ERROR',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: 'Direct Store injection found. Use Facade instead.',
          });
        }

        // Validar que no haga llamadas HTTP directas
        const hasDirectHttp =
          /(HttpClient|\.get\(|\.post\(|\.put\(|\.delete\()/.test(content);
        if (hasDirectHttp) {
          results.push({
            rule: {
              id: 'pattern-005',
              name: 'No Direct HTTP in Components',
              description: '',
              category: 'pattern',
              severity: 'ERROR',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message:
              'Direct HTTP call in component. Use Facade → Command → API service instead.',
          });
        }
      }

      // Validar naming conventions
      const fileName = path.basename(file, '.ts');

      if (
        relativePath.includes('commands/') &&
        relativePath.endsWith('.command.ts')
      ) {
        const isValidName = /^[A-Z][a-zA-Z]*Command$/.test(fileName);
        if (!isValidName) {
          results.push({
            rule: {
              id: 'name-001',
              name: 'Command Naming',
              description: '',
              category: 'naming',
              severity: 'WARNING',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: `Command should be [Verb][Noun]Command, got: ${fileName}`,
          });
        }
      }

      if (
        relativePath.includes('queries/') &&
        relativePath.endsWith('.query.ts')
      ) {
        const isValidName = /^Get[A-Z][a-zA-Z]*Query$/.test(fileName);
        if (!isValidName) {
          results.push({
            rule: {
              id: 'name-002',
              name: 'Query Naming',
              description: '',
              category: 'naming',
              severity: 'WARNING',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: `Query should be Get[Noun]Query, got: ${fileName}`,
          });
        }
      }

      if (relativePath.includes('.store.ts')) {
        const isValidName = /^[A-Z][a-zA-Z]*sStore$/.test(fileName);
        if (!isValidName) {
          results.push({
            rule: {
              id: 'name-003',
              name: 'Store Naming',
              description: '',
              category: 'naming',
              severity: 'WARNING',
              patterns: [],
              errorMessage: '',
              successMessage: '',
            },
            passed: false,
            file: relativePath,
            message: `Store should be plural (e.g., TravelsStore), got: ${fileName}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Busca archivos recursivamente
   */
  private async findFiles(dir: string, extension: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules'
        ) {
          const subFiles = await this.findFiles(fullPath, extension);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Error reading directory ${dir}: ${error.message}`);
    }

    return files;
  }

  /**
   * Verifica si un directorio existe
   */
  private async directoryExists(dir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Verifica si un archivo existe
   */
  private async fileExists(file: string): Promise<boolean> {
    try {
      const stat = await fs.stat(file);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Valida un proyecto Angular completo
   */
  async validateAngularProject(projectPath: string): Promise<{
    passed: boolean;
    features: FeatureValidationResult[];
    summary: {
      totalFeatures: number;
      passedFeatures: number;
      totalErrors: number;
      totalWarnings: number;
    };
  }> {
    const featuresPath = path.join(projectPath, 'src/app/features');
    const features: FeatureValidationResult[] = [];

    // Verificar si existe el directorio de features
    if (!(await this.directoryExists(featuresPath))) {
      this.logger.warn(`Features directory not found: ${featuresPath}`);
      return {
        passed: false,
        features: [],
        summary: {
          totalFeatures: 0,
          passedFeatures: 0,
          totalErrors: 1,
          totalWarnings: 0,
        },
      };
    }

    // Obtener todos los features
    const featureDirs = await fs.readdir(featuresPath);

    for (const feature of featureDirs) {
      const featurePath = path.join(featuresPath, feature);
      const stat = await fs.stat(featurePath);

      if (stat.isDirectory()) {
        const result = await this.validateFeature(featurePath);
        features.push(result);
      }
    }

    const passedFeatures = features.filter((f) => f.passed).length;
    const totalErrors = features.reduce((sum, f) => sum + f.errors.length, 0);
    const totalWarnings = features.reduce(
      (sum, f) => sum + f.warnings.length,
      0,
    );

    return {
      passed: totalErrors === 0,
      features,
      summary: {
        totalFeatures: features.length,
        passedFeatures,
        totalErrors,
        totalWarnings,
      },
    };
  }
}
