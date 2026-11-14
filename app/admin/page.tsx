import Link from 'next/link';
import { Package, ShoppingBag, Users, Clock3, ArrowUpRight } from 'lucide-react';
import { db } from '../../lib/db';
import { currentUser } from '../../lib/auth';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
const format = (kopecks:number) => (kopecks / 100).toLocaleString('ru-RU', { style:'currency', currency:'RUB' });
export default async function Dashboard() {
  const user=await currentUser(); if(!user||user.role!=='ADMIN')notFound();
  const [activeProducts,allProducts,allOrders,pendingOrders,customers,recentOrders,paidRevenue]=await Promise.all([
    db.product.count({where:{status:'ACTIVE'}}),db.product.count(),db.order.count(),
    db.order.count({where:{status:'PENDING_PAYMENT'}}),db.user.count(),
    db.order.findMany({orderBy:{createdAt:'desc'},take:6,select:{id:true,email:true,totalKopecks:true,status:true,createdAt:true}}),
    db.order.aggregate({where:{status:{in:['PAID','PROCESSING','FULFILLED']}},_sum:{totalKopecks:true}})
  ]);
  const stats=[
    {title:'Всего товаров',value:allProducts,detail:activeProducts+' опубликовано',Icon:Package},
    {title:'Всего заказов',value:allOrders,detail:'Все статусы',Icon:ShoppingBag},
    {title:'Ожидают оплаты',value:pendingOrders,detail:'Платёжный модуль отключён',Icon:Clock3},
    {title:'Зарегистрировано',value:customers,detail:'Аккаунты пользователей',Icon:Users}
  ];
  return <><div className="adm-head"><div><div className="adm-eyebrow">ОБЗОР МАГАЗИНА</div><h1>Панель управления</h1><p>Каталог, покупатели и заказы — в одном месте.</p></div><Link href="/admin/products" className="adm-btn primary"><Package size={17}/> Управлять товарами</Link></div>
    <div className="adm-stat-grid">{stats.map(({title,value,detail,Icon})=><div className="adm-stat" key={title}><div className="adm-stat-top"><span>{title}</span><Icon size={19}/></div><strong>{value.toLocaleString('ru-RU')}</strong><small>{detail}</small></div>)}</div>
    <div className="adm-columns"><section className="adm-card"><div className="adm-card-head"><div><h2>Последние заказы</h2><p>Актуальные обращения покупателей</p></div><Link href="/admin/orders">Все заказы <ArrowUpRight size={15}/></Link></div>
    <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Номер</th><th>Покупатель</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{recentOrders.map(o=><tr key={o.id}><td><Link href={'/admin/orders?q='+encodeURIComponent(o.id)} className="adm-id">#{o.id.slice(-8)}</Link></td><td>{o.email}</td><td>{format(o.totalKopecks)}</td><td><span className={'adm-status '+o.status.toLowerCase()}>{o.status==='PENDING_PAYMENT'?'Ожидает оплаты':o.status==='PAID'?'Оплачен':o.status==='PROCESSING'?'В обработке':o.status==='FULFILLED'?'Выполнен':o.status==='CANCELLED'?'Отменён':'Возврат'}</span></td></tr>)}</tbody></table>{recentOrders.length===0&&<div className="adm-empty">Заказов пока нет. Они появятся здесь после оформления.</div>}</div></section>
    <section className="adm-card"><div className="adm-card-head"><div><h2>Состояние магазина</h2><p>Подготовка к запуску</p></div></div><div className="adm-ops"><div><span>Каталог</span><strong>{activeProducts} активных</strong></div><div><span>Платежи</span><strong className="adm-warning">Не подключены</strong></div><div><span>Выдача товаров</span><strong className="adm-warning">Отключена</strong></div><div><span>Сумма заказов в оплаченных статусах (не выручка)</span><strong>{format(paidRevenue._sum.totalKopecks||0)}</strong></div></div><p className="adm-hint">Суммы в статусах PAID/PROCESSING/FULFILLED могут включать sandbox и не являются бухгалтерской выручкой. Администратор не может вручную подтвердить оплату.</p></section></div>
  </>;
}
