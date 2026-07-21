import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContextIdToMcpPlans1784500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mcp_plans" 
      ADD COLUMN "context_id" UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "mcp_plans" 
      ADD CONSTRAINT "fk_mcp_plans_context" 
      FOREIGN KEY ("context_id") REFERENCES "contexts"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_mcp_plans_context_id" ON "mcp_plans" ("context_id") WHERE "context_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_mcp_plans_context_id"`);
    await queryRunner.query(`ALTER TABLE "mcp_plans" DROP CONSTRAINT IF EXISTS "fk_mcp_plans_context"`);
    await queryRunner.query(`ALTER TABLE "mcp_plans" DROP COLUMN IF EXISTS "context_id"`);
  }
}
