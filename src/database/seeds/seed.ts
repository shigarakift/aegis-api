import * as dotenv from 'dotenv';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Role } from '../../common/enums/role.enum';
import { AppDataSource } from '../data-source';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

dotenv.config();

async function main() {
  console.log('🌱 Menjalankan database seeder (TypeORM)...');

  await AppDataSource.initialize();

  // Pastikan kolom id dan timestamp memiliki default di level database jika tabel dibuat sebelumnya tanpa default
  try {
    await AppDataSource.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
      ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE "refresh_tokens" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
      ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE "audit_logs" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
      ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
    `);
  } catch (err) {
    // Abaikan jika alter column gagal atau tidak didukung pada skema tertentu
  }

  const userRepository = AppDataSource.getRepository(User);
  const auditLogRepository = AppDataSource.getRepository(AuditLog);

  try {
    const adminHash = await argon2.hash('AdminSecure2026!', {
      type: argon2.argon2id,
    });
    const userHash = await argon2.hash('UserSecure2026!', {
      type: argon2.argon2id,
    });

    const now = new Date();

    // 1. Seed / Upsert Administrator Account
    let admin = await userRepository.findOne({
      where: { email: 'admin@aegis.local' },
    });
    if (!admin) {
      admin = userRepository.create({
        id: randomUUID(),
        email: 'admin@aegis.local',
        password: adminHash,
        fullName: 'System Administrator',
        role: Role.ADMIN,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      admin = await userRepository.save(admin);
    } else {
      admin.password = adminHash;
      admin.fullName = 'System Administrator';
      admin.role = Role.ADMIN;
      admin.isActive = true;
      admin.updatedAt = now;
      admin = await userRepository.save(admin);
    }

    // 2. Seed / Upsert Standard Demo User Account
    let demoUser = await userRepository.findOne({
      where: { email: 'user@aegis.local' },
    });
    if (!demoUser) {
      demoUser = userRepository.create({
        id: randomUUID(),
        email: 'user@aegis.local',
        password: userHash,
        fullName: 'Demo Standard User',
        role: Role.USER,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      demoUser = await userRepository.save(demoUser);
    } else {
      demoUser.password = userHash;
      demoUser.fullName = 'Demo Standard User';
      demoUser.role = Role.USER;
      demoUser.isActive = true;
      demoUser.updatedAt = now;
      demoUser = await userRepository.save(demoUser);
    }

    // 3. Catat jejak audit inisialisasi / seeding
    const auditLog = auditLogRepository.create({
      id: randomUUID(),
      userId: admin.id,
      action: 'SYSTEM_DATABASE_SEEDED',
      ipAddress: '127.0.0.1',
      userAgent: 'TypeORM Seeder Script',
      createdAt: now,
    });
    await auditLogRepository.save(auditLog);

    console.log('✅ Database Seeding berhasil diselesaikan:');
    console.log(`   - Superadmin : ${admin.email} (Role: ${admin.role})`);
    console.log(`   - Demo User  : ${demoUser.email} (Role: ${demoUser.role})`);
    console.log(`   - Audit Log  : SYSTEM_DATABASE_SEEDED tercatat.`);
  } catch (error) {
    console.error('❌ Gagal seeding:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
