import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { adminGate, adminApiError } from '../../../../lib/admin-api';
import { adminOrderTransitions } from '../../../../lib/order-workflow';

const input = z.object({
  id: z.string().cuid(),
  status: z.enum(['CANCELLED', 'PROCESSING', 'FULFILLED'])
}).strict();

export async function PATCH(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const { id, status } = input.parse(await req.json());
    const result = await db.order.updateMany({
      where: { id, status: adminOrderTransitions[status] },
      data: { status }
    });
    if (!result.count) return NextResponse.json({
      error: 'Операция недоступна для текущего статуса. Неоплаченные заказы нельзя выполнить.'
    }, { status: 409 });
    return NextResponse.json({ ok: true, status });
  } catch (error) { return adminApiError(error); }
}
