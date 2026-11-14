'use client';
import {useState} from 'react';
import {Heart} from 'lucide-react';
import Link from 'next/link';

export default function FavoriteButton({productId,initial=false,signedIn=false}:{
  productId:string;initial?:boolean;signedIn?:boolean
}){
  const [selected,setSelected]=useState(initial),[busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  if(!signedIn)return <Link className="favorite-button" href="/account" title="Войдите, чтобы сохранять товары">
    <Heart size={18}/> В избранное — войти
  </Link>;
  async function toggle(){
    if(busy)return;
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/me/favorites',{
        method:selected?'DELETE':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({productId})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось обновить избранное');
      setSelected(Boolean(data.favorite));
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);}
  }
  return <div className="favorite-control">
    <button className={'favorite-button'+(selected?' selected':'')} type="button"
      aria-pressed={selected} disabled={busy} onClick={toggle}>
      <Heart size={18} fill={selected?'currentColor':'none'}/>
      {selected?'В избранном':'Добавить в избранное'}
    </button>
    {error&&<small role="alert">{error}</small>}
  </div>;
}
