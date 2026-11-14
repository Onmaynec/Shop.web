import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';

const db=new PrismaClient(),base='http://127.0.0.1:3000',suffix=Date.now().toString();
const password='FulfillmentPreReleaseTest_2026';
async function request(path,method='GET',body,cookie=''){
  const response=await fetch(base+path,{
    method,headers:{
      ...(method!=='GET'?{'Origin':base}:{}),
      ...(body?{'Content-Type':'application/json'}:{}),
      ...(cookie?{'Cookie':cookie}:{})
    },
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const text=await response.text();let json;
  try{json=JSON.parse(text)}catch{json=null}
  return {status:response.status,json,text,headers:response.headers};
}
async function signup(name){
  const email=name+'-'+suffix+'@example.test';
  const response=await request('/api/auth/register','POST',{email,password});
  assert.equal(response.status,201,JSON.stringify(response.json));
  return {email,id:response.json.user.id,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
}
async function run(){
  try{
    const owner=await signup('work-owner');
    const worker=await signup('work-executor');
    const outsider=await signup('work-outsider');
    const customer=await signup('work-buyer');
    await db.user.update({where:{id:owner.id},data:{role:'ADMIN'}});
    for(const person of [worker,outsider]){
      const promoted=await request('/api/admin/staff','PATCH',{
        userId:person.id,role:'FULFILLMENT'
      },owner.cookie);
      assert.equal(promoted.status,200,JSON.stringify(promoted.json));
      const login=await request('/api/auth/login','POST',{
        email:person.email,password
      });
      assert.equal(login.status,200);
      person.cookie=login.headers.get('set-cookie')?.split(';')[0]||'';
    }
    const category=await db.category.create({data:{
      name:'Workforce '+suffix,slug:'workforce-'+suffix
    }});
    const product=await db.product.create({data:{
      name:'Private pre-release service',slug:'workforce-'+suffix+'-product',
      description:'Digital training preparation',status:'ACTIVE',
      categoryId:category.id,priceKopecks:60000
    }});
    const order=await db.order.create({data:{
      email:customer.email,userId:customer.id,totalKopecks:60000,
      items:{create:{productId:product.id,nameSnapshot:product.name,
        unitPriceKopecks:60000,quantity:1}}
    }});
    const paid=await request('/api/admin/sandbox/payments','POST',{
      orderId:order.id,operation:'pay'
    },owner.cookie);
    assert.equal(paid.status,200,JSON.stringify(paid.json));
    const task=await db.orderTask.findFirstOrThrow({where:{orderId:order.id}});
    const forbiddenPrepare=await request('/api/admin/orders/actions','POST',{
      orderId:order.id,action:'prepare'
    },worker.cookie);
    assert.equal(forbiddenPrepare.status,403);
    const unassigned=await request('/api/admin/orders/actions','POST',{
      orderId:order.id,action:'task',taskId:task.id,status:'DONE'
    },worker.cookie);
    assert.equal(unassigned.status,409);
    const take=await request('/api/admin/orders/actions','POST',{
      orderId:order.id,action:'task',taskId:task.id,status:'OPEN',assignedToId:worker.id
    },worker.cookie);
    assert.equal(take.status,200,JSON.stringify(take.json));
    const foreign=await request('/api/admin/orders/actions','POST',{
      orderId:order.id,action:'task',taskId:task.id,status:'IN_PROGRESS'
    },outsider.cookie);
    assert.equal(foreign.status,409);
    const start=await request('/api/admin/orders/actions','POST',{
      orderId:order.id,action:'task',taskId:task.id,status:'IN_PROGRESS'
    },worker.cookie);
    assert.equal(start.status,200,JSON.stringify(start.json));
    const workerPage=await request('/admin/queue/'+order.id,'GET',undefined,worker.cookie);
    assert.equal(workerPage.status,200);
    assert.ok(workerPage.text.includes('Материалы исполнения'));
    assert.ok(!workerPage.text.includes(customer.email),'Fulfillment page must not expose buyer email');

    const fileData=Buffer.from('Workforce service completion report');
    const form=new FormData();
    form.set('file',new Blob([fileData],{type:'text/plain'}),'service.txt');
    const doUpload=(cookie)=>fetch(base+'/api/admin/orders/'+order.id+'/deliveries',{
      method:'POST',headers:{'Origin':base,'Cookie':cookie},body:form
    });
    const wrong=await doUpload(outsider.cookie);
    assert.equal(wrong.status,403);
    const right=await doUpload(worker.cookie);
    assert.equal(right.status,201,await right.clone().text());
    const attached=await right.json();
    assert.equal(attached.delivery.originalName,'service.txt');
    const publish=await request('/api/admin/orders/'+order.id+'/deliveries',
      'PATCH',{action:'release',deliveryId:attached.delivery.id},worker.cookie);
    assert.equal(publish.status,403);
    const noCustomerFile=await request('/api/me/orders/'+order.id+
      '/downloads/'+attached.delivery.id,'GET',undefined,customer.cookie);
    assert.equal(noCustomerFile.status,404);
    console.log('Workforce integration passed: delegated role, ownership, private upload, no unauthorized publication');
  }finally{await db.$disconnect();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
