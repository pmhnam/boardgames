import { randomUUID } from 'node:crypto';
import {
  ErrorCodes,
  type AdminUserDetailDto,
  type AdminUserDto,
  type Page,
  type RoomDto,
  type UserDto,
} from '@bgp/shared-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminBootstrapService } from '../src/modules/auth/admin-bootstrap.service.js';
import { hashPassword } from '../src/modules/auth/password-hasher.js';
import { UsersRepository } from '../src/modules/users/users.repository.js';
import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  startAdminHarness,
  type AdminHarness,
} from './admin-harness.js';

/** Cheap to compute; stored hashes carry their own cost, so sign-in still reads them. */
const FAST = { ln: 10, r: 8, p: 1 };

describe('administrator accounts', () => {
  let harness: AdminHarness;
  let adminToken: string;

  beforeAll(async () => {
    harness = await startAdminHarness();
    const login = await harness.loginAsAdmin();
    expect(login.status).toBe(200);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await harness?.close();
  });

  function setPassword(displayName: string, password: string) {
    return hashPassword(password, FAST).then((passwordHash) =>
      harness.app.get(UsersRepository).ensureAdmin({ id: randomUUID(), displayName, passwordHash }),
    );
  }

  it('creates the administrator named in the environment and signs them in by password', async () => {
    const login = await harness.loginAsAdmin(` ${ADMIN_USERNAME.toUpperCase()} `);
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ displayName: ADMIN_USERNAME, role: 'admin' });
    expect(JSON.stringify(login.body)).not.toContain('scrypt');

    const session = await harness.request<UserDto>('GET', '/admin/session', adminToken);
    expect(session.status).toBe(200);
    expect(session.body.role).toBe('admin');
    // The same token is an ordinary session everywhere else.
    expect((await harness.request<UserDto>('GET', '/users/me', adminToken)).body.role).toBe(
      'admin',
    );
  });

  it('answers a wrong password and an unknown name identically', async () => {
    const wrongPassword = await harness.loginAsAdmin(ADMIN_USERNAME, 'not the password at all');
    const unknownName = await harness.loginAsAdmin('Nobody', ADMIN_PASSWORD);
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.code).toBe(ErrorCodes.InvalidCredentials);
    expect(unknownName.status).toBe(401);
    expect(unknownName.body).toEqual(wrongPassword.body);
  });

  it('never lets a name alone open an account that has a password', async () => {
    for (const displayName of [
      ADMIN_USERNAME,
      ADMIN_USERNAME.toLowerCase(),
      `  ${ADMIN_USERNAME} `,
    ]) {
      const reply = await harness.request('POST', '/auth/guest', undefined, { displayName });
      expect(reply.status).toBe(403);
      expect(reply.code).toBe(ErrorCodes.PasswordRequired);
    }
  });

  it('keeps players and anonymous callers out of the admin area', async () => {
    const player = await harness.loginAsGuest('Ordinary');
    expect(player.user.role).toBe('player');

    const asPlayer = await harness.request('GET', '/admin/session', player.accessToken);
    expect(asPlayer.status).toBe(403);
    expect(asPlayer.code).toBe(ErrorCodes.Forbidden);

    const anonymous = await harness.request('GET', '/admin/session');
    expect(anonymous.status).toBe(401);
    expect(anonymous.code).toBe(ErrorCodes.Unauthorized);

    // A password is not something a player session can be sent to in place of a name.
    expect((await harness.loginAsAdmin('Ordinary', ADMIN_PASSWORD)).code).toBe(
      ErrorCodes.InvalidCredentials,
    );
  });

  it('ends the username-only sessions of someone whose name becomes an administrator', async () => {
    const squatter = await harness.loginAsGuest('Squatter');
    const socket = await harness.connect(squatter.accessToken);
    socket.disconnect();

    const promoted = await setPassword('squatter', 'a brand new password');
    expect(promoted.id).toBe(squatter.user.id);

    // The old token would otherwise have become an administrator's token.
    const rest = await harness.request('GET', '/admin/session', squatter.accessToken);
    expect(rest.status).toBe(401);
    expect((await harness.request('GET', '/users/me', squatter.accessToken)).status).toBe(401);
    await expect(harness.connect(squatter.accessToken)).rejects.toThrow(ErrorCodes.Unauthorized);

    const login = await harness.loginAsAdmin('Squatter', 'a brand new password');
    expect(login.body.user).toMatchObject({ id: squatter.user.id, role: 'admin' });
    expect((await harness.request('GET', '/admin/session', login.body.accessToken)).status).toBe(
      200,
    );
  });

  it('ends every session signed in under a password once that password changes', async () => {
    await setPassword('Rotating', 'the first password');
    const before = await harness.loginAsAdmin('Rotating', 'the first password');
    expect((await harness.request('GET', '/admin/session', before.body.accessToken)).status).toBe(
      200,
    );

    await setPassword('Rotating', 'the second password');
    expect((await harness.request('GET', '/admin/session', before.body.accessToken)).status).toBe(
      401,
    );
    expect((await harness.loginAsAdmin('Rotating', 'the first password')).status).toBe(401);
    expect((await harness.loginAsAdmin('Rotating', 'the second password')).status).toBe(200);
  });

  it('leaves administrator sessions alone when the server restarts with the same password', async () => {
    await harness.app.get(AdminBootstrapService).onApplicationBootstrap();
    expect((await harness.request('GET', '/admin/session', adminToken)).status).toBe(200);
  });

  describe('players', () => {
    const asAdmin = <T>(method: string, path: string, body?: unknown) =>
      harness.request<T>(method, `/admin${path}`, adminToken, body);
    const names = (page: Page<AdminUserDto>) => page.items.map((user) => user.displayName);

    it('lists people, newest first, and computer players only when asked', async () => {
      await harness.loginAsGuest('Listed First');
      await harness.loginAsGuest('Listed Second');
      await harness.app
        .get(UsersRepository)
        .create({ id: randomUUID(), displayName: 'Bot Dễ 1', isBot: true });

      const people = await asAdmin<Page<AdminUserDto>>('GET', '/users?limit=100');
      expect(people.status).toBe(200);
      expect(people.body.total).toBe(people.body.items.length);
      expect(people.body.items.every((user) => !user.isBot)).toBe(true);
      expect(names(people.body).indexOf('Listed Second')).toBeLessThan(
        names(people.body).indexOf('Listed First'),
      );
      expect(people.body.items.find((user) => user.displayName === ADMIN_USERNAME)?.role).toBe(
        'admin',
      );
      // A user row holds a password hash. It stays on the server.
      expect(JSON.stringify(people.body)).not.toMatch(/scrypt|passwordHash|password_hash/);

      const everyone = await asAdmin<Page<AdminUserDto>>('GET', '/users?bots=true&limit=100');
      expect(names(everyone.body)).toContain('Bot Dễ 1');
      expect(everyone.body.total).toBe(people.body.total + 1);

      const found = await asAdmin<Page<AdminUserDto>>('GET', '/users?q=LISTED%20s');
      expect(names(found.body)).toEqual(['Listed Second']);
      expect(found.body.total).toBe(1);
      // A percent sign someone types is looked for as a percent sign.
      expect((await asAdmin<Page<AdminUserDto>>('GET', '/users?q=%25')).body.total).toBe(0);

      const paged = await asAdmin<Page<AdminUserDto>>('GET', '/users?q=listed&limit=1&offset=1');
      expect(paged.body).toMatchObject({ total: 2, limit: 1, offset: 1 });
      expect(names(paged.body)).toEqual(['Listed First']);
      expect((await asAdmin('GET', '/users?bots=maybe')).code).toBe(ErrorCodes.ValidationFailed);
    });

    it('shows where one person is seated and what they have played', async () => {
      const seated = await harness.loginAsGuest('Seated');
      const { body: room } = await harness.request<RoomDto>('POST', '/rooms', seated.accessToken, {
        gameType: 'grid-claim',
        visibility: 'private',
      });

      const detail = await asAdmin<AdminUserDetailDto>('GET', `/users/${seated.user.id}`);
      expect(detail.status).toBe(200);
      expect(detail.body.user).toMatchObject({
        id: seated.user.id,
        displayName: 'Seated',
        role: 'player',
        isBot: false,
        disabledAt: null,
      });
      expect(detail.body.rooms.map((listed) => listed.id)).toEqual([room.id]);
      expect(detail.body.recentMatches).toEqual([]);

      expect((await asAdmin('GET', `/users/${randomUUID()}`)).code).toBe(ErrorCodes.UserNotFound);
      expect((await asAdmin('GET', '/users/someone')).code).toBe(ErrorCodes.ValidationFailed);
    });

    it('locks a player out at once, and lets the same player back in', async () => {
      const player = await harness.loginAsGuest('Troublemaker');
      const socket = await harness.connect(player.accessToken);
      const dropped = new Promise<string>((resolve) => socket.once('disconnect', resolve));

      const disabled = await asAdmin<AdminUserDto>('PUT', `/users/${player.user.id}/disabled`, {
        disabled: true,
      });
      expect(disabled.status).toBe(200);
      expect(disabled.body.disabledAt).not.toBeNull();

      // Their open connection is ended, their token stops working, and the name is shut.
      expect(await dropped).toBe('io server disconnect');
      expect((await harness.request('GET', '/users/me', player.accessToken)).status).toBe(401);
      await expect(harness.connect(player.accessToken)).rejects.toThrow(ErrorCodes.Unauthorized);
      for (const displayName of ['Troublemaker', ' troublemaker ']) {
        const again = await harness.request('POST', '/auth/guest', undefined, { displayName });
        expect(again.status).toBe(403);
        expect(again.code).toBe(ErrorCodes.AccountDisabled);
      }

      // Asking twice changes nothing more.
      const twice = await asAdmin<AdminUserDto>('PUT', `/users/${player.user.id}/disabled`, {
        disabled: true,
      });
      expect(twice.body.disabledAt).toBe(disabled.body.disabledAt);

      const enabled = await asAdmin<AdminUserDto>('PUT', `/users/${player.user.id}/disabled`, {
        disabled: false,
      });
      expect(enabled.body.disabledAt).toBeNull();
      expect((await harness.loginAsGuest('Troublemaker')).user.id).toBe(player.user.id);
      // The session from before the lock works again too: it was never the token that changed.
      expect((await harness.request('GET', '/users/me', player.accessToken)).status).toBe(200);
    });

    it('will not disable the administrator asking, another administrator, or a computer player', async () => {
      const me = await harness.request<UserDto>('GET', '/admin/session', adminToken);
      const other = await setPassword('Second Admin', 'another long password');
      const bot = await harness.app
        .get(UsersRepository)
        .create({ id: randomUUID(), displayName: 'Bot Khó 9', isBot: true });

      for (const id of [me.body.id, other.id, bot.id]) {
        const refused = await asAdmin('PUT', `/users/${id}/disabled`, { disabled: true });
        expect(refused.status).toBe(403);
        expect(refused.code).toBe(ErrorCodes.Forbidden);
      }
      expect((await harness.request('GET', '/admin/session', adminToken)).status).toBe(200);
      expect((await harness.loginAsAdmin('Second Admin', 'another long password')).status).toBe(
        200,
      );

      expect(
        (await asAdmin('PUT', `/users/${randomUUID()}/disabled`, { disabled: true })).code,
      ).toBe(ErrorCodes.UserNotFound);
      expect((await asAdmin('PUT', `/users/${me.body.id}/disabled`, {})).code).toBe(
        ErrorCodes.ValidationFailed,
      );
    });

    it('is closed to players', async () => {
      const player = await harness.loginAsGuest('Curious');
      const target = await harness.loginAsGuest('Bystander');
      for (const [method, path, body] of [
        ['GET', '/admin/users', undefined],
        ['GET', `/admin/users/${target.user.id}`, undefined],
        ['PUT', `/admin/users/${target.user.id}/disabled`, { disabled: true }],
      ] as const) {
        expect((await harness.request(method, path, player.accessToken, body)).code).toBe(
          ErrorCodes.Forbidden,
        );
      }
      expect((await harness.request('GET', '/users/me', target.accessToken)).status).toBe(200);
    });
  });

  // Last on purpose: it uses up this address's guesses for the rest of the file.
  it('stops checking passwords from an address that keeps guessing wrong', async () => {
    const replies: number[] = [];
    for (let attempt = 0; attempt < 6 && replies.at(-1) !== 429; attempt++) {
      replies.push((await harness.loginAsAdmin(ADMIN_USERNAME, `wrong guess ${attempt}`)).status);
    }
    expect(replies.at(-1)).toBe(429);
    expect(replies.slice(0, -1).every((status) => status === 401)).toBe(true);

    const correct = await harness.loginAsAdmin();
    expect(correct.status).toBe(429);
    expect(correct.code).toBe(ErrorCodes.RateLimited);
    // Sessions that already exist are not affected.
    expect((await harness.request('GET', '/admin/session', adminToken)).status).toBe(200);
  });
});
