import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueConstraintProjects1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_projects_name_localpath" 
      ON "projects" ("name", (metadata->>'localPath'))
      WHERE "metadata"->>'localPath' IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_projects_name_localpath"`);
  }
}
