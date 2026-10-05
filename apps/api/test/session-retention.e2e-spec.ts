import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthSessionDto, UserDto } from '@bgp/shared-types';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseConnection } from '../src/infrastructure/database/database.connection.js';
import {
  matchActions,
  matchPlayers,
  matches,
  roomMembers,
  rooms,
  users,
} from '../src/infrastructure/database/schema.js';
import { MatchCleanupService } from '../src/modules/matches/match-cleanup.service.js';
import { MATCH_HISTORY_RETENTION_MS } from '../src/modules/matches/match-retention.js';
import { MatchRepository } from '../src/modules/matches/match.repository.js';
import { RoomsService } from '../src/modules/rooms/rooms.service.js';
import { UsersRepository } from '../src/modules/users/users.repository.js';

describe('returning usernames and match retention', () => {
  let app: INestApplication;
  let baseUrl: string;
  let connection: DatabaseConnection;

  beforeAll(async () => {
    process.env.DATABASE_URL = '';
    process.env.PGLITE_DATA_DIR = 'memory://';
    process.env.JWT_SECRET = 'session-test-secret';
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/configure-app.js');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api`;
    connection = app.get(DatabaseConnection);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(displayName: string): Promise<AuthSessionDto> {
    const response = await fetch(`${baseUrl}/auth/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    expect(response.status).toBe(201);
    return response.json() as Promise<AuthSessionDto>;
  }

  it('resolves concurrent, case-insensitive logins to one human, excluding bots', async () => {
    await app
      .get(UsersRepository)
      .create({ id: randomUUID(), displayName: 'Returning', isBot: true });
    const sessions = await Promise.all(
      ['Returning', ' returning ', 'RETURNING', 'Returning'].map(login),
    );
    expect(new Set(sessions.map((session) => session.user.id)).size).toBe(1);
    const human = sessions[0]!;
    const other = await login('Another');
    expect(other.user.id).not.toBe(human.user.id);
    const room = await app.get(RoomsService).create(human.user.id, {
      gameType: 'grid-claim',
      visibility: 'private',
    });
    const returned = await login('returning');
    expect(returned.user.id).toBe(human.user.id);
    expect(await app.get(RoomsService).isMember(room.id, returned.user.id)).toBe(true);
    const me = await fetch(`${baseUrl}/users/me`, {
      headers: { authorization: `Bearer ${returned.accessToken}` },
    });
    expect(((await me.json()) as UserDto).id).toBe(human.user.id);
  });

  it('hides expired history immediately and deletes it with players and actions only after 24 hours', async () => {
    const session = await login('Retention');
    const now = new Date();
    const old = new Date(now.getTime() - 2 * MATCH_HISTORY_RETENTION_MS);
    const roomId = randomUUID();
    await connection.db.insert(rooms).values({
      id: roomId,
      code: 'RETAIN',
      gameType: 'grid-claim',
      hostUserId: session.user.id,
      status: 'in_match',
      visibility: 'private',
      createdAt: old,
    });
    await connection.db
      .insert(roomMembers)
      .values({ roomId, userId: session.user.id, seat: 0, status: 'joined' });
    const expired = randomUUID();
    const recent = randomUUID();
    const playing = randomUUID();
    const abandoned = randomUUID();
    const boundary = randomUUID();
    await connection.db.insert(matches).values(
      [
        { id: expired, status: 'finished' as const, finishedAt: old },
        { id: recent, status: 'finished' as const, finishedAt: now },
        { id: playing, status: 'playing' as const, finishedAt: null },
        { id: abandoned, status: 'abandoned' as const, finishedAt: null },
        {
          id: boundary,
          status: 'finished' as const,
          finishedAt: new Date(now.getTime() - MATCH_HISTORY_RETENTION_MS),
        },
      ].map((match) => ({
        ...match,
        roomId,
        gameType: 'grid-claim',
        engineVersion: 1,
        state: {},
        randomSeed: 'retention',
        createdAt: old,
      })),
    );
    for (const matchId of [expired, recent, playing, abandoned, boundary]) {
      await connection.db
        .insert(matchPlayers)
        .values({ matchId, userId: session.user.id, playerId: 'p1', seat: 0 });
      await connection.db.insert(matchActions).values({
        id: randomUUID(),
        matchId,
        sequence: 1,
        playerId: 'p1',
        actionType: 'claim',
        payload: {},
        requestId: randomUUID(),
      });
    }
    const repository = app.get(MatchRepository);
    expect((await repository.listForUser(session.user.id)).map((match) => match.id).sort()).toEqual(
      [recent, playing].sort(),
    );
    for (const route of ['', '/history', '/replay']) {
      const response = await fetch(`${baseUrl}/matches/${expired}${route}`, {
        headers: { authorization: `Bearer ${session.accessToken}` },
      });
      expect(response.status).toBe(404);
    }
    expect(
      (await app.get(RoomsService).listForLobby(session.user.id)).map((room) => room.id),
    ).toContain(roomId);
    await app.get(MatchCleanupService).cleanup(now);
    expect((await connection.db.select().from(matches)).map((match) => match.id).sort()).toEqual(
      [recent, playing].sort(),
    );
    expect((await connection.db.select().from(matchPlayers)).length).toBe(2);
    expect((await connection.db.select().from(matchActions)).length).toBe(2);
    expect(
      await connection.db.select().from(users).where(eq(users.id, session.user.id)),
    ).toHaveLength(1);
    expect(await connection.db.select().from(rooms).where(eq(rooms.id, roomId))).toHaveLength(1);
  });

  it('rejects previously issued tokens after their user is deleted by a reset', async () => {
    const session = await login('DeletedByReset');
    await connection.db.delete(users).where(eq(users.id, session.user.id));
    const response = await fetch(`${baseUrl}/rooms`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(response.status).toBe(401);
  });
});
