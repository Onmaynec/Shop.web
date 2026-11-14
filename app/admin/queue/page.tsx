import { db } from '../../../lib/db';
import { Prisma } from '@prisma/client';
import { currentUser } from '../../../lib/auth';
import {hasPermission} from '../../../lib/permissions';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderQueue from '../../../components/admin/OrderQueue';

export const dynamic='force-dynamic';
export default async function QueuePage({searchParams}:{searchParams:Promise<{page?:string}>}){
  const actor=await currentUser();
  if(!actor||!hasPermission(actor.role,'fulfillment'))notFound();
  const params=await searchParams;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  // Only actionable paid orders appear; refunded orders never enter the queue.
  const filter:Prisma.OrderTaskWhereInput={
    status:{in:['OPEN','IN_PROGRESS','BLOCKED']},
    order:{status:{in:['PAID','PROCESSING']}}
  };
  const [total,tasks]=await Promise.all([
    db.orderTask.count({where:filter}),
    db.orderTask.findMany({
      where:filter,orderBy:[{updatedAt:'asc'},{id:'asc'}],
      skip:(page-1)*30,take:30,
      include:{
        order:{select:{status:true}},
        orderItem:{select:{nameSnapshot:true,variantSnapshot:true,quantity:true}},
        assignedTo:{select:{email:true}}
      }
    })
  ]);
  const pages=Math.max(1,Math.ceil(total/30));
  return <>
    <OrderQueue actorId={actor.id} canViewOrders={actor.role==='ADMIN'} total={total} initial={tasks.map(t=>({
      id:t.id,orderId:t.orderId,orderStatus:t.order.status,
      status:t.status,name:t.orderItem.nameSnapshot,variant:t.orderItem.variantSnapshot,
      quantity:t.orderItem.quantity,assignedToId:t.assignedToId,
      assignedTo:t.assignedTo?.email||null,createdAt:t.createdAt.toISOString()
    }))}/>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>
      {page>1&&<Link href={'/admin/queue?page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/queue?page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
