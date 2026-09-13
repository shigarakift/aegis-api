import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class QueryUserDto {
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
    description: 'Jumlah data per halaman (Maksimal 100 untuk mitigasi serangan DoS OOM)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit harus berupa bilangan bulat' })
  @Min(1, { message: 'Limit minimal bernilai 1' })
  @Max(100, { message: 'Limit maksimal bernilai 100 (Proteksi DoS)' })
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Pencarian case-insensitive pada nama lengkap atau email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: Role,
    description: 'Filter berdasarkan role pengguna',
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Role harus berupa USER atau ADMIN' })
  role?: Role;

  @ApiPropertyOptional({
    default: 'createdAt',
    description:
      'Kolom untuk pengurutan data (id, email, fullName, role, isActive, createdAt, updatedAt, deletedAt)',
  })
  @IsOptional()
  @IsString()
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Arah pengurutan data (asc atau desc)',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc', 'ASC', 'DESC'], {
    message: 'sortOrder harus bernilai asc atau desc',
  })
  sortOrder: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description:
      'Sertakan data pengguna yang telah di-soft-delete (Hanya Administrator)',
    default: false,
  })
  @IsOptional()
  @Transform(
    ({ value }) =>
      value === 'true' || value === true || value === '1' || value === 1,
  )
  @IsBoolean({ message: 'includeDeleted harus bernilai boolean (true atau false)' })
  includeDeleted?: boolean = false;
}
