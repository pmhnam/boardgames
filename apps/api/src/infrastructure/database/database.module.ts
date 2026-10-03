import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { DatabaseConnection } from './database.connection.js';

@Global()
@Module({
  providers: [
    {
      provide: DatabaseConnection,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => DatabaseConnection.connect(config),
    },
  ],
  exports: [DatabaseConnection],
})
export class DatabaseModule {}
