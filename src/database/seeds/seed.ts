import * as argon2 from 'argon2';
import { Role } from '../../common/enums/role.enum';
import { AppDataSource } from '../data-source';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

async function main() {
  console.log('🌱 Menjalankan database seeder (TypeORM)...');

  await AppDataSource.initialize();
  const userRepository = AppDataSource.getRepository(User);
  const auditLogRepository = AppDataSource.getRepository(AuditLog);

  try {
    const adminHash = await argon2.hash('AdminSecure2026!', {
      type: argon2.argon2id,
    });
    const userHash = await argon2.hash('UserSecure2026!', {
      type: argon2.argon2id,
    });

    let admin = await userRepository.findOne({
      where: { email: 'admin@aegis.local' },
    });
    if (!admin) {
      admin = userRepository.create({
        email: 'admin@aegis.local',
        password: adminHash,
        fullName: 'System Administrator',
        role: Role.ADMIN,
        isActive: true,
      });
      admin = await userRepository.save(admin);
    }

    let demoUser = await userRepository.findOne({
      where: { email: 'user@aegis.local' },
    });
    if (!demoUser) {
      demoUser = userRepository.create({
        email: 'user@aegis.local',
        password: userHash,
        fullName: 'Demo Standard User',
        role: Role.USER,
        isActive: true,
      });
      demoUser = await userRepository.save(demoUser);
    }

    const auditLog = auditLogRepository.create({
      userId: admin.id,
      action: 'SYSTEM_DATABASE_SEEDED',
      ipAddress: '127.0.0.1',
      userAgent: 'TypeORM Seeder Script',
    });
    await auditLogRepository.save(auditLog);

    console.log('✅ Seeding berhasil:');
    console.log(`   - Admin: ${admin.email}`);
    console.log(`   - User : ${demoUser.email}`);
  } catch (error) {
    console.error('❌ Gagal seeding:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

main();
