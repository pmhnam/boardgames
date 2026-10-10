import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorCodes, type AuthSessionDto, type UserDto } from '@bgp/shared-types';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { AppError } from '../../common/errors/app-error.js';
import { UsersRepository, type UserRecord } from '../users/users.repository.js';
import { LoginThrottle } from './login-throttle.js';
import { hashPassword, passwordFingerprint, verifyPassword } from './password-hasher.js';

interface AccessTokenPayload {
  sub: string;
  /** Fingerprint of the password the session signed in with. Absent for username-only logins. */
  pv?: string;
}

/** Shorter than a player's session: these tokens can change configs and end matches. */
const PASSWORD_SESSION_TTL = '12h';

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

@Injectable()
export class AuthService {
  /** Checked when the name is unknown, so a miss takes as long as a wrong password. */
  private decoyHash: Promise<string> | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
    private readonly throttle: LoginThrottle,
  ) {}

  /** Username-only login: returning players recover their existing seats and history. */
  async loginAsGuest(displayName: string): Promise<AuthSessionDto> {
    const user = await this.users.findOrCreateHuman({
      id: randomUUID(),
      displayName: displayName.trim(),
    });
    // A name alone must never open an account that has a password, least of all an admin's.
    if (user.passwordHash !== null || user.role !== 'player') {
      throw new AppError(
        ErrorCodes.PasswordRequired,
        'This name belongs to an account that signs in with a password.',
        403,
      );
    }
    if (user.disabledAt !== null) throw this.disabled();
    const payload: AccessTokenPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user: toUserDto(user) };
  }

  /** `address` is where the request came from, and is only used to slow down guessing. */
  async loginWithPassword(
    username: string,
    password: string,
    address: string,
  ): Promise<AuthSessionDto> {
    if (!this.throttle.tryConsume(address)) {
      throw new AppError(
        ErrorCodes.RateLimited,
        'Too many sign-in attempts. Try again later.',
        429,
      );
    }
    const user = await this.users.findHumanByName(username);
    const stored = user?.passwordHash ?? null;
    const matches = await verifyPassword(password, stored ?? (await this.decoy()));
    if (!user || stored === null || !matches) {
      // One answer for every way of being wrong, so names cannot be told apart from here.
      throw new AppError(ErrorCodes.InvalidCredentials, 'Wrong username or password.', 401);
    }
    this.throttle.succeeded(address);
    if (user.disabledAt !== null) throw this.disabled();
    const payload: AccessTokenPayload = { sub: user.id, pv: passwordFingerprint(stored) };
    return {
      accessToken: await this.jwt.signAsync(payload, { expiresIn: PASSWORD_SESSION_TTL }),
      user: toUserDto(user),
    };
  }

  /** Who the token was issued for, as the database describes them right now. */
  async verifyAccessToken(token: string | undefined): Promise<AuthenticatedUser> {
    if (!token) throw new AppError(ErrorCodes.Unauthorized, 'Missing access token.', 401);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      // Database resets invalidate old sessions even while their JWTs have time remaining.
      const user = await this.users.findById(payload.sub);
      if (!user || user.disabledAt !== null) throw new Error('No such active user');
      // Once an account has a password, only tokens issued under that exact password count.
      // A username-only token from before the account was promoted stops working here.
      if (user.passwordHash !== null && payload.pv !== passwordFingerprint(user.passwordHash)) {
        throw new Error('Token predates the current password');
      }
      return { userId: user.id, role: user.role };
    } catch {
      throw new AppError(ErrorCodes.Unauthorized, 'Invalid or expired access token.', 401);
    }
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(ErrorCodes.Unauthorized, 'Unknown user.', 401);
    return toUserDto(user);
  }

  private decoy(): Promise<string> {
    this.decoyHash ??= hashPassword(randomBytes(16).toString('hex'));
    return this.decoyHash;
  }

  private disabled(): AppError {
    return new AppError(
      ErrorCodes.AccountDisabled,
      'This account has been disabled by an administrator.',
      403,
    );
  }
}
