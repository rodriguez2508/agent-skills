import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration: Add issue_id to sessions table
 */
export class AddIssueIdToSessions1711152000010 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('📋 Adding issue_id to sessions table...');

        // 1. Add issue_id column
        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD COLUMN IF NOT EXISTS "issue_id" uuid
        `);

        // 2. Create index
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sessions_issue_id" 
            ON "sessions" ("issue_id")
        `);

        // 3. Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD CONSTRAINT "FK_sessions_issue"
            FOREIGN KEY ("issue_id")
            REFERENCES "issues"("id")
            ON DELETE SET NULL
        `);

        console.log('✅ issue_id column added successfully');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('🔄 Rolling back...');

        // Drop FK constraint
        await queryRunner.query(`
            ALTER TABLE "sessions"
            DROP CONSTRAINT IF EXISTS "FK_sessions_issue"
        `);

        // Drop index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_sessions_issue_id"
        `);

        // Drop column
        await queryRunner.query(`
            ALTER TABLE "sessions"
            DROP COLUMN IF EXISTS "issue_id"
        `);

        console.log('⚠️ Rollback completed');
    }

}
