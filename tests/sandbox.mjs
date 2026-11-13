import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
const secret = process.env.PAYMENT_SANDBOX_SECRET;
assert.ok(secret && secret.length >= 32, 'Sandbox test requires signing secret');

let cookie = '';
async function json(path, method='GET', data, authenticate=true) {
  const response = await fetch(base+path, {
    method,
    headers: {
      ...(data ? {'Content-Type':'application/json'} : {}),
      ...(method !== 'GET' ? {'Origin':base} : {}),
      ...(authenticate && cookie ? {'Cookie':cookie} : {})
    },
    body:data ? JSON.stringify(data) : undefined
  });
  const body = await response.json().catch(()=>null);
  return {status:response.status,body,headers:response.headers};
}
async function webhook(event, opts={}) {
  const raw=JSON.stringify(event);
  const timestamp=opts.timestamp || String(Math.floor(Date.now()/1000));
  const signature='sha256='+createHmac('sha256', secret).update(timestamp+'.'+raw).digest('hex');
  const response=await fetch(base+'/api/payments/webhooks/sandbox',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-ss-timestamp':timestamp,
      'x-ss-signature':opts.badSignature?'sha256='+'0'.repeat(64):signature
    },
    body:raw
  });
  return {status:response.status,body:await response.json().catch(()=>null)};
}

async function run() {
  try {
    const suffix=Date.now().toString();
    const email='integration-'+suffix+'@example.test';
    const category=await db.category.create({
      data:{name:'Sandbox Test '+suffix,slug:'sandbox-test-'+suffix}
    });
    const product=await db.product.create({
      data:{name:'Sandbox Item',slug:'sandbox-item-'+suffix,
        description:'Test-only item',categoryId:category.id,priceKopecks:75000,status:'ACTIVE'}
    });
    const registration=await json('/api/auth/register','POST',{
      email,password:'Long-CI-Test-Password-2026'
    },false);
    assert.equal(registration.status,201,JSON.stringify(registration.body));
    cookie=registration.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(cookie.startsWith('ss_session='));

    const denied=await json('/api/admin/sandbox/payments','POST',{
      orderId:'cln9jwmjm0000a121q4or6b93',operation:'pay'
    });
    assert.equal(denied.status,403,'Customer cannot create sandbox payment');

    await db.user.update({where:{email},data:{role:'ADMIN'}});
    const create=await json('/api/orders','POST', {
      email,items:[{productId:product.id,quantity:2}]
    });
    // Checkout requires an Idempotency-Key; call it explicitly below.
    assert.equal(create.status,400);

    const requestKey=randomUUID();
    const response=await fetch(base+'/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json','Origin':base,'Cookie':cookie,'Idempotency-Key':requestKey},
      body:JSON.stringify({email,items:[{productId:product.id,quantity:2}]})
    });
    const responseData=await response.json().catch(()=>null);
    assert.equal(response.status,201,JSON.stringify(responseData));
    const order=responseData.order;
    assert.equal(order.totalKopecks,150000);

    const paid=await json('/api/admin/sandbox/payments','POST',{orderId:order.id,operation:'pay'});
    assert.equal(paid.status,200,JSON.stringify(paid.body));
    assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).status,'PAID');

    const attempt=await db.paymentAttempt.findFirstOrThrow({where:{orderId:order.id,provider:'sandbox'}});
    assert.equal(attempt.status,'SUCCEEDED');
    assert.equal(attempt.amountKopecks,150000);

    const recorded=await db.paymentEvent.findFirstOrThrow({where:{orderId:order.id,eventType:'payment.succeeded'}});
    const exactReplay={
      eventId:recorded.eventId,type:recorded.eventType,provider:'sandbox',
      externalId:recorded.externalId,orderId:recorded.orderId,
      amountKopecks:recorded.amountKopecks,currency:recorded.currency
    };
    const replay=await webhook(exactReplay);
    assert.equal(replay.status,200,JSON.stringify(replay.body));
    assert.equal(replay.body.outcome,'duplicate');

    const forgery=await webhook({...exactReplay,eventId:randomUUID()}, {badSignature:true});
    assert.equal(forgery.status,401);
    const expired=await webhook({...exactReplay,eventId:randomUUID()},{
      timestamp:String(Math.floor(Date.now()/1000)-1000)
    });
    assert.equal(expired.status,401);

    const mismatch=await webhook({...exactReplay,eventId:randomUUID(),amountKopecks:1});
    assert.equal(mismatch.status,409);

    const refunded=await json('/api/admin/sandbox/payments','POST',{orderId:order.id,operation:'refund'});
    assert.equal(refunded.status,200,JSON.stringify(refunded.body));
    assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).status,'REFUNDED');
    assert.equal(await db.paymentEvent.count({where:{orderId:order.id}}),2);

    const refundedAgain=await json('/api/admin/sandbox/payments','POST',{orderId:order.id,operation:'refund'});
    assert.equal(refundedAgain.status,409);
    console.log('Sandbox integration passed: admin-only payment, signature validation, replay rejection, full refund');
  } finally {
    await db.$disconnect();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
