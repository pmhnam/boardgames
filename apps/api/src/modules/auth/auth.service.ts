import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ErrorCodes, type AuthSessionDto, type UserDto } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { UsersRepository, type UserRecord } from '../users/users.repository.js';

interface AccessTokenPayload {
  sub: string;
}

export function toUserDto(user: UserRecord): UserDto {
  return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  /** Username-only login: returning players recover their existing seats and history. */
  async loginAsGuest(displayName: string): Promise<AuthSessionDto> {
    const user = await this.users.findOrCreateHuman({
      id: randomUUID(),
      displayName: displayName.trim(),
    });
    const payload: AccessTokenPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user: toUserDto(user) };
  }

  /** Returns the user id the token was issued for. */
  async verifyAccessToken(token: string | undefined): Promise<string> {
    if (!token) throw new AppError(ErrorCodes.Unauthorized, 'Missing access token.', 401);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      // Database resets invalidate old sessions even while their JWTs have time remaining.
      await this.getUser(payload.sub);
      return payload.sub;
    } catch {
      throw new AppError(ErrorCodes.Unauthorized, 'Invalid or expired access token.', 401);
    }
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(ErrorCodes.Unauthorized, 'Unknown user.', 401);
    return toUserDto(user);
  }
}
