import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCRYPT_PARAMS,
  hashPassword,
  needsRehash,
  passwordFingerprint,
  verifyPassword,
} from './password-hasher.js';

const FAST = { ln: 10, r: 8, p: 1 };

describe('password hasher', () => {
  it('accepts the password it hashed and refuses any other', async () => {
    const stored = await hashPassword('correct horse battery', FAST);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('correct horse batterx', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts every hash, so the same password never stores the same way twice', async () => {
    const [first, second] = await Promise.all([
      hashPassword('same', FAST),
      hashPassword('same', FAST),
    ]);
    expect(first).not.toBe(second);
    expect(await verifyPassword('same', second!)).toBe(true);
  });

  it('treats differently composed forms of the same characters as one password', async () => {
    const stored = await hashPassword('mật khẩu', FAST);
    expect(await verifyPassword('mật khẩu'.normalize('NFD'), stored)).toBe(true);
  });

  it("works at the default cost, which is above Node's default memory limit", async () => {
    const stored = await hashPassword('default cost');
    expect(stored.startsWith('scrypt$ln=15,r=8,p=3$')).toBe(true);
    expect(await verifyPassword('default cost', stored)).toBe(true);
    expect(needsRehash(stored)).toBe(false);
  });

  it('refuses stored values it cannot read instead of throwing', async () => {
    const stored = await hashPassword('pw', FAST);
    const [, , salt, key] = stored.split('$');
    for (const broken of [
      '',
      'plain-text',
      `bcrypt$ln=10,r=8,p=1$${salt}$${key}`,
      `scrypt$ln=30,r=8,p=1$${salt}$${key}`,
      `scrypt$ln=10,r=0,p=1$${salt}$${key}`,
      `scrypt$ln=10,r=8,p=1$${salt}$short`,
      `${stored}$extra`,
    ]) {
      expect(await verifyPassword('pw', broken)).toBe(false);
      expect(needsRehash(broken)).toBe(true);
    }
  });

  it('asks for a rehash only when the cost parameters differ', async () => {
    const stored = await hashPassword('pw', FAST);
    expect(needsRehash(stored, FAST)).toBe(false);
    expect(needsRehash(stored, DEFAULT_SCRYPT_PARAMS)).toBe(true);
  });

  it('fingerprints a stored hash stably and differently per hash', async () => {
    const [first, second] = await Promise.all([hashPassword('pw', FAST), hashPassword('pw', FAST)]);
    expect(passwordFingerprint(first!)).toBe(passwordFingerprint(first!));
    expect(passwordFingerprint(first!)).not.toBe(passwordFingerprint(second!));
    expect(passwordFingerprint(first!)).toHaveLength(16);
  });
});
