import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import OrderQueue from '../../../components/admin/OrderQueue';

export const dynamic='force-dynamic';
export default async function QueuePage({searchParams}:{searchParams:Promise<{page?:string}>}){
  const actor=await currentUser();
  if(!actor||actor.role!=='ADMIN')notFound();
  const params=await searchParams;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where={status:{in:['OPEN','IN_PROGRESS','BLOCKED'] as const}};
  // Filter explicitly to avoid a phantom queue entry for refunded orders.
  const filter={...where,order:{status:{in:['PAID','PROCESSING'] as const}}};
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
    <OrderQueue actorId={actor.id} total={total} initial={tasks.map(t=>({
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
