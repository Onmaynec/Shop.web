'use client';
import { useEffect,useState,type FormEvent,type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search,ChevronDown,ChevronUp,ReceiptText,ArrowUpRight,UploadCloud,LockKeyhole,MessageSquare,FileText,Check,UserRound,RefreshCcw } from 'lucide-react';

type Status='PENDING_PAYMENT'|'PAID'|'PROCESSING'|'FULFILLED'|'CANCELLED'|'REFUNDED';
type TaskStatus='OPEN'|'IN_PROGRESS'|'BLOCKED'|'DONE';
type Task={id:string;status:TaskStatus;assignedToId:string|null;assignedTo:string|null;name:string;variant:string|null;quantity:number};
type Delivery={id:string;originalName:string;bytes:number;releasedAt:string|null;revokedAt:string|null};
type Activity={id:string;kind:string;visibility:'STAFF'|'CUSTOMER';title:string;message:string|null;author:string|null;createdAt:string};
type Order={
  id:string;email:string;userId:string|null;status:Status;totalKopecks:number;createdAt:string;
  items:{id:string;name:string;unitPriceKopecks:number;quantity:number;sku:string|null;variant:string|null}[];
  paymentEvents:{id:string;type:string;provider:string;amountKopecks:number;createdAt:string}[];
  tasks:Task[];activities:Activity[];deliveries:Delivery[];
};
const labels:Record<Status,string>={
  PENDING_PAYMENT:'Ожидает оплаты',PAID:'Оплачен',PROCESSING:'В обработке',
  FULFILLED:'Выполнен',CANCELLED:'Отменён',REFUNDED:'Возврат'
};
const taskLabels:Record<TaskStatus,string>={
  OPEN:'Ожидает',IN_PROGRESS:'В работе',BLOCKED:'Остановлена',DONE:'Выполнена'
};
const actions:Partial<Record<Status,{next:'CANCELLED'|'PROCESSING'|'FULFILLED';label:string}>>={
  PENDING_PAYMENT:{next:'CANCELLED',label:'Отменить заказ'},
  PAID:{next:'PROCESSING',label:'Начать обработку'},
  PROCESSING:{next:'FULFILLED',label:'Завершить выполнение'}
};
const money=(v:number)=>(v/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

export default function OrderManager({
  initialOrders,total,query,filterStatus,sandboxEnabled,actorId
}:{
  initialOrders:Order[];total:number;query:string;filterStatus:string;
  sandboxEnabled:boolean;actorId:string
}){
  const router=useRouter();
  const [orders,setOrders]=useState(initialOrders);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [search,setSearch]=useState(query),[status,setStatus]=useState(filterStatus);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState<{text:string;ok:boolean}|null>(null);
  const [note,setNote]=useState('');
  const [audience,setAudience]=useState<'STAFF'|'CUSTOMER'>('STAFF');
  useEffect(()=>{
    setOrders(initialOrders);setSearch(query);setStatus(filterStatus);
  },[initialOrders,query,filterStatus]);

  function filter(event:FormEvent){
    event.preventDefault();
    const p=new URLSearchParams();
    if(search.trim())p.set('q',search.trim());
    if(status)p.set('status',status);
    router.push('/admin/orders'+(p.size?'?'+p.toString():''));
  }
  async function json(url:string,method:'POST'|'PATCH',body:unknown){
    const response=await fetch(url,{
      method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.error||'Не удалось выполнить операцию');
    return data;
  }
  async function change(order:Order){
    const action=actions[order.status];if(!action||busy)return;
    const done=order.tasks.length>0&&order.tasks.every(t=>t.status==='DONE');
    if(action.next==='FULFILLED'&&!done){
      setMessage({text:'Сначала завершите все задачи по позициям заказа.',ok:false});return;
    }
    if(!confirm(action.label+' для заказа #'+order.id.slice(-8)+'?'))return;
    setBusy(order.id);setMessage(null);
    try{
      await json('/api/admin/orders','PATCH',{id:order.id,status:action.next});
      setOrders(current=>current.map(o=>o.id===order.id?{...o,status:action.next}:o));
      setMessage({text:'Статус заказа изменён',ok:true});
      router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка',ok:false});}
    finally{setBusy(null);}
  }
  async function sandboxAction(order:Order,operation:'pay'|'refund'){
    if(!sandboxEnabled||busy)return;
    if(!confirm((operation==='pay'?'Подтвердить тестовую оплату':'Симулировать возврат')+
      '? В тестовом режиме деньги не переводятся.'))return;
    setBusy(order.id);setMessage(null);
    try{
      await json('/api/admin/sandbox/payments','POST',{orderId:order.id,operation});
      setOrders(current=>current.map(o=>o.id===order.id?{
        ...o,status:operation==='pay'?'PAID':'REFUNDED'
      }:o));
      setMessage({text:'Тестовая операция выполнена. Обновлены задачи и история заказа.',ok:true});
      router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка sandbox',ok:false});}
    finally{setBusy(null);}
  }
  async function prepare(order:Order){
    setBusy(order.id);setMessage(null);
    try{
      const data=await json('/api/admin/orders/actions','POST',{
        action:'prepare',orderId:order.id
      });
      setMessage({text:'Задач создано: '+data.created,ok:true});router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка',ok:false});}
    finally{setBusy(null);}
  }
  async function taskAction(order:Order,task:Task,desired:TaskStatus,assignee?:string|null){
    if(busy)return;
    setBusy(order.id);setMessage(null);
    try{
      await json('/api/admin/orders/actions','POST',{
        action:'task',orderId:order.id,taskId:task.id,status:desired,
        ...(assignee!==undefined?{assignedToId:assignee}:{})
      });
      setOrders(current=>current.map(o=>o.id!==order.id?o:{
        ...o,tasks:o.tasks.map(t=>t.id===task.id?{
          ...t,status:desired,
          ...(assignee!==undefined?{assignedToId:assignee,assignedTo:assignee?'Вы':''}:{})
        }:t)
      }));
      setMessage({text:'Задача обновлена',ok:true});router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка',ok:false});}
    finally{setBusy(null);}
  }
  async function sendNote(event:FormEvent<HTMLFormElement>,order:Order){
    event.preventDefault();if(busy||!note.trim())return;
    setBusy(order.id);setMessage(null);
    try{
      await json('/api/admin/orders/actions','POST',{
        action:'note',orderId:order.id,visibility:audience,message:note.trim()
      });
      setNote('');setMessage({text:audience==='CUSTOMER'
        ?'Сообщение появилось в личном кабинете покупателя'
        :'Внутренняя заметка сохранена',ok:true});
      router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка',ok:false});}
    finally{setBusy(null);}
  }
  async function upload(event:ChangeEvent<HTMLInputElement>,order:Order){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||busy)return;
    setBusy(order.id);setMessage(null);
    try{
      const form=new FormData();form.set('file',file);
      const response=await fetch('/api/admin/orders/'+order.id+'/deliveries',{method:'POST',body:form});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось загрузить файл');
      setMessage({text:'Материал загружен приватно, но ещё НЕ доступен покупателю.',ok:true});
      router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка загрузки',ok:false});}
    finally{setBusy(null);}
  }
  async function deliveryAction(order:Order,asset:Delivery,action:'release'|'revoke'){
    if(busy)return;
    if(!confirm((action==='release'?'Открыть скачивание':'Отозвать доступ')+
      ' к файлу «'+asset.originalName+'»?'))return;
    setBusy(order.id);setMessage(null);
    try{
      await json('/api/admin/orders/'+order.id+'/deliveries','PATCH',{
        action,deliveryId:asset.id
      });
      setMessage({text:action==='release'?'Файл доступен владельцу заказа':'Доступ к файлу отозван',ok:true});
      router.refresh();
    }catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка',ok:false});}
    finally{setBusy(null);}
  }

  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">ORDER MANAGEMENT / ОБРАБОТКА</div>
      <h1>Заказы</h1>
      <p>Исполнение, события, задачи и сообщения. Найдено: {total}.</p>
    </div><Link href="/admin/queue" className="adm-btn"><RefreshCcw size={17}/> Очередь задач <ArrowUpRight size={15}/></Link></div>
    <div className="adm-hint" style={{margin:'0 0 18px'}}>
      <LockKeyhole size={17}/> Реальный эквайринг не подключён. Работу можно начать только после подтверждённой оплаты.
      {sandboxEnabled?' Доступен отдельный тестовый sandbox без реального списания.':''}
    </div>
    {message&&<div className={'adm-alert'+(message.ok?' ok':'')} role="status">{message.text}</div>}
    <form className="adm-toolbar" onSubmit={filter}>
      <input className="adm-field adm-search" placeholder="Номер заказа или email..."
        value={search} onChange={e=>setSearch(e.target.value)}/>
      <select className="adm-field adm-filter" value={status} aria-label="Статус заказа"
        onChange={e=>setStatus(e.target.value)}>
        <option value="">Все статусы</option>
        {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select><button className="adm-btn"><Search size={17}/> Найти</button>
    </form>
    <section className="adm-card">
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Заказ</th><th>Покупатель</th><th>Создан</th><th>Сумма</th><th>Статус</th><th>Задачи</th><th>Детали</th></tr></thead>
        <tbody>{orders.map(order=><tr key={order.id}>
          <td><strong className="adm-id">#{order.id.slice(-8)}</strong></td>
          <td>{order.email}</td>
          <td>{new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
          <td>{money(order.totalKopecks)}</td>
          <td><span className={'adm-status '+order.status.toLowerCase()}>{labels[order.status]}</span></td>
          <td className="adm-order-tasks-count">
            {order.tasks.filter(t=>t.status==='DONE').length}/{order.tasks.length}
          </td>
          <td><button className="adm-icon-btn" aria-label={'Детали заказа '+order.id.slice(-8)}
            aria-expanded={expanded===order.id} onClick={()=>{
              setExpanded(expanded===order.id?null:order.id);setNote('');
            }}>{expanded===order.id?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button></td>
        </tr>)}</tbody>
      </table>
      {!orders.length&&<div className="adm-empty-large"><ReceiptText size={40}/>
        <h3>Заказы не найдены</h3><p>Измените фильтры или дождитесь нового заказа.</p>
      </div>}</div>

      {orders.filter(o=>o.id===expanded).map(order=>{
        const done=order.tasks.length>0&&order.tasks.every(t=>t.status==='DONE');
        const active=['PAID','PROCESSING'].includes(order.status);
        return <div key={order.id} className="adm-detail adm-order-workspace">
          <div className="adm-overline">ЗАКАЗ {order.id} · {new Date(order.createdAt).toLocaleString('ru-RU')}</div>
          <h3>Состав заказа</h3>
          <ul>{order.items.map(item=><li key={item.id}>
            {item.name}{item.variant?' · '+item.variant:''}
            {item.sku?' (SKU: '+item.sku+')':''} — {item.quantity} × {money(item.unitPriceKopecks)}
          </li>)}</ul>
          <strong>Итого: {money(order.totalKopecks)}</strong>
          {!order.userId&&<div className="adm-hint">Гостевой заказ: покупатель не сможет скачать закрытые материалы через личный кабинет без привязки заказа к аккаунту.</div>}

          <div className="adm-detail-actions adm-order-actions">
            {sandboxEnabled&&order.status==='PENDING_PAYMENT'&&
              <button className="adm-btn primary" disabled={busy===order.id}
                onClick={()=>sandboxAction(order,'pay')}>SANDBOX · Оплатить (тест)</button>}
            {sandboxEnabled&&['PAID','PROCESSING','FULFILLED'].includes(order.status)&&
              <button className="adm-btn" disabled={busy===order.id}
                onClick={()=>sandboxAction(order,'refund')}>SANDBOX · Вернуть (тест)</button>}
            {active&&order.tasks.length===0&&
              <button className="adm-btn" disabled={busy===order.id}
                onClick={()=>prepare(order)}>Сформировать задачи</button>}
            {actions[order.status]&&
              <button className={'adm-btn'+(order.status==='PENDING_PAYMENT'?' danger':'')}
                disabled={busy===order.id||(order.status==='PROCESSING'&&!done)}
                title={order.status==='PROCESSING'&&!done?'Сначала завершите задачи':''}
                onClick={()=>change(order)}>
                {busy===order.id?'Выполняется...':actions[order.status]?.label}
              </button>}
          </div>

          <div className="adm-order-columns">
            <section className="adm-order-section">
              <h3><UserRound size={18}/> Очередь исполнения</h3>
              {!order.tasks.length?<p className="adm-note">Задачи появятся после подтверждения оплаты.</p>:
                <div className="adm-task-list">{order.tasks.map(task=><div className="adm-task" key={task.id}>
                  <div className="adm-task-head"><strong>{task.name}{task.variant?' · '+task.variant:''}</strong>
                    <span className="adm-status">{taskLabels[task.status]}</span></div>
                  <small>Количество: {task.quantity}. {task.assignedTo?'Исполнитель: '+task.assignedTo:'Не назначено'}</small>
                  <div className="adm-task-controls">
                    <select className="adm-field" aria-label={'Статус задачи '+task.name}
                      disabled={busy!==null||!active}
                      value={task.status}
                      onChange={e=>taskAction(order,task,e.target.value as TaskStatus)}>
                      {Object.entries(taskLabels).map(([value,label])=>
                        <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="adm-btn" disabled={busy!==null||!active}
                      onClick={()=>taskAction(order,task,task.status,
                        task.assignedToId===actorId?null:actorId)}>
                      {task.assignedToId===actorId?'Освободить':'Взять'}
                    </button>
                  </div>
                </div>)}</div>}
            </section>
            <section className="adm-order-section">
              <h3><FileText size={18}/> Материалы заказа</h3>
              <p className="adm-note">Файлы хранятся приватно. До выполнения заказа они недоступны покупателю.</p>
              {active&&<label className="adm-btn adm-upload-delivery"><UploadCloud size={16}/>
                Загрузить PDF, PNG, JPG или TXT (до 4 МБ)
                <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.txt"
                  disabled={busy!==null} onChange={e=>upload(e,order)}/>
              </label>}
              <div className="adm-delivery-list">{order.deliveries.map(asset=>
                <div className="adm-delivery" key={asset.id}>
                  <div><strong>{asset.originalName}</strong><small>
                    {(asset.bytes/1024).toFixed(1)} КБ ·
                    {asset.revokedAt?' Доступ отозван':asset.releasedAt?' Доступен покупателю':' Ожидает публикации'}
                  </small></div>
                  {!asset.revokedAt&&
                    <button className="adm-btn" disabled={busy!==null||(!asset.releasedAt&&order.status!=='FULFILLED')}
                      onClick={()=>deliveryAction(order,asset,asset.releasedAt?'revoke':'release')}>
                      {asset.releasedAt?'Отозвать':'Опубликовать'}
                    </button>}
                </div>)}</div>
            </section>
          </div>

          <div className="adm-order-columns">
            <section className="adm-order-section">
              <h3><MessageSquare size={18}/> Комментарии и сообщения</h3>
              <form className="adm-note-form" onSubmit={e=>sendNote(e,order)}>
                <label>Видимость<select className="adm-field" value={audience}
                  onChange={e=>setAudience(e.target.value as 'STAFF'|'CUSTOMER')}>
                  <option value="STAFF">Только сотрудники</option>
                  <option value="CUSTOMER">Сообщение покупателю в кабинете</option>
                </select></label>
                <label>Текст<textarea className="adm-field" maxLength={2000} required minLength={2}
                  value={note} onChange={e=>setNote(e.target.value)}
                  placeholder="Уточнение к заказу, инструкция, результат обработки..."/></label>
                <button className="adm-btn primary" disabled={busy!==null||!note.trim()}>
                  <Check size={16}/> {audience==='STAFF'?'Сохранить заметку':'Отправить в кабинет'}</button>
              </form>
            </section>
            <section className="adm-order-section">
              <h3><ReceiptText size={18}/> История операций</h3>
              <div className="adm-order-timeline">{order.activities.map(item=>
                <div key={item.id} className="adm-order-event">
                  <span>{new Date(item.createdAt).toLocaleString('ru-RU')}
                    {' · '}{item.visibility==='STAFF'?'Сотрудники':'Покупатель'}</span>
                  <strong>{item.title}</strong>
                  {item.message&&<p>{item.message}</p>}
                  {item.author&&<small>Автор: {item.author}</small>}
                </div>)}</div>
              {order.paymentEvents.length>0&&<div className="adm-payment-ledger">
                <h4>Платёжные события</h4>
                {order.paymentEvents.map(event=><div className="adm-payment-event" key={event.id}>
                  <span>{event.type}</span><small>{event.provider} · {money(event.amountKopecks)}</small>
                </div>)}
              </div>}
            </section>
          </div>
        </div>;
      })}
    </section>
  </>;
}
