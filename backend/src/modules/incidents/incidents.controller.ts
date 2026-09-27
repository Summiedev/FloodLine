import { Controller, Get, Param, ParseUUIDPipe, Query, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { IncidentsService } from './incidents.service';

@Controller({ path: 'incidents', version: '1' })
@ApiTags('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({ summary: 'List map-ready flood incidents' })
  list(@Query() query: IncidentQueryDto) {
    return this.incidentsService.list(query);
  }

  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({ summary: 'Get one flood incident by ID' })
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.incidentsService.findById(id);
  }
}
