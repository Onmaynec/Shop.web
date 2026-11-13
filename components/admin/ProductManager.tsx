'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, X, Pencil, Archive, ExternalLink, PackageOpen } from 'lucide-react';
type Product={id:string;name:string;slug:string;description:string;categoryId:string;categoryName:string;priceKopecks:number;status:'DRAFT'|'ACTIVE'|'ARCHIVED';imageUrl:string|null};
type Category={id:string;name:string};
type Draft={id?:string;name:string;slug:string;description:string;categoryId:string;price:string;status:Product['status'];imageUrl:string};
const blank=(categoryId:string):Draft=>({name:'',slug:'',description:'',categoryId,price:'',status:'DRAFT',imageUrl:''});
function messageFor(status:Product['status']){return status==='ACTIVE'?'В продаже':status==='DRAFT'?'Черновик':'Архив';}
export default function ProductManager({initialProducts,categories,total}:{initialProducts:Product[];categories:Category[];total:number}) {
  const router=useRouter();const params=useSearchParams();
  const [draft,setDraft]=useState<Draft|null>(null);const [busy,setBusy]=useState(false);
  const [notification,setNotification]=useState<{text:string;ok:boolean}|null>(null);
  const [search,setSearch]=useState(params.get('q')||'');
  const [status,setStatus]=useState(params.get('status')||'');
  const [items,setItems]=useState(initialProducts);
  function filter(e:FormEvent){e.preventDefault();const query=new URLSearchParams();if(search.trim())query.set('q',search.trim());if(status)query.set('status',status);router.push('/admin/products'+(query.size?'?'+query.toString():''));}
  function edit(p:Product){setDraft({id:p.id,name:p.name,slug:p.slug,description:p.description,categoryId:p.categoryId,price:(p.priceKopecks/100).toFixed(2),status:p.status,imageUrl:p.imageUrl||''});setNotification(null);}
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!draft||busy)return;setBusy(true);setNotification(null);
    try {
      const amount=Number(draft.price.replace(',','.'));const kopecks=Math.round(amount*100);
      if(!Number.isFinite(amount)||!Number.isSafeInteger(kopecks)||kopecks<1)throw Error('Укажите корректную цену');
      const payload={...draft,priceKopecks:kopecks};const response=await fetch('/api/admin/products',{method:draft.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({error:'Сервер вернул неверный ответ'}));
      if(!response.ok)throw Error(data.error||'Не удалось сохранить товар');
      if(draft.id){setItems(current=>current.map(p=>p.id===data.product.id?{...data.product,categoryName:categories.find(c=>c.id===data.product.categoryId)?.name||''}:p));}
      setDraft(null);setNotification({text:'Товар сохранён',ok:true});router.refresh();
    }catch(error){setNotification({text:error instanceof Error?error.message:'Ошибка сохранения',ok:false});}
    finally{setBusy(false);}
  }
  async function archive(p:Product){if(!confirm('Переместить «'+p.name+'» в архив? Товар больше не будет доступен в каталоге.'))return;setBusy(true);
    try{const response=await fetch('/api/admin/products',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id})});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка');setItems(current=>current.map(x=>x.id===p.id?{...x,status:'ARCHIVED'}:x));setNotification({text:'Товар перемещён в архив',ok:true});router.refresh();}
    catch(error){setNotification({text:error instanceof Error?error.message:'Ошибка',ok:false});}finally{setBusy(false);}
  }
  return <>
    <div className="adm-head"><div><div className="adm-eyebrow">КАТАЛОГ / УПРАВЛЕНИЕ</div><h1>Товары</h1><p>Создавайте и редактируйте предложения магазина. Найдено: {total}.</p></div><button className="adm-btn primary" disabled={!categories.length} onClick={()=>{setDraft(blank(categories[0]?.id||''));setNotification(null);}}><Plus size={18}/> Добавить товар</button></div>
    {notification&&<div className={'adm-alert'+(notification.ok?' ok':'')} role="status">{notification.text}</div>}
    <form className="adm-toolbar" onSubmit={filter}><input className="adm-field adm-search" placeholder="Поиск по названию и адресу..." value={search} onChange={e=>setSearch(e.target.value)}/><select className="adm-field adm-filter" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Статус"><option value="">Все статусы</option><option value="ACTIVE">В продаже</option><option value="DRAFT">Черновики</option><option value="ARCHIVED">Архив</option></select><button className="adm-btn"><Search size={16}/> Найти</button></form>
    {!categories.length&&<div className="adm-alert">Сначала создайте категорию в разделе «Категории», затем добавляйте товары.</div>}
    {!items.length?<div className="adm-empty-large"><PackageOpen size={42}/><h3>Товары не найдены</h3><p>Добавьте первый товар или измените фильтры.</p></div>:
    <div className="adm-grid">{items.map(p=><article className="adm-product" key={p.id}><div className="adm-product-media">{p.imageUrl?<img src={p.imageUrl} alt={p.name} loading="lazy"/>:<span>STANDOFF<span style={{color:'#fff'}}>SHOP</span></span>}<span className={'adm-status '+p.status.toLowerCase()}>{messageFor(p.status)}</span></div><div className="adm-product-body"><small>{p.categoryName}</small><h3>{p.name}</h3><strong>{(p.priceKopecks/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'})}</strong></div><div className="adm-product-actions"><button onClick={()=>edit(p)}><Pencil size={14}/> Изменить</button>{p.status==='ACTIVE'?<button disabled={busy} onClick={()=>archive(p)}><Archive size={14}/> Архив</button>:<a href={'/product/'+p.slug} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Просмотр</a>}</div></article>)}</div>}
    {draft&&<div className="adm-modal-backdrop"><section className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="product-dialog"><header className="adm-modal-head"><h2 id="product-dialog">{draft.id?'Редактирование товара':'Новый товар'}</h2><button className="adm-icon-btn" onClick={()=>setDraft(null)} aria-label="Закрыть"><X size={20}/></button></header><form className="adm-form" onSubmit={save}>
      <label className="full">Название<input className="adm-field" required minLength={2} maxLength={150} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Адрес (slug)<input className="adm-field" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} placeholder="my-product" onChange={e=>setDraft({...draft,slug:e.target.value})}/></label>
      <label>Цена, ₽<input className="adm-field" required type="number" min="0.01" max="1000000" step="0.01" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label>
      <label>Категория<select className="adm-field" value={draft.categoryId} onChange={e=>setDraft({...draft,categoryId:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Публикация<select className="adm-field" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Product['status']})}><option value="DRAFT">Черновик</option><option value="ACTIVE">В продаже</option><option value="ARCHIVED">Архив</option></select></label>
      <label className="full">Описание<textarea className="adm-field" required minLength={5} maxLength={5000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      <label className="full">URL изображения (HTTPS)<input className="adm-field" type="url" placeholder="https://..." value={draft.imageUrl} onChange={e=>setDraft({...draft,imageUrl:e.target.value})}/></label>
      <p className="adm-note full">Товар в статусе «Черновик» не показывается покупателям. Для изображения используйте прямую ссылку HTTPS. Загрузка файлов будет добавлена позднее.</p>
      {notification&&!notification.ok&&<div className="adm-alert full" role="alert">{notification.text}</div>}
      <div className="adm-form-footer"><button type="button" className="adm-btn" onClick={()=>setDraft(null)}>Отмена</button><button className="adm-btn primary" disabled={busy}>{busy?'Сохраняем...':'Сохранить товар'}</button></div>
    </form></section></div>}
  </>;
}
