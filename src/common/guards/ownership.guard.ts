import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum';

@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceUserId = request.params.id;

    if (!user) {
      throw new ForbiddenException('Akses ditolak: Pengguna tidak terautentikasi.');
    }

    // Admin passes ownership check automatically
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Ensure the resource belongs to the current user
    if (resourceUserId && resourceUserId !== user.id) {
      throw new ForbiddenException(
        'Akses ditolak (IDOR Protection): Anda hanya dapat mengelola data milik Anda sendiri.',
      );
    }

    return true;
  }
}
