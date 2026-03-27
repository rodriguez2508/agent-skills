import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthFieldsToUsers1774442400000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add password column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "password" character varying
        `);

        // Add emailVerified column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false
        `);

        // Add emailVerificationToken column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying
        `);

        // Add emailVerificationTokenExpires column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpires" TIMESTAMP
        `);

        // Add resetPasswordToken column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "resetPasswordToken" character varying
        `);

        // Add resetPasswordTokenExpires column
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN IF NOT EXISTS "resetPasswordTokenExpires" TIMESTAMP
        `);

        // Create index on email for faster lookups
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_USERS_EMAIL_VERIFIED" 
            ON "users" ("emailVerified")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_USERS_EMAIL_VERIFIED"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordTokenExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationTokenExpires"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerificationToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "emailVerified"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
    }

}
