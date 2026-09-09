import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrasi Pengguna Baru (Role USER)' })
  @ApiResponse({ status: 201, description: 'User berhasil mendaftar' })
  @ApiResponse({ status: 400, description: 'Payload tidak valid' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const user = await this.authService.register(dto, ipAddress, userAgent);
    return {
      success: true,
      message: 'Registrasi akun berhasil.',
      data: user,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Strict rate-limit: 5 attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login Pengguna (Menerbitkan Dual JWT Token)' })
  @ApiResponse({ status: 200, description: 'Login berhasil, token diberikan' })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid' })
  @ApiResponse({ status: 429, description: 'Batas percobaan login terlampaui' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ipAddress, userAgent);

    // Send Refresh Token via HTTP-Only Secure Cookie
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      message: 'Login berhasil.',
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Memperbarui Access Token menggunakan Refresh Token' })
  async refresh(
    @CurrentUser() payload: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const tokens = await this.authService.refreshToken(
      payload.userId,
      payload.refreshToken,
      ipAddress,
      userAgent,
    );

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      message: 'Access Token berhasil diperbarui.',
      data: {
        accessToken: tokens.accessToken,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout Pengguna (Revoke Refresh Token)' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'];
    await this.authService.logout(userId, rawRefreshToken);
    res.clearCookie('refresh_token');

    return {
      success: true,
      message: 'Logout berhasil, sesi telah diakhiri.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Anti-Brute-Force: Maks 3 request per menit
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permintaan Reset Kata Sandi (Anti-User Enumeration Protected)',
  })
  @ApiResponse({
    status: 200,
    description: 'Instruksi reset password dikirim (respon seragam)',
  })
  @ApiResponse({ status: 429, description: 'Rate limit terlampaui' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.forgotPassword(dto, ipAddress, userAgent);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Maks 5 percobaan per menit
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eksekusi Reset Kata Sandi Menggunakan Token',
  })
  @ApiResponse({
    status: 200,
    description: 'Kata sandi berhasil diubah dan seluruh sesi di-revoke',
  })
  @ApiResponse({
    status: 400,
    description: 'Token tidak valid, kedaluwarsa, atau sudah pernah digunakan',
  })
  @ApiResponse({ status: 429, description: 'Rate limit terlampaui' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.resetPassword(dto, ipAddress, userAgent);
    return result;
  }

  @Get('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ambil Daftar Sesi Aktif Pengguna' })
  @ApiResponse({
    status: 200,
    description: 'Daftar sesi aktif berhasil diambil',
  })
  async getSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'];
    const sessions = await this.authService.getActiveSessions(
      userId,
      rawRefreshToken,
    );
    return {
      success: true,
      data: sessions,
    };
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cabut Semua Sesi Lain (Logout dari Seluruh Perangkat Lain)',
  })
  @ApiResponse({
    status: 200,
    description: 'Seluruh sesi perangkat lain berhasil dicabut',
  })
  @ApiResponse({
    status: 400,
    description: 'Refresh token sesi saat ini tidak ditemukan pada cookie',
  })
  async revokeOtherSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const rawRefreshToken = req.cookies?.['refresh_token'];
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.revokeOtherSessions(
      userId,
      rawRefreshToken,
      ipAddress,
      userAgent,
    );
    return result;
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cabut Sesi Spesifik (Remote Logout Perangkat Tertentu)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesi berhasil dicabut',
  })
  @ApiResponse({
    status: 404,
    description: 'Sesi tidak ditemukan atau telah dicabut (IDOR safe)',
  })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.revokeSession(
      userId,
      sessionId,
      ipAddress,
      userAgent,
    );
    return result;
  }
}

