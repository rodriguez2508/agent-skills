import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordRejectionCommand } from './record-rejection.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(RecordRejectionCommand)
export class RecordRejectionHandler implements ICommandHandler<RecordRejectionCommand> {
  private readonly logger = new Logger(RecordRejectionHandler.name);

  constructor(
    @InjectRepository(AgentInvocationPattern)
    private readonly patternRepo: Repository<AgentInvocationPattern>,
  ) {}

  async execute(command: RecordRejectionCommand) {
    const { projectId, fromAgentId, toAgentId } = command;
    this.logger.log(`Recording rejection: ${fromAgentId} → ${toAgentId}`);

    try {
      const pattern = await this.patternRepo.findOne({
        where: { projectId, fromAgentId, toAgentId } as any,
      });
      if (pattern) {
        await this.patternRepo.update(pattern.id, {
          rejectedCount: pattern.rejectedCount + 1,
        });
      }
    } catch (e) {
      this.logger.warn(`recordRejection failed: ${e.message}`);
    }
  }
}
