'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ClipboardList,ArrowUpRight,CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Status='OPEN'|'IN_PROGRESS'|'BLOCKED'|'DONE';
type QueueItem={
  id:string;orderId:string;orderStatus:string;status:Status;name:string;variant:string|null;
  quantity:number;assignedTo:string|null;assignedToId:string|null;createdAt:string
};
const labels:Record<Status,string>={
  OPEN:'Ожидает',IN_PROGRESS:'В работе',BLOCKED:'Приостановлена',DONE:'Выполнена'
};
export default function OrderQueue({initial,actorId,total,canViewOrders=false}:{
  initial:QueueItem[];actorId:string;total:number;canViewOrders?:boolean
}){
  const [items,setItems]=useState(initial);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  const router=useRouter();
  async function update(task:QueueItem,status:Status,assignee?:string|null){
    if(busy)return;
    setBusy(task.id);setMessage('');
    try{
      const response=await fetch('/api/admin/orders/actions',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'task',orderId:task.orderId,taskId:task.id,status,
          ...(assignee!==undefined?{assignedToId:assignee}:{})
        })
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось обновить');
      setItems(list=>list.map(t=>t.id===task.id?{
        ...t,status,
        ...(assignee!==undefined?{assignedToId:assignee,assignedTo:assignee?'Вы':null}:{})
      }:t));
      router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(null);}
  }
  return <>
    <div className="adm-head"><div><div className="adm-eyebrow">FULFILLMENT / ОЧЕРЕДЬ</div>
      <h1>Очередь исполнения</h1>
      <p>Открытые позиции заказов, их ответственные и статус. Задач в очереди: {total}.</p>
    </div>{canViewOrders&&<Link href="/admin/orders" className="adm-btn">Заказы <ArrowUpRight size={16}/></Link>}</div>
    {message&&<div className="adm-alert" role="alert">{message}</div>}
    <div className="adm-hint">Задачи создаются только после проверенного платёжного события. Sandbox доступен исключительно для локального тестирования.</div>
    <section className="adm-card">
      {!items.length?<div className="adm-empty-large"><CheckCircle2 size={40}/>
        <h3>Очередь пуста</h3><p>Нет позиций, ожидающих обработки.</p></div>:
      <div className="adm-queue-list">{items.map(item=>{
        const canAct=['PAID','PROCESSING'].includes(item.orderStatus);
        return <article className="adm-queue-row" key={item.id}>
          <div className="adm-queue-icon"><ClipboardList size={20}/></div>
          <div className="adm-queue-description">
            <strong>{item.name}{item.variant?' · '+item.variant:''}</strong>
            <small>Количество: {item.quantity} · Заказ #{item.orderId.slice(-8)}
              {item.assignedTo?' · Исполнитель: '+item.assignedTo:''}</small>
            {canViewOrders&&<Link href={'/admin/orders?q='+encodeURIComponent(item.orderId)}>
              Открыть заказ <ArrowUpRight size={13}/></Link>}
            {(canViewOrders||item.assignedToId===actorId)&&<Link href={'/admin/queue/'+item.orderId}>
              Материалы заказа <ArrowUpRight size={13}/></Link>}
          </div>
          <div className="adm-queue-controls">
            <select className="adm-field" value={item.status}
              aria-label={'Статус задачи '+item.name}
              disabled={busy!==null||!canAct||(!canViewOrders&&item.assignedToId!==actorId)}
              onChange={e=>update(item,e.target.value as Status)}>
              {Object.entries(labels).map(([value,label])=>
                <option value={value} key={value}>{label}</option>)}
            </select>
            <button className="adm-btn" disabled={busy!==null||!canAct||(!canViewOrders&&!!item.assignedToId&&item.assignedToId!==actorId)}
              onClick={()=>update(item,item.status,item.assignedToId===actorId?null:actorId)}>
              {item.assignedToId===actorId?'Освободить':'Взять'}
            </button>
          </div>
        </article>;
      })}</div>}
    </section>
  </>;
}
