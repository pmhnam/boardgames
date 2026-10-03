import type { INestApplication } from '@nestjs/common';
import { AppExceptionFilter } from './common/filters/app-exception.filter.js';
import { AppConfig } from './config/app-config.js';

export const API_PREFIX = 'api';

/** Shared by main.ts and the e2e tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableCors({ origin: app.get(AppConfig).corsOrigin, credentials: true });
  app.enableShutdownHooks();
}
