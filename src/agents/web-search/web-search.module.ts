/**
 * Web Search Module
 *
 * Módulo que agrupa el agente de búsqueda web
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSearchAgent } from './web-search.agent';
import { SearchModule } from '@infrastructure/adapters/search/search.module';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

@Module({
  imports: [ConfigModule, SearchModule],
  providers: [WebSearchAgent, AgentLoggerService],
  exports: [WebSearchAgent],
})
export class WebSearchModule {}
