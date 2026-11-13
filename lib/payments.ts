/** No production provider is configured. Never mark an order PAID from a browser request. */
export interface PaymentProvider {
  createCheckout(input: { orderId: string; amountKopecks: number; currency: string }): Promise<{ checkoutUrl: string; externalId: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<{ externalId: string; paid: boolean }>;
}
export class UnconfiguredPaymentProvider implements PaymentProvider {
  async createCheckout(): Promise<never> { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async verifyWebhook(): Promise<never> { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
}
