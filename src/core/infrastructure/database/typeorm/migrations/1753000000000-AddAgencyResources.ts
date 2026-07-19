/**
 * Migration: AddAgencyResources
 *
 * Creates tables for per-agency custom resources:
 * - agency_skills
 * - agency_rules
 * - agency_agents
 * - agency_workflows
 */

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAgencyResources1753000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── agency_skills ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_skills',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
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
            name: 'content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'tags',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            default: `'custom'`,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            default: `'1.0.0'`,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'install_count',
            type: 'int',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['agency_id'],
            referencedTableName: 'agencies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'agency_skills',
      new TableIndex({
        name: 'idx_agency_skills_agency_id',
        columnNames: ['agency_id'],
      }),
    );

    // ─── agency_rules ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_rules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
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
            name: 'content',
            type: 'text',
          },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            default: `'agent'`,
          },
          {
            name: 'tags',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'impact',
            type: 'varchar',
            length: '20',
            default: `'MEDIUM'`,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'install_count',
            type: 'int',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['agency_id'],
            referencedTableName: 'agencies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'agency_rules',
      new TableIndex({
        name: 'idx_agency_rules_agency_id',
        columnNames: ['agency_id'],
      }),
    );

    // ─── agency_agents ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_agents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
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
            name: 'system_prompt',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'skill_ids',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'rule_ids',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'intent_patterns',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'install_count',
            type: 'int',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['agency_id'],
            referencedTableName: 'agencies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'agency_agents',
      new TableIndex({
        name: 'idx_agency_agents_agency_id',
        columnNames: ['agency_id'],
      }),
    );

    // ─── agency_workflows ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_workflows',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
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
            name: 'steps',
            type: 'jsonb',
            default: `'[]'`,
          },
          {
            name: 'is_published',
            type: 'boolean',
            default: false,
          },
          {
            name: 'install_count',
            type: 'int',
            default: 0,
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
        foreignKeys: [
          {
            columnNames: ['agency_id'],
            referencedTableName: 'agencies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'agency_workflows',
      new TableIndex({
        name: 'idx_agency_workflows_agency_id',
        columnNames: ['agency_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('agency_workflows');
    await queryRunner.dropTable('agency_agents');
    await queryRunner.dropTable('agency_rules');
    await queryRunner.dropTable('agency_skills');
  }
}
