import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceAgentTypeWithCategoryId1784700000000 implements MigrationInterface {
  name = 'ReplaceAgentTypeWithCategoryId1784700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add category_id column
    await queryRunner.query(`
      ALTER TABLE "agency_skills"
      ADD COLUMN "category_id" UUID
    `);

    // 2. Add FK to agent_categories
    await queryRunner.query(`
      ALTER TABLE "agency_skills"
      ADD CONSTRAINT "FK_agency_skills_category"
      FOREIGN KEY ("category_id") REFERENCES "agent_categories"("id")
      ON DELETE SET NULL
    `);

    // 3. Migrate existing data: map agentType → category slug
    const slugMap: Record<string, string> = {
      'system-architect': 'architecture',
      'backend-dev': 'backend',
      'frontend-dev': 'frontend',
      'devops-architect': 'devops',
      'market-analyst': 'analysis',
      'business-analyst': 'analysis',
      'data-analyst': 'analysis',
      'code-reviewer': 'backend',
      'product-manager': 'management',
      'qa-engineer': 'backend',
    };

    for (const [agentType, slug] of Object.entries(slugMap)) {
      await queryRunner.query(`
        UPDATE "agency_skills" s
        SET "category_id" = c."id"
        FROM "agent_categories" c
        WHERE s."agent_type" = $1 AND c."slug" = $2
      `, [agentType, slug]);
    }

    // 4. Default remaining unmapped skills to 'general'
    await queryRunner.query(`
      UPDATE "agency_skills" s
      SET "category_id" = c."id"
      FROM "agent_categories" c
      WHERE s."category_id" IS NULL AND c."slug" = 'general'
    `);

    // 5. Add index on category_id
    await queryRunner.query(`
      CREATE INDEX "IDX_agency_skills_category_id"
      ON "agency_skills" ("category_id")
    `);

    // 6. Drop agent_type column
    await queryRunner.query(`
      ALTER TABLE "agency_skills" DROP COLUMN "agent_type"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Recreate agent_type column
    await queryRunner.query(`
      ALTER TABLE "agency_skills"
      ADD COLUMN "agent_type" VARCHAR(50) NOT NULL DEFAULT 'general'
    `);

    // 2. Reverse map: category slug → agentType
    const reverseMap: Record<string, string> = {
      'architecture': 'system-architect',
      'backend': 'backend-dev',
      'frontend': 'frontend-dev',
      'devops': 'devops-architect',
      'analysis': 'business-analyst',
      'management': 'product-manager',
      'knowledge': 'general',
      'general': 'general',
    };

    for (const [slug, agentType] of Object.entries(reverseMap)) {
      await queryRunner.query(`
        UPDATE "agency_skills" s
        SET "agent_type" = $1
        FROM "agent_categories" c
        WHERE s."category_id" = c."id" AND c."slug" = $2
      `, [agentType, slug]);
    }

    // 3. Drop FK and column
    await queryRunner.query(`DROP INDEX "IDX_agency_skills_category_id"`);
    await queryRunner.query(`ALTER TABLE "agency_skills" DROP CONSTRAINT "FK_agency_skills_category"`);
    await queryRunner.query(`ALTER TABLE "agency_skills" DROP COLUMN "category_id"`);
  }
}
