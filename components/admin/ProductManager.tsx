'use client';

import { useEffect,useState,type FormEvent,type ChangeEvent } from 'react';
import { useRouter,useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus,Search,X,Pencil,Archive,Eye,PackageOpen,Copy,UploadCloud,ImagePlus,Trash2,Layers3 } from 'lucide-react';

type Status='DRAFT'|'ACTIVE'|'ARCHIVED';
type Spec={name:string;value:string};
type Image={url:string;alt:string};
type Variant={id?:string;sku:string;label:string;priceKopecks:number;active:boolean};
type Product={
  id:string;name:string;slug:string;description:string;categoryId:string;categoryName:string;
  priceKopecks:number;status:Status;imageUrl:string|null;sku:string|null;
  tags:string[];specs:Spec[];images:Image[];variants:Variant[];
};
type Category={id:string;name:string};
type VariantDraft={id?:string;sku:string;label:string;price:string;active:boolean};
type Draft={
  id?:string;name:string;slug:string;description:string;categoryId:string;
  price:string;status:Status;imageUrl:string;sku:string;tagsText:string;
  specs:Spec[];images:Image[];variants:VariantDraft[];
};
const money=(n:number)=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
const blank=(categoryId:string):Draft=>({
  name:'',slug:'',description:'',categoryId,price:'',status:'DRAFT',
  imageUrl:'',sku:'',tagsText:'',specs:[],images:[],variants:[]
});
const statusLabel=(status:Status)=>status==='ACTIVE'?'В продаже':status==='DRAFT'?'Черновик':'Архив';
function toDraft(p:Product):Draft{
  return {
    id:p.id,name:p.name,slug:p.slug,description:p.description,categoryId:p.categoryId,
    price:(p.priceKopecks/100).toFixed(2),status:p.status,imageUrl:p.imageUrl||'',
    sku:p.sku||'',tagsText:p.tags.join(', '),specs:p.specs,images:p.images,
    variants:p.variants.map(v=>({...v,price:(v.priceKopecks/100).toFixed(2)}))
  };
}
function kopecks(value:string){
  const raw=value.trim().replace(',','.');
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw))throw Error('Цена должна быть числом с двумя знаками после запятой');
  const n=Math.round(Number(raw)*100);
  if(!Number.isSafeInteger(n)||n<1||n>100000000)throw Error('Цена должна быть от 0,01 до 1 000 000 ₽');
  return n;
}

export default function ProductManager({
  initialProducts,categories,total
}:{initialProducts:Product[];categories:Category[];total:number}){
  const router=useRouter(),params=useSearchParams();
  const [items,setItems]=useState(initialProducts);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [notice,setNotice]=useState<{text:string;ok:boolean}|null>(null);
  const [search,setSearch]=useState(params.get('q')||'');
  const [status,setStatus]=useState(params.get('status')||'');

  useEffect(()=>{
    setItems(initialProducts);
    setSelected([]);
    setSearch(params.get('q')||'');
    setStatus(params.get('status')||'');
  },[initialProducts,params]);

  function filter(event:FormEvent){
    event.preventDefault();
    const query=new URLSearchParams();
    if(search.trim())query.set('q',search.trim());
    if(status)query.set('status',status);
    router.push('/admin/products'+(query.size?'?'+query:''));
  }
  function beginEdit(p:Product){setDraft(toDraft(p));setNotice(null);}
  function duplicate(p:Product){
    const copy=toDraft(p);
    setDraft({
      ...copy,id:undefined,name:'Копия — '+p.name,slug:p.slug+'-copy',
      sku:'',status:'DRAFT',variants:copy.variants.map(v=>({...v,id:undefined,sku:v.sku+'-COPY'}))
    });
    setNotice(null);
  }

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!draft||busy)return;
    setBusy(true);setNotice(null);
    try{
      const payload={
        ...(draft.id?{id:draft.id}:{}),
        name:draft.name,slug:draft.slug,description:draft.description,
        categoryId:draft.categoryId,priceKopecks:kopecks(draft.price),
        status:draft.status,imageUrl:draft.imageUrl,sku:draft.sku,
        tags:draft.tagsText.split(',').map(s=>s.trim()).filter(Boolean),
        specs:draft.specs.filter(s=>s.name.trim()||s.value.trim()),
        images:draft.images,
        variants:draft.variants.map(v=>({...v,priceKopecks:kopecks(v.price),price:undefined}))
          .map(({price,...v})=>v)
      };
      const response=await fetch('/api/admin/products',{
        method:draft.id?'PATCH':'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Не удалось сохранить товар');
      setDraft(null);
      setNotice({text:'Товар сохранён. Изменения применены в каталоге.',ok:true});
      router.refresh();
    }catch(error){setNotice({text:error instanceof Error?error.message:'Ошибка сохранения',ok:false});}
    finally{setBusy(false);}
  }

  async function archive(product:Product){
    if(!confirm('Переместить «'+product.name+'» в архив?'))return;
    setBusy(true);setNotice(null);
    try{
      const response=await fetch('/api/admin/products',{
        method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:product.id})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Ошибка архивирования');
      setItems(list=>list.map(p=>p.id===product.id?{...p,status:'ARCHIVED'}:p));
      setNotice({text:'Товар перемещён в архив',ok:true});
      router.refresh();
    }catch(error){setNotice({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setBusy(false);}
  }

  async function bulk(status:Status){
    if(!selected.length||busy)return;
    if(!confirm('Изменить статус '+selected.length+' товаров на «'+statusLabel(status)+'»?'))return;
    setBusy(true);setNotice(null);
    try{
      const response=await fetch('/api/admin/products/bulk',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ids:selected,status})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Ошибка массовой операции');
      setItems(list=>list.map(p=>selected.includes(p.id)?{...p,status}:p));
      setNotice({text:'Изменено товаров: '+data.updated,ok:true});setSelected([]);
      router.refresh();
    }catch(error){setNotice({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setBusy(false);}
  }

  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||!draft||uploading)return;
    if(draft.images.length>=8){setNotice({text:'Максимум 8 изображений',ok:false});return;}
    setUploading(true);setNotice(null);
    try{
      const body=new FormData();body.append('file',file);
      const response=await fetch('/api/admin/media',{method:'POST',body});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Загрузка не удалась');
      setDraft(current=>current?{
        ...current,images:[...current.images,{url:data.url,alt:current.name}]
      }:current);
      setNotice({text:'Изображение загружено в библиотеку',ok:true});
    }catch(error){setNotice({text:error instanceof Error?error.message:'Ошибка загрузки',ok:false});}
    finally{setUploading(false);}
  }

  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">CATALOG PRO / УПРАВЛЕНИЕ</div>
      <h1>Товары</h1><p>Галереи, SKU, варианты, характеристики и публикации. Найдено: {total}.</p>
    </div><button className="adm-btn primary" disabled={!categories.length} onClick={()=>{
      setDraft(blank(categories[0]?.id||''));setNotice(null);
    }}><Plus size={18}/> Добавить товар</button></div>

    {notice&&<div className={'adm-alert'+(notice.ok?' ok':'')} role="status">{notice.text}</div>}
    <form className="adm-toolbar" onSubmit={filter}>
      <input className="adm-field adm-search" placeholder="Поиск по названию и адресу..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select className="adm-field adm-filter" value={status} onChange={e=>setStatus(e.target.value)} aria-label="Статус">
        <option value="">Все статусы</option>
        <option value="ACTIVE">В продаже</option><option value="DRAFT">Черновики</option><option value="ARCHIVED">Архив</option>
      </select><button className="adm-btn"><Search size={16}/> Найти</button>
    </form>

    {items.length>0&&<div className="adm-bulk">
      <label><input type="checkbox" aria-label="Выбрать все товары на странице"
        checked={selected.length===items.length} onChange={e=>setSelected(e.target.checked?items.map(p=>p.id):[])}/>
        Выбрано: {selected.length}</label>
      <button className="adm-btn" disabled={!selected.length||busy} onClick={()=>bulk('ACTIVE')}>Опубликовать</button>
      <button className="adm-btn" disabled={!selected.length||busy} onClick={()=>bulk('DRAFT')}>Черновики</button>
      <button className="adm-btn" disabled={!selected.length||busy} onClick={()=>bulk('ARCHIVED')}>Архивировать</button>
    </div>}

    {!categories.length&&<div className="adm-alert">Сначала добавьте категорию.</div>}
    {!items.length?<div className="adm-empty-large"><PackageOpen size={42}/><h3>Товары не найдены</h3><p>Измените фильтры или создайте первый товар.</p></div>:
      <div className="adm-grid">{items.map(p=><article className="adm-product" key={p.id}>
        <div className="adm-product-media">
          {(p.images[0]?.url||p.imageUrl)?<img src={p.images[0]?.url||p.imageUrl||''} alt={p.name} loading="lazy"/>:<span>STANDOFF<span style={{color:'#fff'}}>SHOP</span></span>}
          <span className={'adm-status '+p.status.toLowerCase()}>{statusLabel(p.status)}</span>
          <label className="adm-product-check"><input type="checkbox" aria-label={'Выбрать '+p.name} checked={selected.includes(p.id)}
            onChange={e=>setSelected(list=>e.target.checked?[...list,p.id]:list.filter(id=>id!==p.id))}/></label>
        </div>
        <div className="adm-product-body"><small>{p.categoryName}{p.sku?' · '+p.sku:''}</small>
          <h3>{p.name}</h3><strong>{money(p.variants.filter(v=>v.active).length?
            Math.min(...p.variants.filter(v=>v.active).map(v=>v.priceKopecks)):p.priceKopecks)}</strong>
          <div className="adm-product-extra"><span><ImagePlus size={13}/> {p.images.length} фото</span>
            <span><Layers3 size={13}/> {p.variants.length} вариантов</span></div>
        </div>
        <div className="adm-product-actions">
          <button onClick={()=>beginEdit(p)}><Pencil size={14}/> Изменить</button>
          <Link href={'/admin/preview/'+p.id}><Eye size={14}/> Просмотр</Link>
          <button onClick={()=>duplicate(p)} title="Создать копию товара"><Copy size={14}/></button>
          {p.status==='ACTIVE'&&<button disabled={busy} onClick={()=>archive(p)} title="Архивировать"><Archive size={14}/></button>}
        </div>
      </article>)}</div>}

    {draft&&<div className="adm-modal-backdrop">
      <section className="adm-modal adm-product-editor" role="dialog" aria-modal="true" aria-labelledby="product-dialog">
        <header className="adm-modal-head"><div><div className="adm-eyebrow">CATALOG EDITOR</div>
          <h2 id="product-dialog">{draft.id?'Редактирование товара':'Новый товар'}</h2></div>
          <button type="button" className="adm-icon-btn" onClick={()=>setDraft(null)} aria-label="Закрыть"><X size={20}/></button>
        </header>
        <form className="adm-form" onSubmit={save}>
          <h3 className="adm-editor-section full">Основная информация</h3>
          <label className="full">Название<input className="adm-field" required maxLength={150} minLength={2}
            value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
          <label>Адрес товара (slug)<input className="adm-field" required pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80} value={draft.slug} placeholder="my-product"
            onChange={e=>setDraft({...draft,slug:e.target.value})}/></label>
          <label>Артикул (SKU, необязательно)<input className="adm-field" maxLength={64} value={draft.sku}
            placeholder="TRAIN-101" onChange={e=>setDraft({...draft,sku:e.target.value})}/></label>
          <label>Цена базового товара, ₽<input className="adm-field" required type="number" min="0.01" max="1000000"
            step="0.01" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label>
          <label>Категория<select className="adm-field" value={draft.categoryId}
            onChange={e=>setDraft({...draft,categoryId:e.target.value})}>{categories.map(c=>
              <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Публикация<select className="adm-field" value={draft.status}
            onChange={e=>setDraft({...draft,status:e.target.value as Status})}>
            <option value="DRAFT">Черновик</option><option value="ACTIVE">В продаже</option>
            <option value="ARCHIVED">Архив</option>
          </select></label>
          <label className="full">Теги через запятую<input className="adm-field" maxLength={420}
            placeholder="Обучение, Командная игра, Стратегия" value={draft.tagsText}
            onChange={e=>setDraft({...draft,tagsText:e.target.value})}/></label>
          <label className="full">Описание<textarea className="adm-field" required minLength={5} maxLength={5000}
            value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>

          <div className="adm-editor-heading full"><h3>Галерея изображений</h3>
            <label className="adm-upload-button"><UploadCloud size={16}/>{uploading?'Загружаем...':'Загрузить PNG / JPG / WebP'}
              <input type="file" hidden disabled={uploading||draft.images.length>=8} accept="image/png,image/jpeg,image/webp" onChange={upload}/></label>
          </div>
          <p className="adm-note full">До 8 файлов по 2 МБ. Также можно вставлять HTTPS-ссылки. При переносе сайта перенесите каталог хранения медиафайлов.</p>
          {draft.images.map((image,index)=><div className="adm-image-edit full" key={index}>
            <div className="adm-image-preview"><img src={image.url} alt={image.alt||'Изображение товара'}/></div>
            <div><input className="adm-field" aria-label={'Ссылка изображения '+(index+1)} placeholder="https://..."
              value={image.url} onChange={e=>setDraft({...draft,images:draft.images.map((v,i)=>i===index?{...v,url:e.target.value}:v)})}/>
              <input className="adm-field" aria-label={'Описание изображения '+(index+1)} placeholder="Подпись / alt"
                value={image.alt} onChange={e=>setDraft({...draft,images:draft.images.map((v,i)=>i===index?{...v,alt:e.target.value}:v)})}/></div>
            <div className="adm-editor-arrows">
              <button type="button" className="adm-btn" disabled={index===0} onClick={()=>setDraft(current=>{if(!current)return current;const images=[...current.images];[images[index-1],images[index]]=[images[index],images[index-1]];return {...current,images};})}>↑</button>
              <button type="button" className="adm-btn" disabled={index===draft.images.length-1} onClick={()=>setDraft(current=>{if(!current)return current;const images=[...current.images];[images[index],images[index+1]]=[images[index+1],images[index]];return {...current,images};})}>↓</button>
              <button type="button" className="adm-btn" title="Убрать из галереи"
                onClick={()=>setDraft({...draft,images:draft.images.filter((_,i)=>i!==index)})}><Trash2 size={14}/></button>
            </div>
          </div>)}
          {draft.images.length<8&&<button className="adm-btn full adm-add-line" type="button"
            onClick={()=>setDraft({...draft,images:[...draft.images,{url:'',alt:''}]})}>
            <Plus size={15}/> Добавить ссылку на изображение</button>}
          <label className="full">Резервная обложка для старых карточек (HTTPS)<input className="adm-field"
            value={draft.imageUrl} placeholder="https://..." onChange={e=>setDraft({...draft,imageUrl:e.target.value})}/></label>

          <div className="adm-editor-heading full"><h3>Характеристики</h3>
            <button type="button" className="adm-btn" disabled={draft.specs.length>=16}
              onClick={()=>setDraft({...draft,specs:[...draft.specs,{name:'',value:''}]})}><Plus size={15}/> Добавить</button>
          </div>
          {draft.specs.map((spec,i)=><div className="adm-spec-row full" key={i}>
            <input className="adm-field" aria-label={'Характеристика '+(i+1)} placeholder="Параметр"
              value={spec.name} onChange={e=>setDraft({...draft,specs:draft.specs.map((v,j)=>j===i?{...v,name:e.target.value}:v)})}/>
            <input className="adm-field" aria-label={'Значение '+(i+1)} placeholder="Значение"
              value={spec.value} onChange={e=>setDraft({...draft,specs:draft.specs.map((v,j)=>j===i?{...v,value:e.target.value}:v)})}/>
            <button className="adm-btn" type="button" aria-label={'Удалить характеристику '+(i+1)}
              onClick={()=>setDraft({...draft,specs:draft.specs.filter((_,j)=>j!==i)})}><Trash2 size={15}/></button>
          </div>)}

          <div className="adm-editor-heading full"><h3>Варианты и цены</h3>
            <button type="button" className="adm-btn" disabled={draft.variants.length>=12}
              onClick={()=>setDraft({...draft,variants:[...draft.variants,{sku:'',label:'',price:draft.price,active:true}]})}>
              <Plus size={15}/> Добавить</button>
          </div>
          <p className="adm-note full">Если указаны активные варианты, покупатель обязан выбрать один из них. Удаление существующего варианта из формы отключает его, но сохраняет историю заказов.</p>
          {draft.variants.map((variant,i)=><div className="adm-variant-row full" key={variant.id||'new-'+i}>
            <label>Название<input className="adm-field" required maxLength={100} value={variant.label}
              placeholder="Стандартный" onChange={e=>setDraft({...draft,variants:draft.variants.map((v,j)=>j===i?{...v,label:e.target.value}:v)})}/></label>
            <label>SKU<input className="adm-field" required maxLength={64} value={variant.sku}
              placeholder="TRAIN-101-STD" onChange={e=>setDraft({...draft,variants:draft.variants.map((v,j)=>j===i?{...v,sku:e.target.value}:v)})}/></label>
            <label>Цена, ₽<input className="adm-field" required type="number" min="0.01" step="0.01"
              value={variant.price} onChange={e=>setDraft({...draft,variants:draft.variants.map((v,j)=>j===i?{...v,price:e.target.value}:v)})}/></label>
            <label className="adm-switch"><input type="checkbox" checked={variant.active}
              onChange={e=>setDraft({...draft,variants:draft.variants.map((v,j)=>j===i?{...v,active:e.target.checked}:v)})}/>
              В продаже</label>
            <button className="adm-btn" type="button" aria-label={'Убрать вариант '+(i+1)}
              onClick={()=>setDraft({...draft,variants:draft.variants.filter((_,j)=>j!==i)})}><Trash2 size={15}/></button>
          </div>)}
          {notice&&!notice.ok&&<div className="adm-alert full" role="alert">{notice.text}</div>}
          <div className="adm-form-footer"><button type="button" className="adm-btn" onClick={()=>setDraft(null)}>Отмена</button>
            <button className="adm-btn primary" disabled={busy||uploading}>{busy?'Сохраняем...':'Сохранить товар'}</button>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
