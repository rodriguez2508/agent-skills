import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgentCatalogBM21774800000000 implements MigrationInterface {
  name = 'AgentCatalogBM21774800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agent_categories" (
        "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
        "slug"        VARCHAR(50) NOT NULL,
        "name"        VARCHAR(100) NOT NULL,
        "description" TEXT,
        "icon"        VARCHAR(20),
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_categories" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_categories_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "agent_catalog" (
        "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
        "agent_id"         VARCHAR(100) NOT NULL,
        "category_id"      UUID,
        "name"             VARCHAR(200) NOT NULL,
        "description"      TEXT,
        "purpose"          TEXT,
        "skill_ids"        TEXT[] NOT NULL DEFAULT '{}',
        "rule_categories"  TEXT[] NOT NULL DEFAULT '{}',
        "intent_patterns"  TEXT[] NOT NULL DEFAULT '{}',
        "is_active"        BOOLEAN NOT NULL DEFAULT true,
        "priority"         INTEGER NOT NULL DEFAULT 0,
        "config"           JSONB,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_catalog" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_catalog_agent_id" UNIQUE ("agent_id"),
        CONSTRAINT "FK_agent_catalog_category" FOREIGN KEY ("category_id")
          REFERENCES "agent_categories"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agent_catalog_agent_id" ON "agent_catalog" ("agent_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "agent_session_contexts" (
        "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
        "agent_id"         VARCHAR(100) NOT NULL,
        "session_id"       VARCHAR(255) NOT NULL,
        "project_id"       UUID,
        "messages"         JSONB NOT NULL DEFAULT '[]',
        "loaded_skills"    TEXT[] NOT NULL DEFAULT '{}',
        "loaded_rules"     JSONB NOT NULL DEFAULT '[]',
        "invocation_count" INTEGER NOT NULL DEFAULT 0,
        "last_invoked_at"  TIMESTAMP,
        "metadata"         JSONB,
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_session_contexts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_agent_session_contexts_agent_session" UNIQUE ("agent_id", "session_id"),
        CONSTRAINT "FK_agent_session_contexts_project" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agent_session_contexts_agent_id"   ON "agent_session_contexts" ("agent_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_agent_session_contexts_session_id" ON "agent_session_contexts" ("session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_agent_session_contexts_project_id" ON "agent_session_contexts" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_session_contexts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_catalog"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_categories"`);
  }
}
