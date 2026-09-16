import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('Audit Logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Mendapatkan statistik ringkas forensik keamanan (Khusus Role ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ringkasan insiden keamanan berhasil didapatkan',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (Jika bukan ADMIN)' })
  async getSummary() {
    const summary = await this.auditLogService.getSummary();
    return {
      success: true,
      data: summary,
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Mendapatkan jejak audit keamanan dengan paginasi, filter rentang tanggal, aksi, dan user (Khusus Role ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar jejak audit berhasil didapatkan',
  })
  @ApiResponse({
    status: 400,
    description: 'Parameter query tidak valid (misal format tanggal salah atau limit > 100)',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (Jika bukan ADMIN)' })
  async findAll(@Query() query: QueryAuditLogDto) {
    const result = await this.auditLogService.findAll(query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }
}
