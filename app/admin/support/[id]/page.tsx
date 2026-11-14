import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ExternalLink,LockKeyhole} from 'lucide-react';
import {db} from '../../../../lib/db';
import {currentUser} from '../../../../lib/auth';
import {hasPermission} from '../../../../lib/permissions';
import SupportThread from '../../../../components/support/SupportThread';
import {ticketStatusLabel,ticketPriorityLabel} from '../../../../lib/support-schemas';

export const dynamic='force-dynamic';
export default async function StaffTicket({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user||!hasPermission(user.role,'support'))notFound();
  const {id}=await params;
  const ticket=await db.supportTicket.findUnique({
    where:{id},include:{
      customer:{select:{email:true}},
      assignedTo:{select:{email:true}},
      messages:{orderBy:{createdAt:'asc'},include:{author:{select:{email:true,role:true}}}}
    }
  });
  if(!ticket)notFound();
  return <>
    <div className="adm-head"><div>
      <Link href="/admin/support" className="support-back"><ArrowLeft size={16}/> Список обращений</Link>
      <div className="adm-eyebrow">SUPPORT / #{ticket.id.slice(-8)}</div>
      <h1>{ticket.subject}</h1>
      <p>Покупатель: {ticket.customer.email}. Создано: {ticket.createdAt.toLocaleString('ru-RU')}</p>
    </div>{ticket.orderId&&user.role==='ADMIN'&&
      <Link href={'/admin/orders?q='+encodeURIComponent(ticket.orderId)} className="adm-btn">
        Заказ #{ticket.orderId.slice(-8)} <ExternalLink size={16}/>
      </Link>}</div>
    <div className="support-staff-metadata">
      <span>Статус: <strong>{ticketStatusLabel[ticket.status]}</strong></span>
      <span>Приоритет: <strong>{ticketPriorityLabel[ticket.priority]}</strong></span>
      <span>Исполнитель: <strong>{ticket.assignedTo?.email||'Не назначен'}</strong></span>
      {!ticket.orderId&&<span><LockKeyhole size={13}/> Без привязанного заказа</span>}
    </div>
    <SupportThread staff ticketId={id} actorId={user.id}
      status={ticket.status} priority={ticket.priority} assignedToId={ticket.assignedToId}
      messages={ticket.messages.map(m=>({
        id:m.id,body:m.body,internal:m.internal,
        author:m.authorId===ticket.customerId?'Покупатель':m.author.email,
        mine:m.authorId===user.id,createdAt:m.createdAt.toISOString()
      }))}/>
  </>;
}
