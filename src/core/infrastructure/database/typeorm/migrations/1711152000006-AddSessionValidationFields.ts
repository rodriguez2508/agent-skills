/**
 * Migration: Add session validation fields
 *
 * Adds purpose, isValidated, and validatedAt columns to sessions table.
 * Also adds status values for EXPIRED and INVALID.
 */

import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddSessionValidationFields1711152000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add purpose column
    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'purpose',
        type: 'varchar',
        isNullable: true,
        comment: 'Specific goal/issue for this session',
      }),
    );

    // Add isValidated column
    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'is_validated',
        type: 'boolean',
        default: false,
        comment: 'True after first meaningful interaction',
      }),
    );

    // Add validatedAt column
    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'validated_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'When session was validated',
      }),
    );

    // Create index on isValidated for fast queries
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_IS_VALIDATED',
        columnNames: ['is_validated', 'status'],
      }),
    );

    // Create index on validatedAt for cleanup queries
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_VALIDATED_AT',
        columnNames: ['validated_at'],
      }),
    );

    // Update enum type to include new status values
    // PostgreSQL requires altering the enum type
    await queryRunner.query(`
      ALTER TYPE "session_status" 
      ADD VALUE IF NOT EXISTS 'expired'
    `);

    await queryRunner.query(`
      ALTER TYPE "session_status" 
      ADD VALUE IF NOT EXISTS 'invalid'
    `);

    console.log('✅ Migration applied: Added session validation fields');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('sessions', 'IDX_SESSIONS_IS_VALIDATED');
    await queryRunner.dropIndex('sessions', 'IDX_SESSIONS_VALIDATED_AT');

    // Drop columns
    await queryRunner.dropColumn('sessions', 'purpose');
    await queryRunner.dropColumn('sessions', 'is_validated');
    await queryRunner.dropColumn('sessions', 'validated_at');

    console.log('❌ Migration reverted: Removed session validation fields');
  }
}
