import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { hashPassword, clearSession, setSession } from '../../../../lib/auth';
import { takeRateLimit } from '../../../../lib/rate-limit';
import { requireSameOrigin, requireJson, readBoundedJson, inputError, ipLimit, limitResponse } from '../../../../lib/http-security';

const schema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
}).strict();

export async function POST(request: Request) {
  const deniedOrigin = requireSameOrigin(request) || requireJson(request);
  if (deniedOrigin) return deniedOrigin;
  try {
    const input = schema.parse(await readBoundedJson(request));
    const email = input.email.toLowerCase();
    const ipDenied = await ipLimit(request, 'register-ip', 15, 3600);
    if (ipDenied) return ipDenied;
    const denied = limitResponse(await takeRateLimit('register-account', email, 4, 86400));
    if (denied) return denied;
    const user = await db.user.create({
      data: { email, passwordHash: hashPassword(input.password) }
    });
    await clearSession();
    await setSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role }
    }, { status: 201, headers: {'Cache-Control':'no-store'} });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Аккаунт с таким email уже существует' }, { status: 409 });
    }
    return inputError(error);
  }
}
