import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkillAgentType1753200000000 implements MigrationInterface {
  name = 'AddSkillAgentType1753200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agency_skills
      ADD COLUMN agent_type VARCHAR(50) NOT NULL DEFAULT 'general'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE agency_skills
      DROP COLUMN agent_type
    `);
  }
}
