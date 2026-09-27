import { Body, Controller, Post, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RoutePreviewDto } from './dto/route-preview.dto';
import { RoutingService } from './routing.service';
import type { RoutePreviewResponse } from './routing.types';

@Controller({ path: 'routes', version: '1' })
@ApiTags('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('preview')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({
    summary: 'Preview route candidates with currently known reported flood risk',
  })
  preview(@Body() dto: RoutePreviewDto): Promise<RoutePreviewResponse> {
    return this.routingService.preview({
      origin: dto.origin,
      destination: dto.destination,
      travelMode: dto.travelMode,
      ...(dto.waypoints ? { waypoints: dto.waypoints } : {}),
    });
  }
}
