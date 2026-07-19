import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class RecreateAgencyResources1753100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS agency_workflows CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_agents CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_rules CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_skills CASCADE');

    // ─── agency_skills ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_skills',
        columns: [
          { name: 'id', type: 'uuid', generationStrategy: 'uuid', default: `gen_random_uuid()`, isPrimary: true },
          { name: 'agency_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', default: "''" },
          { name: 'prompt_template', type: 'text' },
          { name: 'tags', type: 'text', default: "''" },
          { name: 'usage_count', type: 'int', default: 0 },
          { name: 'rating', type: 'decimal', precision: 3, scale: 2, default: 0 },
          { name: 'input_variables', type: 'text', default: "''" },
          { name: 'is_published', type: 'boolean', default: false },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [{ columnNames: ['agency_id'], referencedTableName: 'agencies', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
      }),
      true,
    );
    await queryRunner.createIndex('agency_skills', new TableIndex({ name: 'idx_skills_agency_id', columnNames: ['agency_id'] }));

    // ─── agency_rules ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_rules',
        columns: [
          { name: 'id', type: 'uuid', generationStrategy: 'uuid', default: `gen_random_uuid()`, isPrimary: true },
          { name: 'agency_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', default: "''" },
          { name: 'category', type: 'varchar', length: '50', default: "'custom'" },
          { name: 'rule_content', type: 'text' },
          { name: 'enforcement_level', type: 'varchar', length: '20', default: "'soft'" },
          { name: 'priority', type: 'int', default: 0 },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [{ columnNames: ['agency_id'], referencedTableName: 'agencies', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
      }),
      true,
    );
    await queryRunner.createIndex('agency_rules', new TableIndex({ name: 'idx_rules_agency_id', columnNames: ['agency_id'] }));

    // ─── agency_agents ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_agents',
        columns: [
          { name: 'id', type: 'uuid', generationStrategy: 'uuid', default: `gen_random_uuid()`, isPrimary: true },
          { name: 'agency_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', default: "''" },
          { name: 'system_prompt', type: 'text' },
          { name: 'tools', type: 'text', default: "''" },
          { name: 'type', type: 'varchar', length: '20', default: "'conversational'" },
          { name: 'skill_ids', type: 'text', default: "''" },
          { name: 'rule_ids', type: 'text', default: "''" },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [{ columnNames: ['agency_id'], referencedTableName: 'agencies', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
      }),
      true,
    );
    await queryRunner.createIndex('agency_agents', new TableIndex({ name: 'idx_agents_agency_id', columnNames: ['agency_id'] }));

    // ─── agency_workflows ───
    await queryRunner.createTable(
      new Table({
        name: 'agency_workflows',
        columns: [
          { name: 'id', type: 'uuid', generationStrategy: 'uuid', default: `gen_random_uuid()`, isPrimary: true },
          { name: 'agency_id', type: 'uuid' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'description', type: 'text', default: "''" },
          { name: 'steps', type: 'jsonb' },
          { name: 'trigger_type', type: 'varchar', length: '30', default: "'sequential'" },
          { name: 'trigger_config', type: 'jsonb', default: `'{}'` },
          { name: 'execution_count', type: 'int', default: 0 },
          { name: 'success_count', type: 'int', default: 0 },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [{ columnNames: ['agency_id'], referencedTableName: 'agencies', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
      }),
      true,
    );
    await queryRunner.createIndex('agency_workflows', new TableIndex({ name: 'idx_workflows_agency_id', columnNames: ['agency_id'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS agency_workflows CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_agents CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_rules CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS agency_skills CASCADE');
  }
}
