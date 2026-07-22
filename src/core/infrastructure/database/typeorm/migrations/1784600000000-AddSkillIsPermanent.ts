import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkillIsPermanent1784600000000 implements MigrationInterface {
  name = 'AddSkillIsPermanent1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agency_skills
      ADD COLUMN is_permanent BOOLEAN DEFAULT FALSE
    `);
    await queryRunner.query(`
      CREATE INDEX idx_agency_skills_permanent
      ON agency_skills(agency_id, is_permanent)
      WHERE is_permanent = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_agency_skills_permanent`);
    await queryRunner.query(`ALTER TABLE agency_skills DROP COLUMN IF EXISTS is_permanent`);
  }
}
