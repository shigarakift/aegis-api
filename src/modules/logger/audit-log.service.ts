import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

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
  }) {
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
      console.error('Failed to save audit log:', error);
    }
  }
}
