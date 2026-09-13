import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToUsers1710300000000 implements MigrationInterface {
  name = 'AddDeletedAtToUsers1710300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP WITH TIME ZONE;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_role_is_active";`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_role_is_active_deleted_at" ON "users" ("role", "is_active", "deleted_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_users_role_is_active_deleted_at";`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_role_is_active" ON "users" ("role", "is_active");`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at";`,
    );
  }
}
