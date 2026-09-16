import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Password saat ini untuk verifikasi identitas',
    example: 'OldSecurePass2026!',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password saat ini tidak boleh kosong.' })
  currentPassword: string;

  @ApiProperty({
    description:
      'Password baru minimal 8 karakter dengan kombinasi huruf besar, huruf kecil, dan angka/simbol',
    example: 'NewSecurePass2026!',
  })
  @IsString()
  @MinLength(8, { message: 'Password baru minimal 8 karakter.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password baru harus mengandung kombinasi huruf besar, huruf kecil, dan angka atau simbol.',
  })
  newPassword: string;
}
