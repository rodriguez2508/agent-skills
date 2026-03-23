/**
 * Migration: AddIpAddressToUsers
 *
 * Adds IP address tracking columns to users table:
 * - lastIpAddress (varchar)
 * - ipAddressHistory (jsonb)
 */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIpAddressToUsers1711152000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add lastIpAddress column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lastIpAddress',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Add ipAddressHistory column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'ipAddressHistory',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    // Create index on lastIpAddress for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_USERS_LAST_IP_ADDRESS" 
      ON "users" ("lastIpAddress")
    `);

    console.log('✅ Migration applied: Added IP address tracking to users table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_USERS_LAST_IP_ADDRESS"
    `);

    // Drop columns
    await queryRunner.dropColumn('users', 'ipAddressHistory');
    await queryRunner.dropColumn('users', 'lastIpAddress');

    console.log('❌ Migration reverted: Removed IP address tracking from users table');
  }
}
