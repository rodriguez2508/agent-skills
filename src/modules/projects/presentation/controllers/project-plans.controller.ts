import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { User } from '@modules/auth/decorators/user.decorator';
import { McpPlanService } from '@modules/plans/application/services/mcp-plan.service';
import { McpPlanStatus } from '@modules/plans/domain/entities/mcp-plan.entity';
import { ContextRepository } from '@modules/contexts/infrastructure/persistence/context.repository';
import { ProjectsService } from '../../application/services/projects.service';

@Controller('projects')
@UseGuards(AuthGuard)
export class ProjectPlansController {
  constructor(
    private readonly planService: McpPlanService,
    private readonly projectsService: ProjectsService,
    private readonly contextRepository: ContextRepository,
  ) {}

  @Get(':id/plans')
  @HttpCode(HttpStatus.OK)
  async getProjectPlans(
    @Param('id') id: string,
    @User('id') userId: string,
    @Query('status') status?: string,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const plans = await this.planService.findByProject(id, status as any);
    return {
      success: true,
      data: { plans, total: plans.length },
    };
  }

  @Get(':id/plans/:planId/messages')
  @HttpCode(HttpStatus.OK)
  async getPlanMessages(
    @Param('id') id: string,
    @Param('planId') planId: string,
    @User('id') userId: string,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const plans = await this.planService.findByProject(id);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return { success: false, error: 'Plan no encontrado' };
    }

    if (!plan.contextId) {
      return { success: true, data: { messages: [], total: 0 } };
    }

    const context = await this.contextRepository.findById(plan.contextId);
    const messages = (context?.messages as any[]) || [];

    return {
      success: true,
      data: {
        plan: { id: plan.id, title: plan.title, status: plan.status },
        messages,
        total: messages.length,
      },
    };
  }

  @Patch(':id/plans/:planId')
  @HttpCode(HttpStatus.OK)
  async updatePlanStatus(
    @Param('id') id: string,
    @Param('planId') planId: string,
    @User('id') userId: string,
    @Body('status') status: McpPlanStatus,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const plans = await this.planService.findByProject(id);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return { success: false, error: 'Plan no encontrado' };
    }

    if (!Object.values(McpPlanStatus).includes(status)) {
      return { success: false, error: 'Estado inválido' };
    }

    await this.planService.updateStatus(planId, status);
    return { success: true, data: { plan: { id: planId, status } } };
  }

  @Delete(':id/plans/:planId')
  @HttpCode(HttpStatus.OK)
  async deletePlan(
    @Param('id') id: string,
    @Param('planId') planId: string,
    @User('id') userId: string,
  ) {
    const project = await this.projectsService.findById(id);
    if (!project || (project.userId && project.userId !== userId)) {
      return { success: false, error: 'Proyecto no encontrado' };
    }

    const plans = await this.planService.findByProject(id);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      return { success: false, error: 'Plan no encontrado' };
    }

    const { contextId } = await this.planService.delete(planId);

    if (contextId) {
      try {
        await this.contextRepository.deleteById(contextId);
      } catch {}
    }

    return { success: true };
  }
}
