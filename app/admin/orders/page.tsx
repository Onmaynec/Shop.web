import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import { Prisma,OrderStatus } from '@prisma/client';
import Link from 'next/link';
import OrderManager from '../../../components/admin/OrderManager';
import { sandboxEnabled } from '../../../lib/payments';

export const dynamic='force-dynamic';

export default async function OrdersPage({searchParams}:{
  searchParams:Promise<{q?:string;status?:string;page?:string}>
}){
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const params=await searchParams,q=(params.q||'').trim().slice(0,80);
  const status=['PENDING_PAYMENT','PAID','PROCESSING','FULFILLED','CANCELLED','REFUNDED']
    .includes(params.status||'')?params.status as OrderStatus:undefined;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where:Prisma.OrderWhereInput={
    ...(status?{status}:{}),
    ...(q?{OR:[{email:{contains:q,mode:'insensitive'}},{id:{contains:q}}]}:{})
  };
  const [total,orders]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({
      where,orderBy:{createdAt:'desc'},skip:(page-1)*20,take:20,
      include:{
        items:true,
        paymentEvents:{orderBy:{createdAt:'desc'}},
        activities:{orderBy:{createdAt:'desc'},take:60,
          include:{author:{select:{email:true}}}},
        tasks:{orderBy:{createdAt:'asc'},
          include:{orderItem:{select:{nameSnapshot:true,variantSnapshot:true,quantity:true}},
            assignedTo:{select:{email:true}}}},
        deliveries:{orderBy:{createdAt:'desc'}}
      }
    })
  ]);
  const mapped=orders.map(o=>({
    id:o.id,email:o.email,userId:o.userId,status:o.status,
    totalKopecks:o.totalKopecks,createdAt:o.createdAt.toISOString(),
    items:o.items.map(i=>({
      id:i.id,name:i.nameSnapshot,unitPriceKopecks:i.unitPriceKopecks,
      quantity:i.quantity,sku:i.skuSnapshot,variant:i.variantSnapshot
    })),
    paymentEvents:o.paymentEvents.map(e=>({
      id:e.id,type:e.eventType,provider:e.provider,
      amountKopecks:e.amountKopecks,createdAt:e.createdAt.toISOString()
    })),
    activities:o.activities.map(a=>({
      id:a.id,kind:a.kind,visibility:a.visibility,title:a.title,
      message:a.message,author:a.author?.email||null,createdAt:a.createdAt.toISOString()
    })),
    tasks:o.tasks.map(t=>({
      id:t.id,status:t.status,assignedToId:t.assignedToId,
      assignedTo:t.assignedTo?.email||null,
      name:t.orderItem.nameSnapshot,variant:t.orderItem.variantSnapshot,
      quantity:t.orderItem.quantity
    })),
    deliveries:o.deliveries.map(d=>({
      id:d.id,originalName:d.originalName,bytes:d.bytes,
      releasedAt:d.releasedAt?.toISOString()||null,
      revokedAt:d.revokedAt?.toISOString()||null
    }))
  }));
  const query=new URLSearchParams();if(q)query.set('q',q);if(status)query.set('status',status);
  const pages=Math.max(1,Math.ceil(total/20));
  return <>
    <OrderManager initialOrders={mapped} total={total} query={q}
      filterStatus={status||''} actorId={user.id} sandboxEnabled={sandboxEnabled()}/>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>
      {page>1&&<Link href={'/admin/orders?'+query.toString()+(query.size?'&':'')+'page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/orders?'+query.toString()+(query.size?'&':'')+'page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
