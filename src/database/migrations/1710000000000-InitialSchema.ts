import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1710000000000 implements MigrationInterface {
  name = 'InitialSchema1710000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto or uuid-ossp for gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Create enum for user roles
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "role_enum" AS ENUM ('USER', 'ADMIN');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`,
    );

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "full_name" character varying(255) NOT NULL,
        "role" "role_enum" NOT NULL DEFAULT 'USER',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "role_enum" NOT NULL DEFAULT 'USER';`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_role_is_active" ON "users" ("role", "is_active");`,
    );

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token_hash" character varying(255) NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "is_revoked" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "family_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") 
          REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    // Ensure family_id exists if refresh_tokens was previously created without it
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" uuid NOT NULL DEFAULT gen_random_uuid();`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "is_revoked" boolean NOT NULL DEFAULT false;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_lookup" ON "refresh_tokens" ("user_id", "is_revoked", "expires_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id");`,
    );

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "action" character varying(100) NOT NULL,
        "ip_address" character varying(100) NOT NULL,
        "user_agent" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FK_audit_logs_user_id" FOREIGN KEY ("user_id") 
          REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" text;`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id" ON "audit_logs" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON "audit_logs" ("action");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at" ON "audit_logs" ("created_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "role_enum";`);
  }
}
