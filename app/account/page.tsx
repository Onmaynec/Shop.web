'use client';
import Link from 'next/link';
import { useEffect,useState,type FormEvent } from 'react';
import { ShieldCheck, UserRound, ShoppingBag, LogOut, ArrowUpRight } from 'lucide-react';
type User={id:string;email:string;role:'CUSTOMER'|'ADMIN'};
type Order={id:string;status:string;totalKopecks:number;createdAt:string};
const money=(v:number)=>(v/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
export default function Account(){
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [user,setUser]=useState<User|null>(null);const [orders,setOrders]=useState<Order[]>([]);
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function getJson(response:Response){const data=await response.json().catch(()=>null);if(!data)throw Error('Сервер не ответил корректно. Проверьте подключение к базе данных.');if(!response.ok)throw Error(data.error||'Ошибка запроса');return data;}
 async function loadOrders(){try{const data=await getJson(await fetch('/api/me/orders',{cache:'no-store'}));setOrders(data.orders);}catch{setOrders([]);}}
 useEffect(()=>{let live=true;fetch('/api/auth/session',{cache:'no-store'}).then(getJson).then(data=>{if(live){setUser(data.user);if(data.user)void loadOrders();}}).catch(()=>{if(live)setError('Не удалось проверить сессию.');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;setBusy(true);setError('');
 try{const data=await getJson(await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password})}));setUser(data.user);setPassword('');await loadOrders();}
 catch(error){setError(error instanceof Error?error.message:'Ошибка авторизации');}finally{setBusy(false);}}
 async function logout(){setBusy(true);setError('');try{await getJson(await fetch('/api/auth/logout',{method:'POST'}));setUser(null);setOrders([]);setEmail('');}catch(e){setError(e instanceof Error?e.message:'Ошибка выхода');}finally{setBusy(false);}}
 return <main className="content account-wrap"><div className="eyebrow">STANDOFFSHOP / ПРОФИЛЬ</div><h1>Личный кабинет</h1><p className="muted">Ваш аккаунт и история заказов.</p>
 {loading?<div className="account-panel">Проверяем авторизацию...</div>:user?
 <><section className="account-panel"><div className="account-profile"><div className="account-avatar"><UserRound size={27}/></div><div><small>Вы вошли как</small><h2>{user.email}</h2><span className="adm-status">{user.role==='ADMIN'?'Администратор':'Покупатель'}</span></div></div><div className="account-buttons">{user.role==='ADMIN'&&<Link href="/admin" className="button"><ShieldCheck size={17}/> Панель управления <ArrowUpRight size={16}/></Link>}<Link href="/account/security" className="account-out"><ShieldCheck size={17}/> Безопасность</Link><button className="account-out" disabled={busy} onClick={logout}><LogOut size={17}/> Выйти</button></div></section>
 <section className="account-panel"><h2><ShoppingBag size={21}/> Мои заказы</h2>{orders.length===0?<p className="muted">Пока нет заказов, оформленных через ваш аккаунт. <Link href="/catalog">Перейти в каталог</Link></p>:<div className="account-orders">{orders.map(o=><div key={o.id} className="account-order"><strong>#{o.id.slice(-8)}</strong><span>{o.status}</span><b>{money(o.totalKopecks)}</b></div>)}</div>}</section>
 </>:
 <section className="account-panel account-auth"><div className="account-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>{setMode('login');setError('');}}>Вход</button><button type="button" className={mode==='register'?'selected':''} onClick={()=>{setMode('register');setError('');}}>Регистрация</button></div><h2>{mode==='login'?'С возвращением':'Создать аккаунт'}</h2><p className="muted">{mode==='login'?'Войдите, чтобы управлять своими заказами.':'Зарегистрируйтесь, чтобы сохранять историю покупок.'}</p><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@mail.com"/></label><label>Пароль<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='register'?12:1} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='register'?'Не менее 12 символов':'Введите пароль'}/></label><button className="button" disabled={busy}>{busy?'Подождите...':mode==='login'?'Войти в аккаунт':'Зарегистрироваться'}</button></form></section>}
 {error&&<div className="account-error" role="alert">{error}</div>}</main>;
}
