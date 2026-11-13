import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { currentUser } from './auth';

export async function adminGate(request: Request, mutation = false) {
  const user = await currentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Требуются права администратора' }, { status: 403 });
  }
  if (mutation) {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (!origin || !host || (() => { try { return new URL(origin).host !== host; } catch { return true; } })()) {
      return NextResponse.json({ error: 'Недопустимый источник запроса' }, { status: 403 });
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      return NextResponse.json({ error: 'Ожидается application/json' }, { status: 415 });
    }
  }
  return null;
}

export function adminApiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || 'Неверные данные' }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Неверный формат JSON' }, { status: 400 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Такое значение уже существует. Проверьте уникальный адрес.' }, { status: 409 });
    if (error.code === 'P2003') return NextResponse.json({ error: 'Нельзя удалить запись, которая используется в других разделах.' }, { status: 409 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Запись не найдена или уже изменена.' }, { status: 404 });
  }
  console.error('Admin request failed', error);
  return NextResponse.json({ error: 'Ошибка сервера. Проверьте журнал приложения.' }, { status: 500 });
}
