import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AvalonAction, AvalonView } from '@bgp/game-avalon';
import type { CatanView } from '@bgp/game-catan';
import type { GridClaimView } from '@bgp/game-demo';
import type { HarmoniesConfig, HarmoniesView } from '@bgp/game-harmonies';
import type { SplendorView } from '@bgp/game-splendor';
import type { WerewolfView } from '@bgp/game-werewolf';
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

  it('keeps a card reserved unseen to its owner, for a game with private information', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    const watcher = await createClient('Watcher');

    const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'splendor',
      settings: { targetScore: 10 },
    });
    expect(room.settings).toEqual({ targetScore: 10 });
    await guest.api('POST', `/rooms/${room.id}/join`);
    await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    await guest.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    type SplendorState = GameStateMessage<SplendorView>;
    const sync = async (client: Client): Promise<SplendorState> => {
      const ack = await client.emit<SplendorState>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const seated = [host, guest];
    const before = await Promise.all(seated.map(sync));
    for (const view of [...before, await sync(watcher)]) {
      expect(view.state).not.toHaveProperty('decks');
      expect(view.state).not.toHaveProperty('config');
      expect(view.state.deckCounts).toEqual({ 1: 36, 2: 26, 3: 16 });
      expect(view.state.targetScore).toBe(10);
    }

    const ownerIndex = before.findIndex((view) => view.state.legal.reservableTiers.length > 0);
    const owner = seated[ownerIndex] as Client;
    const rival = seated[1 - ownerIndex] as Client;
    const ownerId = before[ownerIndex]?.viewerPlayerId as string;

    const reserved = await owner.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: 0,
      action: { type: 'RESERVE_FROM_DECK', tier: 3 },
    });
    expect(reserved.ok).toBe(true);

    // The owner sees the card they drew, and got a gold with it.
    const own = (await sync(owner)).state.players[ownerId];
    const entry = own?.reserved[0];
    if (!entry || entry.hidden) throw new Error('The owner cannot see their own reserved card');
    expect(entry.card.tier).toBe(3);
    expect(own?.tokens.gold).toBe(1);

    // Everyone else sees a face-down tier 3 card, and the id is nowhere in what they get.
    for (const client of [rival, watcher]) {
      const view = await sync(client);
      expect(view.state.players[ownerId]?.reserved).toEqual([{ hidden: true, tier: 3 }]);
      expect(view.state.deckCounts[3]).toBe(15);
      expect(JSON.stringify(view)).not.toContain(entry.card.id);
    }

    // Guessing the id tells the rival nothing: it is refused exactly like a made-up one.
    const guess = (cardId: string) =>
      rival.emit(ClientEvents.GameAction, {
        gameId,
        requestId: randomUUID(),
        expectedVersion: 1,
        action: { type: 'BUY_CARD', cardId },
      });
    const [real, invented] = [await guess(entry.card.id), await guess('no-such-card')];
    expect(real).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.InvalidAction, details: { rule: 'CARD_NOT_AVAILABLE' } },
    });
    if (real.ok || invented.ok) throw new Error('A guess was accepted');
    expect(real.error.message).toBe(invented.error.message);
  });

  it('plays a game of hidden roles, on a cast the host fits to the table', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    const watcher = await createClient('Watcher');
    type ErrorBody = { error: { code: string; details?: { rule?: string } } };

    // The cast is picked before anyone knows how many will sit down, so it is only checked
    // against the game's limits here.
    const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'werewolf',
      settings: {
        preset: 'custom',
        roles: { werewolf: 2, seer: 1, witch: 1, bodyguard: 1, hunter: 1 },
      },
    });
    expect(room.settings).toMatchObject({ preset: 'custom', roles: { werewolf: 2, cupid: 0 } });
    const noWolf = await host.api<ErrorBody>('PUT', `/rooms/${room.id}/settings`, {
      settings: { preset: 'custom', roles: { seer: 1 } },
    });
    expect(noWolf.body.error.code).toBe(ErrorCodes.InvalidRoomSettings);

    await guest.api('POST', `/rooms/${room.id}/join`);
    for (let bot = 0; bot < 3; bot++) {
      await host.api('POST', `/rooms/${room.id}/bots`, { level: 'normal' });
    }
    const everyoneReady = async () => {
      await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      await guest.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    };

    // Five sat down for six roles: the match does not start, and the host is told why.
    await everyoneReady();
    const tooMany = await host.api<ErrorBody>('POST', `/rooms/${room.id}/start`);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error).toMatchObject({
      code: ErrorCodes.InvalidRoomSettings,
      details: { rule: 'TOO_MANY_ROLES' },
    });
    const { body: stillOpen } = await host.api<RoomDto>('GET', `/rooms/${room.id}`);
    expect(stillOpen).toMatchObject({ status: 'open', currentMatchId: null });

    // A smaller cast fits; the two villagers it leaves room for are not named.
    await host.api('PUT', `/rooms/${room.id}/settings`, {
      settings: { preset: 'custom', roles: { werewolf: 1, seer: 1, hunter: 1 } },
    });
    await everyoneReady();
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    type WerewolfState = GameStateMessage<WerewolfView>;
    const sync = async (client: Client): Promise<WerewolfState> => {
      const ack = await client.emit<WerewolfState>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const knownRoles = (view: WerewolfState) =>
      view.state.players.filter((player) => player.role !== null).map((player) => player.playerId);

    // Everyone is told the cast, their own role, and nobody else's.
    for (const client of [host, guest]) {
      const view = await sync(client);
      expect(view.state).not.toHaveProperty('seatOrder');
      expect(view.state).not.toHaveProperty('night');
      expect(view.state.roleCounts).toMatchObject({ villager: 2, werewolf: 1, seer: 1, hunter: 1 });
      expect(knownRoles(view)).toEqual([view.viewerPlayerId]);
      expect(view.state.me?.role).toBeDefined();
    }
    const watching = await sync(watcher);
    expect(watching.state.me).toBeNull();
    expect(knownRoles(watching)).toEqual([]);
    const spectatorMove = await watcher.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: watching.version,
      action: { type: 'SLEEP' },
    });
    expect(spectatorMove).toMatchObject({ ok: false, error: { code: ErrorCodes.Forbidden } });

    // A role's action from someone who does not hold it gives nothing away.
    const first = await sync(host);
    const notMine = first.state.me?.role === 'werewolf' ? 'SEER_INSPECT' : 'WOLF_VOTE';
    const other = first.state.players.find((player) => player.playerId !== first.viewerPlayerId);
    const pretend = await host.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: first.version,
      action: { type: notMine, targetId: other?.playerId },
    });
    if (pretend.ok) throw new Error('A role was played by someone who does not hold it');
    expect([ErrorCodes.InvalidAction, ErrorCodes.GameVersionConflict]).toContain(
      pretend.error.code,
    );

    // Both people play at once, alongside three bots: at night and in a vote everyone acts
    // on the same version, so losing a race is normal and just means looking again.
    let conflicts = 0;
    const play = async (client: Client): Promise<WerewolfState> => {
      for (let step = 0; step < 3000; step++) {
        const view = await sync(client);
        if (view.status !== 'playing') return view;
        const legal = view.state.me?.legal;
        if (!legal || legal.action === null) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          continue;
        }
        const targetId = legal.targets[0] ?? null;
        const actions: Record<string, unknown> = {
          WITCH_DECIDE: { type: 'WITCH_DECIDE', heal: false, poisonTargetId: null },
          CUPID_LINK: { type: 'CUPID_LINK', firstId: targetId, secondId: legal.targets[1] },
        };
        const ack = await client.emit(ClientEvents.GameAction, {
          gameId,
          requestId: randomUUID(),
          expectedVersion: view.version,
          action: actions[legal.action] ?? { type: legal.action, targetId },
        });
        if (ack.ok) continue;
        expect(ack.error.code).toBe(ErrorCodes.GameVersionConflict);
        conflicts += 1;
      }
      throw new Error(`The match did not end (${conflicts} conflicts)`);
    };
    const [final] = await Promise.all([play(host), play(guest)]);

    // The end shows everything, to everyone, and the winners are one whole side.
    expect(final.status).toBe('finished');
    const shown = await sync(watcher);
    const roleOf = new Map(shown.state.players.map((player) => [player.playerId, player.role]));
    expect([...roleOf.values()].sort()).toEqual(
      ['hunter', 'seer', 'villager', 'villager', 'werewolf'].sort(),
    );
    const { body: match } = await host.api<MatchDto>('GET', `/matches/${gameId}`);
    const winners = match.result?.winnerPlayerIds ?? [];
    expect(winners).toEqual(shown.state.winnerPlayerIds);
    expect(shown.state.winner === 'werewolves' ? ['werewolf'] : ['village']).toEqual([
      ...new Set(winners.map((id) => (roleOf.get(id) === 'werewolf' ? 'werewolf' : 'village'))),
    ]);

    // The replay is what a spectator saw: no roles until the last frame.
    const { body: replay } = await host.api<MatchReplayDto>('GET', `/matches/${gameId}/replay`);
    expect(replay.frames.length).toBe(match.version + 1);
    const opening = replay.frames[0]?.state as WerewolfView;
    expect(opening.players.every((player) => player.role === null)).toBe(true);
    expect(opening.me).toBeNull();
  });

  it('plays Avalon: a role per seat, votes cast together, and roles that fit the table', async () => {
    const names = ['Arthur', 'Bors', 'Cai', 'Dagonet', 'Ector'];
    const seated: Client[] = [];
    for (const name of names) seated.push(await createClient(name));
    const [host, ...guests] = seated as [Client, ...Client[]];
    const watcher = await createClient('Watcher');
    type ErrorBody = { error: { code: string; message: string; details?: { rule?: string } } };

    // The host may pick any roles the game offers; whether they fit is only known at the start.
    const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'avalon',
      settings: { roles: ['MORDRED', 'MORGANA'], ladyOfTheLake: true, seed: 'mine' },
    });
    expect(room.settings).toEqual({ roles: ['MORGANA', 'MORDRED'], ladyOfTheLake: true });
    for (const guest of guests) await guest.api('POST', `/rooms/${room.id}/join`);
    const everyoneReady = async () => {
      for (const client of seated) {
        await client.api('POST', `/rooms/${room.id}/ready`, { ready: true });
      }
    };

    // Five players have two evil seats: the Assassin and one more. The game says so, and the
    // room stays open for the host to put it right.
    await everyoneReady();
    const tooMany = await host.api<ErrorBody>('POST', `/rooms/${room.id}/start`);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error).toMatchObject({
      code: ErrorCodes.InvalidRoomSettings,
      message: expect.stringContaining('at least 7 players'),
      details: { rule: 'ROLES_DO_NOT_FIT' },
    });
    const { body: stillOpen } = await host.api<RoomDto>('GET', `/rooms/${room.id}`);
    expect(stillOpen).toMatchObject({ status: 'open', currentMatchId: null });

    await host.api('PUT', `/rooms/${room.id}/settings`, {
      settings: { roles: ['MORGANA'], ladyOfTheLake: true },
    });
    await everyoneReady();
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    type AvalonState = GameStateMessage<AvalonView>;
    const sync = async (client: Client): Promise<AvalonState> => {
      const ack = await client.emit<AvalonState>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const send = (
      client: Client,
      action: AvalonAction,
      expectedVersion: number,
      requestId: string,
    ) =>
      client.emit<GameActionAccepted>(ClientEvents.GameAction, {
        gameId,
        requestId,
        expectedVersion,
        action,
      });
    /** As the web client does for this game: on a conflict, fetch the state and send again. */
    const sendUntilItLands = async (client: Client, action: AvalonAction): Promise<number> => {
      const requestId = randomUUID();
      for (let resends = 0; resends <= 10; resends += 1) {
        const ack = await send(client, action, (await sync(client)).version, requestId);
        if (ack.ok) return resends;
        if (ack.error.code !== ErrorCodes.GameVersionConflict) throw new Error(ack.error.code);
      }
      throw new Error('The action never landed');
    };

    // Each seat gets its own role and nothing of anyone else's; the raw state never leaves.
    const dealt = await Promise.all(seated.map(sync));
    const watching = await sync(watcher);
    for (const view of [...dealt, watching]) {
      expect(view.state.roles).toBeNull();
      expect(view.state).not.toHaveProperty('current');
      expect(view.state).not.toHaveProperty('firstLeaderIndex');
      expect(view.state.rolesInPlay).toEqual([
        'MERLIN',
        'LOYAL_SERVANT',
        'LOYAL_SERVANT',
        'ASSASSIN',
        'MORGANA',
      ]);
      expect(view.state.lady?.inspections).toEqual([]);
    }
    expect(watching.viewerPlayerId).toBeNull();
    expect(watching.state.you).toBeNull();
    expect(dealt.map((view) => view.state.you?.role).sort()).toEqual(
      [...dealt[0]!.state.rolesInPlay].sort(),
    );

    const playerIdOf = (view: AvalonState) => view.viewerPlayerId as string;
    const evilIds = dealt.filter((view) => view.state.you?.alignment === 'EVIL').map(playerIdOf);
    for (const view of dealt) {
      const knows = view.state.you?.knowledge.map((seen) => seen.playerId);
      const role = view.state.you?.role;
      if (role === 'MERLIN') expect(knows?.sort()).toEqual([...evilIds].sort());
      else if (role === 'LOYAL_SERVANT') expect(knows).toEqual([]);
      else expect(knows).toEqual(evilIds.filter((id) => id !== playerIdOf(view)));
    }

    // The leader proposes; then everyone votes at once, against the same version.
    const leaderIndex = dealt.findIndex((view) => view.state.legal.propose !== null);
    const team = dealt[0]!.state.seatOrder.slice(0, 2);
    const proposed = await send(
      seated[leaderIndex] as Client,
      { type: 'PROPOSE_TEAM', team },
      0,
      randomUUID(),
    );
    expect(proposed.ok).toBe(true);

    const approve: AvalonAction = { type: 'VOTE', proposal: 0, approve: true };
    const requestIds = seated.map(() => randomUUID());
    const together = await Promise.all(
      seated.map((client, index) => send(client, approve, 1, requestIds[index] as string)),
    );
    expect(together.filter((ack) => ack.ok)).toHaveLength(1);
    for (const ack of together) {
      if (!ack.ok) expect(ack.error.code).toBe(ErrorCodes.GameVersionConflict);
    }

    // One vote is in: everyone can see whose, nobody how, and the match log stays closed.
    const oneIn = await sync(watcher);
    expect(oneIn.version).toBe(2);
    expect(oneIn.state.voted).toHaveLength(1);
    expect(oneIn.state.proposals).toEqual([]);
    const liveHistory = await host.api<ErrorBody>('GET', `/matches/${gameId}/history`);
    expect(liveHistory.body.error.code).toBe(ErrorCodes.MatchNotFinished);

    // The four who lost the race send again, all at once, until every vote has landed.
    const losers = seated.filter((_, index) => !together[index]?.ok);
    const resends = await Promise.all(losers.map((client) => sendUntilItLands(client, approve)));
    expect(resends.every((count) => count <= 4)).toBe(true);
    const voted = await sync(watcher);
    expect(voted.version).toBe(6);
    expect(voted.state.phase).toBe('QUEST');
    expect(voted.state.proposals).toHaveLength(1);
    expect(Object.values(voted.state.proposals[0]!.votes)).toEqual([true, true, true, true, true]);

    // A vote that arrives after its proposal is settled is refused, not counted for the next.
    const late = await send(host, approve, 6, randomUUID());
    expect(late).toMatchObject({ ok: false, error: { code: ErrorCodes.InvalidAction } });

    // Play it out: everyone approves and plays Success, so good takes three quests and the
    // Assassin gets a guess. Those with something to do act together each round.
    const choose = (view: AvalonView): AvalonAction | null => {
      const { legal } = view;
      if (legal.propose) {
        return { type: 'PROPOSE_TEAM', team: view.seatOrder.slice(0, legal.propose.teamSize) };
      }
      if (legal.vote) return { type: 'VOTE', proposal: legal.vote.proposal, approve: true };
      if (legal.quest) return { type: 'PLAY_QUEST_CARD', quest: legal.quest.quest, success: true };
      if (legal.ladyTargets[0]) return { type: 'USE_LADY', targetId: legal.ladyTargets[0] };
      if (legal.assassinTargets[0]) {
        return { type: 'ASSASSINATE', targetId: legal.assassinTargets[0] };
      }
      return null;
    };
    const phases = new Set<string>();
    let inspectorIndex = -1;
    for (let round = 0; round < 50; round += 1) {
      const views = await Promise.all(seated.map(sync));
      if (views[0]!.status !== 'playing') break;
      phases.add(views[0]!.state.phase);
      await Promise.all(
        views.map((view, index) => {
          const action = choose(view.state);
          if (action?.type === 'USE_LADY') inspectorIndex = index;
          return action ? sendUntilItLands(seated[index] as Client, action) : null;
        }),
      );

      // Only the player who used the Lady learns what she showed.
      if (inspectorIndex !== -1 && phases.has('LADY') && !phases.has('ASSASSINATION')) {
        const shown = await Promise.all([...seated, watcher].map(sync));
        shown.forEach((view, index) => {
          const alignment = view.state.lady?.inspections[0]?.alignment;
          expect(alignment === null).toBe(index !== inspectorIndex);
        });
      }
    }
    expect([...phases].sort()).toEqual(
      ['ASSASSINATION', 'LADY', 'QUEST', 'TEAM_PROPOSAL', 'TEAM_VOTE'].sort(),
    );

    // Over: everything is shown to everyone, and each side wins or loses together.
    const final = await sync(watcher);
    expect(final.status).toBe('finished');
    expect(final.state.quests.filter((quest) => quest.result?.success)).toHaveLength(3);
    expect(Object.keys(final.state.roles ?? {})).toHaveLength(5);
    const goodIds = dealt.map(playerIdOf).filter((id) => !evilIds.includes(id));
    const winners = final.state.outcome?.winner === 'EVIL' ? evilIds : goodIds;
    const { body: match } = await host.api<MatchDto>('GET', `/matches/${gameId}`);
    expect(match.result?.winnerPlayerIds.sort()).toEqual([...winners].sort());
    expect(match.result).not.toHaveProperty('scores');

    // The replay is what a watcher saw: no roles until the last frame, and no vote or card in
    // an action's name.
    const { body: replay } = await host.api<MatchReplayDto>('GET', `/matches/${gameId}/replay`);
    expect(replay.frames).toHaveLength(final.version + 1);
    const frames = replay.frames.map((frame) => frame.state as AvalonView);
    expect(frames.slice(0, -1).every((view) => view.roles === null && view.you === null)).toBe(
      true,
    );
    expect(frames.at(-1)?.roles).toEqual(final.state.roles);
    expect(new Set(replay.frames.map((frame) => frame.action?.actionType))).toEqual(
      new Set([undefined, 'PROPOSE_TEAM', 'VOTE', 'PLAY_QUEST_CARD', 'USE_LADY', 'ASSASSINATE']),
    );
  });

  it('plays CATAN against computer players, each hand kept to its owner', async () => {
    const host = await createClient('Host');
    const watcher = await createClient('Watcher');

    const { body: room } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'catan',
      settings: { boardSetup: 'variable' },
    });
    expect(room.settings).toEqual({ boardSetup: 'variable' });
    // Three seats at least: one person cannot start alone, or with one computer player.
    await host.api('POST', `/rooms/${room.id}/ready`, { ready: true });
    await host.api('POST', `/rooms/${room.id}/bots`, { level: 'normal' });
    const tooFew = await host.api<{ error: { code: string } }>('POST', `/rooms/${room.id}/start`);
    expect(tooFew.body.error.code).toBe(ErrorCodes.NotEnoughPlayers);
    await host.api('POST', `/rooms/${room.id}/bots`, { level: 'hard' });
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${room.id}/start`);
    const gameId = started.matchId;

    type CatanState = GameStateMessage<CatanView>;
    const sync = async (client: Client): Promise<CatanState> => {
      const ack = await client.emit<CatanState>(ClientEvents.GameSync, { gameId });
      if (!ack.ok) throw new Error(ack.error.code);
      return ack.data;
    };
    const act = (state: CatanState, action: unknown) =>
      host.emit<GameActionAccepted>(ClientEvents.GameAction, {
        gameId,
        requestId: randomUUID(),
        expectedVersion: state.version,
        action,
      });
    /** Waits out the computer players until the host has something to do. */
    const myMove = async (can: (view: CatanView) => boolean): Promise<CatanState> => {
      for (let attempt = 0; attempt < 400; attempt++) {
        const latest = await sync(host);
        if (can(latest.state)) return latest;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('Timed out waiting for the host to be asked to move');
    };

    // The opening: the host places twice, the computer players in between and around.
    for (let placed = 0; placed < 2; placed++) {
      const settling = await myMove((view) => view.legal.settlementVertices.length > 0);
      expect(settling.state.turn.step).toBe('SETUP_SETTLEMENT');
      const settled = await act(settling, {
        type: 'PLACE_SETUP_SETTLEMENT',
        vertex: settling.state.legal.settlementVertices[0],
      });
      expect(settled.ok).toBe(true);
      const paving = await myMove((view) => view.legal.roadEdges.length > 0);
      const paved = await act(paving, {
        type: 'PLACE_SETUP_ROAD',
        edge: paving.state.legal.roadEdges[0],
      });
      expect(paved.ok).toBe(true);
    }

    // The computer players finish the opening and play until the host is to roll.
    const rolling = await myMove((view) => view.legal.canRoll);
    const me = rolling.viewerPlayerId as string;
    expect(Object.keys(rolling.state.buildings)).toHaveLength(6);
    expect(Object.keys(rolling.state.roads).length).toBeGreaterThanOrEqual(6);
    expect(rolling.state.board.hexes).toHaveLength(19);
    expect(rolling.state.board.ports).toHaveLength(9);

    // The host sees their own hand; of the others, only how many cards they hold.
    const mine = rolling.state.players[me];
    expect(mine?.resources).not.toBeNull();
    expect(mine?.resourceCount).toBeGreaterThan(0);
    for (const [playerId, seat] of Object.entries(rolling.state.players)) {
      if (playerId === me) continue;
      expect(seat.resources).toBeNull();
      expect(seat.developmentCards).toBeNull();
      expect(seat.resourceCount).toBeGreaterThanOrEqual(0);
    }
    // A spectator sees no hand at all, and nobody is sent the seed or the deck.
    const watched = await sync(watcher);
    expect(watched.viewerPlayerId).toBeNull();
    for (const seat of Object.values(watched.state.players)) expect(seat.resources).toBeNull();
    for (const view of [rolling, watched]) {
      expect(view.state).not.toHaveProperty('random');
      expect(view.state).not.toHaveProperty('developmentDeck');
      expect(view.state).not.toHaveProperty('config');
      expect(view.state.developmentDeckCount).toBeLessThanOrEqual(25);
    }

    // A move the rules refuse comes back with the rule's own code; the roll goes through.
    const early = await act(rolling, { type: 'END_TURN' });
    expect(early).toMatchObject({
      ok: false,
      error: { code: ErrorCodes.InvalidAction, details: { rule: 'WRONG_STEP' } },
    });
    const peeking = await watcher.emit(ClientEvents.GameAction, {
      gameId,
      requestId: randomUUID(),
      expectedVersion: rolling.version,
      action: { type: 'ROLL_DICE' },
    });
    expect(peeking).toMatchObject({ ok: false, error: { code: ErrorCodes.Forbidden } });
    const rolled = await act(rolling, { type: 'ROLL_DICE', roll: [6, 6] });
    expect(rolled.ok).toBe(true);
    const after = await sync(host);
    const [first, second] = after.state.turn.roll ?? [0, 0];
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBeLessThanOrEqual(6);

    // The fixed setup has no opening: the pieces are on the board when the match starts.
    const { body: fixedRoom } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'catan',
      settings: { boardSetup: 'fixed' },
    });
    await host.api('POST', `/rooms/${fixedRoom.id}/ready`, { ready: true });
    await host.api('POST', `/rooms/${fixedRoom.id}/bots`, { level: 'easy' });
    await host.api('POST', `/rooms/${fixedRoom.id}/bots`, { level: 'easy' });
    const { body: fixed } = await host.api<StartRoomResponse>(
      'POST',
      `/rooms/${fixedRoom.id}/start`,
    );
    const ack = await host.emit<CatanState>(ClientEvents.GameSync, { gameId: fixed.matchId });
    if (!ack.ok) throw new Error(ack.error.code);
    expect(Object.keys(ack.data.state.buildings)).toHaveLength(6);
    expect(ack.data.state.board.hexes[0]).toEqual({ q: 0, r: -2, terrain: 'desert', number: null });
    expect(ack.data.state.turn.step).not.toBe('SETUP_SETTLEMENT');
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

  it('lists rooms in the lobby and lets the host change the map', async () => {
    const host = await createClient('Host');
    const guest = await createClient('Guest');
    const stranger = await createClient('Stranger');
    type ErrorBody = { error: { code: string } };
    const listed = async (client: Client) =>
      (await client.api<RoomDto[]>('GET', '/rooms')).body.map((room) => room.id);

    const { body: open } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'harmonies',
      visibility: 'public',
    });
    const { body: hidden } = await host.api<RoomDto>('POST', '/rooms', {
      gameType: 'grid-claim',
      visibility: 'private',
    });

    // Public rooms are listed for everyone; private ones only for their members.
    expect(await listed(stranger)).toContain(open.id);
    expect(await listed(stranger)).not.toContain(hidden.id);
    expect(await listed(host)).toEqual(expect.arrayContaining([open.id, hidden.id]));
    await guest.api('POST', `/rooms/${hidden.id}/join`);
    expect(await listed(guest)).toContain(hidden.id);

    // A room nobody is left in is closed and drops off the list.
    const { body: abandoned } = await stranger.api<RoomDto>('POST', '/rooms', {
      gameType: 'harmonies',
      visibility: 'public',
    });
    await stranger.api('POST', `/rooms/${abandoned.id}/leave`);
    expect(await listed(host)).not.toContain(abandoned.id);

    // The list carries what the lobby shows: game, members, settings.
    const { body: rooms } = await stranger.api<RoomDto[]>('GET', '/rooms');
    expect(rooms.find((room) => room.id === open.id)).toMatchObject({
      gameType: 'harmonies',
      settings: { mapId: 'A' },
      members: [{ displayName: 'Host' }],
    });

    // Only the host changes the map, only to a map that exists, and it un-readies people.
    await guest.api('POST', `/rooms/${open.id}/join`);
    await guest.api('POST', `/rooms/${open.id}/ready`, { ready: true });
    await host.api('POST', `/rooms/${open.id}/bots`, { level: 'easy' });

    const notHost = await guest.api<ErrorBody>('PUT', `/rooms/${open.id}/settings`, {
      settings: { mapId: 'B' },
    });
    expect(notHost.body.error.code).toBe(ErrorCodes.NotRoomHost);
    const noSuchMap = await host.api<ErrorBody>('PUT', `/rooms/${open.id}/settings`, {
      settings: { mapId: 'Z' },
    });
    expect(noSuchMap.body.error.code).toBe(ErrorCodes.InvalidRoomSettings);

    const { body: changed } = await host.api<RoomDto>('PUT', `/rooms/${open.id}/settings`, {
      settings: { mapId: 'B' },
    });
    expect(changed.settings).toEqual({ mapId: 'B' });
    expect(changed.members.map((member) => [member.displayName, member.status])).toEqual([
      ['Host', 'joined'],
      ['Guest', 'joined'],
      [expect.stringContaining('Bot'), 'ready'],
    ]);

    // The match is then played on the new map, and cannot be changed once it has started.
    await host.api('POST', `/rooms/${open.id}/ready`, { ready: true });
    await guest.api('POST', `/rooms/${open.id}/ready`, { ready: true });
    const { body: started } = await host.api<StartRoomResponse>('POST', `/rooms/${open.id}/start`);
    const ack = await host.emit<GameStateMessage<HarmoniesView>>(ClientEvents.GameSync, {
      gameId: started.matchId,
    });
    if (!ack.ok) throw new Error(ack.error.code);
    expect(ack.data.state.map.id).toBe('B');
    const tooLate = await host.api<ErrorBody>('PUT', `/rooms/${open.id}/settings`, {
      settings: { mapId: 'A' },
    });
    expect(tooLate.body.error.code).toBe(ErrorCodes.RoomNotOpen);
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
