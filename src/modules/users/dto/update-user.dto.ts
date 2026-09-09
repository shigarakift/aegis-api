import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'user.update@aegis.local',
    description: 'Perubahan alamat email',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email?: string;

  @ApiPropertyOptional({
    example: 'Budi Santoso Update',
    description: 'Perubahan nama lengkap',
  })
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'Nama lengkap minimal 2 dan maksimal 50 karakter' })
  fullName?: string;
}
