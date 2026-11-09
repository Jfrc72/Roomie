import { createHash, randomBytes, scrypt as deriveKey, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(deriveKey);
export const COOKIE = 'roomie_session';
export const token = () => randomBytes(32).toString('hex');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(expected || '')) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
