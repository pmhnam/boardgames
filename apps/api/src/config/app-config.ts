import { Injectable } from '@nestjs/common';
import type { VoiceIceServer } from '@bgp/shared-types';
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
  VOICE_MAX_PEERS: z.coerce.number().int().min(2).max(16).default(8),
  VOICE_RESUME_GRACE_MS: z.coerce.number().int().min(0).max(120_000).default(20_000),
  /** A JSON list of ICE servers. Left out, calls use public STUN servers and no relay. */
  VOICE_ICE_SERVERS: z.string().optional(),
});

const iceServersSchema = z
  .array(
    z.object({
      urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  )
  .max(8);

/** Enough for two browsers to find each other when neither sits behind a strict network. */
const DEFAULT_ICE_SERVERS: VoiceIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

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
  /**
   * How many connections one room's call takes. Every one of them is connected to every other,
   * so each more costs everybody in the call.
   */
  readonly voiceMaxPeers: number;
  /** How long a place in a call is kept for a connection that dropped, for it to come back to. */
  readonly voiceResumeGraceMs: number;
  /** What browsers in a call are told to ask about reaching each other. */
  readonly voiceIceServers: VoiceIceServer[];

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
    this.voiceMaxPeers = env.VOICE_MAX_PEERS;
    this.voiceResumeGraceMs = env.VOICE_RESUME_GRACE_MS;
    this.voiceIceServers = readIceServers(env.VOICE_ICE_SERVERS);
  }
}

function readIceServers(raw = ''): VoiceIceServer[] {
  if (!raw.trim()) return DEFAULT_ICE_SERVERS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('VOICE_ICE_SERVERS must be a JSON list of ICE servers');
  }
  const result = iceServersSchema.safeParse(parsed);
  if (!result.success) throw new Error('VOICE_ICE_SERVERS must be a JSON list of ICE servers');
  return result.data;
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
