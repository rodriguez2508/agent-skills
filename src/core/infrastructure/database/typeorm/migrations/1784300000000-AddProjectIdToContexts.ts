import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectIdToContexts1784300000000 implements MigrationInterface {
  name = 'AddProjectIdToContexts1784300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contexts
      ADD COLUMN project_id UUID NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_contexts_project_id
      ON contexts (project_id)
      WHERE project_id IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE contexts
      ADD CONSTRAINT fk_contexts_project
      FOREIGN KEY (project_id) REFERENCES projects(id)
      ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contexts DROP CONSTRAINT IF EXISTS fk_contexts_project`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_contexts_project_id`);
    await queryRunner.query(`ALTER TABLE contexts DROP COLUMN IF EXISTS project_id`);
  }
}
