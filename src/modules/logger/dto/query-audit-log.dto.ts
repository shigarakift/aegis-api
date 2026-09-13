import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryAuditLogDto {
  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    description: 'Nomor halaman (page number)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page harus berupa bilangan bulat' })
  @Min(1, { message: 'Page minimal bernilai 1' })
  page: number = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Jumlah log per halaman (Maksimal 100 untuk mitigasi serangan DoS OOM)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100 (Proteksi DoS)' })
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan nama aksi (contoh: LOGIN_FAILED, USER_SOFT_DELETED)',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter berdasarkan ID pengguna (UUID)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId harus berupa format UUID v4 yang valid' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter batas awal tanggal kejadian (format ISO 8601, contoh: 2026-09-01T00:00:00.000Z)',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'startDate harus berupa string ISO 8601 yang valid' })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter batas akhir tanggal kejadian (format ISO 8601, contoh: 2026-09-30T23:59:59.999Z)',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'endDate harus berupa string ISO 8601 yang valid' })
  endDate?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    description: 'Kolom untuk pengurutan log (id, userId, action, ipAddress, createdAt)',
  })
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Arah pengurutan log (asc atau desc)',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc', 'ASC', 'DESC'], {
    message: 'sortOrder harus bernilai asc atau desc',
  })
  sortOrder: 'asc' | 'desc' = 'desc';
}
