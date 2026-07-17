import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecordTransitionCommand } from './record-transition.command';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentInvocationPattern } from '@modules/agency-agents/domain/entities/agent-invocation-pattern.entity';
import { Logger } from '@nestjs/common';

@CommandHandler(RecordTransitionCommand)
export class RecordTransitionHandler implements ICommandHandler<RecordTransitionCommand> {
  private readonly logger = new Logger(RecordTransitionHandler.name);

  constructor(
    @InjectRepository(AgentInvocationPattern)
    private readonly patternRepo: Repository<AgentInvocationPattern>,
  ) {}

  async execute(command: RecordTransitionCommand) {
    const { projectId, fromAgentId, toAgentId, intention, sampleInput } = command;
    this.logger.log(`Recording transition: ${fromAgentId || 'start'} → ${toAgentId}`);

    if (!projectId || !toAgentId) return;

    try {
      const where = {
        projectId,
        fromAgentId: fromAgentId ?? IsNull(),
        toAgentId,
        intention: intention ?? null,
      } as any;

      let pattern = await this.patternRepo.findOne({ where });

      if (pattern) {
        const inputs = [...(pattern.sampleInputs ?? []), sampleInput.substring(0, 100)].slice(-5);
        await this.patternRepo.update(pattern.id, {
          count: pattern.count + 1,
          sampleInputs: inputs,
        });
      } else {
        await this.patternRepo.save(
          this.patternRepo.create({
            projectId,
            fromAgentId,
            toAgentId,
            intention,
            count: 1,
            sampleInputs: [sampleInput.substring(0, 100)],
          }),
        );
      }
    } catch (e) {
      this.logger.warn(`recordTransition failed: ${e.message}`);
    }
  }
}
