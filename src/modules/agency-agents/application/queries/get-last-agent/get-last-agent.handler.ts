import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLastAgentQuery } from './get-last-agent.query';
import { RedisService } from '@infrastructure/database/redis/redis.service';
import { Logger } from '@nestjs/common';

@QueryHandler(GetLastAgentQuery)
export class GetLastAgentHandler implements IQueryHandler<GetLastAgentQuery> {
  private readonly logger = new Logger(GetLastAgentHandler.name);

  constructor(private readonly redisService: RedisService) {}

  async execute(query: GetLastAgentQuery): Promise<string | null> {
    const { sessionId } = query;
    this.logger.debug(`Getting last agent for session: ${sessionId}`);
    return this.redisService.get<string>(`session:${sessionId}:last_agent`);
  }
}
