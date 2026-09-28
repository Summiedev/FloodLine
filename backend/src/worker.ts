import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logging/structured-logger.service';

async function bootstrapWorker(): Promise<void> {
  if (process.env.JOBS_PROCESSOR_ENABLED !== 'true') {
    throw new Error('Set JOBS_PROCESSOR_ENABLED=true before starting the FloodLine worker');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  logger.log({}, 'FloodLine queue worker started');
}

void bootstrapWorker();
