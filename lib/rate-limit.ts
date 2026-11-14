import { createHmac } from 'node:crypto';
import { db } from './db';

export type LimitResult = { allowed: boolean; retryAfter: number; remaining: number };

export function fingerprint(value: string): string {
  const secret=process.env.SESSION_SECRET;
  if(!secret || secret.length<32 || secret.startsWith('replace-with-')) throw new Error('SESSION_SECRET is not configured');
  return createHmac('sha256',secret).update(value.toLowerCase().trim()).digest('hex');
}

/**
 * Client IP is only considered when all forwarding headers are installed by
 * an explicitly trusted reverse proxy. Do not enable TRUST_PROXY_HEADERS
 * when the application accepts requests directly from the internet.
 */
export function trustedClientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return null;
  const source = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!source || source.length > 64 || !/^[0-9a-fA-F.:]+$/.test(source)) return null;
  return source;
}

/** Fixed-window SQL UPSERT. One atomic PostgreSQL operation per attempt. */
export async function takeRateLimit(scope: string, subject: string, max: number, windowSeconds: number): Promise<LimitResult> {
  const key = scope + ':' + fingerprint(subject);
  const now = new Date();
  const reset = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ attempts: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "attempts", "resetAt")
    VALUES (${key}, 1, ${reset})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."attempts" + 1 END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${reset}
        ELSE "RateLimitBucket"."resetAt" END
    RETURNING "attempts", "resetAt";
  `;
  const value = rows[0];
  const allowed = value.attempts <= max;
  return {
    allowed,
    remaining: Math.max(0, max - value.attempts),
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil((value.resetAt.getTime() - Date.now()) / 1000))
  };
}
