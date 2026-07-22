import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentCategory } from '@modules/agency-agents/domain/entities/agent-category.entity';
import { AuthGuard } from '@modules/auth/guard/auth.guard';

@Controller('v1/agency-resources')
@UseGuards(AuthGuard)
export class AgencyResourcesCategoriesController {
  constructor(
    @InjectRepository(AgentCategory)
    private readonly categoryRepo: Repository<AgentCategory>,
  ) {}

  @Get('categories')
  async findAll(): Promise<AgentCategory[]> {
    return this.categoryRepo.find({ order: { slug: 'ASC' } });
  }
}
