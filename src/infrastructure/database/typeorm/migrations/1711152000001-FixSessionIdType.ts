/**
 * Migration: FixSessionIdType
 *
 * Changes session_id from UUID to VARCHAR in sessions and chat_messages tables.
 */

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class FixSessionIdType1711152000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change sessions.session_id from UUID to VARCHAR
    await queryRunner.changeColumn(
      'sessions',
      'session_id',
      new TableColumn({
        name: 'session_id',
        type: 'varchar',
        comment: 'External session ID from MCP client',
      }),
    );

    // Change chat_messages.session_id from UUID to VARCHAR
    await queryRunner.changeColumn(
      'chat_messages',
      'session_id',
      new TableColumn({
        name: 'session_id',
        type: 'varchar',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to UUID
    await queryRunner.changeColumn(
      'chat_messages',
      'session_id',
      new TableColumn({
        name: 'session_id',
        type: 'uuid',
      }),
    );

    await queryRunner.changeColumn(
      'sessions',
      'session_id',
      new TableColumn({
        name: 'session_id',
        type: 'uuid',
      }),
    );
  }
}
