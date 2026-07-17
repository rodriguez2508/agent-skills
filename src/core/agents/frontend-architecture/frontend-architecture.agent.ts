import { Injectable } from '@nestjs/common';
import { BaseAgent } from '@core/agents/base.agent';
import { AgentRequest, AgentResponse } from '@core/agents/agent-response';
import { FrontendValidationService } from './frontend-validation.service';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

/**
 * FrontendArchitectureAgent
 *
 * Valida que un proyecto frontend Angular cumpla con:
 * - Clean Architecture (domain/application/infrastructure)
 * - CQRS (commands/queries/facade)
 * - Convenciones de nombres
 * - Patrones arquitectónicos (Facade, Stores granulares, etc.)
 * - Componentes standalone con OnPush
 */
@Injectable()
export class FrontendArchitectureAgent extends BaseAgent {
  constructor(
    private readonly validationService: FrontendValidationService,
    private readonly agentLogger: AgentLoggerService,
  ) {
    super(
      'FrontendArchitectureAgent',
      'Valida arquitectura frontend Angular (Clean Architecture + CQRS + convenciones)',
    );
  }

  protected async handle(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    this.agentLogger.info(
      this.agentId,
      '🏗️ [FrontendArch] Starting architecture validation',
      {
        input: request.input.substring(0, 100),
        projectPath: request.options?.projectPath,
      },
    );

    // Detectar path del proyecto
    const projectPath = request.options?.projectPath || process.cwd();

    try {
      // Validar proyecto Angular
      const validationResult =
        await this.validationService.validateAngularProject(projectPath);

      const executionTime = Date.now() - startTime;

      // Construir reporte
      const report = this.buildReport(validationResult);

      this.agentLogger.info(
        this.agentId,
        validationResult.passed
          ? '✅ Validation passed'
          : '❌ Validation failed',
        {
          totalFeatures: validationResult.summary.totalFeatures,
          passedFeatures: validationResult.summary.passedFeatures,
          errors: validationResult.summary.totalErrors,
          warnings: validationResult.summary.totalWarnings,
          executionTime,
        },
      );

      return {
        success: validationResult.passed,
        data: {
          message: report,
          validation: validationResult,
          passed: validationResult.passed,
          summary: validationResult.summary,
        },
        metadata: {
          agentId: this.agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.agentLogger.error(
        this.agentId,
        `Validation failed: ${error.message}`,
        {
          projectPath,
          stack: error.stack,
        },
      );

      return {
        success: false,
        error: error.message,
        data: {
          message: `❌ Error validating architecture: ${error.message}`,
        },
        metadata: {
          agentId: this.agentId,
          executionTime,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Construye reporte de validación
   */
  private buildReport(result: {
    passed: boolean;
    features: any[];
    summary: any;
  }): string {
    let report = `## 🏗️ Frontend Architecture Validation Report\n\n`;

    // Resumen
    report += `### 📊 Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Features | ${result.summary.totalFeatures} |\n`;
    report += `| ✅ Passed | ${result.summary.passedFeatures} |\n`;
    report += `| ❌ Failed | ${result.summary.totalFeatures - result.summary.passedFeatures} |\n`;
    report += `| 🔴 Errors | ${result.summary.totalErrors} |\n`;
    report += `| ⚠️ Warnings | ${result.summary.totalWarnings} |\n\n`;

    if (result.passed) {
      report += `✅ **All features passed architecture validation!**\n\n`;
    } else {
      report += `❌ **${result.summary.totalErrors} errors found. Please fix them to comply with architecture.**\n\n`;
    }

    // Detalles por feature
    report += `### 📁 Features Details\n\n`;

    for (const feature of result.features) {
      report += `#### ${feature.feature}\n\n`;

      if (feature.passed) {
        report += `✅ All checks passed\n\n`;
      } else {
        if (feature.errors.length > 0) {
          report += `**Errors:**\n`;
          for (const error of feature.errors) {
            report += `- ${error}\n`;
          }
          report += '\n';
        }

        if (feature.warnings.length > 0) {
          report += `**Warnings:**\n`;
          for (const warning of feature.warnings) {
            report += `- ${warning}\n`;
          }
          report += '\n';
        }
      }
    }

    // Recomendaciones
    if (result.summary.totalErrors > 0 || result.summary.totalWarnings > 0) {
      report += `### 💡 Recommendations\n\n`;

      if (result.summary.totalErrors > 0) {
        report += `1. **Fix all ERRORs first** - These violate architecture principles\n`;
        report += `2. **Review WARNINGs** - These are best practices that improve maintainability\n`;
        report += `3. **Run validation again** after making changes\n\n`;
      }

      report += `### 📚 Architecture References\n\n`;
      report += `- **Clean Architecture**: Separate domain, application, and infrastructure layers\n`;
      report += `- **CQRS**: Use commands for writes, queries for reads\n`;
      report += `- **Facade Pattern**: Views only interact with Facade, not Stores directly\n`;
      report += `- **Granular Stores**: One store per entity/type, avoid God Stores\n`;
      report += `- **Standalone Components**: All components should be standalone with OnPush\n`;
    }

    return report;
  }

  /**
   * Valida un feature específico
   */
  async validateFeature(featurePath: string): Promise<AgentResponse> {
    try {
      const result = await this.validationService.validateFeature(featurePath);

      return {
        success: result.passed,
        data: {
          message: this.buildFeatureReport(result),
          validation: result,
        },
        metadata: {
          agentId: this.agentId,
          executionTime: Date.now(),
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          agentId: this.agentId,
          executionTime: Date.now(),
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Reporte para un feature individual
   */
  private buildFeatureReport(result: any): string {
    let report = `## 📁 Feature: ${result.feature}\n\n`;

    if (result.passed) {
      report += `✅ **All architecture checks passed!**\n\n`;
    } else {
      report += `❌ **Found ${result.errors.length} errors and ${result.warnings.length} warnings**\n\n`;
    }

    if (result.errors.length > 0) {
      report += `### 🔴 Errors\n\n`;
      for (const error of result.errors) {
        report += `- ${error}\n`;
      }
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += `### ⚠️ Warnings\n\n`;
      for (const warning of result.warnings) {
        report += `- ${warning}\n`;
      }
      report += '\n';
    }

    return report;
  }
}
