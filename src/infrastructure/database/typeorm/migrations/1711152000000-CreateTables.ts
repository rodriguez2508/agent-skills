/**
 * Migration: CreateTables (Initial Schema)
 * 
 * Creates the initial database schema with:
 * - users table
 * - sessions table
 * - chat_messages table
 * - Required enums and indexes
 */

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateTables1711152000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums first
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE session_status AS ENUM ('active', 'ended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'avatar',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'preferences',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'total_sessions',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_searches',
            type: 'int',
            default: 0,
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

    // Create indexes for users table
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_EMAIL',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_ACTIVE',
        columnNames: ['active'],
      }),
    );

    // Create sessions table
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
          },
          {
            name: 'session_id',
            type: 'varchar',
            comment: 'External session ID from MCP client',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'session_status',
            default: `'active'`,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'message_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'last_activity_at',
            type: 'timestamp',
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

    // Create indexes for sessions table
    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_SESSION_ID',
        columnNames: ['session_id'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'sessions',
      new TableIndex({
        name: 'IDX_SESSIONS_STATUS',
        columnNames: ['status'],
      }),
    );

    // Create foreign key for sessions -> users
    await queryRunner.createForeignKey(
      'sessions',
      new TableForeignKey({
        name: 'FK_SESSIONS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Create chat_messages table
    await queryRunner.createTable(
      new Table({
        name: 'chat_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            generationStrategy: 'uuid',
            default: `gen_random_uuid()`,
            isPrimary: true,
          },
          {
            name: 'session_id',
            type: 'uuid',
          },
          {
            name: 'role',
            type: 'message_role',
            default: `'user'`,
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'parent_message_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'token_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes for chat_messages table
    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_CHAT_MESSAGES_SESSION_ID',
        columnNames: ['session_id'],
      }),
    );

    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_CHAT_MESSAGES_ROLE',
        columnNames: ['role'],
      }),
    );

    await queryRunner.createIndex(
      'chat_messages',
      new TableIndex({
        name: 'IDX_CHAT_MESSAGES_PARENT',
        columnNames: ['parent_message_id'],
      }),
    );

    // Create foreign key for chat_messages -> sessions
    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        name: 'FK_CHAT_MESSAGES_SESSION',
        columnNames: ['session_id'],
        referencedTableName: 'sessions',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create migrations table (TypeORM needs this)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        name VARCHAR(255) NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop migrations table
    await queryRunner.query(`DROP TABLE IF EXISTS migrations`);

    // Drop foreign keys
    await queryRunner.dropForeignKey('chat_messages', 'FK_CHAT_MESSAGES_SESSION');
    await queryRunner.dropForeignKey('sessions', 'FK_SESSIONS_USER');

    // Drop tables
    await queryRunner.dropTable('chat_messages');
    await queryRunner.dropTable('sessions');
    await queryRunner.dropTable('users');

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS message_role`);
    await queryRunner.query(`DROP TYPE IF EXISTS session_status`);
  }
}
