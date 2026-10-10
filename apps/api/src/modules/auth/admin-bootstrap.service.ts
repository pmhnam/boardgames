import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { UsersRepository } from '../users/users.repository.js';
import { hashPassword, needsRehash, verifyPassword } from './password-hasher.js';

/**
 * Keeps the administrator named in the environment (ADMIN_USERNAME, ADMIN_PASSWORD) in the
 * database. With neither set there is no administrator and the admin area is simply off.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly users: UsersRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const admin = this.config.admin;
    if (!admin) return;

    const existing = await this.users.findHumanByName(admin.username);
    // Storing a fresh hash signs every administrator session out, so only do it when the
    // password really changed.
    if (
      existing?.role === 'admin' &&
      existing.passwordHash !== null &&
      existing.disabledAt === null &&
      !needsRehash(existing.passwordHash) &&
      (await verifyPassword(admin.password, existing.passwordHash))
    ) {
      return;
    }

    const user = await this.users.ensureAdmin({
      id: randomUUID(),
      displayName: admin.username,
      passwordHash: await hashPassword(admin.password),
    });
    this.logger.log({ event: 'admin_account_ensured', userId: user.id });
  }
}
