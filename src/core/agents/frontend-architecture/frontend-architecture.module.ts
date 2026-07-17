import { Module } from '@nestjs/common';
import { FrontendArchitectureAgent } from './frontend-architecture.agent';
import { FrontendValidationService } from './frontend-validation.service';
import { AgentLoggerService } from '@infrastructure/logging/agent-logger.service';

@Module({
  providers: [
    FrontendArchitectureAgent,
    FrontendValidationService,
    AgentLoggerService,
  ],
  exports: [FrontendArchitectureAgent, FrontendValidationService],
})
export class FrontendArchitectureModule {}
