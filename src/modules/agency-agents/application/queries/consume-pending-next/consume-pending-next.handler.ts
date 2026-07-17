import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConsumePendingNextQuery } from './consume-pending-next.query';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { Logger } from '@nestjs/common';

@QueryHandler(ConsumePendingNextQuery)
export class ConsumePendingNextHandler implements IQueryHandler<ConsumePendingNextQuery> {
  private readonly logger = new Logger(ConsumePendingNextHandler.name);

  constructor(private readonly redisService: RedisService) {}

  async execute(query: ConsumePendingNextQuery): Promise<{ agentId: string; action: string; intention: string; confidence: number; basedOn: string; fromPattern: boolean; fromAgentId: string } | null> {
    const { sessionId } = query;
    this.logger.debug(`Consuming pending next for session: ${sessionId}`);

    const data = await this.redisService.get<any>(`session:${sessionId}:pending_next`);
    if (data) {
      await this.redisService.del(`session:${sessionId}:pending_next`);
    }
    return data || null;
  }
}
