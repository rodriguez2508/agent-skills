/**
 * Migration: AddTotalSessionsAndSearchesToUsers
 *
 * Adds totalSessions and totalSearches columns to users table.
 */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTotalSessionsAndSearchesToUsers1711152000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist before adding
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('totalSessions', 'totalSearches')
    `);

    const columnNames = columns.map((c: any) => c.column_name);

    // Add totalSessions column if not exists
    if (!columnNames.includes('totalSessions')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'totalSessions',
          type: 'int',
          default: 0,
        }),
      );
    }

    // Add totalSearches column if not exists
    if (!columnNames.includes('totalSearches')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'totalSearches',
          type: 'int',
          default: 0,
        }),
      );
    }

    console.log('✅ Migration applied: Added totalSessions and totalSearches to users table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'totalSearches');
    await queryRunner.dropColumn('users', 'totalSessions');
    
    console.log('❌ Migration reverted: Removed totalSessions and totalSearches from users table');
  }
}
