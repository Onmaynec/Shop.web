import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, Search } from 'lucide-react';
export const dynamic='force-dynamic';
export default async function CustomersPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
 const params=await searchParams;const q=(params.q||'').trim().slice(0,80);const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
 const where=q?{email:{contains:q,mode:'insensitive' as const}}:{};
 const [total,customers]=await Promise.all([db.user.count({where}),db.user.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*20,take:20,select:{id:true,email:true,role:true,createdAt:true,_count:{select:{orders:true}}}})]);
 const pages=Math.max(1,Math.ceil(total/20));const qs=q?'q='+encodeURIComponent(q)+'&':'';
 return <><div className="adm-head"><div><div className="adm-eyebrow">ПОКУПАТЕЛИ / АККАУНТЫ</div><h1>Пользователи</h1><p>Зарегистрированные аккаунты и история активности. Найдено: {total}.</p></div></div>
 <form method="get" className="adm-toolbar"><input name="q" className="adm-field adm-search" placeholder="Поиск по email..." defaultValue={q}/><button className="adm-btn"><Search size={17}/> Найти</button></form>
 <div className="adm-card"><div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Электронная почта</th><th>Роль</th><th>Дата регистрации</th><th>Заказы</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td>{c.email}</td><td><span className={'adm-status '+(c.role==='ADMIN'?'paid':'')}>{c.role==='ADMIN'?'Администратор':'Покупатель'}</span></td><td>{c.createdAt.toLocaleDateString('ru-RU')}</td><td>{c._count.orders}</td></tr>)}</tbody></table>{customers.length===0&&<div className="adm-empty-large"><Users size={40}/><h3>Пользователи не найдены</h3></div>}</div></div>
 <p className="adm-overline">В этой версии список доступен только для просмотра. Изменение ролей и удаление пользователей через панель отключены из соображений безопасности.</p>
 <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>{page>1&&<Link href={'/admin/customers?'+qs+'page='+(page-1)}>← Назад</Link>}{page<pages&&<Link href={'/admin/customers?'+qs+'page='+(page+1)}>Далее →</Link>}</div></div>
 </>;
}
