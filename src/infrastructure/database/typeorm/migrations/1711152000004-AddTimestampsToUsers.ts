/**
 * Migration: AddTimestampsToUsers
 *
 * Adds createdAt and updatedAt columns to users table if they don't exist.
 */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTimestampsToUsers1711152000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns exist before adding
    const columns = await queryRunner.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('created_at', 'updated_at')
    `);

    const columnNames = columns.map((c: any) => c.column_name);

    // Add created_at column if not exists
    if (!columnNames.includes('created_at')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'created_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
        }),
      );
    }

    // Add updated_at column if not exists
    if (!columnNames.includes('updated_at')) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'updated_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
        }),
      );
    }

    console.log('✅ Migration applied: Added created_at and updated_at to users table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'updated_at');
    await queryRunner.dropColumn('users', 'created_at');
    
    console.log('❌ Migration reverted: Removed created_at and updated_at from users table');
  }
}
