import { NextResponse } from 'next/server';
import { SandboxPaymentProvider, sandboxEnabled, PaymentVerificationError } from '../../../../../lib/payments';
import { applyVerifiedPaymentEvent, PaymentEventConflict } from '../../../../../lib/payment-events';

export const runtime = 'nodejs';

/**
 * Test webhook, purposely UNAVAILABLE in production. Only signed raw bodies
 * are accepted; neither an order ID nor a browser callback proves payment.
 */
export async function POST(request: Request) {
  if (!sandboxEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 8192) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const event = new SandboxPaymentProvider().verifyWebhook({
      rawBody,
      timestamp: request.headers.get('x-ss-timestamp') || '',
      signature: request.headers.get('x-ss-signature') || ''
    });
    const result = await applyVerifiedPaymentEvent(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return NextResponse.json({ error: 'Invalid webhook signature or event' }, { status: 401 });
    }
    if (error instanceof PaymentEventConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Sandbox webhook processing failed', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
