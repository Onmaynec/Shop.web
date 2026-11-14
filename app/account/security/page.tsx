'use client';

import Link from 'next/link';
import { useEffect,useState,type FormEvent } from 'react';
import { ArrowLeft, ShieldCheck, LogOut, LockKeyhole, Monitor, RefreshCw } from 'lucide-react';

type Session = {
  id:string;createdAt:string;lastSeenAt:string;expiresAt:string;current:boolean
};

export default function SecuritySettings() {
  const [sessions,setSessions]=useState<Session[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');

  async function loadSessions(){
    const response=await fetch('/api/account/sessions',{cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Не удалось загрузить сессии');
    setSessions(data.sessions);
  }
  useEffect(()=>{let live=true;
    fetch('/api/account/sessions',{cache:'no-store'}).then(async r=>{
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Нет доступа');
      if(live)setSessions(d.sessions);
    }).catch(e=>{if(live)setError(e instanceof Error?e.message:'Ошибка');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);

  async function revoke(action:'revoke'|'revoke_others'|'revoke_all',sessionId?:string){
    if(!confirm(action==='revoke_all'?'Завершить все сеансы и выйти из аккаунта?':'Завершить выбранные сеансы?'))return;
    setBusy(true);setError('');setSuccess('');
    try{
      const response=await fetch('/api/account/sessions',{
        method:'DELETE',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,...(sessionId?{sessionId}:{})})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Не удалось завершить сессию');
      if(data.signedOut){window.location.assign('/account');return;}
      await loadSessions();setSuccess('Сеансы завершены');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}finally{setBusy(false);}
  }

  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    setBusy(true);setError('');setSuccess('');
    try{
      const response=await fetch('/api/account/password',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({currentPassword,newPassword})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Не удалось сменить пароль');
      setCurrentPassword('');setNewPassword('');
      window.location.assign('/account');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}finally{setBusy(false);}
  }

  return <main className="content account-wrap security-settings">
    <Link className="product-back" href="/account"><ArrowLeft size={17}/> Назад в кабинет</Link>
    <div className="eyebrow">STANDOFFSHOP / SECURITY</div>
    <h1>Безопасность аккаунта</h1>
    <p className="muted">Управляйте входами и защищайте доступ к своему профилю.</p>
    {error&&<div className="account-error" role="alert">{error}</div>}
    {success&&<div className="notice" role="status">{success}</div>}
    <div className="security-grid">
      <section className="account-panel">
        <h2><Monitor size={21}/> Активные сессии</h2>
        <p className="muted">Сеансы хранятся на сервере и могут быть немедленно отозваны.</p>
        {loading?<p className="muted"><RefreshCw size={15}/> Загрузка...</p>:
          sessions.length===0?<p className="muted">Нет активных сеансов. <Link href="/account">Войти</Link></p>:
          <div className="security-session-list">{sessions.map(s=><div key={s.id} className="security-session">
            <div><strong>{s.current?'Текущая сессия':'Другое устройство'}</strong>
              <small>Активность: {new Date(s.lastSeenAt).toLocaleString('ru-RU')}</small>
              <small>Истекает: {new Date(s.expiresAt).toLocaleDateString('ru-RU')}</small></div>
            <button className="account-out" disabled={busy} onClick={()=>revoke('revoke',s.id)}><LogOut size={15}/> Завершить</button>
          </div>)}</div>}
        <div className="account-buttons">
          <button className="account-out" disabled={busy||sessions.length<2} onClick={()=>revoke('revoke_others')}>Завершить остальные</button>
          <button className="account-out" disabled={busy||sessions.length===0} onClick={()=>revoke('revoke_all')}>Выйти на всех устройствах</button>
        </div>
      </section>
      <section className="account-panel">
        <h2><LockKeyhole size={21}/> Изменить пароль</h2>
        <p className="muted">После изменения пароля все действующие сессии будут завершены.</p>
        <form className="security-password-form" onSubmit={changePassword}>
          <label>Текущий пароль<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
          <label>Новый пароль (от 12 символов)<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
          <button className="button" disabled={busy}>{busy?'Сохраняем...':'Изменить пароль'} <ShieldCheck size={16}/></button>
        </form>
      </section>
    </div>
  </main>;
}
