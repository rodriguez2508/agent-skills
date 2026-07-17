import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Agent Configs Table
 *
 * Creates the `agency_agent_configs` table for storing per-agency
 * agent CLI tool configurations (replaces hardcoded adapters).
 *
 * Depends on:
 * - None (agency_id is a simple varchar, not FK, to allow null = global)
 */
export class CreateAgentConfigsTable1784232000001 implements MigrationInterface {
  name = 'CreateAgentConfigsTable1784232000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "agency_agent_configs" (
        "id"                      UUID NOT NULL DEFAULT gen_random_uuid(),
        "agency_id"               VARCHAR(255),
        "agent_id"                VARCHAR(255) NOT NULL,
        "name"                    VARCHAR(255) NOT NULL,
        "binary_name"             VARCHAR(255),
        "description"             TEXT,
        "config_dir"              VARCHAR(255) NOT NULL,
        "system_prompt_file"      VARCHAR(255) NOT NULL,
        "skills_dir"              VARCHAR(255) NOT NULL,
        "settings_path"           VARCHAR(255) NOT NULL,
        "mcp_config_path"         VARCHAR(255),
        "system_prompt_strategy"  INTEGER NOT NULL DEFAULT 2,
        "mcp_strategy"            INTEGER NOT NULL DEFAULT 1,
        "supports_skills"         BOOLEAN NOT NULL DEFAULT true,
        "supports_system_prompt"  BOOLEAN NOT NULL DEFAULT true,
        "supports_mcp"            BOOLEAN NOT NULL DEFAULT true,
        "tier"                    VARCHAR(255) NOT NULL DEFAULT 'full',
        "is_active"               BOOLEAN NOT NULL DEFAULT true,
        "is_default"              BOOLEAN NOT NULL DEFAULT false,
        "created_at"              TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"              TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agency_agent_configs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agency_agent_configs_agent_id"
        ON "agency_agent_configs" ("agent_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agency_agent_configs_agency_id"
        ON "agency_agent_configs" ("agency_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_agency_agent_configs_is_default"
        ON "agency_agent_configs" ("is_default")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agency_agent_configs_is_default"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agency_agent_configs_agency_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_agency_agent_configs_agent_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agency_agent_configs"`);
  }
}
