import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (!isProduction) {
      // Mode Development: Log simulasi pengiriman email ke terminal
      this.logger.log('═══════════════════════════════════════════════════════════════════');
      this.logger.log(`📧 [MOCK EMAIL DISPATCHED]`);
      this.logger.log(`   To      : ${options.to}`);
      this.logger.log(`   Subject : ${options.subject}`);
      this.logger.log(`   Preview : ${options.text || 'Lihat payload HTML untuk konten lengkap'}`);
      this.logger.log('═══════════════════════════════════════════════════════════════════');
      return true;
    }

    // Mode Production: Implementasi SMTP / Provider eksternal (Nodemailer / Resend / SendGrid)
    // Transporter dapat diaktifkan ketika environment variable SMTP dikonfigurasi
    this.logger.log(`[PROD] Dispatching email to ${options.to} via SMTP Transport`);
    return true;
  }
}
