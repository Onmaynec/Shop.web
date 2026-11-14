import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentUser } from './auth';
import { hasPermission,type Permission } from './permissions';
import { requireSameOrigin, requireJson, readBoundedJson, inputError, RequestTooLargeError, limitResponse } from './http-security';
import { takeRateLimit } from './rate-limit';

export async function staffGate(request:Request,permission:Permission,mutation=false){
  const user = await currentUser();
  if (!user || !hasPermission(user.role,permission)) {
    return NextResponse.json({ error: 'Требуются права администратора' }, { status: 403 });
  }
  if (mutation) {
    const denied = requireSameOrigin(request) || requireJson(request);
    if (denied) return denied;
    const limited = limitResponse(await takeRateLimit('admin-write', user.id, 120, 900));
    if (limited) return limited;
  }
  return null;
}

export async function adminGate(request:Request,mutation=false){
  return staffGate(request,'admin',mutation);
}

export async function readAdminBody(request: Request) {
  return readBoundedJson(request, 16384);
}

export function adminApiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Неверные данные' }, { status: 400 });
  if (error instanceof RequestTooLargeError || error instanceof SyntaxError) return inputError(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Это значение уже существует. Проверьте уникальный адрес.' }, { status: 409 });
    if (error.code === 'P2003') return NextResponse.json({ error: 'Нельзя удалить запись, которая используется в других разделах.' }, { status: 409 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Запись не найдена или уже изменена.' }, { status: 404 });
  }
  console.error('Admin operation failed', error);
  return NextResponse.json({ error: 'Не удалось выполнить операцию' }, { status: 500 });
}
