import type { INestApplication } from '@nestjs/common';
import type { Application } from 'express';
import { AppExceptionFilter } from './common/filters/app-exception.filter.js';
import { AppConfig } from './config/app-config.js';

export const API_PREFIX = 'api';

/** Shared by main.ts and the e2e tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AppExceptionFilter());
  const config = app.get(AppConfig);
  // Behind a proxy every request arrives from the proxy; this makes `request.ip` the caller's.
  (app.getHttpAdapter().getInstance() as Application).set('trust proxy', config.trustProxy);
  app.enableCors({ origin: config.corsOrigin, credentials: true });
  app.enableShutdownHooks();
}
