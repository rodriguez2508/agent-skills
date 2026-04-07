import { Module } from '@nestjs/common';
import { Context7Agent } from './context7.agent';
import { Context7Module as InfrastructureContext7Module } from '@infrastructure/adapters/context7/context7.module';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

@Module({
  imports: [InfrastructureContext7Module],
  providers: [Context7Agent, AgentLoggerService],
  exports: [Context7Agent],
})
export class Context7AgentModule {}
