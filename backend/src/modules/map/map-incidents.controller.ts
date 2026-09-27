import { Controller, Get, Query, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MapIncidentsQueryDto } from './dto/map-incidents-query.dto';
import { MapIncidentsService } from './map-incidents.service';

@Controller({ path: 'map/incidents', version: '1' })
@ApiTags('map')
export class MapIncidentsController {
  constructor(private readonly service: MapIncidentsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({ summary: 'Get bounded, incremental map incident markers' })
  get(@Query() query: MapIncidentsQueryDto) {
    return this.service.getFeed(query);
  }
}
