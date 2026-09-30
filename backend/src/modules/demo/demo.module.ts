import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { AuthModule } from '../auth/auth.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AuthModule],
  controllers: [DemoController],
  providers: [StructuredLogger, DemoService],
})
export class DemoModule {}
