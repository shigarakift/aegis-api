import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(params: {
    userId?: string;
    action: string;
    ipAddress: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          ipAddress: params.ipAddress || 'UNKNOWN',
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      // Prevent failure in audit logging from crashing the primary request flow
      console.error('Failed to save audit log:', error);
    }
  }
}
