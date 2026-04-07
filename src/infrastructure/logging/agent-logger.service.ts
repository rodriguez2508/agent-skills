import { Injectable, LoggerService } from '@nestjs/common';

/**
 * Niveles de log para agentes
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Entrada de log de agente
 */
export interface AgentLogEntry {
  timestamp: Date;
  level: LogLevel;
  agentId: string;
  message: string;
  context?: Record<string, any>;
}

/**
 * Servicio de logging especializado para agentes
 * Centraliza y formatea los logs de todos los agentes
 */
@Injectable()
export class AgentLoggerService {
  private readonly logs: AgentLogEntry[] = [];
  private readonly maxLogs = 1000;

  /**
   * Registra un log de agente
   */
  log(
    agentId: string,
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
  ): void {
    const entry: AgentLogEntry = {
      timestamp: new Date(),
      level,
      agentId,
      message,
      context,
    };

    this.logs.push(entry);

    // Limitar cantidad de logs en memoria
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Imprimir log formateado
    this.printLog(entry);
  }

  /**
   * Log de nivel DEBUG
   */
  debug(agentId: string, message: string, context?: Record<string, any>): void {
    this.log(agentId, LogLevel.DEBUG, message, context);
  }

  /**
   * Log de nivel INFO
   */
  info(agentId: string, message: string, context?: Record<string, any>): void {
    this.log(agentId, LogLevel.INFO, message, context);
  }

  /**
   * Log de nivel WARN
   */
  warn(agentId: string, message: string, context?: Record<string, any>): void {
    this.log(agentId, LogLevel.WARN, message, context);
  }

  /**
   * Log de nivel ERROR
   */
  error(agentId: string, message: string, context?: Record<string, any>): void {
    this.log(agentId, LogLevel.ERROR, message, context);
  }

  /**
   * Obtiene todos los logs de un agente específico
   */
  getLogsByAgent(agentId: string): AgentLogEntry[] {
    return this.logs.filter((log) => log.agentId === agentId);
  }

  /**
   * Obtiene logs por nivel
   */
  getLogsByLevel(level: LogLevel): AgentLogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Obtiene los últimos N logs
   */
  getRecentLogs(count: number = 100): AgentLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Obtiene estadísticas de logs por agente
   */
  getAgentStats(): Record<
    string,
    { total: number; errors: number; warnings: number }
  > {
    const stats: Record<
      string,
      { total: number; errors: number; warnings: number }
    > = {};

    for (const log of this.logs) {
      if (!stats[log.agentId]) {
        stats[log.agentId] = { total: 0, errors: 0, warnings: 0 };
      }

      stats[log.agentId].total++;

      if (log.level === LogLevel.ERROR) {
        stats[log.agentId].errors++;
      } else if (log.level === LogLevel.WARN) {
        stats[log.agentId].warnings++;
      }
    }

    return stats;
  }

  /**
   * Limpia todos los logs
   */
  clear(): void {
    this.logs.length = 0;
  }

  /**
   * Imprime un log formateado en consola
   */
  private printLog(entry: AgentLogEntry): void {
    const emoji = this.getEmojiForLevel(entry.level);
    const timestamp = entry.timestamp.toISOString();

    console.log(
      `[${timestamp}] ${emoji} [${entry.agentId}] ${entry.message}`,
      entry.context ? JSON.stringify(entry.context) : '',
    );
  }

  /**
   * Obtiene emoji para el nivel de log
   */
  private getEmojiForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '📝';
    }
  }
}
