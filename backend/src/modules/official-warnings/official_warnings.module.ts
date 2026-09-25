import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { OfficialWarningsController } from './official-warnings.controller';
import { OfficialWarningsRepository } from './official-warnings.repository';
import { OfficialWarningsService } from './official-warnings.service';

@Module({
  controllers: [OfficialWarningsController],
  providers: [StructuredLogger, OfficialWarningsRepository, OfficialWarningsService],
  exports: [OfficialWarningsService],
})
export class OfficialWarningsModule {}
