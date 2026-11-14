import Link from 'next/link';
import {db} from '../../lib/db';
import {currentUser} from '../../lib/auth';
import {ticketStatusLabel} from '../../lib/support-schemas';
import SupportCreate from '../../components/support/SupportCreate';
import {Headset,ArrowUpRight,LockKeyhole} from 'lucide-react';

export const dynamic='force-dynamic';
export default async function SupportHome({searchParams}:{
  searchParams:Promise<{order?:string}>
}){
  const user=await currentUser();
  if(!user)return <main className="content support-page">
    <div className="eyebrow">STANDOFFSHOP / ПОМОЩЬ</div><h1>Центр поддержки</h1>
    <p className="muted">Войдите, чтобы создать обращение или просмотреть историю переписки.</p>
    <Link href="/account" className="button button-light"><LockKeyhole size={16}/> Войти в аккаунт</Link>
  </main>;
  const params=await searchParams;
  const [tickets,orders]=await Promise.all([
    db.supportTicket.findMany({
      where:{customerId:user.id},orderBy:{updatedAt:'desc'},take:40,
      select:{id:true,subject:true,status:true,updatedAt:true,orderId:true,
        _count:{select:{messages:true}}}
    }),
    db.order.findMany({
      where:{userId:user.id},orderBy:{createdAt:'desc'},take:30,
      select:{id:true,createdAt:true}
    })
  ]);
  return <main className="content support-page">
    <div className="eyebrow">STANDOFFSHOP / CUSTOMER CARE</div>
    <h1>Центр поддержки</h1>
    <p className="muted">Вопросы о заказах, доставке цифровых материалов и работе магазина.</p>
    <div className="support-home-grid">
      <section className="support-card">
        <SupportCreate orders={orders.map(o=>({id:o.id,createdAt:o.createdAt.toISOString()}))}
          defaultOrder={orders.some(o=>o.id===params.order)?params.order||'':''}/>
      </section>
      <section className="support-card">
        <div className="support-card-heading"><Headset size={19}/><h2>Ваши обращения</h2>
          <span>{tickets.length}</span></div>
        {!tickets.length?<p className="support-hint">Вы ещё не обращались в поддержку.</p>:
          <div className="support-ticket-list">{tickets.map(t=>
            <Link key={t.id} href={'/support/'+t.id} className="support-ticket-link">
              <div><strong>{t.subject}</strong>
                <small>#{t.id.slice(-8)} · {t._count.messages} сообщений ·
                  {new Date(t.updatedAt).toLocaleDateString('ru-RU')}</small></div>
              <span className={'support-status '+t.status.toLowerCase()}>{ticketStatusLabel[t.status]}</span>
              <ArrowUpRight size={16}/>
            </Link>)}</div>}
      </section>
    </div>
  </main>;
}
