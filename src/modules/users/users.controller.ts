import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mendapatkan profil pengguna yang sedang login' })
  @ApiResponse({ status: 200, description: 'Profil pengguna berhasil didapatkan' })
  @ApiResponse({ status: 401, description: 'Tidak terautentikasi' })
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findOne(userId);
    return {
      success: true,
      data: user,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Mendapatkan daftar seluruh pengguna dengan paginasi, sorting, dan filter (Khusus Role ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar user dan metadata paginasi berhasil didapatkan',
  })
  @ApiResponse({
    status: 400,
    description: 'Parameter query tidak valid (misal: limit > 100)',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (Jika bukan ADMIN)' })
  async findAll(@Query() query: QueryUserDto) {
    const result = await this.usersService.findAll(query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary:
      'Mendapatkan detail pengguna berdasarkan ID (Protected against IDOR)',
  })
  @ApiResponse({ status: 200, description: 'Detail user berhasil didapatkan' })
  @ApiResponse({ status: 403, description: 'Akses ditolak (IDOR)' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      data: user,
    };
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({
    summary:
      'Memperbarui profil pengguna berdasarkan ID (Protected against IDOR)',
  })
  @ApiResponse({ status: 200, description: 'Data pengguna berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Payload tidak valid' })
  @ApiResponse({ status: 403, description: 'Akses ditolak (IDOR)' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updatedUser = await this.usersService.update(id, dto);
    return {
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
      data: updatedUser,
    };
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Mengubah status aktif / suspend akun pengguna (Khusus Role ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Status pengguna berhasil diperbarui',
  })
  @ApiResponse({
    status: 400,
    description: 'Payload tidak valid atau mencoba suspend akun sendiri',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (Jika bukan ADMIN)' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const updatedUser = await this.usersService.updateStatus(
      id,
      dto,
      adminId,
      ipAddress,
      userAgent,
    );
    return {
      success: true,
      message: 'Status pengguna berhasil diperbarui.',
      data: updatedUser,
    };
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Soft delete dan deactive akun pengguna (User pemilik atau ADMIN)',
  })
  @ApiResponse({
    status: 200,
    description: 'Akun berhasil dinonaktifkan dan dihapus secara aman',
  })
  @ApiResponse({ status: 403, description: 'Akses ditolak (IDOR)' })
  @ApiResponse({ status: 404, description: 'Pengguna tidak ditemukan' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') operatorId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    return this.usersService.remove(id, operatorId, ipAddress, userAgent);
  }
}
