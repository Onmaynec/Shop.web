'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronDown, ChevronUp, ReceiptText } from 'lucide-react';
type Status='PENDING_PAYMENT'|'PAID'|'PROCESSING'|'FULFILLED'|'CANCELLED'|'REFUNDED';
type Order={id:string;email:string;status:Status;totalKopecks:number;createdAt:string;items:{id:string;name:string;unitPriceKopecks:number;quantity:number}[]};
const labels:Record<Status,string>={PENDING_PAYMENT:'Ожидает оплаты',PAID:'Оплачен',PROCESSING:'В обработке',FULFILLED:'Выполнен',CANCELLED:'Отменён',REFUNDED:'Возврат'};
const actions:Partial<Record<Status,{next:'CANCELLED'|'PROCESSING'|'FULFILLED';label:string}>>={PENDING_PAYMENT:{next:'CANCELLED',label:'Отменить заказ'},PAID:{next:'PROCESSING',label:'Начать обработку'},PROCESSING:{next:'FULFILLED',label:'Завершить выполнение'}};
const money=(v:number)=>(v/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
export default function OrderManager({initialOrders,total,query,filterStatus}:{initialOrders:Order[];total:number;query:string;filterStatus:string}){
 const router=useRouter();const [items,setItems]=useState(initialOrders);const [expanded,setExpanded]=useState<string|null>(null);
 const [search,setSearch]=useState(query);const [status,setStatus]=useState(filterStatus);
 useEffect(()=>{setItems(initialOrders);setSearch(query);setStatus(filterStatus);},[initialOrders,query,filterStatus]);
 const [busy,setBusy]=useState<string|null>(null);const [message,setMessage]=useState<{text:string;ok:boolean}|null>(null);
 function filter(e:FormEvent){e.preventDefault();const p=new URLSearchParams();if(search.trim())p.set('q',search.trim());if(status)p.set('status',status);router.push('/admin/orders'+(p.size?'?'+p.toString():''));}
 async function change(o:Order){const action=actions[o.status];if(!action)return;if(!confirm(action.label+' для заказа #'+o.id.slice(-8)+'?'))return;
 setBusy(o.id);setMessage(null);try{const response=await fetch('/api/admin/orders',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:o.id,status:action.next})});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Не удалось изменить заказ');setItems(current=>current.map(x=>x.id===o.id?{...x,status:action.next}:x));setMessage({text:'Статус заказа обновлён',ok:true});router.refresh();}catch(e){setMessage({text:e instanceof Error?e.message:'Ошибка сервера',ok:false});}finally{setBusy(null);}}
 return <><div className="adm-head"><div><div className="adm-eyebrow">ПРОДАЖИ / ИСТОРИЯ</div><h1>Заказы</h1><p>Просмотр заявок и безопасное изменение статусов. Найдено: {total}.</p></div></div>
 <div className="adm-hint" style={{margin:'0 0 18px'}}>Эквайринг не подключён. Подтверждение оплаты недоступно — заказы нельзя вручную сделать оплаченными или выполненными без предшествующей оплаты.</div>
 {message&&<div className={'adm-alert'+(message.ok?' ok':'')} role="status">{message.text}</div>}
 <form className="adm-toolbar" onSubmit={filter}><input className="adm-field adm-search" placeholder="Номер заказа или email..." value={search} onChange={e=>setSearch(e.target.value)}/><select className="adm-field adm-filter" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Статус заказа"><option value="">Все статусы</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button className="adm-btn"><Search size={17}/> Найти</button></form>
 <section className="adm-card"><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Заказ</th><th>Покупатель</th><th>Создан</th><th>Сумма</th><th>Статус</th><th>Детали</th></tr></thead><tbody>{items.map(o=><tr key={o.id}><td><strong className="adm-id">#{o.id.slice(-8)}</strong></td><td>{o.email}</td><td>{new Date(o.createdAt).toLocaleDateString('ru-RU')}</td><td>{money(o.totalKopecks)}</td><td><span className={'adm-status '+o.status.toLowerCase()}>{labels[o.status]}</span></td><td><button className="adm-icon-btn" aria-label="Показать детали" onClick={()=>setExpanded(expanded===o.id?null:o.id)}>{expanded===o.id?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button></td></tr>)}</tbody></table>
 {items.length===0&&<div className="adm-empty-large"><ReceiptText size={40}/><h3>Заказы не найдены</h3><p>Измените фильтр или дождитесь нового заказа.</p></div>}
 </div>
 {items.filter(o=>o.id===expanded).map(o=><div key={o.id} className="adm-detail"><div className="adm-overline">ЗАКАЗ {o.id} · {new Date(o.createdAt).toLocaleString('ru-RU')}</div><h3>Состав заказа</h3><ul>{o.items.map(i=><li key={i.id}>{i.name} — {i.quantity} × {money(i.unitPriceKopecks)}</li>)}</ul><strong>Итого: {money(o.totalKopecks)}</strong><div className="adm-detail-actions" style={{marginTop:20}}>{actions[o.status]?<button className={'adm-btn'+(o.status==='PENDING_PAYMENT'?' danger':'')} disabled={busy===o.id} onClick={()=>change(o)}>{busy===o.id?'Обрабатываем...':actions[o.status]?.label}</button>:<span className="adm-overline">Дальнейшие ручные переходы недоступны</span>}</div></div>)}
 </section></>;
}
