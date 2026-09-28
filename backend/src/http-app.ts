import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLogger } from './common/logging/structured-logger.service';

export async function createHttpApplication(options?: { enableShutdownHooks?: boolean }) {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = app.get(StructuredLogger);

  app.useLogger(logger);
  const httpServer = app.getHttpAdapter().getInstance() as unknown as {
    disable: (setting: string) => void;
  };
  httpServer.disable('x-powered-by');
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb' }));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  if (options?.enableShutdownHooks) {
    app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.enableCors({
    origin: configService.getOrThrow<string[]>('app.corsOrigins'),
    credentials: true,
  });

  if (configService.getOrThrow<boolean>('docs.enabled')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FloodLine API')
      .setDescription('FloodLine flood awareness and safer-routing platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  return { app, configService, logger };
}
