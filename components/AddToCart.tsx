'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag, ArrowUpRight } from 'lucide-react';

type Item = { productId: string; name: string; priceKopecks: number; quantity: number };
const CART_KEY = 'standoffshop_cart_v1';
const CHECKOUT_KEY = 'standoffshop_checkout_key_v1';

export default function AddToCart({productId,name,priceKopecks}:{productId:string;name:string;priceKopecks:number}) {
  const [added,setAdded] = useState(false);
  const [error,setError] = useState('');

  function add() {
    setError('');
    try {
      const parsed=JSON.parse(localStorage.getItem(CART_KEY)||'[]');
      const items:Item[]=Array.isArray(parsed)?parsed:[];
      const found=items.find(item=>item.productId===productId);
      if(found){found.quantity=Math.min(20,found.quantity+1);}
      else{items.push({productId,name,priceKopecks,quantity:1});}
      localStorage.setItem(CART_KEY,JSON.stringify(items));
      localStorage.removeItem(CHECKOUT_KEY);
      window.dispatchEvent(new Event('cart-updated'));
      setAdded(true);
    }catch {
      setError('Не удалось обновить корзину. Проверьте разрешение на локальное хранение данных.');
    }
  }

  return <div className="add-to-cart">
    <button className="button button-light" type="button" onClick={add} aria-live="polite">
      {added?<Check size={17}/>:<ShoppingBag size={17}/>}
      {added?'Добавлено в корзину':'Добавить в корзину'}
    </button>
    {added&&<Link href="/cart" className="button button-ghost">Перейти к заказу <ArrowUpRight size={16}/></Link>}
    {error&&<p className="account-error" role="alert">{error}</p>}
  </div>;
}
