import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db=new PrismaClient();
const base='http://127.0.0.1:3000';
const suffix=Date.now().toString();
const buyer='orders-buyer-'+suffix+'@example.test';
const admin='orders-admin-'+suffix+'@example.test';
let buyerCookie='',adminCookie='';

async function call(path,method='GET',body,cookie=buyerCookie){
  const response=await fetch(base+path,{
    method,
    headers:{
      ...(body!==undefined?{'Content-Type':'application/json'}:{}),
      ...(method!=='GET'?{'Origin':base}:{}),
      ...(cookie?{'Cookie':cookie}:{})
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const raw=await response.text();let data;
  try{data=JSON.parse(raw)}catch{data={raw}};
  return {status:response.status,data,headers:response.headers};
}
async function signUp(email){
  const response=await call('/api/auth/register','POST',{
    email,password:'OrderManagementTestPass-2026!'
  },'');
  assert.equal(response.status,201,JSON.stringify(response.data));
  const cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
  assert.ok(cookie.startsWith('ss_session='));
  return cookie;
}
async function run(){
  try{
    buyerCookie=await signUp(buyer);
    adminCookie=await signUp(admin);
    await db.user.update({where:{email:admin},data:{role:'ADMIN'}});
    const category=await db.category.create({data:{
      name:'Order Ops '+suffix,slug:'order-ops-'+suffix
    }});
    const product=await db.product.create({data:{
      name:'Manual service',slug:'manual-service-'+suffix,
      description:'Test manual fulfillment service',priceKopecks:45000,
      categoryId:category.id,status:'ACTIVE'
    }});
    const created=await call('/api/orders','POST',{
      email:buyer,items:[{productId:product.id,quantity:1}]
    },buyerCookie);
    // A checkout key is mandatory; submit with one below.
    assert.equal(created.status,400);
    const resp=await fetch(base+'/api/orders',{
      method:'POST',
      headers:{'Origin':base,'Cookie':buyerCookie,
        'Content-Type':'application/json','Idempotency-Key':randomUUID()},
      body:JSON.stringify({email:buyer,items:[{productId:product.id,quantity:1}]})
    });
    assert.equal(resp.status,201);
    const order=(await resp.json()).order;
    assert.equal(order.status,'PENDING_PAYMENT');
    assert.equal(await db.orderTask.count({where:{orderId:order.id}}),0);

    const forbidden=await call('/api/admin/orders/actions','POST',{
      action:'prepare',orderId:order.id
    },buyerCookie);
    assert.equal(forbidden.status,403);
    const unpaid=await call('/api/admin/orders','PATCH',{
      id:order.id,status:'PROCESSING'
    },adminCookie);
    assert.equal(unpaid.status,409);
    const premature=await call('/api/admin/orders/actions','POST',{
      action:'prepare',orderId:order.id
    },adminCookie);
    assert.equal(premature.status,409);

    const note=await call('/api/admin/orders/actions','POST',{
      action:'note',orderId:order.id,visibility:'STAFF',message:'Секретная внутренняя заметка'
    },adminCookie);
    assert.equal(note.status,200,JSON.stringify(note.data));
    const notice=await call('/api/admin/orders/actions','POST',{
      action:'note',orderId:order.id,visibility:'CUSTOMER',message:'Ваша заявка ожидает обработки.'
    },adminCookie);
    assert.equal(notice.status,200,JSON.stringify(notice.data));
    const visible=await call('/account/orders/'+order.id);
    assert.equal(visible.status,200);
    assert.ok(visible.data.raw.includes('Ваша заявка ожидает обработки.'));
    assert.ok(!visible.data.raw.includes('Секретная внутренняя заметка'));

    const paid=await call('/api/admin/sandbox/payments','POST',{
      orderId:order.id,operation:'pay'
    },adminCookie);
    assert.equal(paid.status,200,JSON.stringify(paid.data));
    const task=await db.orderTask.findFirstOrThrow({where:{orderId:order.id}});
    assert.equal(task.status,'OPEN');
    const again=await call('/api/admin/orders/actions','POST',{
      action:'prepare',orderId:order.id
    },adminCookie);
    assert.equal(again.status,200);
    assert.equal(again.data.created,0,'Task creation must be idempotent');

    const cannotComplete=await call('/api/admin/orders','PATCH',{
      id:order.id,status:'FULFILLED'
    },adminCookie);
    assert.equal(cannotComplete.status,409);
    const start=await call('/api/admin/orders','PATCH',{
      id:order.id,status:'PROCESSING'
    },adminCookie);
    assert.equal(start.status,200,JSON.stringify(start.data));

    const assetBytes=Buffer.from('Final report for the demo user');
    const data=new FormData();
    data.set('file',new Blob([assetBytes],{type:'text/plain'}),'summary.txt');
    const uploadResponse=await fetch(base+'/api/admin/orders/'+order.id+'/deliveries',{
      method:'POST',headers:{'Origin':base,'Cookie':adminCookie},body:data
    });
    const upload=await uploadResponse.json();
    assert.equal(uploadResponse.status,201,JSON.stringify(upload));
    const assetId=upload.delivery.id;
    const download='/api/me/orders/'+order.id+'/downloads/'+assetId;
    assert.equal((await call(download,'GET',undefined,buyerCookie)).status,404);

    const updated=await call('/api/admin/orders/actions','POST',{
      action:'task',orderId:order.id,taskId:task.id,status:'DONE',
      assignedToId:(await db.user.findUniqueOrThrow({where:{email:admin}})).id
    },adminCookie);
    assert.equal(updated.status,200,JSON.stringify(updated.data));
    const complete=await call('/api/admin/orders','PATCH',{
      id:order.id,status:'FULFILLED'
    },adminCookie);
    assert.equal(complete.status,200,JSON.stringify(complete.data));
    assert.equal((await call(download,'GET',undefined,buyerCookie)).status,404);

    const release=await call('/api/admin/orders/'+order.id+'/deliveries','PATCH',{
      action:'release',deliveryId:assetId
    },adminCookie);
    assert.equal(release.status,200,JSON.stringify(release.data));
    const downloadResponse=await fetch(base+download,{headers:{'Cookie':buyerCookie}});
    assert.equal(downloadResponse.status,200);
    assert.equal(Buffer.compare(Buffer.from(await downloadResponse.arrayBuffer()),assetBytes),0);
    assert.equal(downloadResponse.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.equal((await call(download,'GET',undefined,adminCookie)).status,404,
      'Being an admin must not expose an unrelated customer download');
    assert.equal((await call(download,'GET',undefined,'')).status,404);
    const missing=await call('/api/me/orders/'+order.id+'/downloads/not-a-valid-id','GET',undefined,buyerCookie);
    assert.equal(missing.status,404);

    const notifications=await call('/api/me/notifications','GET',undefined,buyerCookie);
    assert.equal(notifications.status,200);
    assert.ok(notifications.data.unread>=3);
    const messageId=notifications.data.items[0].id;
    const mark=await call('/api/me/notifications','PATCH',{id:messageId},buyerCookie);
    assert.equal(mark.status,200);
    const outsider=await call('/api/me/notifications','PATCH',{id:messageId},adminCookie);
    assert.equal(outsider.status,200);
    assert.equal(outsider.data.changed,0,'Only notification owner can mark it read');

    const refunded=await call('/api/admin/sandbox/payments','POST',{
      orderId:order.id,operation:'refund'
    },adminCookie);
    assert.equal(refunded.status,200,JSON.stringify(refunded.data));
    assert.equal((await call(download,'GET',undefined,buyerCookie)).status,404);
    const delivered=await db.orderDelivery.findUniqueOrThrow({where:{id:assetId}});
    assert.ok(delivered.revokedAt);
    assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).status,'REFUNDED');
    const afterRefund=await call('/api/admin/orders/actions','POST',{
      action:'task',orderId:order.id,taskId:task.id,status:'OPEN'
    },adminCookie);
    assert.equal(afterRefund.status,409);
    const events=await db.orderActivity.findMany({where:{orderId:order.id}});
    assert.ok(events.some(e=>e.kind==='PAYMENT'));
    assert.ok(events.some(e=>e.kind==='STATUS'&&e.toStatus==='FULFILLED'));
    assert.ok(events.some(e=>e.kind==='NOTE'&&e.visibility==='STAFF'));

    console.log('Order Management passed: payment guard, queue, staff/customer notes, private upload, release, owner-only download, notifications, refund revocation');
  }finally{await db.$disconnect();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
