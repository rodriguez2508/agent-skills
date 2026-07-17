import { Module } from '@nestjs/common';
import { GraphifyAgent } from './graphify.agent';
import { GraphifyExecutorService } from './graphify-executor.service';

@Module({
  providers: [GraphifyAgent, GraphifyExecutorService],
  exports: [GraphifyAgent],
})
export class GraphifyModule {}
