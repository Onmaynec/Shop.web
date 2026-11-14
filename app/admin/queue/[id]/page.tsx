import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ClipboardList,FileText} from 'lucide-react';
import {db} from '../../../../lib/db';
import {currentUser} from '../../../../lib/auth';
import {hasPermission} from '../../../../lib/permissions';
import FulfillmentUpload from '../../../../components/admin/FulfillmentUpload';

export const dynamic='force-dynamic';
export default async function FulfillmentOrder({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user||!hasPermission(user.role,'fulfillment'))notFound();
  const {id}=await params;
  const order=await db.order.findFirst({
    where:{
      id,
      ...(user.role==='FULFILLMENT'
        ?{tasks:{some:{assignedToId:user.id}}}:{})
    },
    select:{
      id:true,status:true,
      tasks:{select:{
        id:true,status:true,assignedToId:true,
        orderItem:{select:{nameSnapshot:true,variantSnapshot:true,quantity:true}}
      }},
      deliveries:{select:{id:true,originalName:true,bytes:true,createdAt:true},
        orderBy:{createdAt:'desc'}}
    }
  });
  if(!order)notFound();
  const enabled=['PAID','PROCESSING'].includes(order.status)&&
    (user.role==='ADMIN'||order.tasks.some(t=>
      t.assignedToId===user.id&&['IN_PROGRESS','DONE'].includes(t.status)));
  return <>
    <div className="adm-head"><div>
      <Link className="support-back" href="/admin/queue"><ArrowLeft size={16}/> Очередь задач</Link>
      <div className="adm-eyebrow">FULFILLMENT / WORKSPACE</div>
      <h1>Заказ #{order.id.slice(-8)}</h1>
      <p>Статус: {order.status}. Доступны только служебные сведения, необходимые для исполнения.</p>
    </div></div>
    <div className="operations-grid">
      <section className="adm-card operations-panel">
        <h2><ClipboardList size={18}/> Позиции заказа</h2>
        {order.tasks.map(task=><div className="adm-worker-task" key={task.id}>
          <strong>{task.orderItem.nameSnapshot}
            {task.orderItem.variantSnapshot?' · '+task.orderItem.variantSnapshot:''}</strong>
          <small>Кол-во: {task.orderItem.quantity} · Статус: {task.status}
            {task.assignedToId===user.id?' · Назначено вам':''}</small>
        </div>)}
      </section>
      <section className="adm-card operations-panel">
        <FulfillmentUpload orderId={order.id} enabled={enabled}/>
        <h2><FileText size={18}/> Прикреплённые материалы</h2>
        {!order.deliveries.length&&<p className="adm-note">Файлы ещё не загружены.</p>}
        {order.deliveries.map(asset=><div className="adm-worker-task" key={asset.id}>
          <strong>{asset.originalName}</strong>
          <small>{(asset.bytes/1024).toFixed(1)} КБ · {asset.createdAt.toLocaleString('ru-RU')}</small>
        </div>)}
      </section>
    </div>
  </>;
}
