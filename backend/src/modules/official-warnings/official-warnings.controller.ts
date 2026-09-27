import { Controller, Get, Param, ParseUUIDPipe, Query, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OfficialWarningQueryDto } from './dto/official-warning-query.dto';
import { OfficialWarningsService } from './official-warnings.service';

@Controller({ path: 'official-warnings', version: '1' })
@ApiTags('official-warnings')
export class OfficialWarningsController {
  constructor(private readonly officialWarningsService: OfficialWarningsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({ summary: 'List official flood warnings' })
  list(@Query() query: OfficialWarningQueryDto) {
    return this.officialWarningsService.list(this.officialWarningsService.toFilters(query));
  }

  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Version('1')
  @ApiOperation({ summary: 'Get one official flood warning' })
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.officialWarningsService.findById(id);
  }
}
