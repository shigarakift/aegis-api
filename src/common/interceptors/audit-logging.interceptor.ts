import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../../modules/logger/audit-log.service';

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Hanya pantau HTTP method yang mengubah status data (mutasi)
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          try {
            const userId = req.user?.id || req.user?.userId || req.user?.sub;
            const ipAddress =
              req.ip || req.socket?.remoteAddress || '127.0.0.1';
            const userAgent = req.headers['user-agent'];
            const routePath =
              (req.baseUrl || '') + (req.route?.path || req.url || '');
            const action = `HTTP_${method}_${routePath}`;

            // Asynchronous non-blocking logging
            this.auditLogService
              .logEvent({
                userId,
                action,
                ipAddress,
                userAgent,
              })
              .catch((err) => {
                if ((err as any)?.message?.includes('Connection terminated')) {
                  return;
                }
                console.error('Audit logging interceptor error:', err);
              });
          } catch (err) {
            // Ensure interceptor never throws or interrupts user request
          }
        },
      }),
    );
  }
}
