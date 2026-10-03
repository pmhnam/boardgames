import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default('.data/pglite'),
  CORS_ORIGIN: z.string().optional(),
  ADMIN_TOKEN: z.string().optional(),
});

const DEV_JWT_SECRET = 'dev-only-secret';

@Injectable()
export class AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly jwtSecret: string;
  /** Empty means "use embedded PGlite". */
  readonly databaseUrl: string | null;
  readonly pgliteDataDir: string;
  readonly corsOrigin: string | true;
  /** Null means admin endpoints are switched off. */
  readonly adminToken: string | null;

  constructor() {
    const env = envSchema.parse(process.env);
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      throw new Error('JWT_SECRET must be set in production');
    }
    this.nodeEnv = env.NODE_ENV;
    this.port = env.PORT;
    this.jwtSecret = env.JWT_SECRET ?? DEV_JWT_SECRET;
    this.databaseUrl = env.DATABASE_URL ? env.DATABASE_URL : null;
    this.pgliteDataDir = env.PGLITE_DATA_DIR;
    this.corsOrigin = env.CORS_ORIGIN ?? true;
    this.adminToken = env.ADMIN_TOKEN ? env.ADMIN_TOKEN : null;
  }
}
