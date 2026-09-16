import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { ValidatedFile } from '../../common/pipes/file-validation.pipe';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLogService } from '../logger/audit-log.service';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface PaginatedUsersResult {
  data: Partial<User>[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(query: QueryUserDto): Promise<PaginatedUsersResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Admin option to view soft-deleted records as well
    if (query.includeDeleted) {
      queryBuilder.withDeleted();
    }

    if (query.role) {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.search && query.search.trim()) {
      const searchTerm = `%${query.search.trim()}%`;
      queryBuilder.andWhere(
        '(user.fullName ILIKE :searchTerm OR user.email ILIKE :searchTerm)',
        { searchTerm },
      );
    }

    // Whitelist allowed sort columns
    const allowedSortFields: Record<string, string> = {
      id: 'user.id',
      email: 'user.email',
      fullName: 'user.fullName',
      role: 'user.role',
      isActive: 'user.isActive',
      createdAt: 'user.createdAt',
      updatedAt: 'user.updatedAt',
      deletedAt: 'user.deletedAt',
    };

    const sortField = allowedSortFields[query.sortBy] || 'user.createdAt';
    const sortDirection =
      query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(sortField, sortDirection);
    queryBuilder.skip(skip).take(limit);

    // Strictly whitelist returned columns (NEVER return password hash)
    queryBuilder.select([
      'user.id',
      'user.email',
      'user.fullName',
      'user.role',
      'user.isActive',
      'user.avatarUrl',
      'user.createdAt',
      'user.updatedAt',
      'user.deletedAt',
    ]);

    const [data, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: string, includeDeleted: boolean = false) {
    const query = this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id });

    if (includeDeleted) {
      query.withDeleted();
    }

    query.select([
      'user.id',
      'user.email',
      'user.fullName',
      'user.role',
      'user.isActive',
      'user.avatarUrl',
      'user.createdAt',
      'user.updatedAt',
      'user.deletedAt',
    ]);

    const user = await query.getOne();

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);

    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
        withDeleted: true,
      });
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException(
          'Email sudah digunakan oleh pengguna lain.',
        );
      }
    }

    await this.userRepository.update({ id }, dto);

    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Prevent admin from suspending their own active account (Self-lockout defense)
    if (id === adminId && !dto.isActive) {
      throw new BadRequestException(
        'Operasi ditolak: Anda tidak dapat menonaktifkan akun Administrator Anda sendiri.',
      );
    }

    await this.findOne(id, true);

    await this.userRepository.update({ id }, { isActive: dto.isActive });

    // If account is being suspended / deactivated, instantly revoke all active refresh tokens
    if (!dto.isActive) {
      await this.refreshTokenRepository.update(
        { userId: id, isRevoked: false },
        { isRevoked: true },
      );
    }

    // Non-blocking audit logging
    try {
      await this.auditLogService.logEvent({
        userId: adminId,
        action: dto.isActive
          ? 'USER_STATUS_ACTIVATED'
          : 'USER_STATUS_SUSPENDED',
        ipAddress,
        userAgent,
      });
    } catch (err) {
      // Prevent audit logging failures from breaking primary flow
    }

    return this.findOne(id, true);
  }

  async remove(
    id: string,
    operatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.findOne(id);

    // Prevent admin from deleting their own account
    if (id === operatorId && user.role === Role.ADMIN) {
      throw new BadRequestException(
        'Operasi ditolak: Anda tidak dapat menghapus akun Administrator Anda sendiri.',
      );
    }

    const now = new Date();
    // Soft delete: set deletedAt = now, isActive = false
    await this.userRepository.update(
      { id },
      {
        deletedAt: now,
        isActive: false,
      },
    );

    // Revoke all active refresh tokens immediately
    await this.refreshTokenRepository.update(
      { userId: id, isRevoked: false },
      { isRevoked: true },
    );

    // Non-blocking audit logging
    try {
      await this.auditLogService.logEvent({
        userId: operatorId,
        action: 'USER_SOFT_DELETED',
        ipAddress,
        userAgent,
      });
    } catch (err) {
      // Prevent logging failures from aborting transaction
    }

    return {
      success: true,
      message: 'Akun berhasil dinonaktifkan dan dihapus secara aman.',
    };
  }

  async updateAvatar(
    userId: string,
    file: ValidatedFile,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ avatarUrl: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('Pengguna tidak ditemukan atau sedang dinonaktifkan.');
    }

    // 1. Sanitasi nama file dengan UUID acak untuk mencegah Path Traversal & Remote Code Execution
    const fileName = `${randomUUID()}.${file.detectedExt}`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');

    // 2. Pastikan direktori penyimpanan aman tersedia
    await fs.promises.mkdir(uploadDir, { recursive: true });

    // 3. Hapus avatar lama milik pengguna jika sebelumnya ada di disk
    if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/avatars/')) {
      const oldFileName = path.basename(user.avatarUrl);
      const oldFilePath = path.join(uploadDir, oldFileName);
      try {
        await fs.promises.unlink(oldFilePath);
      } catch {
        // Abaikan jika file lama tidak ditemukan di disk
      }
    }

    // 4. Tulis file buffer baru ke disk secara aman
    const targetFilePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(targetFilePath, file.buffer);

    // 5. Update field avatarUrl di database
    const avatarUrl = `/uploads/avatars/${fileName}`;
    await this.userRepository.update(userId, {
      avatarUrl,
      updatedAt: new Date(),
    });

    // 6. Jejak audit non-blocking
    try {
      await this.auditLogService.logEvent({
        userId,
        action: 'USER_AVATAR_UPDATED',
        ipAddress,
        userAgent,
      });
    } catch {
      // Non-blocking
    }

    return { avatarUrl };
  }
}
