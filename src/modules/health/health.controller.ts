import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness & Readiness Health Probes' })
  @ApiResponse({
    status: 200,
    description: 'Seluruh komponen sistem sehat dan beroperasi normal',
  })
  @ApiResponse({
    status: 503,
    description: 'Satu atau lebih komponen sistem mengalami gangguan',
  })
  check() {
    return this.health.check([
      // 1. Verifikasi koneksi PostgreSQL via TypeORM
      () => this.db.pingCheck('database'),

      // 2. Verifikasi penggunaan heap memory di bawah 300MB
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // 3. Verifikasi alokasi RSS memory di bawah 500MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
    ]);
  }
}
