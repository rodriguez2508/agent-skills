import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SkillFileService } from './skill-file.service';

interface TaskEvent {
  task: string;
  agentId: string;
  success: boolean;
  patterns?: string[];
  corrections?: string[];
  timestamp: string;
}

/**
 * Hermes-style Learning Loop Service
 *
 * Analyzes completed tasks and autonomously creates or patches skills
 * based on successful patterns, user corrections, and recurring workflows.
 *
 * Mirrors Hermes Agent's learning loop:
 * 1. Scan recent activity → 2. Identify patterns → 3. Create/patch skills
 */
@Injectable()
export class SkillLearningService {
  private readonly logger = new Logger(SkillLearningService.name);
  private recentEvents: TaskEvent[] = [];
  private readonly MAX_EVENTS = 100;
  private readonly MIN_PATTERNS_FOR_SKILL = 2;

  constructor(private readonly skillFileService: SkillFileService) {}

  /**
   * Records a task completion event for analysis.
   * Called by RouterAgent after each agent execution.
   */
  recordTask(event: TaskEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.MAX_EVENTS) {
      this.recentEvents.shift();
    }

    // Auto-trigger learning if task was successful with patterns
    if (event.success && event.patterns && event.patterns.length >= this.MIN_PATTERNS_FOR_SKILL) {
      this.learnFromEvent(event).catch((err) =>
        this.logger.warn(`Learning from event failed: ${err.message}`),
      );
    }
  }

  /**
   * Periodic learning loop — runs every hour.
   * Scans recent events for recurring patterns.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async periodicLearningLoop(): Promise<void> {
    const recent = [...this.recentEvents];
    if (recent.length < 5) return;

    this.logger.log(`🔄 Learning Loop: Analyzing ${recent.length} recent events...`);

    try {
      // Group by agent
      const byAgent = this.groupBy(recent, 'agentId');

      for (const [agentId, events] of Object.entries(byAgent)) {
        // Look for recurring patterns
        const patternCounts = this.countPatterns(events);

        for (const [pattern, count] of Object.entries(patternCounts)) {
          if (count >= this.MIN_PATTERNS_FOR_SKILL) {
            const skillName = this.patternToSkillName(pattern, agentId);
            const existingSkill = await this.skillFileService.getSkill(skillName);

            if (existingSkill) {
              // Patch existing skill with new pattern data
              await this.skillFileService.patchSkill(skillName, {
                sections: {
                  'Patrón Detectado': `Este patrón se ha detectado ${count} veces en sesiones recientes.\n\n**Frecuencia:** ${count} ocurrencias\n**Agente:** ${agentId}\n**Último evento:** ${events[events.length - 1].timestamp}`,
                },
                addTags: [agentId.toLowerCase(), 'auto-aprendido'],
              });
            } else {
              // Create new skill from recurring pattern
              const sampleEvent = events[0];
              await this.skillFileService.createSkill(
                skillName,
                `Auto-detectado: ${pattern}`,
                this.buildSkillBody(pattern, agentId, events),
                [agentId.toLowerCase(), 'auto-aprendido', 'learning-loop'],
                [agentId],
              );
              this.logger.log(`🧠 Auto-created skill from pattern: ${skillName}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Learning loop error: ${error.message}`);
    }
  }

  /**
   * Analyzes a single successful event for skill creation.
   */
  async learnFromEvent(event: TaskEvent): Promise<void> {
    const eventPatterns = event.patterns || [];
    const corrections = event.corrections || [];

    for (const pattern of eventPatterns) {
      const skillName = this.patternToSkillName(pattern, event.agentId);
      const existing = await this.skillFileService.getSkill(skillName);

      if (existing) {
        // Patch: add usage + new insights
        await this.skillFileService.recordUsage(skillName);
        if (corrections.length > 0) {
          await this.skillFileService.patchSkill(skillName, {
            sections: {
              'Correcciones Aprendidas': corrections.join('\n- '),
            },
            addTags: ['aprendido'],
          });
        }
      } else if (eventPatterns.length >= this.MIN_PATTERNS_FOR_SKILL) {
        // Create new skill
        await this.skillFileService.createSkill(
          skillName,
          `Auto-generado de: ${event.task.substring(0, 80)}`,
          this.buildSkillBody(event.task, event.agentId, [event]),
          [event.agentId.toLowerCase(), 'auto-generado'],
          [event.agentId],
        );
        this.logger.log(`🧠 Learning loop created skill: ${skillName}`);
      }
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────────

  private buildSkillBody(task: string, agentId: string, events: TaskEvent[]): string {
    const sections: string[] = [];

    sections.push(`## Descripción\n\nSkill auto-generado para el agente **${agentId}** basado en patrones de tareas exitosas.`);

    sections.push(`## Cuándo Usar\n\n- Cuando el usuario pida tareas similares a: "${task.substring(0, 100)}"\n- Cuando el agente ${agentId} esté procesando solicitudes de este tipo`);

    sections.push(`## Patrones Detectados\n\n${events.map((e) => `- ${e.task.substring(0, 120)}`).join('\n')}`);

    const corrections = events.flatMap((e) => e.corrections || []).filter(Boolean);
    if (corrections.length > 0) {
      sections.push(`## Correcciones Aprendidas\n\n${corrections.map((c) => `- ${c}`).join('\n')}`);
    }

    sections.push(`---\n*Generado automáticamente por el Learning Loop*\n*Eventos analizados: ${events.length}*`);

    return sections.join('\n\n');
  }

  private patternToSkillName(pattern: string, agentId: string): string {
    // Normalize: lowercase, replace spaces with hyphens, limit length
    const normalized = pattern
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .substring(0, 40);
    return `${agentId.toLowerCase()}-${normalized}`;
  }

  private countPatterns(events: TaskEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const event of events) {
      for (const pattern of event.patterns || []) {
        counts[pattern] = (counts[pattern] || 0) + 1;
      }
    }
    return counts;
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const k = String(item[key]);
        (acc[k] = acc[k] || []).push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }
}
