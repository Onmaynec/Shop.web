'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag, ArrowUpRight } from 'lucide-react';

type Variant={id:string;label:string;sku:string;priceKopecks:number};
type Item={productId:string;variantId?:string|null;name:string;priceKopecks:number;quantity:number};
const CART_KEY='standoffshop_cart_v1';
const CHECKOUT_KEY='standoffshop_checkout_key_v1';
const money=(value:number)=>(value/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

export default function AddToCart({
  productId,name,priceKopecks,variants=[]
}:{productId:string;name:string;priceKopecks:number;variants?:Variant[]}){
  const [selected,setSelected]=useState(variants[0]?.id||'');
  const [added,setAdded]=useState(false);
  const [error,setError]=useState('');
  const variant=variants.find(v=>v.id===selected);
  const effectivePrice=variant?.priceKopecks??priceKopecks;

  function add(){
    setError('');
    try{
      const parsed:unknown=JSON.parse(localStorage.getItem(CART_KEY)||'[]');
      const items:Item[]=Array.isArray(parsed)?parsed:[];
      if(variants.length&&!variant)throw new Error('Выберите вариант товара');
      const variantId=variant?.id||null;
      const found=items.find(item=>item.productId===productId&&(item.variantId||null)===variantId);
      if(found)found.quantity=Math.min(20,found.quantity+1);
      else items.push({
        productId,variantId,name:variant?name+' · '+variant.label:name,
        priceKopecks:effectivePrice,quantity:1
      });
      localStorage.setItem(CART_KEY,JSON.stringify(items));
      localStorage.removeItem(CHECKOUT_KEY);
      window.dispatchEvent(new Event('cart-updated'));
      setAdded(true);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось обновить корзину');}
  }

  return <div className="add-to-cart add-variant-cart">
    {variants.length>0&&<fieldset className="variant-fieldset">
      <legend>Выберите вариант</legend>
      <div className="variant-options">{variants.map(v=><button type="button" key={v.id}
        className={'variant-option'+(selected===v.id?' selected':'')}
        aria-pressed={selected===v.id}
        onClick={()=>{setSelected(v.id);setAdded(false);}}>
        <span>{v.label}</span><strong>{money(v.priceKopecks)}</strong>
      </button>)}</div>
    </fieldset>}
    <div className="variant-action-row">
      <button className="button button-light" type="button" onClick={add}
        aria-label={added?'Добавлено в корзину':'Добавить в корзину'}>
        {added?<Check size={17}/>:<ShoppingBag size={17}/>}
        {added?'Добавлено':'В корзину'} · {money(effectivePrice)}
      </button>
      {added&&<Link href="/cart" className="button button-ghost">Перейти к заказу <ArrowUpRight size={16}/></Link>}
    </div>
    {error&&<p className="account-error" role="alert">{error}</p>}
  </div>;
}
