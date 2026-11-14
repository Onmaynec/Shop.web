'use client';
import {useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {Send,Check,Lock,UserCheck,RotateCcw} from 'lucide-react';

type Msg={id:string;body:string;internal:boolean;author:string;createdAt:string;mine:boolean};
type Status='OPEN'|'WAITING_CUSTOMER'|'CLOSED';
type Priority='LOW'|'NORMAL'|'HIGH';

export default function SupportThread({ticketId,messages,staff=false,status:startingStatus,
  priority:startingPriority='NORMAL',assignedToId=null,actorId=''}:{
  ticketId:string;messages:Msg[];staff?:boolean;status:Status;priority?:Priority;
  assignedToId?:string|null;actorId?:string
}){
  const router=useRouter();
  const [body,setBody]=useState(''),[internal,setInternal]=useState(false);
  const [status,setStatus]=useState(startingStatus),[priority,setPriority]=useState(startingPriority);
  const [assignee,setAssignee]=useState(assignedToId);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const closed=status==='CLOSED';
  async function post(event:FormEvent){
    event.preventDefault();if(busy||closed)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/support/tickets/'+ticketId+'/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:body,internal:staff&&internal})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось отправить сообщение');
      setBody('');setNotice('Сообщение сохранено.');
      if(!staff)setStatus('OPEN');else if(!internal)setStatus('WAITING_CUSTOMER');
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);}
  }
  async function manage(input:{status?:Status;priority?:Priority;assignedToId?:string|null}){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/support/'+ticketId,{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось обновить обращение');
      if(data.status)setStatus(data.status);
      if(data.priority)setPriority(data.priority);
      setAssignee(data.assignedToId??null);
      setNotice('Изменения сохранены.');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);}
  }
  return <div className="support-thread-wrap">
    {staff&&<section className="support-tools">
      <div className="support-card-heading"><UserCheck size={18}/><h2>Обработка обращения</h2></div>
      <div className="support-tools-controls">
        <label>Статус
          <select disabled={busy} value={status} onChange={e=>manage({status:e.target.value as Status})}>
            <option value="OPEN">Открыт</option>
            <option value="WAITING_CUSTOMER">Ожидает покупателя</option>
            <option value="CLOSED">Закрыт</option>
          </select>
        </label>
        <label>Приоритет
          <select disabled={busy} value={priority} onChange={e=>manage({priority:e.target.value as Priority})}>
            <option value="LOW">Низкий</option><option value="NORMAL">Обычный</option>
            <option value="HIGH">Высокий</option>
          </select>
        </label>
        <button type="button" className="adm-btn" disabled={busy} onClick={()=>manage({
          assignedToId:assignee===actorId?null:actorId
        })}>{assignee===actorId?'Снять с себя':'Взять в работу'}</button>
        {closed&&<button type="button" className="adm-btn" disabled={busy}
          onClick={()=>manage({status:'OPEN'})}><RotateCcw size={15}/> Переоткрыть</button>}
      </div>
    </section>}
    <section className="support-thread">
      <div className="support-card-heading"><h2>Переписка</h2><span>{messages.length} сообщений</span></div>
      <div className="support-messages" aria-live="polite">
        {messages.map(m=><article key={m.id} className={'support-message'+(m.mine?' mine':'')+(m.internal?' internal':'')}>
          <div className="support-message-meta">
            <strong>{m.internal?<><Lock size={13}/> Внутренняя заметка</>:m.author}</strong>
            <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString('ru-RU')}</time>
          </div>
          <p>{m.body}</p>
        </article>)}
      </div>
      {closed?<p className="support-hint">Обращение закрыто. Новые сообщения недоступны.</p>:
        <form onSubmit={post} className="support-reply-form">
          <label>Ответ
            <textarea required minLength={2} maxLength={4000} rows={4}
              value={body} onChange={e=>setBody(e.target.value)}
              placeholder={staff?'Напишите ответ покупателю или заметку...':'Напишите уточнение для поддержки...'}/>
          </label>
          {staff&&<label className="support-internal-toggle">
            <input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/>
            <Lock size={14}/> Внутренняя заметка — покупатель не увидит</label>}
          <button type="submit" className={staff?'adm-btn primary':'button button-light'} disabled={busy}>
            <Send size={16}/> {busy?'Отправляем...':'Отправить'}
          </button>
        </form>}
    </section>
    {error&&<p className="account-error" role="alert">{error}</p>}
    {notice&&<p className="support-success" role="status"><Check size={16}/>{notice}</p>}
  </div>;
}
