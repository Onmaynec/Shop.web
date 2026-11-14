import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { currentUser } from '../../../lib/auth';
import { db } from '../../../lib/db';
import NotificationInbox from '../../../components/account/NotificationInbox';

export const dynamic='force-dynamic';
export default async function Notifications(){
  const user=await currentUser();
  if(!user)notFound();
  const records=await db.customerNotification.findMany({
    where:{userId:user.id},orderBy:{createdAt:'desc'},take:50
  });
  return <main className="content account-wrap">
    <Link href="/account" className="product-back"><ArrowLeft size={16}/> Личный кабинет</Link>
    <div className="eyebrow">STANDOFFSHOP / УВЕДОМЛЕНИЯ</div>
    <h1>Сообщения магазина</h1>
    <NotificationInbox initial={records.map(r=>({
      id:r.id,orderId:r.orderId,title:r.title,body:r.body,
      createdAt:r.createdAt.toISOString(),readAt:r.readAt?.toISOString()||null
    }))}/>
  </main>;
}
