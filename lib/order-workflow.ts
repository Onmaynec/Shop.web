import type { OrderStatus } from '@prisma/client';

// Allowed admin-only transitions. Payment confirmation is handled by a future provider.
export const adminOrderTransitions = {
  CANCELLED: 'PENDING_PAYMENT',
  PROCESSING: 'PAID',
  FULFILLED: 'PROCESSING'
} as const satisfies Partial<Record<OrderStatus, OrderStatus>>;

export function canAdminTransition(from: OrderStatus, to: OrderStatus) {
  return Object.prototype.hasOwnProperty.call(adminOrderTransitions, to)
    && adminOrderTransitions[to as keyof typeof adminOrderTransitions] === from;
}
