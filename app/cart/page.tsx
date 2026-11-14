'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ShoppingBag, Trash2, Minus, Plus, LockKeyhole, CheckCircle2, ArrowRight } from 'lucide-react';

type CartItem = {productId:string;variantId?:string|null;name:string;priceKopecks:number;quantity:number};
const keyFor=(item:CartItem)=>item.productId+'|'+(item.variantId||'base');
type CompletedOrder = {id:string;status:string;totalKopecks:number;reused:boolean};
const CART_KEY='standoffshop_cart_v1';
const REQUEST_KEY='standoffshop_checkout_key_v1';
const money=(v:number)=>(v/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

export default function Cart(){
  const [items,setItems]=useState<CartItem[]>([]);
  const [email,setEmail]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [completed,setCompleted]=useState<CompletedOrder|null>(null);

  useEffect(()=>{
    try{
      const data=JSON.parse(localStorage.getItem(CART_KEY)||'[]');
      if(Array.isArray(data))setItems(data.filter(i=>
        typeof i.productId==='string'&&(i.variantId===undefined||i.variantId===null||typeof i.variantId==='string')&&typeof i.name==='string'&&
        Number.isInteger(i.priceKopecks)&&i.priceKopecks>=0&&
        Number.isInteger(i.quantity)&&i.quantity>=1&&i.quantity<=20
      ));
    }catch{}
  },[]);

  function save(next:CartItem[]){
    setItems(next);
    localStorage.setItem(CART_KEY,JSON.stringify(next));
    localStorage.removeItem(REQUEST_KEY);
    window.dispatchEvent(new Event('cart-updated'));
  }

  async function checkout(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(busy||items.length===0)return;
    setBusy(true);setMessage('');
    let idempotencyKey=localStorage.getItem(REQUEST_KEY);
    if(!idempotencyKey){
      idempotencyKey=crypto.randomUUID();
      localStorage.setItem(REQUEST_KEY,idempotencyKey);
    }
    try {
      const response=await fetch('/api/orders',{
        method:'POST',
        headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
        body:JSON.stringify({
          email:email.trim(),
          items:items.map(({productId,variantId,quantity})=>({productId,variantId:variantId||null,quantity}))
        })
      });
      const data=await response.json().catch(()=>null);
      if(!data)throw Error('Сервер не ответил корректно. Повторная попытка не создаст новый заказ.');
      if(!response.ok) {
        if(response.status===409)localStorage.removeItem(REQUEST_KEY);
        throw Error(data.error||'Не удалось создать заказ');
      }
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(REQUEST_KEY);
      setCompleted({...data.order,reused:!!data.reused});
      setItems([]);
    }catch(err){
      setMessage(err instanceof Error?err.message:'Ошибка соединения');
    }finally{setBusy(false);}
  }

  const subtotal=items.reduce((sum,i)=>sum+i.priceKopecks*i.quantity,0);
  return <main className="content cart-modern">
    <div className="eyebrow">STANDOFFSHOP / ПОКУПКИ</div>
    <h1>Ваша корзина</h1>
    <p className="muted">Проверьте состав заказа. Итоговая стоимость будет рассчитана на сервере.</p>
    {completed?
      <section className="cart-success">
        <CheckCircle2 size={42}/>
        <h2>{completed.reused?'Заказ уже был создан':'Заказ создан!'}</h2>
        <p>Номер: <strong>{completed.id}</strong></p>
        <p>Итого: <strong>{money(completed.totalKopecks)}</strong></p>
        <p>Заказ ожидает оплаты. Платёжный провайдер не подключён — деньги не списываются.</p>
        <Link className="button" href="/catalog">Вернуться в каталог <ArrowRight size={17}/></Link>
      </section>:
    items.length===0?
      <section className="cart-empty"><ShoppingBag size={46}/><h2>Здесь пока пусто</h2><p>Загляните в каталог и выберите то, что вам нужно.</p><Link href="/catalog" className="button">Перейти в каталог <ArrowRight size={17}/></Link></section>:
      <div className="cart-layout"><section className="cart-list">
        <div className="cart-panel-heading"><h2>Товары</h2><span>{items.length} позиций</span></div>
        {items.map(item=><div className="cart-item" key={keyFor(item)}>
          <div className="cart-item-icon"><ShoppingBag size={24}/></div>
          <div className="cart-item-main"><strong>{item.name}</strong><small>{money(item.priceKopecks)} за единицу (предварительно)</small></div>
          <div className="cart-quantity"><button aria-label={'Уменьшить количество '+item.name} onClick={()=>item.quantity>1&&save(items.map(i=>keyFor(i)===keyFor(item)?{...i,quantity:i.quantity-1}:i))}><Minus size={15}/></button><span>{item.quantity}</span><button aria-label={'Увеличить количество '+item.name} onClick={()=>item.quantity<20&&save(items.map(i=>i.productId===item.productId?{...i,quantity:i.quantity+1}:i))}><Plus size={15}/></button></div>
          <strong className="cart-item-total">{money(item.priceKopecks*item.quantity)}</strong>
          <button className="cart-remove" aria-label={'Удалить '+item.name} onClick={()=>save(items.filter(i=>keyFor(i)!==keyFor(item)))}><Trash2 size={17}/></button>
        </div>)}
      </section>
      <aside className="cart-checkout"><div className="cart-panel-heading"><h2>Оформление</h2></div><div className="cart-sum"><span>Предварительная сумма</span><strong>{money(subtotal)}</strong></div>
        <p className="cart-note">Окончательная сумма фиксируется по актуальным ценам каталога при создании заказа.</p>
        <form onSubmit={checkout}><label>Email для заказа<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);localStorage.removeItem(REQUEST_KEY);}} placeholder="you@example.com"/></label><button className="button" disabled={busy}>{busy?'Создаём заказ...':'Создать заказ без оплаты'} <ArrowRight size={17}/></button></form>
        <div className="cart-safe"><LockKeyhole size={16}/> Реальные платежи сейчас отключены.</div>
      </aside></div>}
    {message&&<div className="account-error" role="alert">{message}</div>}
  </main>;
}
