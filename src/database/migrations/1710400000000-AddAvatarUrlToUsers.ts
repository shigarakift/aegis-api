import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarUrlToUsers1710400000000 implements MigrationInterface {
  name = 'AddAvatarUrlToUsers1710400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" character varying(500);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_url";`,
    );
  }
}
