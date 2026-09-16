import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

export interface ValidatedFile extends Express.Multer.File {
  detectedExt: 'jpg' | 'png' | 'webp';
}

@Injectable()
export class FileValidationPipe implements PipeTransform<Express.Multer.File, Promise<ValidatedFile>> {
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Megabytes

  async transform(file: Express.Multer.File): Promise<ValidatedFile> {
    // 1. Verifikasi keberadaan file buffer
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('File avatar wajib diunggah.');
    }

    // 2. Proteksi ukuran file maksimum (Max 2MB)
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('Ukuran file melebihi batas maksimum 2MB.');
    }

    // 3. Verifikasi Binary Magic Number (Anti-MIME Spoofing)
    const detectedExt = this.detectMagicNumber(file.buffer);

    if (!detectedExt) {
      throw new BadRequestException(
        'Format file tidak sah. Hanya gambar JPEG, PNG, dan WebP valid yang diizinkan.',
      );
    }

    return {
      ...file,
      detectedExt,
    };
  }

  /**
   * Membaca signature byte awal file buffer secara langsung tanpa bergantung pada header Content-Type client.
   */
  private detectMagicNumber(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
    if (buffer.length < 12) {
      return null;
    }

    // 1. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'jpg';
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'png';
    }

    // 3. WebP: RIFF (bytes 0-3) dan WEBP (bytes 8-11)
    if (
      buffer.toString('utf8', 0, 4) === 'RIFF' &&
      buffer.toString('utf8', 8, 12) === 'WEBP'
    ) {
      return 'webp';
    }

    return null;
  }
}
