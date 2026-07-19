import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentInvocationPatterns1774810000000 implements MigrationInterface {
  name = 'AgentInvocationPatterns1774810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agent_invocation_patterns" (
        "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
        "project_id"      UUID NOT NULL,
        "from_agent_id"   VARCHAR(100),
        "to_agent_id"     VARCHAR(100) NOT NULL,
        "intention"       VARCHAR(100),
        "count"           INTEGER NOT NULL DEFAULT 1,
        "confirmed_count" INTEGER NOT NULL DEFAULT 0,
        "rejected_count"  INTEGER NOT NULL DEFAULT 0,
        "sample_inputs"   TEXT[] NOT NULL DEFAULT '{}',
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "last_seen_at"    TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_invocation_patterns" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_invocation_patterns_transition"
          UNIQUE ("project_id", "from_agent_id", "to_agent_id", "intention"),
        CONSTRAINT "FK_agent_invocation_patterns_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agent_invocation_patterns_project"
        ON "agent_invocation_patterns" ("project_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_agent_invocation_patterns_to_agent"
        ON "agent_invocation_patterns" ("project_id", "to_agent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_invocation_patterns"`);
  }
}
