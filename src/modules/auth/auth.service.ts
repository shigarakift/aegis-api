import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLogService } from '../logger/audit-log.service';
import { MailerService } from '../mailer/mailer.service';
import { getPasswordResetTemplate } from '../mailer/templates/password-reset.template';
import { Argon2Service } from './argon2.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly argon2Service: Argon2Service,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto, ipAddress: string, userAgent?: string) {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email sudah terdaftar dalam sistem.');
    }

    const hashedPassword = await this.argon2Service.hash(dto.password);

    const newUser = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      fullName: dto.fullName,
      role: Role.USER, // Enforcement: public registration can only create USER role
    });

    const user = await this.userRepository.save(newUser);

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'USER_REGISTER_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Mencegah User Enumeration Attack (mengabaikan pemberitahuan apakah email/pass yg salah)
    if (!user || !user.isActive) {
      await this.auditLogService.logEvent({
        action: 'LOGIN_FAILED_INVALID_CREDENTIALS',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Email atau password yang Anda masukkan salah.');
    }

    const isPasswordValid = await this.argon2Service.verify(
      user.password,
      dto.password,
    );

    if (!isPasswordValid) {
      await this.auditLogService.logEvent({
        userId: user.id,
        action: 'LOGIN_FAILED_WRONG_PASSWORD',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Email atau password yang Anda masukkan salah.');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken, ipAddress, userAgent);

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refreshToken(
    userId: string,
    rawRefreshToken: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Akses ditolak: Akun tidak ditemukan atau telah dinonaktifkan.');
    }

    const activeTokens = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    let matchingTokenRecord: RefreshToken | null = null;
    for (const record of activeTokens) {
      const isMatch = await this.argon2Service.verify(
        record.tokenHash,
        rawRefreshToken,
      );
      if (isMatch) {
        matchingTokenRecord = record;
        break;
      }
    }

    if (!matchingTokenRecord) {
      // Periksa apakah token yang dikirim adalah token yang sudah pernah di-revoke (Deteksi Replay / Reuse Attack)
      const revokedTokens = await this.refreshTokenRepository.find({
        where: {
          userId,
          isRevoked: true,
        },
        order: { createdAt: 'DESC' },
        take: 50,
      });

      let isTokenReused = false;
      for (const record of revokedTokens) {
        const isMatch = await this.argon2Service.verify(
          record.tokenHash,
          rawRefreshToken,
        );
        if (isMatch) {
          isTokenReused = true;
          break;
        }
      }

      if (isTokenReused) {
        // DETEKSI PELANGGARAN KEAMANAN: Token Reuse Detected!
        // Otomatis cabut seluruh token aktif user (Family Revocation)
        await this.refreshTokenRepository.update(
          { userId, isRevoked: false },
          { isRevoked: true },
        );

        await this.auditLogService.logEvent({
          userId,
          action: 'SECURITY_ALERT_REFRESH_TOKEN_REUSE',
          ipAddress,
          userAgent,
        });

        throw new UnauthorizedException(
          'Aktivitas mencurigakan terdeteksi (token reuse). Seluruh sesi telah dicabut. Silakan login kembali.',
        );
      }

      await this.auditLogService.logEvent({
        userId,
        action: 'REFRESH_TOKEN_INVALID_OR_REVOKED',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Refresh token tidak valid atau telah dicabut.');
    }

    // Issue new token pair
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Atomic transaction: Revoke token lama dan terbitkan token baru dengan familyId yang sama
    await this.refreshTokenRepository.manager.transaction(async (manager) => {
      await manager.update(RefreshToken, matchingTokenRecord!.id, {
        isRevoked: true,
      });

      const tokenHash = await this.argon2Service.hash(tokens.refreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const newToken = manager.create(RefreshToken, {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
        familyId: matchingTokenRecord!.familyId,
      });
      await manager.save(RefreshToken, newToken);
    });

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'REFRESH_TOKEN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return tokens;
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const activeTokens = await this.refreshTokenRepository.find({
        where: { userId, isRevoked: false },
      });

      for (const record of activeTokens) {
        const isMatch = await this.argon2Service.verify(
          record.tokenHash,
          rawRefreshToken,
        );
        if (isMatch) {
          await this.refreshTokenRepository.update(record.id, {
            isRevoked: true,
          });
          break;
        }
      }
    } else {
      // Revoke all tokens for this user
      await this.refreshTokenRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true },
      );
    }

    await this.auditLogService.logEvent({
      userId,
      action: 'LOGOUT_SUCCESS',
      ipAddress: 'N/A',
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
    familyId?: string,
  ) {
    const tokenHash = await this.argon2Service.hash(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const tokenRecord = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
      ...(familyId ? { familyId } : {}),
    });
    await this.refreshTokenRepository.save(tokenRecord);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const genericResponse = {
      success: true,
      message:
        'Jika email terdaftar, instruksi pemulihan kata sandi telah dikirim ke inbox Anda.',
    };

    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Anti-User Enumeration: Selalu return genericResponse meskipun email tidak terdaftar atau tidak aktif
    if (!user || !user.isActive) {
      await this.auditLogService.logEvent({
        action: 'PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL',
        ipAddress,
        userAgent,
      });
      return genericResponse;
    }

    // Invalidate semua token reset lama yang belum dipakai milik user ini
    await this.passwordResetTokenRepository.update(
      { userId: user.id, isUsed: false },
      { isUsed: true },
    );

    // Generate cryptographic raw token 32-byte hex (64 karakter)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token kedaluwarsa dalam 15 menit
    const expiresInMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const resetRecord = this.passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      isUsed: false,
    });
    await this.passwordResetTokenRepository.save(resetRecord);

    // Buat tautan / instruksi pemulihan
    const clientUrl = this.configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    const resetLink = `${clientUrl}/auth/reset-password?token=${rawToken}`;
    const emailTemplate = getPasswordResetTemplate({
      fullName: user.fullName,
      resetLink,
      expiresInMinutes,
    });

    // Kirim email secara non-blocking
    this.mailerService
      .sendMail({
        to: user.email,
        subject: 'Instruksi Pemulihan Kata Sandi - aegisAPI',
        html: emailTemplate.html,
        text: `${emailTemplate.text}\n[Token Reset]: ${rawToken}`,
      })
      .catch((err) => console.error('Failed to dispatch reset email:', err));

    await this.auditLogService.logEvent({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      ipAddress,
      userAgent,
    });

    return genericResponse;
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    // Hash input token dengan SHA-256 untuk dicocokkan dengan yang ada di database
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');

    const tokenRecord = await this.passwordResetTokenRepository.findOne({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });

    if (!tokenRecord || !tokenRecord.user || !tokenRecord.user.isActive) {
      await this.auditLogService.logEvent({
        action: 'PASSWORD_RESET_FAILED_INVALID_OR_EXPIRED_TOKEN',
        ipAddress,
        userAgent,
      });
      throw new BadRequestException(
        'Token reset kata sandi tidak valid atau telah kedaluwarsa.',
      );
    }

    // Hash password baru menggunakan Argon2id
    const newHashedPassword = await this.argon2Service.hash(dto.newPassword);

    // Perbarui kata sandi user
    await this.userRepository.update(tokenRecord.userId, {
      password: newHashedPassword,
      updatedAt: new Date(),
    });

    // Tandai token reset ini telah digunakan (One-Time Use)
    await this.passwordResetTokenRepository.update(tokenRecord.id, {
      isUsed: true,
    });

    // Invalidation seluruh sesi refresh token aktif (Force logout semua perangkat)
    await this.refreshTokenRepository.update(
      { userId: tokenRecord.userId, isRevoked: false },
      { isRevoked: true },
    );

    await this.auditLogService.logEvent({
      userId: tokenRecord.userId,
      action: 'PASSWORD_RESET_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message:
        'Password berhasil diubah. Seluruh sesi lama telah dihentikan, silakan login kembali dengan password baru.',
    };
  }

  async getActiveSessions(
    userId: string,
    currentRawRefreshToken?: string,
  ): Promise<
    Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: Date;
      isCurrent: boolean;
    }>
  > {
    const activeTokens = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const sessions = await Promise.all(
      activeTokens.map(async (token) => {
        let isCurrent = false;
        if (currentRawRefreshToken) {
          try {
            isCurrent = await this.argon2Service.verify(
              token.tokenHash,
              currentRawRefreshToken,
            );
          } catch {
            isCurrent = false;
          }
        }
        return {
          id: token.id,
          ipAddress: token.ipAddress || null,
          userAgent: token.userAgent || null,
          createdAt: token.createdAt,
          isCurrent,
        };
      }),
    );

    return sessions;
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const token = await this.refreshTokenRepository.findOne({
      where: {
        id: sessionId,
        userId,
        isRevoked: false,
      },
    });

    // IDOR defense: if session does not exist or does not belong to user, return 404
    if (!token) {
      throw new NotFoundException('Sesi tidak ditemukan atau telah dicabut.');
    }

    await this.refreshTokenRepository.update(token.id, {
      isRevoked: true,
    });

    await this.auditLogService.logEvent({
      userId,
      action: 'SESSION_REVOKED',
      ipAddress: ipAddress || 'N/A',
      userAgent,
    });

    return {
      success: true,
      message: 'Sesi berhasil dicabut.',
    };
  }

  async revokeOtherSessions(
    userId: string,
    currentRawRefreshToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!currentRawRefreshToken) {
      throw new BadRequestException(
        'Refresh token sesi saat ini tidak ditemukan. Silakan login kembali.',
      );
    }

    const activeTokens = await this.refreshTokenRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    let currentTokenId: string | null = null;
    for (const token of activeTokens) {
      try {
        const isMatch = await this.argon2Service.verify(
          token.tokenHash,
          currentRawRefreshToken,
        );
        if (isMatch) {
          currentTokenId = token.id;
          break;
        }
      } catch {
        // continue
      }
    }

    // Revoke all active tokens except the current one
    const tokensToRevoke = activeTokens.filter(
      (token) => token.id !== currentTokenId,
    );

    for (const token of tokensToRevoke) {
      await this.refreshTokenRepository.update(token.id, {
        isRevoked: true,
      });
    }

    await this.auditLogService.logEvent({
      userId,
      action: 'OTHER_SESSIONS_REVOKED',
      ipAddress: ipAddress || 'N/A',
      userAgent,
    });

    return {
      success: true,
      message: 'Seluruh sesi perangkat lain berhasil dicabut.',
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Akun tidak ditemukan atau sedang dinonaktifkan.');
    }

    // 1. Verifikasi kecocokan password saat ini
    const isCurrentPasswordValid = await this.argon2Service.verify(
      user.password,
      dto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      await this.auditLogService.logEvent({
        userId,
        action: 'PASSWORD_CHANGE_FAILED_WRONG_CURRENT',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Password saat ini salah.');
    }

    // 2. Cegah penggunaan password baru yang sama persis dengan password saat ini
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password saat ini.',
      );
    }

    // 3. Hash password baru dengan Argon2id
    const newHashedPassword = await this.argon2Service.hash(dto.newPassword);

    // 4. Update password dan cabut seluruh refresh token aktif dalam satu transaksi DB
    await this.userRepository.manager.transaction(async (manager) => {
      await manager.update(User, userId, {
        password: newHashedPassword,
        updatedAt: new Date(),
      });

      await manager.update(
        RefreshToken,
        { userId, isRevoked: false },
        { isRevoked: true },
      );
    });

    // 5. Catat jejak audit keberhasilan ubah password
    await this.auditLogService.logEvent({
      userId,
      action: 'PASSWORD_CHANGE_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      message:
        'Password berhasil diubah. Seluruh sesi aktif di perangkat lain telah diakhiri.',
    };
  }
}

