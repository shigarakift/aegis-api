import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokens1710100000000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1710100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_user_id_type text;
        v_id_type text;
        v_id_default text;
      BEGIN
        -- Cek tipe data aktual kolom id pada tabel users
        SELECT data_type INTO v_user_id_type
        FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'id';

        IF v_user_id_type = 'text' THEN
          v_id_type := 'text';
          v_id_default := 'gen_random_uuid()::text';
        ELSE
          v_id_type := 'uuid';
          v_id_default := 'gen_random_uuid()';
          v_user_id_type := 'uuid';
        END IF;

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
            "id" %s PRIMARY KEY DEFAULT %s,
            "token_hash" character varying(64) NOT NULL,
            "user_id" %s NOT NULL,
            "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
            "is_used" boolean NOT NULL DEFAULT false,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "FK_password_reset_tokens_user_id" FOREIGN KEY ("user_id")
              REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
          )',
          v_id_type,
          v_id_default,
          v_user_id_type
        );
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_lookup" ON "password_reset_tokens" ("token_hash", "is_used", "expires_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens";`);
  }
}
