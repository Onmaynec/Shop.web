import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft,Download,PackageCheck,LockKeyhole } from 'lucide-react';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/auth';
import { hasVerifiedPayment,statusTitle } from '../../../../lib/order-operations';

export const dynamic='force-dynamic';
const money=(n:number)=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

export default async function CustomerOrder({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user)notFound();
  const {id}=await params;
  const order=await db.order.findFirst({
    where:{id,userId:user.id},
    include:{
      items:true,
      activities:{where:{visibility:'CUSTOMER'},orderBy:{createdAt:'asc'}},
      tasks:{select:{id:true,status:true}},
      deliveries:{where:{releasedAt:{not:null},revokedAt:null},
        select:{id:true,originalName:true,bytes:true}}
    }
  });
  if(!order)notFound();
  const eligible=order.status==='FULFILLED'&&await db.$transaction(tx=>hasVerifiedPayment(tx,order.id));
  const done=order.tasks.filter(t=>t.status==='DONE').length;
  return <main className="content customer-order">
    <Link href="/account" className="product-back"><ArrowLeft size={16}/> Мои заказы</Link>
    <div className="eyebrow">STANDOFFSHOP / ЗАКАЗ</div>
    <h1>Заказ #{order.id.slice(-8)}</h1>
    <p className="muted">{new Date(order.createdAt).toLocaleString('ru-RU')} · {statusTitle(order.status)}</p>
    <div className="customer-order-grid">
      <section className="account-panel"><h2>Состав заказа</h2>
        {order.items.map(item=><div className="customer-order-line" key={item.id}>
          <div><strong>{item.nameSnapshot}</strong>
            {item.variantSnapshot&&<small>{item.variantSnapshot}</small>}
            {item.skuSnapshot&&<small>SKU: {item.skuSnapshot}</small>}
          </div><span>{item.quantity} × {money(item.unitPriceKopecks)}</span>
        </div>)}
        <div className="customer-order-total"><span>Итого</span><strong>{money(order.totalKopecks)}</strong></div>
        <div className="customer-progress"><PackageCheck size={18}/>
          {order.tasks.length?('Выполнено позиций: '+done+' из '+order.tasks.length):
            'Очередь исполнения пока не сформирована'}
        </div>
        <div className="customer-delivery"><h2>Материалы</h2>
          {eligible&&order.deliveries.length?
            order.deliveries.map(asset=><Link key={asset.id} className="customer-download"
              href={'/api/me/orders/'+order.id+'/downloads/'+asset.id}>
              <Download size={17}/><span>{asset.originalName}</span>
              <small>{(asset.bytes/1024).toFixed(1)} КБ</small></Link>):
            <p className="muted"><LockKeyhole size={15}/> Файлов для скачивания нет. Доступ открывается после подтверждённой оплаты, выполнения заказа и публикации материала сотрудником.</p>}
        </div>
      </section>
      <section className="account-panel"><h2>История заказа</h2>
        <div className="order-timeline">{order.activities.map(item=><div className="order-timeline-event" key={item.id}>
          <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString('ru-RU')}</time>
          <strong>{item.title}</strong>
          {item.message&&<p>{item.message}</p>}
        </div>)}</div>
        {!order.activities.length&&<p className="muted">История пока не сформирована.</p>}
      </section>
    </div>
    <p className="product-alert">Сейчас в магазине нет реального эквайринга. Тестовые оплаты и тестовые файлы не означают реальную покупку.</p>
  </main>;
}
