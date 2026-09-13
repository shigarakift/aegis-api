import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    example: false,
    description:
      'Status aktif akun pengguna (true untuk mengaktifkan, false untuk suspend / menonaktifkan)',
  })
  @IsBoolean({
    message: 'isActive harus berupa nilai boolean (true atau false)',
  })
  @IsNotEmpty({ message: 'isActive wajib diisi' })
  isActive: boolean;
}
