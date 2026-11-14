'use client';
import { useState,type FormEvent,type ChangeEvent } from 'react';
import { Eye,UploadCloud,Save,ExternalLink } from 'lucide-react';
import Link from 'next/link';

type Home={
  headline:string;subheadline:string;description:string;eyebrow:string;
  ctaLabel:string;ctaHref:'/catalog'|'/account'|'/cart';
  backgroundUrl:string;published:boolean
};
export default function StorefrontEditor({initial}:{initial:Home}){
  const [draft,setDraft]=useState(initial);
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false);
  const [message,setMessage]=useState<{text:string;ok:boolean}|null>(null);
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setMessage(null);
    try{
      const response=await fetch('/api/admin/content',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Не удалось сохранить');
      setMessage({text:draft.published?'Главная страница опубликована':'Черновик сохранён. На витрине используется стандартный текст.',ok:true});
    }catch(error){setMessage({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setBusy(false);}
  }
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||uploading)return;
    setUploading(true);setMessage(null);
    try{
      const form=new FormData();form.set('file',file);
      const response=await fetch('/api/admin/media',{method:'POST',body:form});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Error(data?.error||'Не удалось загрузить фон');
      setDraft(current=>({...current,backgroundUrl:data.url}));
      setMessage({text:'Фоновое изображение загружено',ok:true});
    }catch(error){setMessage({text:error instanceof Error?error.message:'Ошибка',ok:false});}
    finally{setUploading(false);}
  }
  return <>
    <div className="adm-head"><div><div className="adm-eyebrow">CATALOG PRO / CONTENT MANAGEMENT</div>
      <h1>Главная страница</h1>
      <p>Управляйте заголовками и фоном первого экрана без изменения исходного кода.</p></div>
      <Link href="/" className="adm-btn" target="_blank"><ExternalLink size={16}/> Открыть витрину</Link>
    </div>
    {message&&<div className={'adm-alert'+(message.ok?' ok':'')} role="status">{message.text}</div>}
    <div className="adm-cms-layout">
      <form className="adm-card adm-cms-form" onSubmit={save}>
        <div className="adm-editor-heading"><h3>Первый экран</h3></div>
        <label>Метка над заголовком<input className="adm-field" maxLength={100} required value={draft.eyebrow}
          onChange={e=>setDraft({...draft,eyebrow:e.target.value})}/></label>
        <label>Первая строка заголовка<input className="adm-field" maxLength={90} required value={draft.headline}
          onChange={e=>setDraft({...draft,headline:e.target.value})}/></label>
        <label>Вторая строка заголовка<input className="adm-field" maxLength={90} required value={draft.subheadline}
          onChange={e=>setDraft({...draft,subheadline:e.target.value})}/></label>
        <label>Описание<textarea className="adm-field" maxLength={400} required minLength={10} value={draft.description}
          onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <label>Текст кнопки<input className="adm-field" maxLength={40} required value={draft.ctaLabel}
          onChange={e=>setDraft({...draft,ctaLabel:e.target.value})}/></label>
        <label>Переход по кнопке<select className="adm-field" value={draft.ctaHref}
          onChange={e=>setDraft({...draft,ctaHref:e.target.value as Home['ctaHref']})}>
          <option value="/catalog">Каталог</option><option value="/account">Личный кабинет</option>
          <option value="/cart">Корзина</option>
        </select></label>
        <label>Ссылка на фон (необязательно)<input className="adm-field" value={draft.backgroundUrl}
          placeholder="https://... или /api/media/..."
          onChange={e=>setDraft({...draft,backgroundUrl:e.target.value})}/></label>
        <label className="adm-upload-button adm-cms-upload"><UploadCloud size={16}/>
          {uploading?'Загрузка...':'Загрузить фон PNG / JPG / WebP'}
          <input hidden type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={upload}/>
        </label>
        <label className="adm-cms-publish"><input type="checkbox" checked={draft.published}
          onChange={e=>setDraft({...draft,published:e.target.checked})}/>
          Опубликовать изменения на витрине</label>
        <button className="adm-btn primary" disabled={busy||uploading}>
          <Save size={17}/>{busy?'Сохранение...':'Сохранить оформление'}</button>
      </form>
      <div className="adm-cms-preview-wrap"><div className="adm-editor-heading"><h3><Eye size={17}/> Предпросмотр</h3></div>
        <div className="adm-cms-preview">
          {draft.backgroundUrl&&<img src={draft.backgroundUrl} alt="" aria-hidden="true"/>}
          <div className="adm-cms-preview-shade"/>
          <div className="adm-cms-preview-body"><small>{draft.eyebrow}</small>
            <h2>{draft.headline}<br/><span>{draft.subheadline}</span></h2>
            <p>{draft.description}</p><span className="adm-cms-demo-button">{draft.ctaLabel} ↗</span>
          </div>
        </div>
        <p className="adm-note">Это предпросмотр заполненной формы. Пока не нажата кнопка сохранения и не включена публикация, покупатели видят прежний первый экран.</p>
      </div>
    </div>
  </>;
}
