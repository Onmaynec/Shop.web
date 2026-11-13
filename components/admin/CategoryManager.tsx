'use client';
import { useState,type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Layers3, Pencil, Trash2, X } from 'lucide-react';
type Category={id:string;name:string;slug:string;description:string;products:number};
type Draft={id?:string;name:string;slug:string;description:string};
export default function CategoryManager({initialCategories}:{initialCategories:Category[]}){
 const router=useRouter();const [items,setItems]=useState(initialCategories);const [draft,setDraft]=useState<Draft|null>(null);
 const [busy,setBusy]=useState(false);const [alert,setAlert]=useState<{text:string;ok:boolean}|null>(null);
 async function save(e:FormEvent){e.preventDefault();if(!draft||busy)return;setBusy(true);setAlert(null);
 try{const response=await fetch('/api/admin/categories',{method:draft.id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка сохранения');
 const category={...data.category,products:items.find(c=>c.id===data.category.id)?.products||0};
 setItems(current=>draft.id?current.map(c=>c.id===category.id?category:c):[...current,category]);setDraft(null);setAlert({text:'Категория сохранена',ok:true});router.refresh();
 }catch(error){setAlert({text:error instanceof Error?error.message:'Ошибка',ok:false});}finally{setBusy(false);}}
 async function remove(c:Category){if(c.products>0)return setAlert({text:'Сначала перенесите товары из категории',ok:false});if(!confirm('Удалить категорию «'+c.name+'»?'))return;setBusy(true);
 try{const response=await fetch('/api/admin/categories',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id})});const data=await response.json();if(!response.ok)throw Error(data.error||'Ошибка удаления');setItems(current=>current.filter(x=>x.id!==c.id));setAlert({text:'Категория удалена',ok:true});router.refresh();}
 catch(error){setAlert({text:error instanceof Error?error.message:'Ошибка',ok:false});}finally{setBusy(false);}}
 return <><div className="adm-head"><div><div className="adm-eyebrow">КАТАЛОГ / СТРУКТУРА</div><h1>Категории</h1><p>Организация ассортимента. Всего: {items.length}.</p></div><button className="adm-btn primary" onClick={()=>{setDraft({name:'',slug:'',description:''});setAlert(null);}}><Plus size={17}/> Добавить категорию</button></div>
 {alert&&<div role="status" className={'adm-alert'+(alert.ok?' ok':'')}>{alert.text}</div>}
 <div className="adm-card">{items.length===0?<div className="adm-empty-large"><Layers3 size={40}/><h3>Категорий ещё нет</h3><p>Создайте первую категорию, чтобы начать наполнение магазина.</p></div>:items.map(c=><div key={c.id} className="adm-record"><div><strong>{c.name}</strong><small>/{c.slug} · {c.products} товаров {c.description?'· '+c.description:''}</small></div><div className="adm-record-actions"><button onClick={()=>setDraft({id:c.id,name:c.name,slug:c.slug,description:c.description})} title="Редактировать"><Pencil size={16}/></button><button className="adm-danger" disabled={busy||c.products>0} title={c.products?'Категория содержит товары':'Удалить'} onClick={()=>remove(c)}><Trash2 size={16}/></button></div></div>)}</div>
 {draft&&<div className="adm-modal-backdrop"><section className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="category-dialog"><div className="adm-modal-head"><h2 id="category-dialog">{draft.id?'Редактировать категорию':'Новая категория'}</h2><button className="adm-icon-btn" onClick={()=>setDraft(null)} aria-label="Закрыть"><X size={20}/></button></div><form className="adm-form" onSubmit={save}>
 <label className="full">Название<input className="adm-field" required minLength={2} maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label className="full">Адрес категории (slug)<input className="adm-field" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="services" value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value})}/></label>
 <label className="full">Описание<textarea className="adm-field" maxLength={500} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
 {alert&&!alert.ok&&<div className="adm-alert full" role="alert">{alert.text}</div>}
 <div className="adm-form-footer"><button type="button" className="adm-btn" onClick={()=>setDraft(null)}>Отмена</button><button className="adm-btn primary" disabled={busy}>{busy?'Сохранение...':'Сохранить категорию'}</button></div></form></section></div>}
 </>;
}
