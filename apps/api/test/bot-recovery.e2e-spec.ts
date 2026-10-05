import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { GridClaimView } from '@bgp/game-demo';
import {
  ClientEvents,
  type Ack,
  type AuthSessionDto,
  type GameStateMessage,
  type MatchDto,
  type RoomDto,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { io } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MatchesService } from '../src/modules/matches/matches.service.js';

/**
 * A server restart must not strand a match on a computer player's turn. The two "servers" here
 * share one database on disk, as two runs of the API would.
 */
describe('bot recovery after a restart', () => {
  let dataDir: string;
  let app: INestApplication | undefined;

  async function shutdown() {
    await app?.close();
    app = undefined;
  }

  async function boot(botDelayMs: number): Promise<string> {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = path.join(dataDir, 'db');
    process.env.JWT_SECRET = 'test-secret';
    process.env.BOT_ACTION_DELAY_MS = String(botDelayMs);

    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    return `http://127.0.0.1:${port}/api`;
  }

  async function call<T>(
    base: string,
    method: string,
    url: string,
    token?: string,
    body?: unknown,
  ) {
    const response = await fetch(base + url, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as T;
  }

  beforeAll(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'bgp-bot-recovery-'));
  });

  afterAll(async () => {
    await app?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('resumes a match that was waiting on a bot', async () => {
    // First run: bots are slow, so the server can be stopped while one is "thinking".
    let base = await boot(10_000);
    const { accessToken } = await call<AuthSessionDto>(base, 'POST', '/auth/guest', undefined, {
      displayName: 'Host',
    });
    const room = await call<RoomDto>(base, 'POST', '/rooms', accessToken, {
      gameType: 'grid-claim',
    });
    await call(base, 'POST', `/rooms/${room.id}/bots`, accessToken, { level: 'normal' });
    await call(base, 'POST', `/rooms/${room.id}/ready`, accessToken, { ready: true });
    const { matchId } = await call<StartRoomResponse>(
      base,
      'POST',
      `/rooms/${room.id}/start`,
      accessToken,
    );

    // Make sure it is the bot's turn: if the host is first to move, the host moves.
    const socket = io(base.replace('/api', ''), {
      auth: { token: accessToken },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const sync: Ack<GameStateMessage<GridClaimView>> = await socket.emitWithAck(
      ClientEvents.GameSync,
      { gameId: matchId },
    );
    if (!sync.ok) throw new Error(sync.error.code);
    if (sync.data.state.turn.activePlayerId === sync.data.viewerPlayerId) {
      const moved: Ack<unknown> = await socket.emitWithAck(ClientEvents.GameAction, {
        gameId: matchId,
        requestId: randomUUID(),
        expectedVersion: sync.data.version,
        action: { type: 'PLACE_PIECE', position: sync.data.state.legalPositions[0] },
      });
      expect(moved.ok).toBe(true);
    }
    socket.disconnect();

    const before = await call<MatchDto>(base, 'GET', `/matches/${matchId}`, accessToken);
    expect(before.status).toBe('playing');

    // The server goes down while the bot is still waiting to move.
    await app?.close();
    app = undefined;

    // Second run, same database: the bot picks the match up without anyone asking.
    base = await boot(0);
    let after = before;
    for (let attempt = 0; attempt < 400 && after.version === before.version; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      after = await call<MatchDto>(base, 'GET', `/matches/${matchId}`, accessToken);
    }
    expect(after.version).toBe(before.version + 1);
  });

  it('restores autoplay on a human seat even when the match has no computer players', async () => {
    await shutdown();
    let base = await boot(10_000);
    const host = await call<AuthSessionDto>(base, 'POST', '/auth/guest', undefined, {
      displayName: 'Autoplay host',
    });
    const guest = await call<AuthSessionDto>(base, 'POST', '/auth/guest', undefined, {
      displayName: 'Human guest',
    });
    const room = await call<RoomDto>(base, 'POST', '/rooms', host.accessToken, {
      gameType: 'harmonies',
    });
    await call(base, 'POST', `/rooms/${room.id}/join`, guest.accessToken);
    await call(base, 'POST', `/rooms/${room.id}/ready`, host.accessToken, { ready: true });
    await call(base, 'POST', `/rooms/${room.id}/ready`, guest.accessToken, { ready: true });
    const { matchId } = await call<StartRoomResponse>(
      base,
      'POST',
      `/rooms/${room.id}/start`,
      host.accessToken,
    );
    const state = await app!.get(MatchesService).getStateMessage(matchId, host.user.id);
    const actor =
      (state.state as { turn: { activePlayerId: string } }).turn.activePlayerId ===
      state.viewerPlayerId
        ? host
        : guest;
    await call(base, 'PUT', `/matches/${matchId}/autoplay`, actor.accessToken, { enabled: true });
    const before = await call<MatchDto>(base, 'GET', `/matches/${matchId}`, actor.accessToken);
    expect(before.version).toBe(0);
    expect(before.players.every((player) => player.botLevel === null)).toBe(true);
    await shutdown();

    base = await boot(0);
    let after = before;
    for (let attempt = 0; attempt < 400 && after.version < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      after = await call<MatchDto>(base, 'GET', `/matches/${matchId}`, actor.accessToken);
    }
    expect(after.version).toBeGreaterThanOrEqual(5);
    expect(after.players.find((player) => player.userId === actor.user.id)).toMatchObject({
      botLevel: null,
      autoplayLevel: 'normal',
      controlVersion: 1,
    });
    await call(base, 'PUT', `/matches/${matchId}/autoplay`, actor.accessToken, { enabled: false });
  });
});
