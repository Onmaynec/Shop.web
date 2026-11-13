import { describe, expect, it } from 'vitest';
import { checkoutFingerprint, hashCheckoutKey, validCheckoutKey } from '../lib/checkout';

describe('checkout idempotency',()=>{
  it('uses stable fingerprints for same items despite input order',()=>{
    const a=checkoutFingerprint({email:' User@Example.Com ',items:[
      {productId:'a',quantity:1},{productId:'b',quantity:3},{productId:'a',quantity:2}
    ]});
    const b=checkoutFingerprint({email:'user@example.com',items:[
      {productId:'b',quantity:3},{productId:'a',quantity:3}
    ]});
    expect(a).toBe(b);
  });
  it('changes hash if cart or email changes',()=>{
    const first=checkoutFingerprint({email:'a@example.com',items:[{productId:'a',quantity:1}]});
    const second=checkoutFingerprint({email:'a@example.com',items:[{productId:'a',quantity:2}]});
    const third=checkoutFingerprint({email:'b@example.com',items:[{productId:'a',quantity:1}]});
    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
  });
  it('validates keys and hashes them instead of storing plaintext',()=>{
    expect(validCheckoutKey('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validCheckoutKey('tiny')).toBe(false);
    expect(validCheckoutKey('unsafe key with spaces')).toBe(false);
    expect(hashCheckoutKey('550e8400-e29b-41d4-a716-446655440000')).toHaveLength(64);
  });
});
