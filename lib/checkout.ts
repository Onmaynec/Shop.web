import { createHash } from 'node:crypto';

export function hashCheckoutKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function checkoutFingerprint(input: {
  email: string;
  items: { productId: string; quantity: number }[];
}): string {
  const grouped = new Map<string, number>();
  for (const {productId, quantity} of input.items) {
    grouped.set(productId, (grouped.get(productId) || 0) + quantity);
  }
  const items = [...grouped.entries()]
    .map(([productId,quantity])=>({productId,quantity}))
    .sort((a,b)=>a.productId.localeCompare(b.productId));
  return createHash('sha256')
    .update(JSON.stringify({email:input.email.trim().toLowerCase(),items}))
    .digest('hex');
}

export function validCheckoutKey(key: string | null): key is string {
  return !!key && key.length >= 12 && key.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(key);
}
