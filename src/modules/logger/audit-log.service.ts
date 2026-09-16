import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface PaginatedAuditLogsResult {
  data: AuditLog[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SecuritySummaryResult {
  failedLogins24h: number;
  suspiciousIps: string[];
  totalSecurityEvents: number;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async logEvent(params: {
    userId?: string;
    action: string;
    ipAddress: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        userId: params.userId || null,
        action: params.action,
        ipAddress: params.ipAddress || 'UNKNOWN',
        userAgent: params.userAgent || null,
      });
      await this.auditLogRepository.save(log);
    } catch (error) {
      // Prevent failure in audit logging from crashing the primary request flow
      if ((error as any)?.message?.includes('Connection terminated')) {
        return;
      }
      console.error('Failed to save audit log:', error);
    }
  }

  async findAll(query: QueryAuditLogDto): Promise<PaginatedAuditLogsResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    if (query.userId) {
      queryBuilder.andWhere('auditLog.userId = :userId', {
        userId: query.userId,
      });
    }

    if (query.action && query.action.trim()) {
      const actionTerm = `%${query.action.trim()}%`;
      queryBuilder.andWhere('auditLog.action ILIKE :actionTerm', {
        actionTerm,
      });
    }

    if (query.startDate) {
      queryBuilder.andWhere('auditLog.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('auditLog.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    // Whitelist allowed sort columns
    const allowedSortFields: Record<string, string> = {
      id: 'auditLog.id',
      userId: 'auditLog.userId',
      action: 'auditLog.action',
      ipAddress: 'auditLog.ipAddress',
      createdAt: 'auditLog.createdAt',
    };

    const sortField = allowedSortFields[query.sortBy] || 'auditLog.createdAt';
    const sortDirection =
      query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryBuilder.orderBy(sortField, sortDirection);
    queryBuilder.skip(skip).take(limit);

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

  async getSummary(): Promise<SecuritySummaryResult> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Hitung total login gagal dalam 24 jam terakhir
    const failedLogins24h = await this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.createdAt >= :twentyFourHoursAgo', { twentyFourHoursAgo })
      .andWhere('log.action ILIKE :failedAction', {
        failedAction: '%LOGIN_FAILED%',
      })
      .getCount();

    // 2. Kumpulkan IP mencurigakan (memicu insiden keamanan berulang dalam 24 jam terakhir)
    const suspiciousRaw = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.ipAddress', 'ipAddress')
      .addSelect('COUNT(log.id)', 'count')
      .where('log.createdAt >= :twentyFourHoursAgo', { twentyFourHoursAgo })
      .andWhere(
        '(log.action ILIKE :failed OR log.action ILIKE :alert OR log.action ILIKE :denied)',
        {
          failed: '%LOGIN_FAILED%',
          alert: '%SECURITY_ALERT%',
          denied: '%ACCESS_DENIED%',
        },
      )
      .groupBy('log.ipAddress')
      .having('COUNT(log.id) >= 2')
      .getRawMany();

    const suspiciousIps: string[] = suspiciousRaw
      .map((row) => row.ipAddress)
      .filter((ip) => ip && ip !== 'UNKNOWN');

    // 3. Hitung seluruh insiden keamanan yang tercatat
    const totalSecurityEvents = await this.auditLogRepository
      .createQueryBuilder('log')
      .where(
        '(log.action ILIKE :failed OR log.action ILIKE :alert OR log.action ILIKE :denied OR log.action ILIKE :softDelete OR log.action ILIKE :suspended)',
        {
          failed: '%LOGIN_FAILED%',
          alert: '%SECURITY_ALERT%',
          denied: '%ACCESS_DENIED%',
          softDelete: '%USER_SOFT_DELETED%',
          suspended: '%USER_STATUS_SUSPENDED%',
        },
      )
      .getCount();

    return {
      failedLogins24h,
      suspiciousIps,
      totalSecurityEvents,
    };
  }
}
