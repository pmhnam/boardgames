import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ApiErrorBody, AuthSessionDto } from '@bgp/shared-types';
import { io, type Socket } from 'socket.io-client';

export const ADMIN_USERNAME = 'Operator';
export const ADMIN_PASSWORD = 'correct horse battery staple';

export interface Reply<T> {
  status: number;
  body: T;
  /** The stable error code, when the reply is an error. */
  code: string | undefined;
}

export interface AdminHarness {
  app: INestApplication;
  request<T>(method: string, path: string, token?: string, body?: unknown): Promise<Reply<T>>;
  loginAsGuest(displayName: string): Promise<AuthSessionDto>;
  loginAsAdmin(username?: string, password?: string): Promise<Reply<AuthSessionDto>>;
  /** Opens a socket that is closed again by `close`. Rejects when the handshake is refused. */
  connect(token: string): Promise<Socket>;
  close(): Promise<void>;
}

/** The whole app on an in-memory database, with one administrator set up from the environment. */
export async function startAdminHarness(): Promise<AdminHarness> {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
  process.env.PGLITE_DATA_DIR = 'memory://';
  process.env.JWT_SECRET = 'admin-test-secret';
  process.env.ADMIN_USERNAME = ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  process.env.BOT_ACTION_DELAY_MS = '0';

  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/configure-app.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  const { port } = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const sockets: Socket[] = [];

  async function request<T>(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ): Promise<Reply<T>> {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = (await response.json()) as T;
    return {
      status: response.status,
      body: parsed,
      code: (parsed as Partial<ApiErrorBody> | null)?.error?.code,
    };
  }

  return {
    app,
    request,
    async loginAsGuest(displayName) {
      const reply = await request<AuthSessionDto>('POST', '/auth/guest', undefined, {
        displayName,
      });
      if (reply.status !== 201) throw new Error(`Guest login failed: ${reply.code}`);
      return reply.body;
    },
    loginAsAdmin(username = ADMIN_USERNAME, password = ADMIN_PASSWORD) {
      return request<AuthSessionDto>('POST', '/auth/admin/login', undefined, {
        username,
        password,
      });
    },
    connect(token) {
      const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], forceNew: true });
      sockets.push(socket);
      return new Promise((resolve, reject) => {
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
      });
    },
    async close() {
      for (const socket of sockets) socket.disconnect();
      await app.close();
    },
  };
}
