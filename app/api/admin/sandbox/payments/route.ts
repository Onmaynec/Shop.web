import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { adminGate, adminApiError } from '../../../../../lib/admin-api';
import { SandboxPaymentProvider, sandboxEnabled, signSandboxWebhook } from '../../../../../lib/payments';
import { applyVerifiedPaymentEvent, PaymentEventConflict } from '../../../../../lib/payment-events';

export const runtime = 'nodejs';

const input = z.object({
  orderId: z.string().cuid(),
  operation: z.enum(['pay', 'refund'])
}).strict();

/**
 * Only a logged-in admin on a LOCAL DEVELOPMENT instance can simulate
 * sandbox events. This endpoint is completely disabled in production.
 */
export async function POST(request: Request) {
  if (!sandboxEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const denied = await adminGate(request, true); if (denied) return denied;
  try {
    const { orderId, operation } = input.parse(await request.json());
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { paymentAttempts: { where: { provider: 'sandbox' }, orderBy: { createdAt: 'desc' } } }
    });
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });

    let attempt = order.paymentAttempts.find(p => operation === 'pay' ? p.status === 'CREATED' : p.status === 'SUCCEEDED');

    if (operation === 'pay') {
      if (order.status !== 'PENDING_PAYMENT') {
        return NextResponse.json({ error: 'Оплатить в тестовом режиме можно только ожидающий заказ' }, { status: 409 });
      }
      if (!attempt) {
        const checkout = await new SandboxPaymentProvider().createCheckout({
          orderId, amountKopecks: order.totalKopecks, currency: order.currency
        });
        attempt = await db.paymentAttempt.create({
          data: {
            orderId, provider: 'sandbox', externalId: checkout.externalId,
            amountKopecks: order.totalKopecks, currency: order.currency, status: 'CREATED'
          }
        });
      }
    } else {
      if (!['PAID', 'PROCESSING', 'FULFILLED'].includes(order.status) || !attempt) {
        return NextResponse.json({ error: 'Возврат возможен только для тестового оплаченного заказа' }, { status: 409 });
      }
    }

    if (!attempt?.externalId) return NextResponse.json({ error: 'Платёжная попытка не найдена' }, { status: 409 });
    const rawBody = JSON.stringify({
      eventId: randomUUID(),
      type: operation === 'pay' ? 'payment.succeeded' : 'payment.refunded',
      provider: 'sandbox',
      externalId: attempt.externalId,
      orderId,
      amountKopecks: order.totalKopecks,
      currency: 'RUB'
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signSandboxWebhook(rawBody, timestamp);
    const verified = new SandboxPaymentProvider().verifyWebhook({rawBody,timestamp,signature});
    const result = await applyVerifiedPaymentEvent(verified);
    return NextResponse.json({ sandbox: true, ...result });
  } catch (error) {
    if (error instanceof PaymentEventConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    return adminApiError(error);
  }
}
