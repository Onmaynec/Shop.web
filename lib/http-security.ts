import { NextResponse } from 'next/server';
import { trustedClientIp, takeRateLimit, type LimitResult } from './rate-limit';

export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  try {
    if (!origin || !host || new URL(origin).host !== host ||
        !['http:', 'https:'].includes(new URL(origin).protocol)) {
      return NextResponse.json({ error: 'Недопустимый источник запроса' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Недопустимый источник запроса' }, { status: 403 });
  }
  return null;
}

export function requireJson(request: Request): NextResponse | null {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'Ожидается application/json' }, { status: 415 });
  }
  return null;
}

export async function readBoundedJson(request: Request, maxBytes = 4096): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new RequestTooLargeError();
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > maxBytes) throw new RequestTooLargeError();
  return JSON.parse(body);
}

export class RequestTooLargeError extends Error {}

export function limitResponse(result: LimitResult): NextResponse | null {
  if (result.allowed) return null;
  return NextResponse.json(
    { error: 'Слишком много запросов. Попробуйте позже.', retryAfter: result.retryAfter },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter), 'Cache-Control': 'no-store' } }
  );
}

export async function ipLimit(request: Request, scope: string, max: number, seconds: number) {
  const ip = trustedClientIp(request);
  return ip ? limitResponse(await takeRateLimit(scope, ip, max, seconds)) : null;
}

export function inputError(error: unknown) {
  if (error instanceof RequestTooLargeError) return NextResponse.json({error:'Слишком большой запрос'}, {status:413});
  if (error instanceof SyntaxError || (error && typeof error === 'object' && 'issues' in error)) {
    return NextResponse.json({error:'Некорректные данные запроса'}, {status:400});
  }
  console.error('Request processing failed',error);
  return NextResponse.json({error:'Внутренняя ошибка сервера'}, {status:500});
}
