'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {ShieldCheck,ShieldOff,Copy,KeyRound,CheckCircle2,LockKeyhole} from 'lucide-react';

type Status={enabled:boolean;pending:boolean;recoveryRemaining:number};
type StartResponse={secret:string;uri:string};

export default function MfaSettings(){
  const [status,setStatus]=useState<Status|null>(null);
  const [busy,setBusy]=useState(false);
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [enrollment,setEnrollment]=useState<StartResponse|null>(null);
  const [recovery,setRecovery]=useState<string[]|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    let mounted=true;
    fetch('/api/account/mfa',{cache:'no-store'}).then(async r=>{
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Не удалось проверить MFA');
      if(mounted)setStatus(data);
    }).catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Ошибка');});
    return()=>{mounted=false;};
  },[]);
  async function request(body:unknown){
    const r=await fetch('/api/account/mfa',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok)throw new Error(data?.error||'Не удалось выполнить действие');
    return data;
  }
  async function start(e:FormEvent){
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const data=await request({action:'start',password});
      setEnrollment({secret:data.secret,uri:data.uri});setCode('');setRecovery(null);
      setNotice('Добавьте ключ в приложение-аутентификатор и подтвердите шестизначным кодом.');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);setPassword('');}
  }
  async function confirm(e:FormEvent){
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const data=await request({action:'confirm',code});
      setRecovery(data.recoveryCodes);setEnrollment(null);setCode('');
      setStatus({enabled:true,pending:false,recoveryRemaining:data.recoveryCodes.length});
      setNotice('Двухфакторная защита включена. Сохраните резервные коды: они отображаются только сейчас.');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);}
  }
  async function disable(e:FormEvent){
    e.preventDefault();if(busy)return;
    if(!confirm('Выключить двухфакторную защиту?'))return;
    setBusy(true);setError('');setNotice('');
    try{
      await request({action:'disable',password,code});
      setStatus({enabled:false,pending:false,recoveryRemaining:0});setEnrollment(null);setRecovery(null);
      setPassword('');setCode('');
      setNotice('MFA выключена; остальные сессии завершены.');
    }catch(e){setError(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(false);}
  }
  return <section className="account-panel mfa-panel">
    <h2><ShieldCheck size={21}/> Двухфакторная аутентификация</h2>
    <p className="muted">Дополнительная проверка при входе с помощью одноразовых кодов из приложения-аутентификатора (TOTP).</p>
    {error&&<div className="account-error" role="alert">{error}</div>}
    {notice&&<div className="notice" role="status">{notice}</div>}
    {!status?<p className="muted">Проверяем настройки безопасности...</p>:
      <div className="mfa-current"><span className={'mfa-state'+(status.enabled?' active':'')}>
        {status.enabled?<ShieldCheck size={16}/>:<ShieldOff size={16}/>}
        {status.enabled?'Включена':'Выключена'}
      </span>
      {status.enabled&&<span className="mfa-backup-count">
        Осталось резервных кодов: {status.recoveryRemaining}</span>}</div>}
    {recovery&&<div className="mfa-recovery">
      <h3><KeyRound size={18}/> Резервные коды восстановления</h3>
      <p>Каждый код одноразовый. Сохраните их в менеджере паролей. После закрытия страницы они недоступны.</p>
      <div className="mfa-code-grid">{recovery.map(value=><code key={value}>{value}</code>)}</div>
      <button className="account-out" onClick={()=>void navigator.clipboard.writeText(recovery.join('\n'))}>
        <Copy size={16}/> Скопировать все</button>
      <button className="account-out" onClick={()=>setRecovery(null)}>Я сохранил коды</button>
    </div>}
    {status&&!status.enabled&&!enrollment&&<form className="mfa-form" onSubmit={start}>
      <label>Текущий пароль<input type="password" required autoComplete="current-password"
        value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="button" disabled={busy}><ShieldCheck size={16}/>
        {busy?'Проверка...':'Настроить 2FA'}</button>
    </form>}
    {status&&!status.enabled&&enrollment&&<div className="mfa-enrollment">
      <p>Сканирование QR не требуется: откройте Google Authenticator, Microsoft Authenticator или другое TOTP-приложение и выберите ручное добавление ключа.</p>
      <label>Секрет настройки (только сейчас)<div className="mfa-key-row"><code>{enrollment.secret}</code>
        <button type="button" className="account-out"
          onClick={()=>void navigator.clipboard.writeText(enrollment.secret)} aria-label="Скопировать секрет"><Copy size={17}/></button>
      </div></label>
      <form className="mfa-form" onSubmit={confirm}>
        <label>Шестизначный код из приложения<input required inputMode="numeric" pattern="[0-9]{6}"
          autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}
          maxLength={6} placeholder="000000"/></label>
        <button className="button" disabled={busy}><CheckCircle2 size={16}/>
          {busy?'Проверка...':'Подтвердить и включить'}</button>
      </form>
      <p className="muted">Подтвердите настройку в течение 10 минут. Не отправляйте секрет и резервные коды в поддержку.</p>
    </div>}
    {status?.enabled&&<form className="mfa-form" onSubmit={disable}>
      <h3><LockKeyhole size={17}/> Отключить защиту</h3>
      <p className="muted">Потребуется текущий пароль и код приложения либо резервный код.</p>
      <label>Текущий пароль<input required type="password" autoComplete="current-password"
        value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <label>Код 2FA или резервный код<input required
        autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}
        maxLength={35}/></label>
      <button type="submit" className="account-out" disabled={busy}><ShieldOff size={16}/>
        {busy?'Проверка...':'Отключить двухфакторную защиту'}</button>
    </form>}
  </section>;
}
