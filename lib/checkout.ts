import { createHash } from 'node:crypto';

export type CheckoutLine = {productId:string;variantId?:string|null;quantity:number};
export function hashCheckoutKey(key:string){
  return createHash('sha256').update(key).digest('hex');
}
export function checkoutFingerprint(input:{email:string;items:CheckoutLine[]}):string{
  const quantities=new Map<string,number>();
  for(const {productId,variantId,quantity} of input.items){
    const key=JSON.stringify([productId,variantId||null]);
    quantities.set(key,(quantities.get(key)||0)+quantity);
  }
  const items=[...quantities.entries()]
    .map(([key,quantity])=>({key,quantity}))
    .sort((a,b)=>a.key.localeCompare(b.key));
  return createHash('sha256').update(JSON.stringify({
    email:input.email.trim().toLowerCase(),items
  })).digest('hex');
}
export function validCheckoutKey(key:string|null):key is string{
  return !!key&&key.length>=12&&key.length<=128&&/^[A-Za-z0-9._:-]+$/.test(key);
}
