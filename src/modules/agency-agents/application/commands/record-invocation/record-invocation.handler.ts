import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordInvocationCommand } from './record-invocation.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentSessionContext } from '@modules/agency-agents/domain/entities/agent-session-context.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(RecordInvocationCommand)
export class RecordInvocationHandler implements ICommandHandler<RecordInvocationCommand> {
  private readonly logger = new Logger(RecordInvocationHandler.name);

  constructor(
    @InjectRepository(AgentSessionContext)
    private readonly contextRepo: Repository<AgentSessionContext>,
  ) {}

  async execute(command: RecordInvocationCommand) {
    const { agentId, sessionId, projectId, userMessage, assistantResponse, appliedRules } = command;

    try {
      let ctx = await this.contextRepo.findOne({ where: { agentId, sessionId } });

      if (!ctx) {
        ctx = this.contextRepo.create({
          agentId,
          sessionId,
          projectId,
          loadedSkills: [],
          loadedRules: [],
          messages: [],
          invocationCount: 0,
        });
        ctx = await this.contextRepo.save(ctx);
      }

      const messages = ctx.messages ?? [];
      messages.push(
        { role: 'user', content: userMessage.substring(0, 500), timestamp: new Date().toISOString() },
        { role: 'assistant', content: assistantResponse.substring(0, 500), timestamp: new Date().toISOString() },
      );

      await this.contextRepo.update(ctx.id, {
        messages: messages.slice(-40),
        invocationCount: ctx.invocationCount + 1,
        lastInvokedAt: new Date(),
        loadedRules: appliedRules,
      });
    } catch (e) {
      this.logger.warn(`recordInvocation failed: ${e.message}`);
    }
  }
}
