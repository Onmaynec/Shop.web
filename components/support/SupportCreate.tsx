'use client';

import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Send,MessageSquarePlus} from 'lucide-react';

type OrderOption={id:string;createdAt:string};
export default function SupportCreate({orders,defaultOrder=''}:{
  orders:OrderOption[];defaultOrder?:string
}){
  const router=useRouter();
  const [subject,setSubject]=useState('');
  const [message,setMessage]=useState('');
  const [orderId,setOrderId]=useState(defaultOrder);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/support/tickets',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({subject,message,orderId:orderId||null})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось отправить обращение');
      router.push('/support/'+data.ticketId);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка создания обращения');}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="support-create">
    <div className="support-card-heading"><MessageSquarePlus size={19}/><h2>Новое обращение</h2></div>
    <label>Тема обращения
      <input required minLength={5} maxLength={120} value={subject}
        placeholder="Например: вопрос по срокам заказа"
        onChange={e=>setSubject(e.target.value)}/>
    </label>
    <label>Связанный заказ (необязательно)
      <select value={orderId} onChange={e=>setOrderId(e.target.value)}>
        <option value="">Общий вопрос без заказа</option>
        {orders.map(order=><option value={order.id} key={order.id}>
          #{order.id.slice(-8)} · {new Date(order.createdAt).toLocaleDateString('ru-RU')}
        </option>)}
      </select>
    </label>
    <label>Сообщение
      <textarea required minLength={10} maxLength={4000} rows={5} value={message}
        placeholder="Опишите вопрос подробно. Не отправляйте пароли и платёжные данные."
        onChange={e=>setMessage(e.target.value)}/>
    </label>
    <p className="support-hint">Обращения обрабатываются через сайт. Отправка писем на email пока не подключена.</p>
    {error&&<p className="account-error" role="alert">{error}</p>}
    <button className="button button-light" disabled={busy}>
      <Send size={16}/>{busy?'Отправляем...':'Создать обращение'}
    </button>
  </form>;
}
