import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Alamat email aktif' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiProperty({
    example: 'P@ssword123',
    description: 'Password minimal 8 karakter, mengandung huruf besar, kecil, dan angka/simbol',
  })
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password harus mengandung setidaknya satu huruf besar, satu huruf kecil, dan satu angka/karakter khusus.',
  })
  password: string;

  @ApiProperty({ example: 'Budi Santoso', description: 'Nama lengkap pengguna' })
  @IsString()
  @Length(2, 50, { message: 'Nama lengkap minimal 2 dan maksimal 50 karakter' })
  fullName: string;
}
