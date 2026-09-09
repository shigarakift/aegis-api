import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'Token acak 32-byte (hex) yang diterima melalui email/notifikasi',
  })
  @IsString({ message: 'Token harus berupa string' })
  @IsNotEmpty({ message: 'Token reset wajib diisi' })
  token: string;

  @ApiProperty({
    example: 'NewSecurePass2026!',
    description: 'Kata sandi baru (minimal 8 karakter, huruf besar, kecil, angka/simbol)',
  })
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password harus mengandung setidaknya satu huruf besar, satu huruf kecil, dan satu angka/karakter khusus.',
  })
  newPassword: string;
}
