import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StorePendingNextCommand } from './store-pending-next.command';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { Logger } from '@nestjs/common';

const PENDING_NEXT_TTL = 60 * 30;

@CommandHandler(StorePendingNextCommand)
export class StorePendingNextHandler implements ICommandHandler<StorePendingNextCommand> {
  private readonly logger = new Logger(StorePendingNextHandler.name);

  constructor(private readonly redisService: RedisService) {}

  async execute(command: StorePendingNextCommand) {
    const { sessionId, suggestion, fromAgentId } = command;
    this.logger.debug(`Storing pending next for session: ${sessionId}`);
    await this.redisService.set(
      `session:${sessionId}:pending_next`,
      { ...suggestion, fromAgentId },
      PENDING_NEXT_TTL,
    );
  }
}
