import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Budi Santoso Update', description: 'Perubahan nama lengkap' })
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'Nama lengkap minimal 2 dan maksimal 50 karakter' })
  fullName?: string;
}
