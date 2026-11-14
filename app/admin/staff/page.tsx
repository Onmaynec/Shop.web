import Link from 'next/link';
import {notFound} from 'next/navigation';
import {UserCog,Search,ShieldCheck,Headset,ClipboardList} from 'lucide-react';
import {db} from '../../../lib/db';
import {currentUser} from '../../../lib/auth';
import StaffManager from '../../../components/admin/StaffManager';

export const dynamic='force-dynamic';
export default async function StaffPage({searchParams}:{
  searchParams:Promise<{q?:string;page?:string}>
}){
  const actor=await currentUser();
  if(!actor||actor.role!=='ADMIN')notFound();
  const params=await searchParams,q=(params.q||'').trim().slice(0,100);
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where=q?{email:{contains:q,mode:'insensitive' as const}}:{};
  const [total,users,admins,supports,fulfillment]=await Promise.all([
    db.user.count({where}),
    db.user.findMany({where,orderBy:{createdAt:'desc'},take:30,skip:(page-1)*30,
      select:{id:true,email:true,role:true,createdAt:true}}),
    db.user.count({where:{role:'ADMIN'}}),
    db.user.count({where:{role:'SUPPORT'}}),
    db.user.count({where:{role:'FULFILLMENT'}})
  ]);
  const pages=Math.max(1,Math.ceil(total/30));
  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">OPERATIONS / ACCESS CONTROL</div>
      <h1>Команда магазина</h1>
      <p>Назначение ролей, отзыв сессий при смене прав, контроль доступа.</p>
    </div></div>
    <div className="adm-stat-grid">
      {[
        {title:'Администраторы',value:admins,Icon:ShieldCheck},
        {title:'Поддержка',value:supports,Icon:Headset},
        {title:'Исполнители',value:fulfillment,Icon:ClipboardList}
      ].map(({title,value,Icon})=><div className="adm-stat" key={title}>
        <div className="adm-stat-top"><span>{title}</span><Icon size={19}/></div>
        <strong>{value}</strong><small>Действующие аккаунты</small>
      </div>)}
    </div>
    <div className="adm-hint">Назначайте роль только после проверки сотрудника.
      Поддержка видит обращения, исполнитель — очередь задач. Администратор имеет полный доступ.
      При смене роли пользователь будет выведен из всех сессий.</div>
    <form action="/admin/staff" method="get" className="adm-toolbar">
      <input name="q" className="adm-field adm-search" maxLength={100}
        defaultValue={q} placeholder="Поиск по email зарегистрированного пользователя"/>
      <button className="adm-btn"><Search size={16}/> Найти</button>
    </form>
    <StaffManager actorId={actor.id} initial={users.map(u=>({
      id:u.id,email:u.email,role:u.role,createdAt:u.createdAt.toISOString()
    }))}/>
    <div className="adm-pagination"><span>Пользователей: {total}. Страница {page}/{pages}</span><div>
      {page>1&&<Link href={'/admin/staff?'+(q?'q='+encodeURIComponent(q)+'&':'')+'page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/staff?'+(q?'q='+encodeURIComponent(q)+'&':'')+'page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
