import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpPlan } from '@modules/plans/domain/entities/mcp-plan.entity';
import { McpPlanService } from '@modules/plans/application/services/mcp-plan.service';

@Module({
  imports: [TypeOrmModule.forFeature([McpPlan])],
  providers: [McpPlanService],
  exports: [McpPlanService],
})
export class PlansModule {}
