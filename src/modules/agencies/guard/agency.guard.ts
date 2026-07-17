/**
 * Agency Guard ("El Túnel")
 *
 * Ensures the authenticated user belongs to at least one agency
 * before allowing access to protected resources (MCP, tools, etc.).
 *
 * Usage: @UseGuards(AuthGuard, AgencyGuard)
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agency } from '../domain/entities/agency.entity';
import { AgencyMember } from '../domain/entities/agency-member.entity';

@Injectable()
export class AgencyGuard implements CanActivate {
  private readonly logger = new Logger(AgencyGuard.name);

  constructor(
    @InjectRepository(Agency)
    private readonly agencyRepo: Repository<Agency>,
    @InjectRepository(AgencyMember)
    private readonly memberRepo: Repository<AgencyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request['user'];

    if (!user || !user.id) {
      this.logger.warn('AgencyGuard: No authenticated user found');
      throw new ForbiddenException('Authentication required');
    }

    const userId = user.id;

    // Check if user owns any agency
    const ownedAgencies = await this.agencyRepo.count({
      where: { ownerId: userId },
    });

    if (ownedAgencies > 0) {
      this.logger.debug(`✅ User ${userId} owns ${ownedAgencies} agencies`);
      return true;
    }

    // Check if user is a member of any agency
    const memberCount = await this.memberRepo.count({
      where: { userId },
    });

    if (memberCount > 0) {
      this.logger.debug(`✅ User ${userId} is a member of ${memberCount} agencies`);
      return true;
    }

    this.logger.warn(
      `🚫 User ${userId} does not belong to any agency. Access denied.`,
    );
    throw new ForbiddenException(
      'You must create or join an agency to use this feature',
    );
  }
}
