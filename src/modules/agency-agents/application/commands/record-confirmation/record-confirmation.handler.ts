import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordConfirmationCommand } from './record-confirmation.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(RecordConfirmationCommand)
export class RecordConfirmationHandler implements ICommandHandler<RecordConfirmationCommand> {
  private readonly logger = new Logger(RecordConfirmationHandler.name);

  constructor(
    @InjectRepository(AgentInvocationPattern)
    private readonly patternRepo: Repository<AgentInvocationPattern>,
  ) {}

  async execute(command: RecordConfirmationCommand) {
    const { projectId, fromAgentId, toAgentId } = command;
    this.logger.log(`Recording confirmation: ${fromAgentId} → ${toAgentId}`);

    try {
      const pattern = await this.patternRepo.findOne({
        where: { projectId, fromAgentId, toAgentId } as any,
      });
      if (pattern) {
        await this.patternRepo.update(pattern.id, {
          confirmedCount: pattern.confirmedCount + 1,
        });
      }
    } catch (e) {
      this.logger.warn(`recordConfirmation failed: ${e.message}`);
    }
  }
}
