import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const root = 'http://127.0.0.1:3000';
async function run() {
  try {
    const suffix = Date.now().toString();
    const category = await db.category.create({
      data: { name: 'Smoke ' + suffix, slug: 'smoke-' + suffix, description: 'Test category' }
    });
    const product = await db.product.create({
      data: { name: 'Demo smoke ' + suffix, slug: 'demo-smoke-' + suffix,
        description: 'Test product for smoke test', categoryId: category.id,
        priceKopecks: 49900, status: 'ACTIVE' }
    });
    const page = await fetch(root + '/catalog');
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('Demo smoke ' + suffix));

    const requestKey = randomUUID();
    const requestBody = { email: 'test@example.test', items: [{productId:product.id,quantity:2}] };
    const checkout = (key,body) => fetch(root+'/api/orders',{
      method:'POST',headers:{'Content-Type':'application/json','Origin':root,'Idempotency-Key':key},
      body:JSON.stringify(body)
    });
    const response=await checkout(requestKey,requestBody);
    assert.equal(response.status,201);
    const data=await response.json();
    assert.equal(data.order.totalKopecks,99800);
    assert.equal(data.order.status,'PENDING_PAYMENT');
    assert.equal(data.payment.available,false);
    assert.equal(data.reused,false);

    const replay=await checkout(requestKey,requestBody);
    assert.equal(replay.status,200);
    const replayData=await replay.json();
    assert.equal(replayData.order.id,data.order.id);
    assert.equal(replayData.reused,true);

    const conflict=await checkout(requestKey,{
      ...requestBody,items:[{productId:product.id,quantity:1}]
    });
    assert.equal(conflict.status,409);

    const missingKey=await fetch(root+'/api/orders',{
      method:'POST',headers:{'Content-Type':'application/json','Origin':root},
      body:JSON.stringify(requestBody)
    });
    assert.equal(missingKey.status,400);

    const wrongOrigin=await fetch(root+'/api/orders',{
      method:'POST',headers:{'Content-Type':'application/json','Origin':'https://other.example','Idempotency-Key':randomUUID()},
      body:JSON.stringify(requestBody)
    });
    assert.equal(wrongOrigin.status,403);

    const denied=await fetch(root+'/api/admin/overview');
    assert.equal(denied.status,403);
    const sandbox=await fetch(root+'/api/admin/sandbox/payments',{method:'POST'});
    assert.equal(sandbox.status,404);
    const webhook=await fetch(root+'/api/payments/webhooks/sandbox',{method:'POST'});
    assert.equal(webhook.status,404);

    console.log('Production smoke passed: catalog, order snapshots, idempotent retries, access control, sandbox disabled');
  } finally {
    await db.$disconnect();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
