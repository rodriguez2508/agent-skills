import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectRelationships1774700000000 implements MigrationInterface {
  name = 'AddProjectRelationships1774700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'depends_on',
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source_project_id, target_project_id, type)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pr_source ON project_relationships(source_project_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_pr_target ON project_relationships(target_project_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS project_relationships`);
  }
}
