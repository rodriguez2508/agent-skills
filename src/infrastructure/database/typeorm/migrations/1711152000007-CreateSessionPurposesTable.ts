/**
 * Migration: CreateSessionPurposesTable
 *
 * Creates the session_purposes table to track issues/tasks across multiple sessions.
 * Also updates the sessions table to add purpose_id foreign key.
 */

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateSessionPurposesTable1711152000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create session_purposes table
    await queryRunner.createTable(
      new Table({
        name: 'session_purposes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'active'",
          },
          {
            name: 'last_session_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'initial_session_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'session_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_activity_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // 2. Create indexes for session_purposes
    await queryRunner.createIndex(
      'session_purposes',
      new TableIndex({
        name: 'IDX_session_purposes_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'session_purposes',
      new TableIndex({
        name: 'IDX_session_purposes_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'session_purposes',
      new TableIndex({
        name: 'IDX_session_purposes_last_session_id',
        columnNames: ['last_session_id'],
      }),
    );

    // 3. Add foreign key to users table
    await queryRunner.createForeignKey(
      'session_purposes',
      new TableForeignKey({
        name: 'FK_session_purposes_user',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 4. Add purpose_id column to sessions table
    await queryRunner.query(`
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS purpose_id uuid NULL
    `);

    // 5. Create index on purpose_id in sessions table
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_sessions_purpose_id',
        columnNames: ['purpose_id'],
      }),
    );

    // 6. Add foreign key from sessions to session_purposes
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        name: 'FK_sessions_purpose',
        columnNames: ['purpose_id'],
        referencedTableName: 'session_purposes',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign key from sessions to session_purposes
    await queryRunner.dropForeignKey('sessions', 'FK_sessions_purpose');

    // 2. Drop index on purpose_id in sessions
    await queryRunner.dropIndex('sessions', 'IDX_sessions_purpose_id');

    // 3. Drop purpose_id column from sessions
    await queryRunner.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS purpose_id`);

    // 4. Drop foreign key from session_purposes to users
    await queryRunner.dropForeignKey('session_purposes', 'FK_session_purposes_user');

    // 5. Drop indexes from session_purposes
    await queryRunner.dropIndex('session_purposes', 'IDX_session_purposes_user_id');
    await queryRunner.dropIndex('session_purposes', 'IDX_session_purposes_status');
    await queryRunner.dropIndex('session_purposes', 'IDX_session_purposes_last_session_id');

    // 6. Drop session_purposes table
    await queryRunner.dropTable('session_purposes', true);
  }
}
