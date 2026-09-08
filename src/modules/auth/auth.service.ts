import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLogService } from '../logger/audit-log.service';
import { Argon2Service } from './argon2.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly argon2Service: Argon2Service,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
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
    await this.storeRefreshToken(user.id, tokens.refreshToken);

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
      throw new UnauthorizedException('Akses ditolak: Akun tidak ditemukan.');
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
      await this.auditLogService.logEvent({
        userId,
        action: 'REFRESH_TOKEN_INVALID_OR_REVOKED',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Refresh token tidak valid atau telah dicabut.');
    }

    // Revoke old token for rotation
    await this.refreshTokenRepository.update(matchingTokenRecord.id, {
      isRevoked: true,
    });

    // Issue new token pair
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

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

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const tokenHash = await this.argon2Service.hash(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const tokenRecord = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
    });
    await this.refreshTokenRepository.save(tokenRecord);
  }
}
