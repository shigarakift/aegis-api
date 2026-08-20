import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mendapatkan profil pengguna yang sedang login' })
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
  @ApiOperation({ summary: 'Mendapatkan seluruh daftar pengguna (Khusus Role ADMIN)' })
  @ApiResponse({ status: 200, description: 'Daftar user berhasil didapatkan' })
  @ApiResponse({ status: 403, description: 'Forbidden (Jika bukan ADMIN)' })
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Mendapatkan detail pengguna berdasarkan ID (Protected against IDOR)' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      data: user,
    };
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @ApiOperation({ summary: 'Memperbarui profil pengguna berdasarkan ID (Protected against IDOR)' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updatedUser = await this.usersService.update(id, dto);
    return {
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
      data: updatedUser,
    };
  }
}
