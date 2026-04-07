import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIssuesTable1774358885139 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "issues" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "issue_id" varchar(50) NOT NULL,
                "title" varchar(500) NOT NULL,
                "description" text,
                "requirements" text,
                "status" varchar NOT NULL DEFAULT 'open',
                "current_workflow_step" varchar(100),
                "user_id" uuid,
                "repository_url" varchar(500),
                "branch_name" varchar(200),
                "pr_url" varchar(500),
                "pr_md_path" varchar(500),
                "completed_steps" jsonb,
                "next_steps" text[],
                "key_decisions" jsonb,
                "files_modified" text[],
                "metadata" jsonb,
                "last_session_id" uuid,
                "last_activity_at" timestamptz,
                "completed_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "FK_issues_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
            )
        `);

    await queryRunner.query(
      `CREATE INDEX "IDX_issues_issue_id" ON "issues" ("issue_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_issues_status" ON "issues" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_issues_user_id" ON "issues" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_issues_last_session_id" ON "issues" ("last_session_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_issues_last_session_id"`);
    await queryRunner.query(`DROP INDEX "IDX_issues_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_issues_status"`);
    await queryRunner.query(`DROP INDEX "IDX_issues_issue_id"`);
    await queryRunner.query(`DROP TABLE "issues"`);
  }
}
