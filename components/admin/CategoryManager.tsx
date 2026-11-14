'use client';

import { useState,type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus,Layers3,Pencil,Trash2,X,CornerDownRight } from 'lucide-react';

type Category={
  id:string;name:string;slug:string;description:string;parentId:string|null;
  products:number;children:number
};
type Draft={id?:string;name:string;slug:string;description:string;parentId:string|null};

export default function CategoryManager({initialCategories}:{initialCategories:Category[]}){
  const router=useRouter();
  const [items,setItems]=useState(initialCategories);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false);
  const [alert,setAlert]=useState<{text:string;ok:boolean}|null>(null);
  const roots=items.filter(c=>!c.parentId);

  async function save(event:FormEvent){
    event.preventDefault();if(!draft||busy)return;
    setBusy(true);setAlert(null);
    try{
      const response=await fetch('/api/admin/categories',{
        method:draft.id?'PATCH':'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Ошибка сохранения');
      const category:Category={
        ...data.category,
        products:items.find(c=>c.id===data.category.id)?.products||0,
        children:items.find(c=>c.id===data.category.id)?.children||0
      };
      setItems(current=>draft.id?current.map(c=>c.id===category.id?category:c):[...current,category]);
      setDraft(null);setAlert({text:'Категория сохранена',ok:true});
      router.refresh();
    }catch(error){setAlert({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setBusy(false);}
  }

  async function remove(c:Category){
    if(c.products||c.children)return setAlert({text:'Сначала перенесите товары и подразделы',ok:false});
    if(!confirm('Удалить категорию «'+c.name+'»?'))return;
    setBusy(true);
    try{
      const response=await fetch('/api/admin/categories',{
        method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Ошибка удаления');
      setItems(current=>current.filter(x=>x.id!==c.id));
      setAlert({text:'Категория удалена',ok:true});router.refresh();
    }catch(error){setAlert({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setBusy(false);}
  }

  function newCategory(parentId:string|null=null){
    setDraft({name:'',slug:'',description:'',parentId});setAlert(null);
  }
  function item(c:Category,nested=false){
    return <div key={c.id} className={'adm-record'+(nested?' category-nested':'')}>
      <div className="category-record-info">
        <div className="category-record-title">{nested&&<CornerDownRight size={17}/>}<strong>{c.name}</strong></div>
        <small>/{c.slug} · {c.products} товаров {c.children?'· '+c.children+' разделов':''}</small>
        {c.description&&<small>{c.description}</small>}
      </div>
      <div className="adm-record-actions">
        {!nested&&<button type="button" title="Добавить подкатегорию"
          onClick={()=>newCategory(c.id)}><Plus size={16}/></button>}
        <button type="button" title="Редактировать" onClick={()=>setDraft({
          id:c.id,name:c.name,slug:c.slug,description:c.description,parentId:c.parentId
        })}><Pencil size={16}/></button>
        <button type="button" className="adm-danger" disabled={busy||c.products>0||c.children>0}
          title={c.products||c.children?'Категория не пуста':'Удалить'}
          onClick={()=>remove(c)}><Trash2 size={16}/></button>
      </div>
    </div>;
  }

  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">CATALOG PRO / СТРУКТУРА</div>
      <h1>Категории</h1>
      <p>Разделы и подразделы — два уровня. Всего: {items.length}.</p>
    </div><button className="adm-btn primary" onClick={()=>newCategory()}><Plus size={17}/> Добавить категорию</button></div>
    {alert&&<div role="status" className={'adm-alert'+(alert.ok?' ok':'')}>{alert.text}</div>}
    <div className="adm-card">
      {items.length===0?<div className="adm-empty-large"><Layers3 size={40}/>
        <h3>Категорий пока нет</h3><p>Создайте раздел и добавьте в него товары.</p></div>:
        roots.map(root=><div className="category-group" key={root.id}>
          {item(root)}
          {items.filter(c=>c.parentId===root.id).map(child=>item(child,true))}
        </div>)}
    </div>
    {draft&&<div className="adm-modal-backdrop">
      <section className="adm-modal" role="dialog" aria-modal="true" aria-labelledby="category-dialog">
        <header className="adm-modal-head">
          <h2 id="category-dialog">{draft.id?'Редактирование категории':'Новая категория'}</h2>
          <button type="button" className="adm-icon-btn" aria-label="Закрыть"
            onClick={()=>setDraft(null)}><X size={20}/></button>
        </header>
        <form className="adm-form" onSubmit={save}>
          <label className="full">Название<input className="adm-field" required minLength={2} maxLength={100}
            value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <label className="full">Slug (адрес)<input className="adm-field" required maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="services"
            value={draft.slug} onChange={e=>setDraft({...draft,slug:e.target.value})}/></label>
          <label className="full">Родительская категория
            <select className="adm-field" value={draft.parentId||''} onChange={e=>setDraft({
              ...draft,parentId:e.target.value||null
            })}>
              <option value="">Корневой раздел</option>
              {roots.filter(c=>c.id!==draft.id && !(draft.id&&items.some(child=>child.parentId===draft.id)))
                .map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="full">Описание<textarea className="adm-field" maxLength={500}
            value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
          <p className="adm-note full">Нельзя переместить категорию с собственными подразделами внутрь другой категории.</p>
          {alert&&!alert.ok&&<div className="adm-alert full" role="alert">{alert.text}</div>}
          <div className="adm-form-footer">
            <button type="button" className="adm-btn" onClick={()=>setDraft(null)}>Отмена</button>
            <button className="adm-btn primary" disabled={busy}>{busy?'Сохраняем...':'Сохранить категорию'}</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
