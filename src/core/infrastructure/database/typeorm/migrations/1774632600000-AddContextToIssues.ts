import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add context column to issues table
 *
 * Adds JSONB column for storing complete interaction context
 */
export class AddContextToIssues1774632600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('📋 Adding context column to issues table...');

    // Add context column to issues
    await queryRunner.query(`
      ALTER TABLE "issues"
      ADD COLUMN IF NOT EXISTS "context" jsonb
    `);

    console.log('✅ Context column added to issues table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back context column...');

    await queryRunner.query(`
      ALTER TABLE "issues"
      DROP COLUMN IF EXISTS "context"
    `);

    console.log('⚠️ Rollback completed');
  }
}
