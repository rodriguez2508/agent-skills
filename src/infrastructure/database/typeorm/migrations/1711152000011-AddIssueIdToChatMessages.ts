import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add issue_id to chat_messages for proper issue tracking
 */
export class AddIssueIdToChatMessages1711152000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('📋 Adding issue_id to chat_messages...');

    // 1. Add issue_id column
    await queryRunner.query(`
            ALTER TABLE "chat_messages" 
            ADD COLUMN IF NOT EXISTS "issue_id" uuid
        `);

    // 2. Create index
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_chat_messages_issue_id" 
            ON "chat_messages" ("issue_id")
        `);

    // 3. Add foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "chat_messages"
            ADD CONSTRAINT "FK_chat_messages_issue"
            FOREIGN KEY ("issue_id")
            REFERENCES "issues"("id")
            ON DELETE SET NULL
        `);

    console.log('✅ issue_id column added to chat_messages');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back...');

    // Drop FK constraint
    await queryRunner.query(`
            ALTER TABLE "chat_messages"
            DROP CONSTRAINT IF EXISTS "FK_chat_messages_issue"
        `);

    // Drop index
    await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_chat_messages_issue_id"
        `);

    // Drop column
    await queryRunner.query(`
            ALTER TABLE "chat_messages"
            DROP COLUMN IF EXISTS "issue_id"
        `);

    console.log('⚠️ Rollback completed');
  }
}
