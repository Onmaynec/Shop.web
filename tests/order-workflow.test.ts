import { describe, expect, it } from 'vitest';
import { canAdminTransition } from '../lib/order-workflow';

describe('order transitions', () => {
  it('allows cancellation only before payment', () => {
    expect(canAdminTransition('PENDING_PAYMENT','CANCELLED')).toBe(true);
    expect(canAdminTransition('PAID','CANCELLED')).toBe(false);
  });
  it('requires payment before fulfilment workflow', () => {
    expect(canAdminTransition('PENDING_PAYMENT','PROCESSING')).toBe(false);
    expect(canAdminTransition('PAID','PROCESSING')).toBe(true);
    expect(canAdminTransition('PROCESSING','FULFILLED')).toBe(true);
    expect(canAdminTransition('PENDING_PAYMENT','FULFILLED')).toBe(false);
  });
  it('never permits admin to mark an order paid', () => {
    expect(canAdminTransition('PENDING_PAYMENT','PAID')).toBe(false);
  });
});
