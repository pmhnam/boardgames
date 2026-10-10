import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ErrorCodes, type AdminUserDto, type Page } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { PlatformEvents, type UserDisabledEvent } from '../../common/events/platform-events.js';
import { UsersRepository, type UserListFilter, type UserRecord } from './users.repository.js';

/** Field by field on purpose: a user row also holds a password hash, which never leaves. */
function toAdminDto(user: UserRecord): AdminUserDto {
  return {
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    isBot: user.isBot,
    disabledAt: user.disabledAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly events: EventEmitter2,
  ) {}

  async listForAdmin(
    filter: UserListFilter,
    page: { limit: number; offset: number },
  ): Promise<Page<AdminUserDto>> {
    const [records, total] = await Promise.all([
      this.users.listPage(filter, page),
      this.users.countPage(filter),
    ]);
    return { items: records.map(toAdminDto), total, ...page };
  }

  async getForAdmin(userId: string): Promise<AdminUserDto> {
    return toAdminDto(await this.requireUser(userId));
  }

  /**
   * Locks a player out, or lets them back in. A disabled account cannot sign in and its
   * sessions stop at once. It locks out a name, not a person: with username-only login they
   * can come back under another.
   */
  async setDisabled(actorId: string, targetId: string, disabled: boolean): Promise<AdminUserDto> {
    const target = await this.requireUser(targetId);
    if (target.id === actorId) {
      throw new AppError(ErrorCodes.Forbidden, 'You cannot disable your own account.', 403);
    }
    // An administrator is managed through the server's configuration, not by another one.
    if (target.role !== 'player') {
      throw new AppError(ErrorCodes.Forbidden, 'An administrator cannot be disabled.', 403);
    }
    if (target.isBot) {
      throw new AppError(ErrorCodes.Forbidden, 'A computer player cannot be disabled.', 403);
    }
    if ((target.disabledAt !== null) === disabled) return toAdminDto(target);

    const updated = await this.users.setDisabled(targetId, disabled ? new Date() : null);
    if (!updated) throw this.notFound();
    this.logger.log({
      event: disabled ? 'user_disabled' : 'user_enabled',
      userId: targetId,
      byUserId: actorId,
    });
    if (disabled) {
      const event: UserDisabledEvent = { userId: targetId };
      await this.events.emitAsync(PlatformEvents.UserDisabled, event);
    }
    return toAdminDto(updated);
  }

  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.users.findById(userId);
    if (!user) throw this.notFound();
    return user;
  }

  private notFound(): AppError {
    return new AppError(ErrorCodes.UserNotFound, 'User not found.', 404);
  }
}
