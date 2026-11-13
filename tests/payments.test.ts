import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  paymentEventSchema, SandboxPaymentProvider, PaymentVerificationError,
  signSandboxWebhook, sandboxEnabled
} from '../lib/payments';

const validEvent = {
  eventId:'0ffca6bb-bf8e-4ee9-adce-7d90a73b92a1',
  provider:'sandbox' as const,
  type:'payment.succeeded' as const,
  externalId:'c96ee06b-2fc0-40ad-a3c2-96595b2fd925',
  orderId:'cln9jwmjm0000a121q4or6b93',
  amountKopecks:45900,
  currency:'RUB' as const
};
function setup() {
  vi.stubEnv('NODE_ENV','development');
  vi.stubEnv('PAYMENT_SANDBOX_ENABLED','true');
  vi.stubEnv('PAYMENT_SANDBOX_SECRET','test-secret-signature-is-at-least-32-characters-long');
}
afterEach(()=>vi.unstubAllEnvs());

describe('sandbox signature validation',()=>{
  it('is opt-in and unavailable in production',()=>{
    setup();
    expect(sandboxEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV','production');
    expect(sandboxEnabled()).toBe(false);
  });
  it('verifies the exact signed raw body',()=>{
    setup();
    const rawBody=JSON.stringify(validEvent);
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature=signSandboxWebhook(rawBody,timestamp);
    const verified=new SandboxPaymentProvider().verifyWebhook({rawBody,timestamp,signature});
    expect(verified).toEqual(validEvent);
    expect(()=>new SandboxPaymentProvider().verifyWebhook({
      rawBody:rawBody+' ',timestamp,signature
    })).toThrow(PaymentVerificationError);
  });
  it('rejects mismatched, malformed and expired signatures',()=>{
    setup();
    const rawBody=JSON.stringify(validEvent);
    const timestamp=String(Math.floor(Date.now()/1000));
    const signature=signSandboxWebhook(rawBody,timestamp);
    const provider=new SandboxPaymentProvider();
    expect(()=>provider.verifyWebhook({rawBody,timestamp,signature:'sha256='+'0'.repeat(64)})).toThrow();
    expect(()=>provider.verifyWebhook({rawBody,timestamp:'abc',signature})).toThrow();
    expect(()=>provider.verifyWebhook({
      rawBody,timestamp:String(Number(timestamp)-301),
      signature:signSandboxWebhook(rawBody,String(Number(timestamp)-301))
    })).toThrow();
  });
  it('does not accept arbitrary payment event types',()=>{
    expect(paymentEventSchema.safeParse({...validEvent,type:'payment.pending'}).success).toBe(false);
    expect(paymentEventSchema.safeParse({...validEvent,amountKopecks:-100}).success).toBe(false);
    expect(paymentEventSchema.safeParse({...validEvent,currency:'USD'}).success).toBe(false);
  });
});
