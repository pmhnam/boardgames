import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createSeededRandom } from '@bgp/game-core';
import { HarmoniesBot, type HarmoniesAction, type HarmoniesView } from '@bgp/game-harmonies';
import { SplendorBot, type SplendorView } from '@bgp/game-splendor';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type ApiErrorBody,
  type AuthSessionDto,
  type GameAutoplayMessage,
  type GameStateMessage,
  type PlayerAutoplayDto,
  type RoomDto,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { io, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GameActionService } from '../src/modules/matches/game-action.service.js';
import { MatchRepository } from '../src/modules/matches/match.repository.js';

type State = GameStateMessage<HarmoniesView>;
interface Client {
  session: AuthSessionDto;
  socket: Socket;
}

describe('human seat autoplay', () => {
  let app: INestApplication;
  let base: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.JWT_SECRET = 'test-secret';
    process.env.BOT_ACTION_DELAY_MS = '150';
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app?.close();
  });

  async function call<T>(client: Client | null, method: string, path: string, body?: unknown) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(client ? { authorization: `Bearer ${client.session.accessToken}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  async function client(name: string): Promise<Client> {
    const { body: session } = await call<AuthSessionDto>(null, 'POST', '/auth/guest', {
      displayName: name,
    });
    const socket = io(base, {
      auth: { token: session.accessToken },
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return { session, socket };
  }

  async function start() {
    const host = await client('Autoplay host');
    const guest = await client('Autoplay guest');
    const { body: room } = await call<RoomDto>(host, 'POST', '/rooms', { gameType: 'harmonies' });
    await call(guest, 'POST', `/rooms/${room.id}/join`);
    await call(host, 'POST', `/rooms/${room.id}/ready`, { ready: true });
    await call(guest, 'POST', `/rooms/${room.id}/ready`, { ready: true });
    const { body: started } = await call<StartRoomResponse>(
      host,
      'POST',
      `/rooms/${room.id}/start`,
    );
    const gameId = started.matchId;
    const hostState = await sync(host, gameId);
    const guestState = await sync(guest, gameId);
    // Harmonies randomizes the starting seat. "host" below denotes the current actor.
    return hostState.state.turn.activePlayerId === hostState.viewerPlayerId
      ? {
          host,
          guest,
          gameId,
          hostId: hostState.viewerPlayerId!,
          guestId: guestState.viewerPlayerId!,
        }
      : {
          host: guest,
          guest: host,
          gameId,
          hostId: guestState.viewerPlayerId!,
          guestId: hostState.viewerPlayerId!,
        };
  }

  async function sync<TView = HarmoniesView>(
    client: Client,
    gameId: string,
  ): Promise<GameStateMessage<TView>> {
    const result: Ack<GameStateMessage<TView>> = await client.socket.emitWithAck(
      ClientEvents.GameSync,
      { gameId },
    );
    if (!result.ok) throw new Error(result.error.code);
    return result.data;
  }

  async function action(client: Client, state: State, action: HarmoniesAction) {
    const result: Ack<unknown> = await client.socket.emitWithAck(ClientEvents.GameAction, {
      gameId: state.gameId,
      requestId: randomUUID(),
      expectedVersion: state.version,
      action,
    });
    expect(result.ok).toBe(true);
  }

  const autoplay = (client: Client, gameId: string, enabled: boolean) =>
    call<PlayerAutoplayDto>(client, 'PUT', `/matches/${gameId}/autoplay`, { enabled });

  async function waitForTurn(client: Client, gameId: string, playerId: string): Promise<State> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const state = await sync(client, gameId);
      if (state.state.turn.activePlayerId === playerId) return state;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('Bot did not finish its turn');
  }

  it('autoplays consecutive Splendor turns and hands control back for manual play', async () => {
    const host = await client('Splendor autoplay host');
    const guest = await client('Splendor autoplay guest');
    const { body: room } = await call<RoomDto>(host, 'POST', '/rooms', { gameType: 'splendor' });
    await call(guest, 'POST', `/rooms/${room.id}/join`);
    await call(host, 'POST', `/rooms/${room.id}/ready`, { ready: true });
    await call(guest, 'POST', `/rooms/${room.id}/ready`, { ready: true });
    const { body: started } = await call<StartRoomResponse>(
      host,
      'POST',
      `/rooms/${room.id}/start`,
    );
    const gameId = started.matchId;
    const initial = await sync<SplendorView>(host, gameId);
    const actor = initial.state.turn.activePlayerId === initial.viewerPlayerId ? host : guest;
    const other = actor === host ? guest : host;
    const actorId = (await sync<SplendorView>(actor, gameId)).viewerPlayerId!;
    const otherId = (await sync<SplendorView>(other, gameId)).viewerPlayerId!;

    const wait = async (playerId: string) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const state = await sync<SplendorView>(other, gameId);
        if (state.state.turn.activePlayerId === playerId) return state;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Splendor bot did not finish its turn');
    };
    const move = async (who: Client) => {
      const state = await sync<SplendorView>(who, gameId);
      const result: Ack<unknown> = await who.socket.emitWithAck(ClientEvents.GameAction, {
        gameId,
        requestId: randomUUID(),
        expectedVersion: state.version,
        action: SplendorBot.chooseAction({
          view: state.state,
          playerId: state.viewerPlayerId!,
          level: 'normal',
          random: createSeededRandom(`splendor-${state.version}`),
        }),
      });
      expect(result.ok).toBe(true);
    };

    expect((await autoplay(actor, gameId, true)).body.level).toBe('normal');
    const first = await wait(otherId);
    expect(first.version).toBeGreaterThan(initial.version);
    await move(other);
    const second = await wait(otherId);
    expect(second.state.turn.number).toBeGreaterThan(first.state.turn.number);
    expect(second.autoplay).toContainEqual({ playerId: actorId, level: 'normal', version: 1 });
    expect((await autoplay(actor, gameId, false)).body.level).toBeNull();
    await move(other);
    await wait(actorId);
    await move(actor);
    expect((await sync<SplendorView>(actor, gameId)).state.turn.activePlayerId).toBe(otherId);
  });

  it('toggles only the authenticated seat, is idempotent, and broadcasts without adding game actions', async () => {
    const { host, guest, gameId, hostId, guestId } = await start();
    const outsider = await client('Autoplay outsider');
    const updates: GameAutoplayMessage[] = [];
    host.socket.on(ServerEvents.GameAutoplay, (message) => updates.push(message));
    const before = await sync(host, gameId);
    const enabled = await autoplay(guest, gameId, true);
    expect(enabled.status).toBe(200);
    expect(enabled.body).toEqual({ playerId: guestId, level: 'normal', version: 1 });
    expect((await autoplay(guest, gameId, true)).body).toEqual(enabled.body);
    const disabled = await autoplay(guest, gameId, false);
    expect(disabled.body).toEqual({ playerId: guestId, level: null, version: 2 });
    const after = await sync(host, gameId);
    expect(after.version).toBe(before.version);
    expect(after.autoplay).toContainEqual({ playerId: hostId, level: null, version: 0 });
    expect(after.autoplay).toContainEqual(disabled.body);
    expect(
      updates.some((message) =>
        message.players.some((player) => player.playerId === guestId && player.version === 2),
      ),
    ).toBe(true);
    expect(
      (
        await call<ApiErrorBody>(outsider, 'PUT', `/matches/${gameId}/autoplay`, {
          enabled: true,
          userId: host.session.user.id,
        })
      ).body.error.code,
    ).toBe(ErrorCodes.Forbidden);
    expect((await call(null, 'PUT', `/matches/${gameId}/autoplay`, { enabled: true })).status).toBe(
      401,
    );
    expect(
      (await call(host, 'PUT', `/matches/${gameId}/autoplay`, { enabled: 'true' })).status,
    ).toBe(400);
  });

  it('takes over a partial turn, keeps playing subsequent turns after disconnect, and rejects manual/spoofed actions', async () => {
    const { host, guest, gameId, hostId, guestId } = await start();
    let state = await sync(host, gameId);
    await action(host, state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    state = await sync(host, gameId);
    const move = HarmoniesBot.chooseAction({
      view: state.state,
      playerId: hostId,
      level: 'easy',
      random: createSeededRandom('partial'),
    });
    await action(host, state, move);
    state = await sync(host, gameId);
    expect(state.state.turn.hand).toHaveLength(2);
    expect((await autoplay(host, gameId, true)).status).toBe(200);
    const blocked: Ack<unknown> = await host.socket.emitWithAck(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: state.version,
      action: HarmoniesBot.chooseAction({
        view: state.state,
        playerId: hostId,
        level: 'easy',
        random: createSeededRandom('spoof'),
      }),
      automation: { controlVersion: 1 },
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe(ErrorCodes.GameControlChanged);
    host.socket.disconnect();
    let guestState = await waitForTurn(guest, gameId, guestId);
    expect(guestState.autoplay).toContainEqual({ playerId: hostId, level: 'normal', version: 1 });
    for (
      let attempt = 0;
      attempt < 20 && guestState.state.turn.activePlayerId === guestId;
      attempt++
    ) {
      await action(
        guest,
        guestState,
        HarmoniesBot.chooseAction({
          view: guestState.state,
          playerId: guestId,
          level: 'easy',
          random: createSeededRandom(`guest-${attempt}`),
        }),
      );
      guestState = await sync(guest, gameId);
    }
    expect(guestState.state.turn.activePlayerId).toBe(hostId);
    const nextTurn = await waitForTurn(guest, gameId, guestId);
    expect(nextTurn.state.turn.number).toBeGreaterThan(guestState.state.turn.number);
    expect((await autoplay(host, gameId, false)).body.level).toBeNull();
    const fresh = await start();
    expect(
      (await sync(fresh.host, fresh.gameId)).autoplay?.every(
        (player) => player.level === null && player.version === 0,
      ),
    ).toBe(true);
  });

  it('cancels a queued bot action and lets the person immediately continue the same turn', async () => {
    const { host, gameId } = await start();
    const before = await sync(host, gameId);
    await autoplay(host, gameId, true);
    await autoplay(host, gameId, false);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const after = await sync(host, gameId);
    expect(after.version).toBe(before.version);
    await action(host, after, { type: 'TAKE_TOKENS', spaceIndex: 0 });
  });

  it('checks control again at commit and rejects an old runner credential after off/on', async () => {
    const { host, gameId } = await start();
    const repository = app.get(MatchRepository);
    const actions = app.get(GameActionService);
    const state = await sync(host, gameId);
    // Direct persistence deliberately does not wake a runner: control the precise handoff boundary.
    const enabled = await repository.setAutoplay(gameId, host.session.user.id, true);
    const save = repository.saveActionAndState.bind(repository);
    vi.spyOn(repository, 'saveActionAndState').mockImplementationOnce(async (input) => {
      await repository.setAutoplay(gameId, host.session.user.id, false);
      return save(input);
    });
    await expect(
      actions.execute({
        matchId: gameId,
        userId: host.session.user.id,
        requestId: randomUUID(),
        expectedVersion: state.version,
        action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
        now: new Date(),
        automation: { controlVersion: enabled.version },
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.GameControlChanged });
    expect((await sync(host, gameId)).version).toBe(state.version);
    expect(await repository.listActions(gameId)).toHaveLength(0);
    await repository.setAutoplay(gameId, host.session.user.id, true);
    await expect(
      actions.execute({
        matchId: gameId,
        userId: host.session.user.id,
        requestId: randomUUID(),
        expectedVersion: state.version,
        action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
        now: new Date(),
        automation: { controlVersion: enabled.version },
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.GameControlChanged });
    await repository.setAutoplay(gameId, host.session.user.id, false);
  });

  it('rejects a human action if autoplay becomes enabled between validation and commit', async () => {
    const { host, gameId } = await start();
    const repository = app.get(MatchRepository);
    const state = await sync(host, gameId);
    const save = repository.saveActionAndState.bind(repository);
    vi.spyOn(repository, 'saveActionAndState').mockImplementationOnce(async (input) => {
      await repository.setAutoplay(gameId, host.session.user.id, true);
      return save(input);
    });
    await expect(
      app.get(GameActionService).execute({
        matchId: gameId,
        userId: host.session.user.id,
        requestId: randomUUID(),
        expectedVersion: state.version,
        action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: ErrorCodes.GameControlChanged });
    expect(await repository.listActions(gameId)).toHaveLength(0);
    await repository.setAutoplay(gameId, host.session.user.id, false);
  });
});
