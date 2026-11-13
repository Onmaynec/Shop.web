import assert from 'node:assert/strict';
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
    const response = await fetch(root + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.test', items: [{ productId: product.id, quantity: 2 }] })
    });
    assert.equal(response.status, 201);
    const data = await response.json();
    assert.equal(data.order.totalKopecks, 99800);
    assert.equal(data.order.status, 'PENDING_PAYMENT');
    assert.equal(data.payment.available, false);
    const denied = await fetch(root + '/api/admin/overview');
    assert.equal(denied.status, 403);
    console.log('Integration smoke passed: catalog, pricing, unpaid orders, admin guard');
  } finally {
    await db.$disconnect();
  }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
