import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';

const db=new PrismaClient();
const root='http://127.0.0.1:3000';
const suffix=Date.now().toString();
const password='PreReleaseOperationsSecureTest_2026';
let buyerCookie='',ownerCookie='',supportCookie='',fulfillCookie='';

async function request(path,method='GET',body,cookie=''){
  const response=await fetch(root+path,{
    method,headers:{
      ...(method!=='GET'?{'Origin':root}:{}),
      ...(body!==undefined?{'Content-Type':'application/json'}:{}),
      ...(cookie?{'Cookie':cookie}:{})
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const raw=await response.text();
  let json;try{json=JSON.parse(raw)}catch{json=null}
  return {status:response.status,raw,json,headers:response.headers};
}
async function signup(prefix){
  const email=prefix+'-'+suffix+'@example.test';
  const response=await request('/api/auth/register','POST',{email,password});
  assert.equal(response.status,201,JSON.stringify(response.json));
  return {email,id:response.json.user.id,
    cookie:response.headers.get('set-cookie')?.split(';')[0]||''};
}
async function login(email){
  const response=await request('/api/auth/login','POST',{email,password});
  assert.equal(response.status,200,JSON.stringify(response.json));
  return response.headers.get('set-cookie')?.split(';')[0]||'';
}
async function run(){
  try{
    const buyer=await signup('pre-buyer');
    const owner=await signup('pre-owner');
    const support=await signup('pre-support');
    const fulfill=await signup('pre-fulfill');
    buyerCookie=buyer.cookie;ownerCookie=owner.cookie;
    supportCookie=support.cookie;fulfillCookie=fulfill.cookie;
    await db.user.update({where:{id:owner.id},data:{role:'ADMIN'}});

    const forbidden=await request('/api/admin/staff','PATCH',{
      userId:fulfill.id,role:'ADMIN'
    },buyerCookie);
    assert.equal(forbidden.status,403);
    const self=await request('/api/admin/staff','PATCH',{
      userId:owner.id,role:'SUPPORT'
    },ownerCookie);
    assert.equal(self.status,409);
    const promoteSupport=await request('/api/admin/staff','PATCH',{
      userId:support.id,role:'SUPPORT'
    },ownerCookie);
    assert.equal(promoteSupport.status,200,JSON.stringify(promoteSupport.json));
    const promoteFulfill=await request('/api/admin/staff','PATCH',{
      userId:fulfill.id,role:'FULFILLMENT'
    },ownerCookie);
    assert.equal(promoteFulfill.status,200,JSON.stringify(promoteFulfill.json));
    const revoked=await request('/api/auth/session','GET',undefined,supportCookie);
    assert.equal(revoked.json.user,null,'Changing role must invalidate prior session');
    supportCookie=await login(support.email);
    fulfillCookie=await login(fulfill.email);
    const canSupport=await request('/admin/support','GET',undefined,supportCookie);
    assert.equal(canSupport.status,200);
    assert.ok(canSupport.raw.includes('Обращения покупателей'));
    const cannotStaff=await request('/admin/staff','GET',undefined,supportCookie);
    assert.ok(!cannotStaff.raw.includes('Команда магазина'));
    const fulfillQueue=await request('/admin/queue','GET',undefined,fulfillCookie);
    assert.equal(fulfillQueue.status,200);
    assert.ok(fulfillQueue.raw.includes('Очередь исполнения'));
    const cannotSupport=await request('/api/admin/support/cln9jwmjm0000a121q4or6b93',
      'PATCH',{status:'CLOSED'},fulfillCookie);
    assert.equal(cannotSupport.status,403);
    const crossPermission=await request('/api/admin/orders/actions','POST',{
      action:'note',orderId:'cln9jwmjm0000a121q4or6b93',
      visibility:'STAFF',message:'Should not be allowed'
    },fulfillCookie);
    assert.equal(crossPermission.status,403);

    const category=await db.category.create({data:{
      name:'PreRelease '+suffix,slug:'pre-release-'+suffix
    }});
    const product=await db.product.create({data:{
      name:'Test training',slug:'pre-release-training-'+suffix,
      description:'Support integration test',categoryId:category.id,
      priceKopecks:51000,status:'ACTIVE'
    }});
    const order=await db.order.create({data:{
      email:buyer.email,userId:buyer.id,totalKopecks:51000,
      items:{create:{productId:product.id,nameSnapshot:product.name,
        unitPriceKopecks:51000,quantity:1}}
    }});
    const alien=await db.order.create({data:{
      email:support.email,userId:support.id,totalKopecks:51000
    }});
    const deniedOrder=await request('/api/support/tickets','POST',{
      subject:'Вопрос по чужому заказу',message:'Пример вопроса к чужому заказу.',orderId:alien.id
    },buyerCookie);
    assert.equal(deniedOrder.status,404);
    const created=await request('/api/support/tickets','POST',{
      subject:'Что происходит с заказом?',
      message:'Нужно уточнить время исполнения этой игровой услуги.',
      orderId:order.id
    },buyerCookie);
    assert.equal(created.status,201,JSON.stringify(created.json));
    const ticketId=created.json.ticketId;
    const supportList=await request('/admin/support?q='+encodeURIComponent(ticketId),
      'GET',undefined,supportCookie);
    assert.equal(supportList.status,200);
    assert.ok(supportList.raw.includes('Что происходит с заказом?'));

    const customerPage=await request('/support/'+ticketId,'GET',undefined,buyerCookie);
    assert.equal(customerPage.status,200);
    assert.ok(customerPage.raw.includes('Нужно уточнить время'));
    const strangerPage=await request('/support/'+ticketId,'GET',undefined,fulfillCookie);
    assert.ok(!strangerPage.raw.includes('Нужно уточнить время'));

    const staffNote=await request('/api/support/tickets/'+ticketId+'/messages','POST',{
      message:'Внутренний комментарий, который клиент видеть не должен.',
      internal:true
    },supportCookie);
    assert.equal(staffNote.status,200,JSON.stringify(staffNote.json));
    const customerHidden=await request('/support/'+ticketId,'GET',undefined,buyerCookie);
    assert.ok(!customerHidden.raw.includes('Внутренний комментарий'));
    const clientNoteAttempt=await request('/api/support/tickets/'+ticketId+'/messages','POST',{
      message:'Хочу скрытую заметку',internal:true
    },buyerCookie);
    assert.equal(clientNoteAttempt.status,403);
    const staffAnswer=await request('/api/support/tickets/'+ticketId+'/messages','POST',{
      message:'Мы проверяем заявку и скоро уточним детали.',internal:false
    },supportCookie);
    assert.equal(staffAnswer.status,200);
    assert.equal((await db.supportTicket.findUniqueOrThrow({where:{id:ticketId}})).status,
      'WAITING_CUSTOMER');
    const answered=await request('/support/'+ticketId,'GET',undefined,buyerCookie);
    assert.ok(answered.raw.includes('Мы проверяем заявку'));
    const customerReply=await request('/api/support/tickets/'+ticketId+'/messages','POST',{
      message:'Спасибо, ожидаю новости.'
    },buyerCookie);
    assert.equal(customerReply.status,200);
    assert.equal((await db.supportTicket.findUniqueOrThrow({where:{id:ticketId}})).status,'OPEN');
    const assignment=await request('/api/admin/support/'+ticketId,'PATCH',{
      assignedToId:support.id,priority:'HIGH'
    },supportCookie);
    assert.equal(assignment.status,200,JSON.stringify(assignment.json));
    const crossAssign=await request('/api/admin/support/'+ticketId,'PATCH',{
      assignedToId:owner.id
    },supportCookie);
    assert.equal(crossAssign.status,403);
    const closed=await request('/api/admin/support/'+ticketId,'PATCH',{
      status:'CLOSED'
    },supportCookie);
    assert.equal(closed.status,200);
    const deniedReply=await request('/api/support/tickets/'+ticketId+'/messages','POST',{
      message:'Попробую написать после закрытия'
    },buyerCookie);
    assert.equal(deniedReply.status,409);

    const injection=await db.order.create({data:{
      email:'=SUM(1,1)',totalKopecks:100
    }});
    const from=new Date(Date.now()-86400000).toISOString().slice(0,10);
    const to=new Date().toISOString().slice(0,10);
    const csvPath='/api/admin/reports/orders?from='+from+'&to='+to;
    const reportForbidden=await request(csvPath,'GET',undefined,supportCookie);
    assert.equal(reportForbidden.status,403);
    const report=await request(csvPath,'GET',undefined,ownerCookie);
    assert.equal(report.status,200);
    assert.ok(report.raw.includes(order.id));
    assert.ok(report.raw.includes(injection.id));
    assert.ok(report.raw.includes('"\'=SUM(1,1)"'),'CSV must neutralize spreadsheet formulas');
    assert.ok(!report.raw.includes('"=SUM(1,1)"'));
    assert.match(report.headers.get('content-disposition')||'',/attachment/);
    const badDate=await request('/api/admin/reports/orders?from=2026-02-30&to=2026-11-14',
      'GET',undefined,ownerCookie);
    assert.equal(badDate.status,400);
    const exports=await db.auditLog.count({
      where:{actorId:owner.id,action:'reports.orders.export'}
    });
    assert.ok(exports>=1);
    console.log('Operations & Support passed: role revocation, RBAC, ticket privacy, staff notes, status flow, CSV guards and audit');
  }finally{await db.$disconnect();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
