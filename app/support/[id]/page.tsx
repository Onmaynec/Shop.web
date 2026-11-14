import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft} from 'lucide-react';
import {db} from '../../../lib/db';
import {currentUser} from '../../../lib/auth';
import SupportThread from '../../../components/support/SupportThread';
import {ticketStatusLabel} from '../../../lib/support-schemas';

export const dynamic='force-dynamic';
export default async function CustomerTicket({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)notFound();
  const {id}=await params;
  const ticket=await db.supportTicket.findFirst({
    where:{id,customerId:user.id},
    include:{messages:{where:{internal:false},orderBy:{createdAt:'asc'},
      select:{id:true,authorId:true,body:true,createdAt:true,internal:true}}}
  });
  if(!ticket)notFound();
  return <main className="content support-page">
    <Link href="/support" className="product-back"><ArrowLeft size={16}/> Все обращения</Link>
    <div className="eyebrow">STANDOFFSHOP / SUPPORT / #{ticket.id.slice(-8)}</div>
    <h1>{ticket.subject}</h1>
    <p className="muted">Статус: {ticketStatusLabel[ticket.status]}.
      {ticket.orderId&&<> Связанный заказ: <Link href={'/account/orders/'+ticket.orderId}>
        #{ticket.orderId.slice(-8)}</Link>.</>}</p>
    <SupportThread ticketId={id} status={ticket.status}
      messages={ticket.messages.map(m=>({
        id:m.id,body:m.body,internal:m.internal,
        author:m.authorId===user.id?'Вы':'Служба поддержки',
        mine:m.authorId===user.id,createdAt:m.createdAt.toISOString()
      }))}/>
  </main>;
}
