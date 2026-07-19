/**
 * Migration: Add unique index on lastIpAddress in users table
 *
 * This prevents race conditions where multiple users are created
 * with the same IP address simultaneously.
 */

import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddUniqueIndexToLastIpAddress1711152000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, clean up duplicate IPs - keep only the oldest user for each IP
    await queryRunner.query(`
      DELETE FROM users u1 USING users u2
      WHERE u1.id > u2.id
        AND u1."lastIpAddress" = u2."lastIpAddress"
        AND u1."lastIpAddress" IS NOT NULL
    `);

    // Create unique index on lastIpAddress
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_LAST_IP_ADDRESS_UNIQUE',
        columnNames: ['lastIpAddress'],
        isUnique: true,
        where: '"lastIpAddress" IS NOT NULL',
      }),
    );

    console.log('✅ Migration applied: Added unique index on lastIpAddress');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_USERS_LAST_IP_ADDRESS_UNIQUE');
    console.log(
      '❌ Migration reverted: Removed unique index from lastIpAddress',
    );
  }
}
