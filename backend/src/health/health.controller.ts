import { Controller, Get, HttpStatus, Res, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
@ApiTags('system')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Liveness check' })
  liveness(): ReturnType<HealthService['liveness']> {
    return this.healthService.liveness();
  }

  @Get('ready')
  @Version('1')
  @ApiOperation({ summary: 'Readiness check for critical dependencies' })
  async readiness(@Res({ passthrough: true }) response: Response) {
    const result = await this.healthService.readiness();
    response.status(result.status === 'ready' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
