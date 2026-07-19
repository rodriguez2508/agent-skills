import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Drop SessionPurposes Table
 */
export class DropSessionPurposesTable1711152000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🗑️ Dropping session_purposes table...');

    // Drop session_purposes table
    await queryRunner.query(`DROP TABLE IF EXISTS "session_purposes" CASCADE`);

    console.log('✅ Migration completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back...');

    await queryRunner.query(`
            CREATE TABLE "session_purposes" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" uuid,
                "issue_id" uuid,
                "title" varchar(500) NOT NULL,
                "description" text,
                "status" varchar NOT NULL DEFAULT 'active',
                "last_session_id" varchar,
                "initial_session_id" varchar,
                "session_count" integer DEFAULT 0,
                "last_activity_at" timestamptz,
                "completed_at" timestamptz,
                "metadata" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

    console.log('⚠️ Rollback completed');
  }
}
