'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Bell,Check,ArrowUpRight } from 'lucide-react';

type Notification={id:string;orderId:string;title:string;body:string;createdAt:string;readAt:string|null};

export default function NotificationInbox({initial}:{initial:Notification[]}){
  const [items,setItems]=useState(initial);
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState('');
  async function mark(id:string){
    if(busy)return;
    setBusy(id);setError('');
    try{
      const response=await fetch('/api/me/notifications',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось прочитать уведомление');
      setItems(current=>current.map(item=>item.id===id?{...item,readAt:new Date().toISOString()}:item));
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(null);}
  }
  const unread=items.filter(i=>!i.readAt).length;
  return <section className="account-panel">
    <div className="notice-header"><div><h2><Bell size={21}/> Уведомления</h2><p className="muted">Непрочитанных: {unread}. Сообщения доступны только в личном кабинете.</p></div></div>
    {error&&<div className="account-error" role="alert">{error}</div>}
    {!items.length?<div className="notice-empty">Уведомлений пока нет.</div>:
      <div className="notice-list">{items.map(item=><article key={item.id}
        className={'notice-item'+(!item.readAt?' unread':'')}>
        <div className="notice-item-copy"><div className="notice-item-top">
          <strong>{item.title}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time>
        </div><p>{item.body}</p><Link href={'/account/orders/'+item.orderId}>
          Открыть заказ <ArrowUpRight size={14}/></Link></div>
        {!item.readAt&&<button className="account-out" disabled={busy!==null}
          onClick={()=>mark(item.id)}><Check size={16}/> Прочитано</button>}
      </article>)}</div>}
  </section>;
}
