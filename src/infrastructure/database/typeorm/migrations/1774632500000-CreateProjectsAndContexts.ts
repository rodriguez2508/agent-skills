import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create projects and contexts tables
 *
 * New structure:
 * - User → Project (1:N)
 * - Project → Session (1:N)
 * - Project → Issue (1:N)
 * - Issue → Context (1:N)
 */
export class CreateProjectsAndContexts1774632500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('📋 Creating projects and contexts tables...');

    // 1. Create projects table
    await queryRunner.query(`
            CREATE TABLE "projects" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" varchar(200) NOT NULL,
                "repo_url" varchar(500),
                "description" text,
                "is_active" boolean NOT NULL DEFAULT true,
                "default_branch" varchar(100) NOT NULL DEFAULT 'main',
                "metadata" jsonb,
                "user_id" uuid,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "FK_projects_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_projects_name" ON "projects" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_user_id" ON "projects" ("user_id")`,
    );

    // 2. Create contexts table
    await queryRunner.query(`
            CREATE TABLE "contexts" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "context_id" varchar(50) NOT NULL,
                "type" varchar(100) NOT NULL,
                "summary" text,
                "messages" jsonb,
                "extracted_info" jsonb,
                "issue_id" uuid,
                "is_active" boolean NOT NULL DEFAULT true,
                "metadata" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "FK_contexts_issue" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_contexts_context_id" ON "contexts" ("context_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contexts_issue_id" ON "contexts" ("issue_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_contexts_is_active" ON "contexts" ("is_active")`,
    );

    // 3. Add project_id to sessions table (keep user_id for backward compatibility)
    await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD COLUMN IF NOT EXISTS "project_id" uuid
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sessions_project_id" 
            ON "sessions" ("project_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD CONSTRAINT "FK_sessions_project"
            FOREIGN KEY ("project_id")
            REFERENCES "projects"("id")
            ON DELETE SET NULL
        `);

    // 4. Add project_id to issues table
    await queryRunner.query(`
            ALTER TABLE "issues" 
            ADD COLUMN IF NOT EXISTS "project_id" uuid
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_issues_project_id" 
            ON "issues" ("project_id")
        `);

    await queryRunner.query(`
            ALTER TABLE "issues"
            ADD CONSTRAINT "FK_issues_project"
            FOREIGN KEY ("project_id")
            REFERENCES "projects"("id")
            ON DELETE SET NULL
        `);

    console.log('✅ Projects and contexts tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back...');

    // Drop FK constraints first
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "FK_issues_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "FK_sessions_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contexts" DROP CONSTRAINT IF EXISTS "FK_contexts_issue"`,
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_issues_project_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sessions_project_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contexts_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contexts_issue_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contexts_context_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projects_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_projects_name"`);

    // Drop columns
    await queryRunner.query(
      `ALTER TABLE "issues" DROP COLUMN IF EXISTS "project_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP COLUMN IF EXISTS "project_id"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "contexts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);

    console.log('⚠️ Rollback completed');
  }
}
