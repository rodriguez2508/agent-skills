import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AuthGuard } from '@modules/auth/guard/auth.guard';
import { AgencyGuard } from '@modules/agencies/guard/agency.guard';
import { CreateRuleCommand } from '@agency-resources/application/commands/create-rule/create-rule.command';
import { UpdateRuleCommand } from '@agency-resources/application/commands/update-rule/update-rule.command';
import { DeleteRuleCommand } from '@agency-resources/application/commands/delete-rule/delete-rule.command';
import { GetRulesByAgencyQuery } from '@agency-resources/application/queries/get-rules-by-agency/get-rules-by-agency.query';
import { GetRulesByCategoryQuery } from '@agency-resources/application/queries/get-rules-by-category/get-rules-by-category.query';
import { GetRuleByIdQuery } from '@agency-resources/application/queries/get-rule-by-id/get-rule-by-id.query';
import { CreateAgencyRuleDto, UpdateAgencyRuleDto } from '../dto/agency-rule.dto';
import { AgencyRuleDto } from '../dto/agency-resources-response.dto';

@Controller('v1/agency/:agencyId/rules')
@UseGuards(AuthGuard, AgencyGuard)
export class AgencyRulesController {
  private readonly logger = new Logger(AgencyRulesController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async findAll(
    @Param('agencyId') agencyId: string,
    @Query('category') category?: string,
  ): Promise<AgencyRuleDto[]> {
    if (category) {
      return this.queryBus.execute(new GetRulesByCategoryQuery(agencyId, category));
    }
    return this.queryBus.execute(new GetRulesByAgencyQuery(agencyId));
  }

  @Get(':ruleId')
  async findOne(
    @Param('agencyId') agencyId: string,
    @Param('ruleId') ruleId: string,
  ): Promise<AgencyRuleDto | null> {
    return this.queryBus.execute(new GetRuleByIdQuery(agencyId, ruleId));
  }

  @Post()
  async create(
    @Param('agencyId') agencyId: string,
    @Body() dto: CreateAgencyRuleDto,
  ): Promise<AgencyRuleDto> {
    return this.commandBus.execute(new CreateRuleCommand(agencyId, dto));
  }

  @Put(':ruleId')
  async update(
    @Param('agencyId') agencyId: string,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAgencyRuleDto,
  ): Promise<AgencyRuleDto> {
    return this.commandBus.execute(new UpdateRuleCommand(agencyId, ruleId, dto));
  }

  @Delete(':ruleId')
  async remove(
    @Param('agencyId') agencyId: string,
    @Param('ruleId') ruleId: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteRuleCommand(agencyId, ruleId));
  }
}
