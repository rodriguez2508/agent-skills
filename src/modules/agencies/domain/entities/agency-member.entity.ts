/**
 * Agency Member Entity
 *
 * Represents a user belonging to an agency with specific roles and permissions.
 * Each member has a role that defines what they can do within the agency.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Agency } from './agency.entity';

export enum AgencyMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('agency_members')
@Unique(['agencyId', 'userId'])
export class AgencyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'agency_id' })
  @Index()
  agencyId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  @Index()
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: AgencyMemberRole.MEMBER,
  })
  role: AgencyMemberRole;

  @Column('jsonb', { nullable: true })
  permissions?: {
    canCreateTemplates?: boolean;
    canPublishTemplates?: boolean;
    canManageMembers?: boolean;
    canDeleteAgency?: boolean;
    canConfigureWorkflow?: boolean;
    [key: string]: any;
  };

  @ManyToOne(() => Agency, (agency) => agency.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agency_id' })
  agency?: Agency;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
