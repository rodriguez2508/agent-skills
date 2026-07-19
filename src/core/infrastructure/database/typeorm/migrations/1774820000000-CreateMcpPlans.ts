import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMcpPlans1774820000000 implements MigrationInterface {
  name = 'CreateMcpPlans1774820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "mcp_plan_status_enum" AS ENUM (
        'open', 'in_progress', 'completed', 'abandoned'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "mcp_plans" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title"               VARCHAR(500) NOT NULL,
        "status"              "mcp_plan_status_enum" NOT NULL DEFAULT 'open',
        "plan"                JSONB NOT NULL DEFAULT '{}',
        "project_id"          UUID,
        "session_id"          UUID,
        "agent_id"            VARCHAR(100),
        "issue_id"            UUID,
        "external_issue_ref"  VARCHAR(100),
        "due_date"            TIMESTAMP,
        "started_at"          TIMESTAMP,
        "completed_at"        TIMESTAMP,
        "created_at"          TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_mcp_plans_project_id" ON "mcp_plans" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mcp_plans_session_id" ON "mcp_plans" ("session_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mcp_plans_issue_id"   ON "mcp_plans" ("issue_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_mcp_plans_status"     ON "mcp_plans" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mcp_plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "mcp_plan_status_enum"`);
  }
}
