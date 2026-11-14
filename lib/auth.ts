import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';

const COOKIE = 'ss_session';
const SESSION_DAYS = 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32 || value.startsWith('replace-with-')) {
    throw new Error('Configure a unique SESSION_SECRET of at least 32 characters');
  }
  return value;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function checkPassword(password: string, stored: string) {
  const parts = stored.split(':');
  if (parts.length !== 2 || !/^[0-9a-f]{32}$/.test(parts[0]) || !/^[0-9a-f]{128}$/.test(parts[1])) return false;
  const expected = Buffer.from(parts[1], 'hex');
  return timingSafeEqual(scryptSync(password, parts[0], 64), expected);
}

export function sessionTokenHash(token: string) {
  return createHmac('sha256', secret()).update(token).digest('hex');
}

function cookieSettings() {
  return {
    httpOnly: true, sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60
  };
}

async function tokenFromCookie() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export async function activeSession() {
  const token = await tokenFromCookie();
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { user: { select: { id: true, email: true, role: true } } }
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  // At most one activity write per session per 10 minutes.
  if (Date.now() - session.lastSeenAt.getTime() > 600_000) {
    await db.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: new Date() }
    });
  }
  return session;
}

export async function currentUser() {
  const session = await activeSession();
  return session ? session.user : null;
}

export async function setSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await db.session.create({
    data: {
      userId, tokenHash: sessionTokenHash(token),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000)
    }
  });
  (await cookies()).set(COOKIE, token, cookieSettings());
}

export async function clearSession() {
  const token = await tokenFromCookie();
  if (token) {
    await db.session.updateMany({
      where: { tokenHash: sessionTokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  (await cookies()).delete(COOKIE);
}
