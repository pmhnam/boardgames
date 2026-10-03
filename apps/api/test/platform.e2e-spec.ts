import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { GridClaimView } from '@bgp/game-demo';
import type { HarmoniesConfig, HarmoniesView } from '@bgp/game-harmonies';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type AuthSessionDto,
  type GameActionAccepted,
  type GameConfigDto,
  type GameStateMessage,
  type MatchDto,
  type MatchReplayDto,
  type RoomDto,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type State = GameStateMessage<GridClaimView>;

const ADMIN_TOKEN = 'test-admin-token';

interface Client {
  session: AuthSessionDto;
  socket: Socket;
  /** Latest state pushed by the server. */
  pushed: State[];
  api<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }>;
  emit<T>(event: string, payload: unknown): Promise<Ack<T>>;
}

describe('platform MVP flow', () => {
  let app: INestApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];
  /** Set by the first test; the config test needs a match that finished under config v1. */
  let finishedGridClaim: { gameId: string; player: Client } | undefined;

  beforeAll(async () => {
    // Embedded PGlite by default. Point TEST_DATABASE_URL at an empty PostgreSQL database to
    // run the same suite against a real server.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_TOKEN = ADMIN_TOKEN;
    // Computer players answer at once, so tests do not wait on their thinking time.
    process.env.BOT_ACTION_DELAY_MS = '0';

    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app?.close();
  });

  async function request<T>(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ): Promise<{ status: number; body: T }> {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  function connect(token: string): Promise<Socket> {
    const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  async function createClient(displayName: string): Promise<Client> {
    const { body: session } = await request<AuthSessionDto>('POST', '/auth/guest', undefined, {
      displayName,
    });
    const socket = await connect(session.accessToken);
    const pushed: State[] = [];
    socket.on(ServerEvents.GameState, (message: State) => pushed.push(message));
    return {
      session,
      socket,
      pushed,
      api: (method, path, body) => request(method, path, session.accessToken, body),
      emit: (event, payload) => socket.emitWithAck(event, payload),
    };
  }

  async function waitFor<T>(read: () => T | undefined, what: string): Promise<T> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = read();
      if (value !== undefined) return value;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${what}`);
  }

  function placeAction(state: State, position = state.state.legalPositions[0]) {
    return {
      gameId: state.gameId,
      requestId: randomUUID(),
      expectedVersion: state.version,
      action: { type: 'PLACE_PIECE', position },
    };
  }

  it('rejects unauthenticated HTTP and socket access', async () => {
    const response = await request<{ error: { code: string } }>('POST', '/rooms', undefined, {
      gameType: 'grid-claim',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ErrorCodes.Unauthorized);

    await expect(connect('not-a-token')).rejects.toThrow(ErrorCodes.Unauthorized);
  });

  it('plays a whole match from lobby to replay', async () => {
    const alice = await createClient('Alice');
    const bob = await createClient('Bob');
    const mallory = await createClient('Mallory');

    // Room: create, join by code, ready, start.
    const { body: room } = await alice.api<RoomDto>('POST', '/rooms', { gameType: 'grid-claim' });
    expect(room.members).toHaveLength(1);

    const { body: found } = await bob.api<RoomDto>('GET', `/rooms/by-code/${room.code}`);
    const { body: joined } = await bob.api<RoomDto>('POST', `/rooms/${found.id}/join`);
    expect(joined.members.map((member) => member.displayName)).toEqual(['Alice', 'Bob']);

    const full = await mallory.api<{ error: { code: string } }>('POST', `/rooms/${room.id}/join`);
    expect(full.body.error.code).toBe(ErrorCodes.RoomFull);

    const roomUpdates: RoomDto[] = [];
    alice.socket.on(ServerEvents.RoomUpdated, (dto: RoomDto) => roomUpdates.push(dto));
    expect((await alice.emit(ClientEvents.RoomJoin, { roomId: room.id })).ok).toBe(true);
    expect((await mallory.emit(ClientEvents.RoomJoin, { roomId: room.id })).ok).toBe(false);

    const early = await alice.api<{ error: { code: string } }>('POST', `/rooms/${room.id}/start`);
    expect(early.body.error.code).toBe(ErrorCodes.PlayersNotReady);

    await alice.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    await bob.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    await waitFor(
      () => roomUpdates.find((dto) => dto.members.every((member) => member.status === 'ready')),
      'room.updated with everyone ready',
    );

    const notHost = await bob.api<{ error: { code: string } }>('POST', `/rooms/${room.id}/start`);
    expect(notHost.body.error.code).toBe(ErrorCodes.NotRoomHost);

    const { body: started } = await alice.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;
    expect(started.room.status).toBe('in_match');
    expect(started.room.currentMatchId).toBe(gameId);

    // Both players sync and see the same board through their own view.
    const sync = async (client: Client): Promise<State> => {
      const ack = await client.emit<State>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    let aliceState = await sync(alice);
    let bobState = await sync(bob);
    expect(aliceState.version).toBe(0);
    expect(aliceState.state.cells).toEqual(bobState.state.cells);
    expect(new Set([aliceState.viewerPlayerId, bobState.viewerPlayerId])).toEqual(
      new Set(['p1', 'p2']),
    );

    const byPlayer = new Map([
      [aliceState.viewerPlayerId, alice],
      [bobState.viewerPlayerId, bob],
    ]);
    const activeClient = (state: State) => byPlayer.get(state.state.turn.activePlayerId)!;
    const latest = (client: Client, version: number) =>
      waitFor(
        () => client.pushed.find((message) => message.version === version),
        `game.state v${version}`,
      );

    // Out of turn.
    const waiting = activeClient(aliceState) === alice ? bob : alice;
    const waitingState = waiting === alice ? aliceState : bobState;
    const outOfTurn = await waiting.emit(ClientEvents.GameAction, {
      ...placeAction(aliceState),
      action: { type: 'PLACE_PIECE', position: { row: 0, col: 0 } },
    });
    expect(outOfTurn).toMatchObject({ ok: false, error: { code: ErrorCodes.NotYourTurn } });
    expect(waitingState.state.legalPositions).toEqual([]);

    // Not a player.
    const outsider = await mallory.emit(ClientEvents.GameAction, placeAction(aliceState));
    expect(outsider).toMatchObject({ ok: false, error: { code: ErrorCodes.Forbidden } });

    // Malformed and illegal actions.
    const active = activeClient(aliceState);
    const activeState = active === alice ? aliceState : bobState;
    const malformed = await active.emit(ClientEvents.GameAction, {
      ...placeAction(activeState),
      action: { type: 'PLACE_PIECE', position: { row: 'x', col: 0 } },
    });
    expect(malformed).toMatchObject({ ok: false, error: { code: ErrorCodes.InvalidAction } });
    const offBoard = await active.emit(ClientEvents.GameAction, {
      ...placeAction(activeState),
      action: { type: 'PLACE_PIECE', position: { row: 99, col: 0 } },
    });
    expect(offBoard).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.InvalidAction, details: { rule: 'INVALID_POSITION' } },
    });

    // A valid move reaches both players; forged fields are ignored.
    const first = placeAction(activeState);
    const accepted = await active.emit<GameActionAccepted>(ClientEvents.GameAction, {
      ...first,
      action: { ...first.action, scoreAfterMove: 999, nextPlayerId: activeState.viewerPlayerId },
    });
    expect(accepted).toEqual({
      ok: true,
      data: { gameId, requestId: first.requestId, version: 1, duplicate: false },
    });
    aliceState = await latest(alice, 1);
    bobState = await latest(bob, 1);
    expect(aliceState.state.cells).toEqual(bobState.state.cells);
    expect(aliceState.state.turn.activePlayerId).not.toBe(activeState.viewerPlayerId);
    expect(Math.max(...Object.values(aliceState.state.scores))).toBe(1);

    // Idempotency: replaying the same request changes nothing.
    const duplicate = await active.emit<GameActionAccepted>(ClientEvents.GameAction, first);
    expect(duplicate).toMatchObject({ ok: true, data: { version: 1, duplicate: true } });

    // Stale version.
    const stale = await activeClient(aliceState).emit(ClientEvents.GameAction, {
      ...placeAction(activeClient(aliceState) === alice ? aliceState : bobState),
      expectedVersion: 0,
    });
    expect(stale).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.GameVersionConflict, details: { latestVersion: 1 } },
    });

    // Concurrency: two different moves against the same version -> exactly one wins.
    {
      const client = activeClient(aliceState);
      const state = client === alice ? aliceState : bobState;
      const [a, b] = state.state.legalPositions;
      const results = await Promise.all([
        client.emit<GameActionAccepted>(ClientEvents.GameAction, placeAction(state, a)),
        client.emit<GameActionAccepted>(ClientEvents.GameAction, placeAction(state, b)),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toMatchObject({
        error: { code: ErrorCodes.GameVersionConflict },
      });
      aliceState = await latest(alice, 2);
      await latest(bob, 2);
    }

    // History is closed while the match is live.
    const liveHistory = await alice.api<{ error: { code: string } }>(
      'GET',
      `/matches/${gameId}/history`,
    );
    expect(liveHistory.body.error.code).toBe(ErrorCodes.MatchNotFinished);

    // Reconnect: a fresh socket gets the latest snapshot from game.sync alone.
    bob.socket.disconnect();
    bob.socket = await connect(bob.session.accessToken);
    bob.socket.on(ServerEvents.GameState, (message: State) => bob.pushed.push(message));
    bob.emit = (event, payload) => bob.socket.emitWithAck(event, payload);
    bobState = await sync(bob);
    expect(bobState.version).toBe(2);
    expect(bobState.state.cells).toEqual(aliceState.state.cells);

    // Play to the end.
    const finishedEvents: unknown[] = [];
    alice.socket.on(ServerEvents.GameFinished, (message: unknown) => finishedEvents.push(message));
    let version = 2;
    while (aliceState.status === 'playing') {
      const client = activeClient(aliceState);
      const state = client === alice ? aliceState : bobState;
      const result = await client.emit(ClientEvents.GameAction, placeAction(state));
      expect(result.ok).toBe(true);
      version += 1;
      aliceState = await latest(alice, version);
      bobState = await latest(bob, version);
    }
    expect(aliceState.state.phase).toBe('FINISHED');
    expect(aliceState.state.winnerPlayerIds.length).toBeGreaterThan(0);
    await waitFor(() => finishedEvents[0], 'game.finished');

    const afterEnd = await alice.emit(
      ClientEvents.GameAction,
      placeAction(aliceState, { row: 0, col: 0 }),
    );
    expect(afterEnd).toMatchObject({ ok: false, error: { code: ErrorCodes.MatchNotPlaying } });

    // Result persisted; history lists it; replay reproduces the final board from seed + actions.
    const { body: match } = await alice.api<MatchDto>('GET', `/matches/${gameId}`);
    expect(match.status).toBe('finished');
    expect(match.version).toBe(version);
    expect(match.result?.winnerPlayerIds).toEqual(aliceState.state.winnerPlayerIds);

    const { body: mine } = await alice.api<MatchDto[]>(
      'GET',
      `/users/${alice.session.user.id}/matches`,
    );
    expect(mine.map((entry) => entry.id)).toContain(gameId);
    const others = await alice.api('GET', `/users/${bob.session.user.id}/matches`);
    expect(others.status).toBe(403);

    const { body: replay } = await alice.api<MatchReplayDto>('GET', `/matches/${gameId}/replay`);
    expect(replay.frames).toHaveLength(version + 1);
    expect((replay.frames.at(-1)?.state as GridClaimView).cells).toEqual(aliceState.state.cells);

    finishedGridClaim = { gameId, player: alice };

    // The room reopens for a rematch.
    const reopened = await waitFor(
      () =>
        roomUpdates.find(
          (dto) =>
            dto.status === 'open' &&
            dto.currentMatchId === null &&
            dto.members.every((member) => member.status === 'joined') &&
            roomUpdates.indexOf(dto) > 2,
        ),
      'room reopened',
    );
    expect(reopened.members).toHaveLength(2);
  });
  it('serves a second game through the same pipeline without leaking hidden state', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    const watcher = await createClient('Watcher');

    const { body: room } = await host.api<RoomDto>('POST', '/rooms', { gameType: 'harmonies' });
    await guest.api('POST', `/rooms/${room.id}/join`);
    await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    await guest.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    type HarmoniesState = GameStateMessage<HarmoniesView>;
    const sync = async (client: Client): Promise<HarmoniesState> => {
      const ack = await client.emit<HarmoniesState>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const views = [await sync(host), await sync(guest), await sync(watcher)];

    // The pouch and deck order never leave the server, whoever is asking.
    for (const view of views) {
      expect(view.state).not.toHaveProperty('pouch');
      expect(view.state).not.toHaveProperty('cardDeck');
      expect(view.state.pouchCount).toBe(105);
    }
    expect(views[2]?.viewerPlayerId).toBeNull();
    expect(views[2]?.state.legal.canTakeTokens).toBe(false);

    // A spectator can watch but not act.
    const spectatorMove = await watcher.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
    });
    expect(spectatorMove).toMatchObject({ ok: false, error: { code: ErrorCodes.Forbidden } });

    const activeView = views.find((view) => view.state.legal.canTakeTokens);
    const activeClient = activeView === views[0] ? host : guest;
    const taken = await activeClient.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
    });
    expect(taken.ok).toBe(true);

    const pushed = await waitFor(
      () => watcher.pushed.find((message) => message.gameId === gameId && message.version === 1),
      'spectator game.state',
    );
    const afterTake = pushed.state as unknown as HarmoniesView;
    expect(afterTake.turn.hand).toHaveLength(3);
    expect(afterTake.centralSpaces[0]).toEqual([]);

    const earlyEnd = await activeClient.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: 1,
      action: { type: 'END_TURN' },
    });
    expect(earlyEnd).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.InvalidAction, details: { rule: 'TOKENS_REMAINING' } },
    });
  });

  it('lets the host choose a map, and plays the match on it', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    type HarmoniesState = GameStateMessage<HarmoniesView>;

    const start = async (settings?: Record<string, unknown>): Promise<HarmoniesState> => {
      const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
        gameType: 'harmonies',
        ...(settings ? { settings } : {}),
      });
      await guest.api('POST', `/rooms/${room.id}/join`);
      await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      await guest.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      const { body } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
      const ack = await host.emit<HarmoniesState>(ClientEvents.GameSync, { gameId: body.matchId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };

    // The room remembers the choice, cleaned by the engine.
    const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'harmonies',
      settings: { mapId: 'B', boardCells: [] },
    });
    expect(room.settings).toEqual({ mapId: 'B' });

    // No settings: the game's default.
    const { body: plain } = await host.api<RoomDto>('POST', '/rooms', { gameType: 'harmonies' });
    expect(plain.settings).toEqual({ mapId: 'A' });

    // A map the game does not have.
    const unknown = await host.api<{ error: { code: string; message: string } }>('POST', '/rooms', {
      gameType: 'harmonies',
      settings: { mapId: 'C' },
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe(ErrorCodes.InvalidRoomSettings);

    const sideA = await start();
    expect(sideA.state.map.id).toBe('A');
    expect(sideA.state.boardCells).toHaveLength(23);
    expect(sideA.state.waterScoring).toBe('river');

    const sideB = await start({ mapId: 'B' });
    expect(sideB.state.map.id).toBe('B');
    expect(sideB.state.boardCells).toHaveLength(25);
    expect(sideB.state.waterScoring).toBe('islands');
    // An empty side-B board is one island.
    expect(Object.values(sideB.state.scores).map((score) => score.water)).toEqual([5, 5]);
    expect(Object.values(sideA.state.scores).map((score) => score.water)).toEqual([0, 0]);

    // Grid Claim has no settings; whatever is sent is dropped.
    const { body: grid } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'grid-claim',
      settings: { mapId: 'B' },
    });
    expect(grid.settings).toEqual({});
  });

  it('lets a person play against computer players', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    type ErrorBody = { error: { code: string } };

    /** Polls with a longer deadline than waitFor: a bot's turn is several actions. */
    const until = async <T>(read: () => Promise<T | undefined>, what: string): Promise<T> => {
      for (let attempt = 0; attempt < 400; attempt++) {
        const value = await read();
        if (value !== undefined) return value;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`Timed out waiting for ${what}`);
    };

    // Only the host seats bots, only at a level that exists, and only while there is room.
    const { body: room } = await host.api<RoomDto>('POST', '/rooms', { gameType: 'grid-claim' });
    await guest.api('POST', `/rooms/${room.id}/join`);
    const notHost = await guest.api<ErrorBody>('POST', `/rooms/${room.id}/bots`, { level: 'easy' });
    expect(notHost.body.error.code).toBe(ErrorCodes.NotRoomHost);
    const full = await host.api<ErrorBody>('POST', `/rooms/${room.id}/bots`, { level: 'easy' });
    expect(full.body.error.code).toBe(ErrorCodes.RoomFull);
    await guest.api('POST', `/rooms/${room.id}/leave`);
    const badLevel = await host.api<ErrorBody>('POST', `/rooms/${room.id}/bots`, { level: 'god' });
    expect(badLevel.status).toBe(400);

    const { body: withBot } = await host.api<RoomDto>('POST', `/rooms/${room.id}/bots`, {
      level: 'easy',
    });
    const easyBot = withBot.members.find((member) => member.botLevel !== null)!;
    expect(easyBot).toMatchObject({ botLevel: 'easy', status: 'ready' });

    // Swap it for a stronger one.
    const removed = await host.api<RoomDto>('DELETE', `/rooms/${room.id}/bots/${easyBot.userId}`);
    expect(removed.body.members).toHaveLength(1);
    const { body: ready } = await host.api<RoomDto>('POST', `/rooms/${room.id}/bots`, {
      level: 'hard',
    });
    const bot = ready.members.find((member) => member.botLevel !== null)!;
    expect(bot.displayName).toContain('Bot');

    // The bot needs nobody to press "ready" for it.
    await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    // One person plays a whole game: the bot answers every move on its own.
    const sync = async (): Promise<State> => {
      const ack = await host.emit<State>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    let state = await sync();
    const me = state.viewerPlayerId;
    let myMoves = 0;
    while (state.status === 'playing') {
      state = await until(async () => {
        const latest = await sync();
        return latest.status !== 'playing' || latest.state.turn.activePlayerId === me
          ? latest
          : undefined;
      }, 'my turn');
      if (state.status !== 'playing') break;
      const result = await host.emit(ClientEvents.GameAction, placeAction(state));
      expect(result.ok).toBe(true);
      myMoves += 1;
    }
    expect(myMoves).toBeGreaterThan(0);
    expect(state.state.winnerPlayerIds.length).toBeGreaterThan(0);

    const { body: match } = await host.api<MatchDto>('GET', `/matches/${gameId}`);
    expect(match.status).toBe('finished');
    expect(match.players.map((player) => player.botLevel).sort()).toEqual(['hard', null].sort());
    // The bot's moves are in the log like anyone's, so the match replays.
    const { body: replay } = await host.api<MatchReplayDto>('GET', `/matches/${gameId}/replay`);
    expect(replay.frames.length).toBe(match.version + 1);
    const botPlayerId = match.players.find((player) => player.botLevel !== null)!.playerId;
    expect(replay.frames.some((frame) => frame.action?.playerId === botPlayerId)).toBe(true);

    // After the match the room reopens with the bot still ready for a rematch.
    const reopened = await until(async () => {
      const { body } = await host.api<RoomDto>('GET', `/rooms/${room.id}`);
      return body.status === 'open' ? body : undefined;
    }, 'room to reopen');
    expect(reopened.members.find((member) => member.botLevel !== null)?.status).toBe('ready');

    // Harmonies: the bot takes a whole multi-action turn by itself.
    const { body: harmonies } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'harmonies',
    });
    await host.api('POST', `/rooms/${harmonies.id}/bots`, { level: 'normal' });
    await host.api('POST', `/rooms/${harmonies.id}/bots`, { level: 'hard' });
    await host.api('POST', `/rooms/${harmonies.id}/ready`, { ready: true });
    const { body: harmoniesMatch } = await host.api<StartRoomResponse>(
      'POST',
      `/rooms/${harmonies.id}/start`,
    );
    type HarmoniesState = GameStateMessage<HarmoniesView>;
    const syncHarmonies = async (): Promise<HarmoniesState> => {
      const ack = await host.emit<HarmoniesState>(ClientEvents.GameSync, {
        gameId: harmoniesMatch.matchId,
      });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const send = async (expectedVersion: number, action: unknown) => {
      const ack = await host.emit<GameActionAccepted>(ClientEvents.GameAction, {
        gameId: harmoniesMatch.matchId,
        requestId: randomUUID(),
        expectedVersion,
        action,
      });
      if (!ack.ok) throw new Error(`${ack.error.code}: ${ack.error.message}`);
    };
    const myTurn = () =>
      until(async () => {
        const latest = await syncHarmonies();
        return latest.state.turn.activePlayerId === latest.viewerPlayerId ? latest : undefined;
      }, 'my Harmonies turn');

    // Play one full turn, then wait for both bots to play theirs.
    let view = await myTurn();
    const turnBefore = view.state.turn.number;
    await send(view.version, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    for (;;) {
      view = await syncHarmonies();
      const next = Object.entries(view.state.legal.tokenCells).find(
        ([, cells]) => cells.length > 0,
      );
      if (!next) break;
      await send(view.version, { type: 'PLACE_TOKEN', color: next[0], cell: next[1]![0] });
    }
    await send(view.version, { type: 'END_TURN' });

    view = await myTurn();
    expect(view.state.turn.number).toBeGreaterThanOrEqual(turnBefore + 3);
    const botBoards = view.state.turnOrder
      .filter((playerId) => playerId !== view.viewerPlayerId)
      .map((playerId) => view.state.boards[playerId]!);
    expect(botBoards).toHaveLength(2);
    for (const board of botBoards) {
      expect(Object.keys(board.stacks).length).toBeGreaterThan(0);
    }
  });

  // Runs last on purpose: it changes configs the tests above rely on.
  it('keeps game configs in the database, versioned', async () => {
    const publish = async <T>(
      gameType: string,
      body: unknown,
      token: string | null = ADMIN_TOKEN,
    ) => {
      const response = await fetch(`${baseUrl}/api/games/${gameType}/config`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          ...(token === null ? {} : { 'x-admin-token': token }),
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as T };
    };
    type ErrorBody = { error: { code: string; message: string } };

    const host = await createClient('Host');
    const guest = await createClient('Guest');
    const startHarmonies = async (): Promise<string> => {
      const { body: room } = await host.api<RoomDto>('POST', '/rooms', { gameType: 'harmonies' });
      await guest.api('POST', `/rooms/${room.id}/join`);
      await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      await guest.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      const { body } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
      return body.matchId;
    };
    const sync = async (client: Client, gameId: string) => {
      const ack = await client.emit<GameStateMessage<HarmoniesView>>(ClientEvents.GameSync, {
        gameId,
      });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };

    // Seeded from the engine default on first boot.
    const { body: seeded } = await host.api<GameConfigDto<HarmoniesConfig>>(
      'GET',
      '/games/harmonies/config',
    );
    expect(seeded.version).toBe(1);
    expect(seeded.config.maps.map((map) => map.id)).toEqual(['A', 'B']);
    expect(seeded.config.cards.length).toBeGreaterThan(0);

    const oldMatch = await startHarmonies();

    // Only an operator may publish, and only something the engine accepts.
    const smaller: HarmoniesConfig = {
      ...seeded.config,
      maps: [
        {
          id: 'A',
          name: 'Small',
          boardCells: [0, 1, 2].flatMap((q) => [0, 1, 2].map((r) => ({ q, r }))),
          waterScoring: 'river',
        },
      ],
      tokenCounts: { water: 10, mountain: 0, trunk: 0, leaf: 10, field: 10, building: 0 },
    };
    expect((await publish<ErrorBody>('harmonies', { config: smaller }, null)).status).toBe(403);
    expect((await publish<ErrorBody>('harmonies', { config: smaller }, 'wrong')).status).toBe(403);

    const invalid = await publish<ErrorBody>('harmonies', {
      config: { ...smaller, tokenCounts: { water: 1 } },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ErrorCodes.InvalidGameConfig);
    expect(invalid.body.error.message).toContain('tokenCounts');

    const unknown = await publish<ErrorBody>('chess', { config: {} });
    expect(unknown.body.error.code).toBe(ErrorCodes.UnknownGameType);

    const published = await publish<GameConfigDto<HarmoniesConfig>>('harmonies', {
      config: smaller,
      note: 'Small board for testing',
    });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ version: 2, note: 'Small board for testing' });
    const { body: current } = await host.api<GameConfigDto>('GET', '/games/harmonies/config');
    expect(current.version).toBe(2);

    // New matches are set up from the new config...
    const newMatch = await startHarmonies();
    const newState = await sync(host, newMatch);
    expect(newState.state.boardCells).toHaveLength(9);
    expect(newState.state.pouchCount).toBe(30 - 15);
    const { body: newDto } = await host.api<MatchDto>('GET', `/matches/${newMatch}`);
    expect(newDto.configVersion).toBe(2);

    // ...while the match already in progress keeps the one it started with, and plays on.
    const oldState = await sync(host, oldMatch);
    expect(oldState.state.boardCells).toHaveLength(23);
    expect(oldState.state.pouchCount).toBe(105);
    const oldActive = oldState.state.legal.canTakeTokens ? host : guest;
    const move = await oldActive.emit(ClientEvents.GameAction, {
      gameId: oldMatch,
      requestId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'TAKE_TOKENS', spaceIndex: 0 },
    });
    expect(move.ok).toBe(true);
    const { body: oldDto } = await host.api<MatchDto>('GET', `/matches/${oldMatch}`);
    expect(oldDto.configVersion).toBe(1);

    // A finished match can be replayed until its game's config changes.
    if (!finishedGridClaim) throw new Error('the full-match test must run first');
    const { gameId, player } = finishedGridClaim;
    expect((await player.api('GET', `/matches/${gameId}/replay`)).status).toBe(200);

    const gridClaim = await publish<GameConfigDto>('grid-claim', {
      config: { boardSize: 4, blockedCellCount: 1, targetScore: 6 },
    });
    expect(gridClaim.body.version).toBe(2);

    const replay = await player.api<ErrorBody>('GET', `/matches/${gameId}/replay`);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe(ErrorCodes.ReplayUnavailable);
    // The result and the list of moves are still there.
    expect((await player.api('GET', `/matches/${gameId}/history`)).status).toBe(200);
    const { body: finished } = await player.api<MatchDto>('GET', `/matches/${gameId}`);
    expect(finished.result?.winnerPlayerIds.length).toBeGreaterThan(0);
  });
});
