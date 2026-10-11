import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

if (existsSync('.env')) process.loadEnvFile('.env');

const { AppModule } = await import('./app.module.js');
const { configureApp } = await import('./configure-app.js');
const { AppConfig } = await import('./config/app-config.js');

const production = process.env.NODE_ENV === 'production';

const app = await NestFactory.create(AppModule, {
  // Structured logs in production, without the per-connection chatter; readable ones in development.
  logger: new ConsoleLogger({
    json: production,
    ...(production ? { logLevels: ['log', 'warn', 'error', 'fatal'] } : {}),
  }),
});
configureApp(app);
await app.listen(app.get(AppConfig).port);
