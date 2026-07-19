/**
 * Migration: Create Agencies Tables
 *
 * Creates the multi-tenancy agency system tables:
 * - agencies: Workspaces with owner, plan tier, and settings
 * - agency_members: Role-based membership with permissions
 * - agency_templates: Publishable methodology configurations
 *
 * Dependencies:
 * - users table must exist (agencies.owner_id → users.id)
 */

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateAgenciesTables1784232000000 implements MigrationInterface {
  name = 'CreateAgenciesTables1784232000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────
    //  Create Enums
    // ─────────────────────────────────────

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE agency_plan_tier AS ENUM ('free', 'pro', 'enterprise');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE agency_member_role AS ENUM ('owner', 'admin', 'member');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE template_category AS ENUM (
          'architecture', 'workflow', 'programming', 'analyst', 'full_stack'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─────────────────────────────────────
    //  Create agencies table
    // ─────────────────────────────────────

    await queryRunner.createTable(
      new Table({
        name: 'agencies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'logo',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'owner_id',
            type: 'uuid',
          },
          {
            name: 'plan_tier',
            type: 'agency_plan_tier',
            default: `'free'`,
          },
          {
            name: 'stripe_customer_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: false,
          },
          {
            name: 'settings',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Indexes for agencies
    await queryRunner.createIndex(
      'agencies',
      new TableIndex({
        name: 'IDX_AGENCIES_SLUG',
        columnNames: ['slug'],
      }),
    );

    await queryRunner.createIndex(
      'agencies',
      new TableIndex({
        name: 'IDX_AGENCIES_OWNER_ID',
        columnNames: ['owner_id'],
      }),
    );

    await queryRunner.createIndex(
      'agencies',
      new TableIndex({
        name: 'IDX_AGENCIES_PLAN_TIER',
        columnNames: ['plan_tier'],
      }),
    );

    // Foreign key: agencies.owner_id → users.id
    await queryRunner.createForeignKey(
      'agencies',
      new TableForeignKey({
        name: 'FK_AGENCIES_OWNER',
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─────────────────────────────────────
    //  Create agency_members table
    // ─────────────────────────────────────

    await queryRunner.createTable(
      new Table({
        name: 'agency_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'agency_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
          {
            name: 'role',
            type: 'agency_member_role',
            default: `'member'`,
          },
          {
            name: 'permissions',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Indexes for agency_members
    await queryRunner.createIndex(
      'agency_members',
      new TableIndex({
        name: 'IDX_AGENCY_MEMBERS_AGENCY_ID',
        columnNames: ['agency_id'],
      }),
    );

    await queryRunner.createIndex(
      'agency_members',
      new TableIndex({
        name: 'IDX_AGENCY_MEMBERS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'agency_members',
      new TableIndex({
        name: 'IDX_AGENCY_MEMBERS_ROLE',
        columnNames: ['role'],
      }),
    );

    // Unique constraint: one membership per user per agency
    await queryRunner.createIndex(
      'agency_members',
      new TableIndex({
        name: 'IDX_AGENCY_MEMBERS_UNIQUE',
        columnNames: ['agency_id', 'user_id'],
        isUnique: true,
      }),
    );

    // Foreign keys for agency_members
    await queryRunner.createForeignKey(
      'agency_members',
      new TableForeignKey({
        name: 'FK_AGENCY_MEMBERS_AGENCY',
        columnNames: ['agency_id'],
        referencedTableName: 'agencies',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'agency_members',
      new TableForeignKey({
        name: 'FK_AGENCY_MEMBERS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // ─────────────────────────────────────
    //  Create agency_templates table
    // ─────────────────────────────────────

    await queryRunner.createTable(
      new Table({
        name: 'agency_templates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'agency_id',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'template_category',
            default: `'workflow'`,
          },
          {
            name: 'skills',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rules',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'workflow',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'persona',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'download_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            default: `'1.0.0'`,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Indexes for agency_templates
    await queryRunner.createIndex(
      'agency_templates',
      new TableIndex({
        name: 'IDX_AGENCY_TEMPLATES_AGENCY_ID',
        columnNames: ['agency_id'],
      }),
    );

    await queryRunner.createIndex(
      'agency_templates',
      new TableIndex({
        name: 'IDX_AGENCY_TEMPLATES_CATEGORY',
        columnNames: ['category'],
      }),
    );

    await queryRunner.createIndex(
      'agency_templates',
      new TableIndex({
        name: 'IDX_AGENCY_TEMPLATES_PUBLISHED',
        columnNames: ['is_published'],
      }),
    );

    // Foreign key: agency_templates.agency_id → agencies.id
    await queryRunner.createForeignKey(
      'agency_templates',
      new TableForeignKey({
        name: 'FK_AGENCY_TEMPLATES_AGENCY',
        columnNames: ['agency_id'],
        referencedTableName: 'agencies',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first (agency_templates → agencies)
    await queryRunner.dropForeignKey('agency_templates', 'FK_AGENCY_TEMPLATES_AGENCY');

    // Drop foreign keys (agency_members → agencies, agency_members → users)
    await queryRunner.dropForeignKey('agency_members', 'FK_AGENCY_MEMBERS_AGENCY');
    await queryRunner.dropForeignKey('agency_members', 'FK_AGENCY_MEMBERS_USER');

    // Drop foreign key (agencies → users)
    await queryRunner.dropForeignKey('agencies', 'FK_AGENCIES_OWNER');

    // Drop tables
    await queryRunner.dropTable('agency_templates');
    await queryRunner.dropTable('agency_members');
    await queryRunner.dropTable('agencies');

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS template_category`);
    await queryRunner.query(`DROP TYPE IF EXISTS agency_member_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS agency_plan_tier`);
  }
}
