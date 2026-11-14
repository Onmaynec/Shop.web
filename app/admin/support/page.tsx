import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Prisma} from '@prisma/client';
import {Headset,Search,ArrowUpRight} from 'lucide-react';
import {db} from '../../../lib/db';
import {currentUser} from '../../../lib/auth';
import {hasPermission} from '../../../lib/permissions';
import {ticketPriorityLabel,ticketStatusLabel} from '../../../lib/support-schemas';

export const dynamic='force-dynamic';
export default async function SupportAdmin({searchParams}:{
  searchParams:Promise<{q?:string;status?:string;page?:string}>
}){
  const user=await currentUser();
  if(!user||!hasPermission(user.role,'support'))notFound();
  const params=await searchParams;
  const q=(params.q||'').trim().slice(0,80);
  const status=['OPEN','WAITING_CUSTOMER','CLOSED'].includes(params.status||'')
    ?params.status as 'OPEN'|'WAITING_CUSTOMER'|'CLOSED':undefined;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where:Prisma.SupportTicketWhereInput={
    ...(status?{status}:{}),
    ...(q?{OR:[
      {subject:{contains:q,mode:'insensitive'}},
      {id:{contains:q}},
      {customer:{email:{contains:q,mode:'insensitive'}}}
    ]}:{})
  };
  const [total,tickets,openCount]=await Promise.all([
    db.supportTicket.count({where}),
    db.supportTicket.findMany({
      where,orderBy:[{priority:'desc'},{updatedAt:'desc'}],
      skip:(page-1)*25,take:25,
      include:{customer:{select:{email:true}},assignedTo:{select:{email:true}},
        _count:{select:{messages:true}}}
    }),
    db.supportTicket.count({where:{status:'OPEN'}})
  ]);
  const query=new URLSearchParams();
  if(q)query.set('q',q);if(status)query.set('status',status);
  const pages=Math.max(1,Math.ceil(total/25));
  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">OPERATIONS / SUPPORT DESK</div>
      <h1>Обращения покупателей</h1>
      <p>Открытых: {openCount}. Найдено по фильтрам: {total}.</p>
    </div><Link href="/support" className="adm-btn"><Headset size={16}/> Центр поддержки <ArrowUpRight size={14}/></Link></div>
    <form action="/admin/support" method="get" className="adm-toolbar">
      <input className="adm-field adm-search" name="q" defaultValue={q}
        maxLength={80} placeholder="Тема, номер или email..."/>
      <select className="adm-field adm-filter" name="status" defaultValue={status||''}
        aria-label="Статус обращения">
        <option value="">Все статусы</option>
        <option value="OPEN">Открыты</option>
        <option value="WAITING_CUSTOMER">Ожидают покупателя</option>
        <option value="CLOSED">Закрыты</option>
      </select>
      <button className="adm-btn"><Search size={16}/> Найти</button>
    </form>
    <section className="adm-card">
      <div className="adm-table-wrap"><table className="adm-table">
        <thead><tr><th>Обращение</th><th>Покупатель</th><th>Приоритет</th>
          <th>Статус</th><th>Ответственный</th><th>Последнее изменение</th></tr></thead>
        <tbody>{tickets.map(t=><tr key={t.id}>
          <td><Link href={'/admin/support/'+t.id} className="support-table-title">
            <strong>{t.subject}</strong><small>#{t.id.slice(-8)} · {t._count.messages} сообщений</small>
          </Link></td>
          <td>{t.customer.email}</td>
          <td><span className={'support-priority '+t.priority.toLowerCase()}>
            {ticketPriorityLabel[t.priority]}</span></td>
          <td><span className={'support-status '+t.status.toLowerCase()}>
            {ticketStatusLabel[t.status]}</span></td>
          <td>{t.assignedTo?.email||'Не назначен'}</td>
          <td>{t.updatedAt.toLocaleDateString('ru-RU')}</td>
        </tr>)}</tbody>
      </table></div>
      {!tickets.length&&<div className="adm-empty-large"><Headset size={38}/>
        <h3>Обращения не найдены</h3><p>Измените фильтры или дождитесь сообщения покупателя.</p>
      </div>}
    </section>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>
      {page>1&&<Link href={'/admin/support?'+query.toString()+(query.size?'&':'')+'page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/support?'+query.toString()+(query.size?'&':'')+'page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
