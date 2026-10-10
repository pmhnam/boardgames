import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface ScryptParams {
  /** log2 of the CPU/memory cost N. */
  ln: number;
  r: number;
  p: number;
}

/** About 32 MiB per hash: the OWASP-listed scrypt setting N=2^15, r=8, p=3. */
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { ln: 15, r: 8, p: 3 };

const SCHEME = 'scrypt';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/** Stored parameters are read back before hashing, so they are bounded like any other input. */
const MAX_LN = 20;
const MAX_R = 16;
const MAX_P = 16;

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
}

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  const N = 2 ** params.ln;
  return new Promise((resolve, reject) => {
    scrypt(
      // Different ways of typing the same characters must give the same password.
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      // Node's default memory limit sits exactly at the default parameters and refuses them.
      { N, r: params.r, p: params.p, maxmem: 256 * N * params.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

function inRange(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

function parse(stored: string): ParsedHash | null {
  const [scheme, rawParams, rawSalt, rawKey, ...rest] = stored.split('$');
  if (scheme !== SCHEME || !rawParams || !rawSalt || !rawKey || rest.length > 0) return null;
  const match = /^ln=(\d{1,2}),r=(\d{1,2}),p=(\d{1,2})$/.exec(rawParams);
  if (!match) return null;
  const params = { ln: Number(match[1]), r: Number(match[2]), p: Number(match[3]) };
  if (!inRange(params.ln, MAX_LN) || !inRange(params.r, MAX_R) || !inRange(params.p, MAX_P)) {
    return null;
  }
  const salt = Buffer.from(rawSalt, 'base64url');
  const key = Buffer.from(rawKey, 'base64url');
  if (salt.length === 0 || key.length !== KEY_LENGTH) return null;
  return { params, salt, key };
}

/** `scrypt$ln=15,r=8,p=3$<salt>$<key>`: self-describing, so the cost can be raised later. */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params);
  return [
    SCHEME,
    `ln=${params.ln},r=${params.r},p=${params.p}`,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.params);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}

/** True when `stored` was not made with `params`, or cannot be read at all. */
export function needsRehash(stored: string, params: ScryptParams = DEFAULT_SCRYPT_PARAMS): boolean {
  const parsed = parse(stored);
  return (
    !parsed ||
    parsed.params.ln !== params.ln ||
    parsed.params.r !== params.r ||
    parsed.params.p !== params.p
  );
}

/**
 * Ties an access token to the password it was issued under: changing the password changes the
 * fingerprint, which ends every session signed in with the old one.
 */
export function passwordFingerprint(stored: string): string {
  return createHash('sha256').update(stored).digest('base64url').slice(0, 16);
}
