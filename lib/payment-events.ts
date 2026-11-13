import { Prisma } from '@prisma/client';
import { db } from './db';
import type { VerifiedPaymentEvent } from './payments';

export class PaymentEventConflict extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentEventConflict'; }
}

/**
 * Processes only VERIFIED events. All state updates and the event record are
 * committed together. A replay with the same provider/eventId is a no-op.
 */
export async function applyVerifiedPaymentEvent(event: VerifiedPaymentEvent):
  Promise<{ outcome: 'applied' | 'duplicate'; orderId: string; status?: string }> {
  try {
    return await db.$transaction(async tx => {
      const existing = await tx.paymentEvent.findUnique({
        where: { provider_eventId: { provider: event.provider, eventId: event.eventId } }
      });
      if (existing) {
        if (existing.orderId !== event.orderId || existing.externalId !== event.externalId ||
          existing.eventType !== event.type || existing.amountKopecks !== event.amountKopecks ||
          existing.currency !== event.currency) {
          throw new PaymentEventConflict('Event ID reused with different payment data');
        }
        return { outcome: 'duplicate' as const, orderId: existing.orderId };
      }

      const attempt = await tx.paymentAttempt.findUnique({
        where: { provider_externalId: { provider: event.provider, externalId: event.externalId } },
        include: { order: true }
      });
      if (!attempt || !attempt.externalId) {
        throw new PaymentEventConflict('Unknown payment reference');
      }
      if (attempt.orderId !== event.orderId ||
        attempt.amountKopecks !== event.amountKopecks ||
        attempt.currency !== event.currency ||
        attempt.order.totalKopecks !== event.amountKopecks ||
        attempt.order.currency !== event.currency) {
        throw new PaymentEventConflict('Order, amount or currency mismatch');
      }

      const refund = event.type === 'payment.refunded';
      const allowedStatuses = refund ? ['PAID', 'PROCESSING', 'FULFILLED'] as const : ['PENDING_PAYMENT'] as const;
      if (refund ? attempt.status !== 'SUCCEEDED' : attempt.status !== 'CREATED') {
        throw new PaymentEventConflict('Payment attempt is not in the expected state');
      }
      const result = await tx.order.updateMany({
        where: { id: event.orderId, status: { in: [...allowedStatuses] } },
        data: { status: refund ? 'REFUNDED' : 'PAID' }
      });
      if (result.count !== 1) {
        throw new PaymentEventConflict('Invalid order state transition');
      }
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: refund ? 'REFUNDED' : 'SUCCEEDED' }
      });
      await tx.paymentEvent.create({
        data: {
          provider: event.provider, eventId: event.eventId, eventType: event.type,
          externalId: event.externalId, orderId: event.orderId,
          paymentAttemptId: attempt.id, amountKopecks: event.amountKopecks,
          currency: event.currency
        }
      });
      return { outcome: 'applied' as const, orderId: event.orderId, status: refund ? 'REFUNDED' : 'PAID' };
    }, { timeout: 10000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await db.paymentEvent.findUnique({
        where: { provider_eventId: { provider: event.provider, eventId: event.eventId } }
      });
      if (existing && existing.orderId === event.orderId && existing.externalId === event.externalId &&
        existing.eventType === event.type && existing.amountKopecks === event.amountKopecks &&
        existing.currency === event.currency) {
        return { outcome: 'duplicate', orderId: existing.orderId };
      }
    }
    throw error;
  }
}
