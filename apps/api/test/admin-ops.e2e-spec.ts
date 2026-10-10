import { randomUUID } from 'node:crypto';
import type { GridClaimView } from '@bgp/game-demo';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type AdminGameConfigDto,
  type AdminGameDto,
  type AdminMatchDto,
  type AdminRoomDto,
  type ApiErrorBody,
  type AuthSessionDto,
  type ConfigReplayImpactDto,
  type GameConfigDocumentDto,
  type GameConfigDto,
  type GameActionAccepted,
  type GameConfigSummaryDto,
  type GameFinishedMessage,
  type GameStateMessage,
  type MatchHistoryDto,
  type Page,
  type RoomDto,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { eq } from 'drizzle-orm';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseConnection } from '../src/infrastructure/database/database.connection.js';
import { matches, rooms } from '../src/infrastructure/database/schema.js';
import { GameRegistry } from '../src/modules/games/game-registry.js';
import { ADMIN_USERNAME, startAdminHarness, type AdminHarness } from './admin-harness.js';

type State = GameStateMessage<GridClaimView>;

/** Someone at a table: signed in, connected, and collecting what the server tells them. */
interface Seat {
  session: AuthSessionDto;
  socket: Socket;
  finished: GameFinishedMessage[];
  rooms: RoomDto[];
}

const GAME = 'grid-claim';
const SMALLER = { boardSize: 4, blockedCellCount: 1, targetScore: 6 };

describe('admin area', () => {
  let harness: AdminHarness;
  let admin: AuthSessionDto;
  let player: AuthSessionDto;

  beforeAll(async () => {
    harness = await startAdminHarness();
    admin = (await harness.loginAsAdmin()).body;
    player = await harness.loginAsGuest('Player');
  });

  afterAll(async () => {
    await harness?.close();
  });

  const asAdmin = <T>(method: string, path: string, body?: unknown) =>
    harness.request<T>(method, `/admin${path}`, admin.accessToken, body);

  async function seat(displayName: string): Promise<Seat> {
    const session = await harness.loginAsGuest(displayName);
    const socket = await harness.connect(session.accessToken);
    const finished: GameFinishedMessage[] = [];
    const rooms: RoomDto[] = [];
    socket.on(ServerEvents.GameFinished, (message: GameFinishedMessage) => finished.push(message));
    socket.on(ServerEvents.RoomUpdated, (room: RoomDto) => rooms.push(room));
    return { session, socket, finished, rooms };
  }

  async function sync(who: Seat, gameId: string): Promise<State> {
    const ack: Ack<State> = await who.socket.emitWithAck(ClientEvents.GameSync, { gameId });
    if (!ack.ok) throw new Error(ack.error.code);
    return ack.data;
  }

  /** Two people in a private room with a match under way, both watching it. */
  async function startMatch(host: Seat, guest: Seat) {
    const { body: room } = await harness.request<RoomDto>(
      'POST',
      '/rooms',
      host.session.accessToken,
      {
        gameType: GAME,
        visibility: 'private',
      },
    );
    await harness.request('POST', `/rooms/${room.id}/join`, guest.session.accessToken);
    for (const who of [host, guest]) {
      await who.socket.emitWithAck(ClientEvents.RoomJoin, { roomId: room.id });
    }
    const started = await harness.request<StartRoomResponse>(
      'POST',
      `/rooms/${room.id}/start`,
      host.session.accessToken,
    );
    const matchId = started.body.matchId;
    const states = [await sync(host, matchId), await sync(guest, matchId)];
    return { room, matchId, states };
  }

  /** Sends the next legal move from whoever's turn it is. */
  function move(seats: Seat[], states: State[], version = states[0]!.version) {
    const turn = states.findIndex((state) => state.state.legalPositions.length > 0);
    return seats[turn]!.socket.emitWithAck(ClientEvents.GameAction, {
      gameId: states[turn]!.gameId,
      requestId: randomUUID(),
      expectedVersion: version,
      action: { type: 'PLACE_PIECE', position: states[turn]!.state.legalPositions[0] },
    }) as Promise<Ack<GameActionAccepted>>;
  }

  async function waitFor<T>(read: () => T | undefined, what: string): Promise<T> {
    for (let attempt = 0; attempt < 200; attempt++) {
      const value = read();
      if (value !== undefined) return value;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${what}`);
  }

  const getRoom = (who: Seat, roomId: string) =>
    harness.request<RoomDto>('GET', `/rooms/${roomId}`, who.session.accessToken);

  describe('game configs', () => {
    /** A match of GAME that ended under the given config version, written straight to the database. */
    async function insertEndedMatch(configVersion: number): Promise<void> {
      const { db } = harness.app.get(DatabaseConnection);
      const roomId = randomUUID();
      await db.insert(rooms).values({
        id: roomId,
        code: randomUUID().slice(0, 6).toUpperCase(),
        gameType: GAME,
        hostUserId: player.user.id,
        status: 'open',
        visibility: 'private',
      });
      await db.insert(matches).values({
        id: randomUUID(),
        roomId,
        gameType: GAME,
        engineVersion: harness.app.get(GameRegistry).get(GAME).engine.engineVersion,
        configVersion,
        status: 'finished',
        state: {},
        randomSeed: 'admin-ops',
        finishedAt: new Date(),
      });
    }

    it('is closed to players and to anonymous callers', async () => {
      for (const [method, path, body] of [
        ['GET', '/admin/games', undefined],
        ['GET', `/admin/games/${GAME}/configs`, undefined],
        ['POST', `/admin/games/${GAME}/configs`, { config: SMALLER, expectedVersion: 1 }],
        ['POST', `/admin/games/${GAME}/configs/1/restore`, { expectedVersion: 1 }],
      ] as const) {
        expect((await harness.request(method, path, player.accessToken, body)).code).toBe(
          ErrorCodes.Forbidden,
        );
        expect((await harness.request(method, path, undefined, body)).code).toBe(
          ErrorCodes.Unauthorized,
        );
      }
      // Nothing was published by the refused requests.
      expect(
        (await harness.request<GameConfigDto>('GET', `/games/${GAME}/config`)).body.version,
      ).toBe(1);
    });

    it('lists every game with the config version in force', async () => {
      const games = await asAdmin<AdminGameDto[]>('GET', '/games');
      expect(games.status).toBe(200);
      const registered = harness.app.get(GameRegistry).list();
      expect(games.body.map((game) => game.gameType).sort()).toEqual(
        registered.map((game) => game.definition.gameType).sort(),
      );
      expect(games.body.every((game) => game.currentVersion === 1)).toBe(true);
    });

    it('shows the seeded version, which is the engine default and has no author', async () => {
      const history = await asAdmin<Page<GameConfigSummaryDto>>('GET', `/games/${GAME}/configs`);
      expect(history.body).toMatchObject({ total: 1, limit: 25, offset: 0 });
      expect(history.body.items[0]).toMatchObject({ version: 1, createdBy: null });
      // The history leaves the documents out.
      expect(history.body.items[0]).not.toHaveProperty('config');

      const seeded = await asAdmin<AdminGameConfigDto>('GET', `/games/${GAME}/configs/1`);
      const fallback = await asAdmin<GameConfigDocumentDto>('GET', `/games/${GAME}/config-default`);
      expect(seeded.body).toMatchObject({ version: 1, createdBy: null, engineError: null });
      expect(seeded.body.config).toEqual(fallback.body.config);
    });

    it('checks a document without storing it', async () => {
      const bad = await asAdmin<ApiErrorBody>('POST', `/games/${GAME}/configs/validate`, {
        config: { ...SMALLER, boardSize: 'huge' },
      });
      expect(bad.status).toBe(400);
      expect(bad.code).toBe(ErrorCodes.InvalidGameConfig);

      const good = await asAdmin<GameConfigDocumentDto>('POST', `/games/${GAME}/configs/validate`, {
        config: SMALLER,
      });
      expect(good.status).toBe(200);
      expect(good.body.config).toEqual(SMALLER);
      expect((await asAdmin<AdminGameConfigDto>('GET', `/games/${GAME}/configs/2`)).status).toBe(
        404,
      );
    });

    it('refuses a document the engine does not accept, and one for a game that does not exist', async () => {
      const invalid = await asAdmin('POST', `/games/${GAME}/configs`, {
        config: { boardSize: 'huge' },
        expectedVersion: 1,
      });
      expect(invalid.status).toBe(400);
      expect(invalid.code).toBe(ErrorCodes.InvalidGameConfig);

      const unknown = await asAdmin('POST', '/games/chess/configs', {
        config: {},
        expectedVersion: 1,
      });
      expect(unknown.status).toBe(404);
      expect(unknown.code).toBe(ErrorCodes.UnknownGameType);

      const noEnvelope = await asAdmin('POST', `/games/${GAME}/configs`, { config: SMALLER });
      expect(noEnvelope.code).toBe(ErrorCodes.ValidationFailed);
    });

    it('counts the ended matches a new config would stop from being replayed', async () => {
      const impact = () =>
        asAdmin<ConfigReplayImpactDto>('GET', `/games/${GAME}/replay-impact`).then(
          (reply) => reply.body.replayableMatches,
        );
      expect(await impact()).toBe(0);
      await insertEndedMatch(1);
      await insertEndedMatch(1);
      // Set up under a config that is not the current one: already not replayable.
      await insertEndedMatch(7);
      expect(await impact()).toBe(2);
    });

    it('publishes a new version under its author, and only on top of the version they saw', async () => {
      const published = await asAdmin<AdminGameConfigDto>('POST', `/games/${GAME}/configs`, {
        config: SMALLER,
        note: '  Smaller board  ',
        expectedVersion: 1,
      });
      expect(published.status).toBe(201);
      expect(published.body).toMatchObject({
        version: 2,
        note: 'Smaller board',
        config: SMALLER,
        engineError: null,
        createdBy: { id: admin.user.id, displayName: ADMIN_USERNAME },
      });
      expect(
        (await harness.request<GameConfigDto>('GET', `/games/${GAME}/config`)).body.version,
      ).toBe(2);
      // The matches that ended under v1 can no longer be replayed, so nothing is left to lose.
      expect(
        (await asAdmin<ConfigReplayImpactDto>('GET', `/games/${GAME}/replay-impact`)).body
          .replayableMatches,
      ).toBe(0);

      // Someone still editing v1 would undo v2 without ever having seen it.
      const stale = await asAdmin<ApiErrorBody>('POST', `/games/${GAME}/configs`, {
        config: { ...SMALLER, targetScore: 5 },
        expectedVersion: 1,
      });
      expect(stale.status).toBe(409);
      expect(stale.code).toBe(ErrorCodes.GameConfigConflict);
      expect(stale.body.error.details).toEqual({ latestVersion: 2 });
      expect((await asAdmin<AdminGameConfigDto>('GET', `/games/${GAME}/configs/3`)).status).toBe(
        404,
      );
    });

    it('restores an earlier version by publishing its document again, never by rewriting history', async () => {
      const original = await asAdmin<AdminGameConfigDto>('GET', `/games/${GAME}/configs/1`);

      const stale = await asAdmin('POST', `/games/${GAME}/configs/1/restore`, {
        expectedVersion: 1,
      });
      expect(stale.code).toBe(ErrorCodes.GameConfigConflict);

      const restored = await asAdmin<AdminGameConfigDto>(
        'POST',
        `/games/${GAME}/configs/1/restore`,
        {
          expectedVersion: 2,
        },
      );
      expect(restored.status).toBe(201);
      expect(restored.body).toMatchObject({ version: 3, note: 'Restored from v1.' });
      expect(restored.body.config).toEqual(original.body.config);
      expect(restored.body.createdBy?.id).toBe(admin.user.id);

      // Every version is still there, newest first, and pages as asked.
      const history = await asAdmin<Page<GameConfigSummaryDto>>(
        'GET',
        `/games/${GAME}/configs?limit=2&offset=1`,
      );
      expect(history.body).toMatchObject({ total: 3, limit: 2, offset: 1 });
      expect(history.body.items.map((item) => item.version)).toEqual([2, 1]);
      expect(
        (await asAdmin<AdminGameConfigDto>('GET', `/games/${GAME}/configs/2`)).body.config,
      ).toEqual(SMALLER);
    });

    it('answers clearly for versions and pages that do not exist', async () => {
      const missing = await asAdmin('GET', `/games/${GAME}/configs/99`);
      expect(missing.status).toBe(404);
      expect(missing.code).toBe(ErrorCodes.NotFound);
      expect(
        (await asAdmin('POST', `/games/${GAME}/configs/99/restore`, { expectedVersion: 3 })).code,
      ).toBe(ErrorCodes.NotFound);
      expect((await asAdmin('GET', `/games/${GAME}/configs/latest`)).code).toBe(
        ErrorCodes.ValidationFailed,
      );
      expect((await asAdmin('GET', `/games/${GAME}/configs?limit=0`)).code).toBe(
        ErrorCodes.ValidationFailed,
      );
      expect((await asAdmin('GET', `/games/${GAME}/configs?limit=500`)).code).toBe(
        ErrorCodes.ValidationFailed,
      );
      expect((await asAdmin('GET', '/games/chess/configs')).code).toBe(ErrorCodes.UnknownGameType);
    });
  });
  describe('matches', () => {
    let host: Seat;
    let guest: Seat;

    beforeAll(async () => {
      host = await seat('Table Host');
      guest = await seat('Table Guest');
    });

    it('lists matches in private rooms too, without ever including their state', async () => {
      const { room, matchId, states } = await startMatch(host, guest);

      const playing = await asAdmin<Page<AdminMatchDto>>(
        'GET',
        `/matches?status=playing&gameType=${GAME}`,
      );
      expect(playing.status).toBe(200);
      const listed = playing.body.items.find((match) => match.id === matchId);
      expect(listed).toMatchObject({
        roomId: room.id,
        roomCode: room.code,
        status: 'playing',
        version: 0,
        lastActionAt: null,
        engineOutdated: false,
      });
      expect(listed?.players.map((player) => player.displayName)).toEqual([
        'Table Host',
        'Table Guest',
      ]);
      expect(playing.body.total).toBe(playing.body.items.length);
      expect(JSON.stringify(playing.body)).not.toMatch(/"state"|"randomSeed"|legalPositions/);

      expect((await move([host, guest], states)).ok).toBe(true);
      const detail = await asAdmin<AdminMatchDto>('GET', `/matches/${matchId}`);
      expect(detail.body.version).toBe(1);
      expect(detail.body.lastActionAt).not.toBeNull();
      expect(detail.body).not.toHaveProperty('state');

      // Filters narrow the list, and the total follows them.
      const elsewhere = await asAdmin<Page<AdminMatchDto>>('GET', '/matches?gameType=harmonies');
      expect(elsewhere.body).toMatchObject({ items: [], total: 0 });
      expect((await asAdmin('GET', '/matches?status=paused')).code).toBe(
        ErrorCodes.ValidationFailed,
      );
      expect((await asAdmin('GET', '/matches/not-a-uuid')).code).toBe(ErrorCodes.ValidationFailed);
      expect((await asAdmin('GET', `/matches/${randomUUID()}`)).code).toBe(
        ErrorCodes.MatchNotFound,
      );

      for (const path of ['/admin/matches', `/admin/matches/${matchId}`]) {
        expect((await harness.request('GET', path, host.session.accessToken)).code).toBe(
          ErrorCodes.Forbidden,
        );
      }
      const refused = await harness.request(
        'POST',
        `/admin/matches/${matchId}/abandon`,
        host.session.accessToken,
      );
      expect(refused.code).toBe(ErrorCodes.Forbidden);
      expect((await asAdmin<AdminMatchDto>('GET', `/matches/${matchId}`)).body.status).toBe(
        'playing',
      );
      await asAdmin('POST', `/matches/${matchId}/abandon`);
    });

    it('ends a match in progress: no winner, everyone told, the room open again', async () => {
      const { room, matchId, states } = await startMatch(host, guest);
      expect((await move([host, guest], states)).ok).toBe(true);
      expect((await getRoom(host, room.id)).body.status).toBe('in_match');
      for (const who of [host, guest]) who.finished.length = 0;

      const ended = await asAdmin<AdminMatchDto>('POST', `/matches/${matchId}/abandon`);
      expect(ended.status).toBe(200);
      expect(ended.body).toMatchObject({ status: 'abandoned', result: null, version: 1 });
      expect(ended.body.finishedAt).not.toBeNull();

      for (const who of [host, guest]) {
        const told = await waitFor(() => who.finished[0], 'game.finished');
        expect(told).toEqual({ gameId: matchId, status: 'abandoned', result: null });
        await waitFor(
          () => who.rooms.find((update) => update.id === room.id && update.status === 'open'),
          'the room reopening',
        );
      }
      const reopened = await getRoom(host, room.id);
      expect(reopened.body).toMatchObject({ status: 'open', currentMatchId: null });

      // Nothing more can be played, and ending it twice is refused rather than repeated.
      const late = await move(
        [host, guest],
        [await sync(host, matchId), await sync(guest, matchId)],
      );
      expect(late.ok).toBe(false);
      const stale = await move([host, guest], states, 1);
      expect(stale.ok ? '' : stale.error.code).toBe(ErrorCodes.MatchNotPlaying);
      const again = await asAdmin('POST', `/matches/${matchId}/abandon`);
      expect(again.status).toBe(409);
      expect(again.code).toBe(ErrorCodes.MatchNotPlaying);

      // What was played is still exactly what the log says: ending added no move to it.
      const history = await harness.request<MatchHistoryDto>(
        'GET',
        `/matches/${matchId}/history`,
        host.session.accessToken,
      );
      expect(history.status).toBe(200);
      expect(history.body.actions).toHaveLength(history.body.match.version);
      expect(
        (await harness.request('GET', `/matches/${matchId}/replay`, host.session.accessToken))
          .status,
      ).toBe(200);

      // The same people can play again in the same room.
      const next = await harness.request<StartRoomResponse>(
        'POST',
        `/rooms/${room.id}/start`,
        host.session.accessToken,
      );
      expect(next.status).toBe(200);
      await asAdmin('POST', `/matches/${next.body.matchId}/abandon`);
    });

    it('keeps the log and the version in step when a move and the ending race', async () => {
      const { matchId, states } = await startMatch(host, guest);
      const [played, ended] = await Promise.all([
        move([host, guest], states),
        asAdmin<AdminMatchDto>('POST', `/matches/${matchId}/abandon`),
      ]);
      expect(ended.status).toBe(200);
      // The move either landed first or was refused: never half of each.
      if (!played.ok) expect(played.error.code).toBe(ErrorCodes.MatchNotPlaying);

      const history = await harness.request<MatchHistoryDto>(
        'GET',
        `/matches/${matchId}/history`,
        host.session.accessToken,
      );
      expect(history.body.match.status).toBe('abandoned');
      expect(history.body.match.version).toBe(played.ok ? 1 : 0);
      expect(history.body.actions).toHaveLength(history.body.match.version);
    });

    it('can end a match the current rules can no longer open, which is how rooms get stuck', async () => {
      const { room, matchId } = await startMatch(host, guest);
      const { db } = harness.app.get(DatabaseConnection);
      await db.update(matches).set({ engineVersion: 999 }).where(eq(matches.id, matchId));
      for (const who of [host, guest]) who.finished.length = 0;

      // Nobody at the table can do anything with it any more.
      const opened = await host.socket.emitWithAck(ClientEvents.GameSync, { gameId: matchId });
      expect(opened.ok ? '' : opened.error.code).toBe(ErrorCodes.MatchOutdated);
      const detail = await asAdmin<AdminMatchDto>('GET', `/matches/${matchId}`);
      expect(detail.body).toMatchObject({ status: 'playing', engineOutdated: true });

      const ended = await asAdmin<AdminMatchDto>('POST', `/matches/${matchId}/abandon`);
      expect(ended.body.status).toBe('abandoned');
      await waitFor(() => host.finished[0], 'game.finished');
      expect((await getRoom(host, room.id)).body).toMatchObject({
        status: 'open',
        currentMatchId: null,
      });
    });
  });
  describe('rooms', () => {
    let owner: Seat;
    let friend: Seat;

    beforeAll(async () => {
      owner = await seat('Room Owner');
      friend = await seat('Room Friend');
    });

    async function openRoom(host: Seat, visibility: 'private' | 'public' = 'private') {
      const { body } = await harness.request<RoomDto>('POST', '/rooms', host.session.accessToken, {
        gameType: GAME,
        visibility,
      });
      await host.socket.emitWithAck(ClientEvents.RoomJoin, { roomId: body.id });
      return body;
    }

    const join = async (who: Seat, roomId: string) => {
      await harness.request('POST', `/rooms/${roomId}/join`, who.session.accessToken);
      await who.socket.emitWithAck(ClientEvents.RoomJoin, { roomId });
    };

    const lobby = async (who: Seat) =>
      (await harness.request<RoomDto[]>('GET', '/rooms', who.session.accessToken)).body.map(
        (room) => room.id,
      );

    it('lists every room, private and closed ones included, and finds them by code or host', async () => {
      const hidden = await openRoom(owner, 'private');
      const shown = await openRoom(friend, 'public');

      const all = await asAdmin<Page<AdminRoomDto>>('GET', '/rooms?limit=100');
      expect(all.status).toBe(200);
      expect(all.body.total).toBe(all.body.items.length);
      const listed = all.body.items.find((room) => room.id === hidden.id);
      expect(listed).toMatchObject({
        code: hidden.code,
        visibility: 'private',
        status: 'open',
        hostDisplayName: 'Room Owner',
        currentMatchId: null,
      });
      expect(listed?.members.map((member) => member.displayName)).toEqual(['Room Owner']);
      // Newest first.
      const order = all.body.items.map((room) => room.id);
      expect(order.indexOf(shown.id)).toBeLessThan(order.indexOf(hidden.id));

      const byCode = await asAdmin<Page<AdminRoomDto>>(
        'GET',
        `/rooms?q=${hidden.code.toLowerCase()}`,
      );
      expect(byCode.body.items.map((room) => room.id)).toEqual([hidden.id]);
      const byHost = await asAdmin<Page<AdminRoomDto>>('GET', '/rooms?q=room%20fri');
      expect(byHost.body.items.map((room) => room.id)).toEqual([shown.id]);
      expect(byHost.body.total).toBe(1);
      // What was typed is looked for as it is: a percent sign is not "anything".
      expect((await asAdmin<Page<AdminRoomDto>>('GET', '/rooms?q=%25')).body.total).toBe(0);
      expect((await asAdmin<Page<AdminRoomDto>>('GET', '/rooms?q=_')).body.total).toBe(0);

      await asAdmin('POST', `/rooms/${shown.id}/close`);
      const closed = await asAdmin<Page<AdminRoomDto>>('GET', '/rooms?status=closed');
      expect(closed.body.items.map((room) => room.id)).toContain(shown.id);
      expect(closed.body.items.every((room) => room.status === 'closed')).toBe(true);
      const open = await asAdmin<Page<AdminRoomDto>>(
        'GET',
        `/rooms?status=open&gameType=${GAME}&limit=100`,
      );
      expect(open.body.items.map((room) => room.id)).toContain(hidden.id);
      expect(open.body.items.map((room) => room.id)).not.toContain(shown.id);
      expect((await asAdmin('GET', '/rooms?status=busy')).code).toBe(ErrorCodes.ValidationFailed);

      for (const [method, path] of [
        ['GET', '/admin/rooms'],
        ['GET', `/admin/rooms/${hidden.id}`],
        ['POST', `/admin/rooms/${hidden.id}/close`],
        ['DELETE', `/admin/rooms/${hidden.id}/members/${owner.session.user.id}`],
      ] as const) {
        expect((await harness.request(method, path, friend.session.accessToken)).code).toBe(
          ErrorCodes.Forbidden,
        );
      }
      expect((await getRoom(owner, hidden.id)).body.status).toBe('open');
    });

    it('removes a member, handing the room on when it was the host', async () => {
      const room = await openRoom(owner);
      await join(friend, room.id);
      friend.rooms.length = 0;

      const stranger = await asAdmin('DELETE', `/rooms/${room.id}/members/${admin.user.id}`);
      expect(stranger.status).toBe(404);
      expect(stranger.code).toBe(ErrorCodes.NotRoomMember);

      const removed = await asAdmin<AdminRoomDto>(
        'DELETE',
        `/rooms/${room.id}/members/${owner.session.user.id}`,
      );
      expect(removed.status).toBe(200);
      expect(removed.body).toMatchObject({
        status: 'open',
        hostUserId: friend.session.user.id,
        hostDisplayName: 'Room Friend',
      });
      expect(removed.body.members.map((member) => member.userId)).toEqual([friend.session.user.id]);
      // The people in the room see it happen.
      await waitFor(
        () => friend.rooms.find((update) => update.hostUserId === friend.session.user.id),
        'the room changing hands',
      );
      expect(
        (
          await harness.request('POST', `/rooms/${room.id}/ready`, owner.session.accessToken, {
            ready: true,
          })
        ).code,
      ).toBe(ErrorCodes.NotRoomMember);
    });

    it('closes a room when the last person in it is removed, computer players and all', async () => {
      const room = await openRoom(owner);
      await harness.request('POST', `/rooms/${room.id}/bots`, owner.session.accessToken, {
        level: 'easy',
      });
      expect((await getRoom(owner, room.id)).body.members).toHaveLength(2);

      const removed = await asAdmin<AdminRoomDto>(
        'DELETE',
        `/rooms/${room.id}/members/${owner.session.user.id}`,
      );
      expect(removed.body).toMatchObject({ status: 'closed', members: [] });
      // Nothing more can be done to a closed room.
      expect(
        (await asAdmin('DELETE', `/rooms/${room.id}/members/${owner.session.user.id}`)).code,
      ).toBe(ErrorCodes.RoomNotOpen);
    });

    it('closes a room for good: emptied, gone from the lobby, and closing it again changes nothing', async () => {
      const room = await openRoom(owner, 'public');
      await join(friend, room.id);
      expect(await lobby(friend)).toContain(room.id);
      owner.rooms.length = 0;

      const closed = await asAdmin<AdminRoomDto>('POST', `/rooms/${room.id}/close`);
      expect(closed.status).toBe(200);
      expect(closed.body).toMatchObject({ status: 'closed', members: [], currentMatchId: null });
      await waitFor(
        () => owner.rooms.find((update) => update.id === room.id && update.status === 'closed'),
        'the room closing',
      );
      expect(await lobby(friend)).not.toContain(room.id);
      expect(await lobby(owner)).not.toContain(room.id);
      expect(
        (await harness.request('POST', `/rooms/${room.id}/join`, friend.session.accessToken)).code,
      ).toBe(ErrorCodes.RoomNotOpen);

      const again = await asAdmin<AdminRoomDto>('POST', `/rooms/${room.id}/close`);
      expect(again.status).toBe(200);
      expect(again.body.status).toBe('closed');
      expect((await asAdmin('POST', `/rooms/${randomUUID()}/close`)).code).toBe(
        ErrorCodes.RoomNotFound,
      );
      expect((await asAdmin('GET', `/rooms/${randomUUID()}`)).code).toBe(ErrorCodes.RoomNotFound);
    });

    it('leaves a room alone while a match is being played in it', async () => {
      const { room, matchId } = await startMatch(owner, friend);

      const detail = await asAdmin<AdminRoomDto>('GET', `/rooms/${room.id}`);
      expect(detail.body).toMatchObject({ status: 'in_match', currentMatchId: matchId });

      const close = await asAdmin('POST', `/rooms/${room.id}/close`);
      expect(close.status).toBe(409);
      expect(close.code).toBe(ErrorCodes.RoomInMatch);
      const remove = await asAdmin('DELETE', `/rooms/${room.id}/members/${friend.session.user.id}`);
      expect(remove.code).toBe(ErrorCodes.RoomInMatch);
      expect((await getRoom(owner, room.id)).body.members).toHaveLength(2);

      // Ending the match first is the way through.
      await asAdmin('POST', `/matches/${matchId}/abandon`);
      expect((await asAdmin<AdminRoomDto>('POST', `/rooms/${room.id}/close`)).body.status).toBe(
        'closed',
      );
    });
  });
});
