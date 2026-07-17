import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SetLastAgentCommand } from './set-last-agent.command';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { Logger } from '@nestjs/common';

@CommandHandler(SetLastAgentCommand)
export class SetLastAgentHandler implements ICommandHandler<SetLastAgentCommand> {
  private readonly logger = new Logger(SetLastAgentHandler.name);

  constructor(private readonly redisService: RedisService) {}

  async execute(command: SetLastAgentCommand) {
    const { sessionId, agentId } = command;
    this.logger.debug(`Setting last agent for session ${sessionId}: ${agentId}`);
    await this.redisService.set(`session:${sessionId}:last_agent`, agentId, 3600);
  }
}
