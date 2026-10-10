import { Injectable } from '@nestjs/common';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default('.data/pglite'),
  CORS_ORIGIN: z.string().optional(),
  ADMIN_USERNAME: z.string().trim().max(32).optional(),
  ADMIN_PASSWORD: z.string().max(256).optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(8).default(0),
  BOT_ACTION_DELAY_MS: z.coerce.number().int().min(0).max(10_000).default(700),
});

const DEV_JWT_SECRET = 'dev-only-secret';
const MIN_ADMIN_PASSWORD_LENGTH = 12;

export interface AdminCredentials {
  username: string;
  password: string;
}

@Injectable()
export class AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly jwtSecret: string;
  /** Empty means "use embedded PGlite". */
  readonly databaseUrl: string | null;
  readonly pgliteDataDir: string;
  readonly corsOrigin: string | true;
  /** The administrator account kept in step with the environment. Null means there is none. */
  readonly admin: AdminCredentials | null;
  /** How many reverse proxies sit in front, so the caller's address is read from the right hop. */
  readonly trustProxy: number;
  /** Pause before each action a computer player takes, so people can follow it. */
  readonly botActionDelayMs: number;

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
    this.admin = readAdmin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
    this.trustProxy = env.TRUST_PROXY;
    this.botActionDelayMs = env.BOT_ACTION_DELAY_MS;
  }
}

function readAdmin(username = '', password = ''): AdminCredentials | null {
  if (!username && !password) return null;
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set together');
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
  }
  return { username, password };
}
