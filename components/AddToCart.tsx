'use client';
import { useState } from 'react';
type Item={productId:string;name:string;priceKopecks:number;quantity:number};
const KEY='standoffshop_cart_v1';
export default function AddToCart({productId,name,priceKopecks}:{productId:string;name:string;priceKopecks:number}){const [added,setAdded]=useState(false);function add(){try{const current=JSON.parse(localStorage.getItem(KEY)||'[]') as Item[];const items=Array.isArray(current)?current:[];const found=items.find(x=>x.productId===productId);if(found)found.quantity=Math.min(20,found.quantity+1);else items.push({productId,name,priceKopecks,quantity:1});localStorage.setItem(KEY,JSON.stringify(items));setAdded(true);window.dispatchEvent(new Event('cart-updated'));}catch{setAdded(false);}}return <button className="button" onClick={add}>{added?'Добавлено ✓':'В корзину +'}</button>;}
