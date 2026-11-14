import {NextResponse} from 'next/server';
import {Prisma,OrderStatus} from '@prisma/client';
import {db} from '../../../../../lib/db';
import {adminGate} from '../../../../../lib/admin-api';
import {currentUser} from '../../../../../lib/auth';
import {csvRows,parseUtcDay} from '../../../../../lib/csv';
import {takeRateLimit} from '../../../../../lib/rate-limit';
import {limitResponse} from '../../../../../lib/http-security';
import {auditEntry} from '../../../../../lib/audit';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  const denied=await adminGate(request);
  if(denied)return denied;
  const actor=await currentUser();
  if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
  const limited=limitResponse(await takeRateLimit('csv-export',actor.id,12,3600));
  if(limited)return limited;
  const params=new URL(request.url).searchParams;
  const now=new Date();
  const defaultTo=now.toISOString().slice(0,10);
  const defaultFrom=new Date(now.getTime()-29*86400000).toISOString().slice(0,10);
  const fromText=params.get('from')||defaultFrom;
  const toText=params.get('to')||defaultTo;
  const from=parseUtcDay(fromText),to=parseUtcDay(toText);
  if(!from||!to||to<from||(to.getTime()-from.getTime())>92*86400000){
    return NextResponse.json({error:'Нужен корректный период до 93 дней'},{status:400});
  }
  const statusText=params.get('status')||'';
  const validStatuses:OrderStatus[]=[
    'PENDING_PAYMENT','PAID','PROCESSING','FULFILLED','CANCELLED','REFUNDED'
  ];
  if(statusText&&!validStatuses.includes(statusText as OrderStatus)){
    return NextResponse.json({error:'Неизвестный статус заказа'},{status:400});
  }
  const endExclusive=new Date(to.getTime()+86400000);
  const where:Prisma.OrderWhereInput={
    createdAt:{gte:from,lt:endExclusive},
    ...(statusText?{status:statusText as OrderStatus}:{})
  };
  const orders=await db.order.findMany({
    where,orderBy:{createdAt:'asc'},take:5001,
    select:{
      id:true,email:true,userId:true,status:true,totalKopecks:true,
      currency:true,createdAt:true,
      items:{select:{nameSnapshot:true,quantity:true,skuSnapshot:true}},
      paymentEvents:{select:{provider:true,eventType:true}}
    }
  });
  if(orders.length>5000){
    return NextResponse.json({error:'Больше 5000 заказов: сократите диапазон дат'},{status:422});
  }
  const rows:(string|number|null)[][]=[[
    'order_id','created_utc','status','email','registered_customer','total_kopecks',
    'currency','items_count','skus','payment_providers','sandbox_only'
  ]];
  for(const order of orders){
    const succeeded=order.paymentEvents.filter(e=>e.eventType==='payment.succeeded');
    const providers=[...new Set(succeeded.map(e=>e.provider))];
    rows.push([
      order.id,order.createdAt.toISOString(),order.status,order.email,
      order.userId?'yes':'no',order.totalKopecks,order.currency,
      order.items.reduce((n,i)=>n+i.quantity,0),
      order.items.map(i=>i.skuSnapshot||i.nameSnapshot).join(' | '),
      providers.join(','),
      providers.length>0&&providers.every(p=>p==='sandbox')?'yes':'no'
    ]);
  }
  await db.auditLog.create({data:auditEntry({
    actorId:actor.id,action:'reports.orders.export',targetType:'report',
    details:{from:fromText,to:toText,count:orders.length,status:statusText||'ALL'}
  })});
  return new NextResponse(csvRows(rows),{
    status:200,headers:{
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':`attachment; filename="standoffshop-orders-${fromText}-${toText}.csv"`,
      'Cache-Control':'private, no-store',
      'X-Content-Type-Options':'nosniff'
    }
  });
}
