import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceMetadataToRefreshTokens1710200000000 implements MigrationInterface {
  name = 'AddDeviceMetadataToRefreshTokens1710200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip_address" character varying(45);`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" text;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "user_agent";`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "ip_address";`,
    );
  }
}
