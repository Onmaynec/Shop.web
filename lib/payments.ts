import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Payment integration boundary. No real acquirer is connected.
 * Sandbox works only in local development, never when NODE_ENV=production.
 */
export const paymentEventSchema = z.object({
  eventId: z.string().uuid(),
  type: z.enum(['payment.succeeded', 'payment.refunded']),
  provider: z.literal('sandbox'),
  externalId: z.string().uuid(),
  orderId: z.string().cuid(),
  amountKopecks: z.number().int().positive(),
  currency: z.literal('RUB')
}).strict();

export type VerifiedPaymentEvent = z.infer<typeof paymentEventSchema>;

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: {
    orderId: string;
    amountKopecks: number;
    currency: string;
  }): Promise<{ externalId: string; checkoutUrl: string | null }>;
  verifyWebhook(input: {
    rawBody: string;
    timestamp: string;
    signature: string;
  }): VerifiedPaymentEvent;
}

export class PaymentVerificationError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentVerificationError'; }
}

export function sandboxEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && process.env.PAYMENT_SANDBOX_ENABLED === 'true'
    && typeof process.env.PAYMENT_SANDBOX_SECRET === 'string'
    && process.env.PAYMENT_SANDBOX_SECRET.length >= 32;
}

function requireSandboxSecret(): string {
  if (!sandboxEnabled()) throw new PaymentVerificationError('Sandbox payment adapter is disabled');
  return process.env.PAYMENT_SANDBOX_SECRET!;
}

export function signSandboxWebhook(rawBody: string, timestamp: string): string {
  const secret = requireSandboxSecret();
  return 'sha256=' + createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = 'sandbox';
  async createCheckout(_input: { orderId: string; amountKopecks: number; currency: string }): Promise<{ externalId: string; checkoutUrl: null }> {
    requireSandboxSecret();
    return { externalId: randomUUID(), checkoutUrl: null };
  }
  verifyWebhook({rawBody, timestamp, signature}: {
    rawBody: string; timestamp: string; signature: string;
  }): VerifiedPaymentEvent {
    requireSandboxSecret();
    if (!/^\d{10}$/.test(timestamp)) throw new PaymentVerificationError('Missing or invalid timestamp');
    const issuedAt = Number(timestamp);
    if (Math.abs(Math.floor(Date.now() / 1000) - issuedAt) > 300) {
      throw new PaymentVerificationError('Webhook timestamp outside of allowed window');
    }
    if (!/^sha256=[0-9a-f]{64}$/.test(signature)) {
      throw new PaymentVerificationError('Invalid signature format');
    }
    const expected = Buffer.from(signSandboxWebhook(rawBody, timestamp).slice(7), 'hex');
    const received = Buffer.from(signature.slice(7), 'hex');
    if (!timingSafeEqual(expected, received)) {
      throw new PaymentVerificationError('Webhook signature mismatch');
    }
    try {
      return paymentEventSchema.parse(JSON.parse(rawBody));
    } catch {
      throw new PaymentVerificationError('Invalid webhook event');
    }
  }
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly id = 'unconfigured';
  async createCheckout(): Promise<never> { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  verifyWebhook(): never { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
}
