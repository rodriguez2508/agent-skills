import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropChatMessagesTable1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "session_id" VARCHAR NOT NULL,
        "issue_id" UUID,
        "role" VARCHAR(20) NOT NULL DEFAULT 'user',
        "content" TEXT NOT NULL,
        "metadata" JSONB,
        "parent_message_id" UUID,
        "token_count" INTEGER DEFAULT 0,
        "created_at" TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_session_id" ON "chat_messages" ("session_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_issue_id" ON "chat_messages" ("issue_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_role" ON "chat_messages" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_chat_messages_parent_message_id" ON "chat_messages" ("parent_message_id")`);
  }
}
