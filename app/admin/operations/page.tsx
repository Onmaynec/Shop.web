import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Prisma} from '@prisma/client';
import {db} from '../../../lib/db';
import {currentUser} from '../../../lib/auth';
import {ArrowUpRight,BarChart3,ClipboardList,Download,Headset,
  ShieldCheck,ShoppingBag} from 'lucide-react';

export const dynamic='force-dynamic';
const money=(n:number)=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
const labels:Record<string,string>={
  PENDING_PAYMENT:'Ожидают оплаты',PAID:'Подтверждена оплата',
  PROCESSING:'В работе',FULFILLED:'Завершены',CANCELLED:'Отменены',REFUNDED:'Возвраты'
};

export default async function Operations(){
  const actor=await currentUser();if(!actor||actor.role!=='ADMIN')notFound();
  const from=new Date(Date.now()-30*86400000);
  const [orders,tasks,tickets,payments,oldestOpen,totalOrders]=await Promise.all([
    db.order.groupBy({by:['status'],where:{createdAt:{gte:from}},_count:{id:true}}),
    db.orderTask.groupBy({by:['status'],_count:{id:true}}),
    db.supportTicket.groupBy({by:['status'],_count:{id:true}}),
    db.paymentEvent.groupBy({
      by:['provider','eventType'],where:{createdAt:{gte:from}},
      _count:{id:true},_sum:{amountKopecks:true}
    }),
    db.orderTask.findFirst({
      where:{status:{in:['OPEN','IN_PROGRESS','BLOCKED']},
        order:{status:{in:['PAID','PROCESSING']}}},
      orderBy:{createdAt:'asc'},select:{createdAt:true}
    }),
    db.order.count({where:{createdAt:{gte:from}}})
  ]);
  const real=payments.filter(p=>p.provider!=='sandbox');
  const sandbox=payments.filter(p=>p.provider==='sandbox');
  const sum=(data:typeof payments,type:string)=>data.filter(p=>p.eventType===type)
    .reduce((acc,p)=>acc+(p._sum.amountKopecks||0),0);
  const realNet=sum(real,'payment.succeeded')-sum(real,'payment.refunded');
  const sandboxNet=sum(sandbox,'payment.succeeded')-sum(sandbox,'payment.refunded');
  const queue=tasks.filter(x=>x.status!=='DONE').reduce((n,x)=>n+x._count.id,0);
  const supportOpen=tickets.filter(x=>x.status!=='CLOSED').reduce((n,x)=>n+x._count.id,0);
  const max=Math.max(1,...orders.map(x=>x._count.id));
  const defaultTo=new Date().toISOString().slice(0,10);
  const defaultFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">PRE-RELEASE / STORE OPERATIONS</div>
      <h1>Операционная аналитика</h1>
      <p>Заказы и подтверждённые события за последние 30 дней. Задачи и обращения — на текущий момент.</p>
    </div></div>
    <div className="adm-hint">Реальный эквайринг не подключён. Sandbox-операции показаны отдельно и НЕ являются
      денежной выручкой. Суммы основаны на событиях платёжного журнала, а не на ручных статусах заказа.</div>
    <div className="adm-stat-grid operations-stats">
      {[
        {title:'Заказов за 30 дней',value:String(totalOrders),detail:'Все статусы',Icon:ShoppingBag},
        {title:'Задач в работе',value:String(queue),detail:'Не завершены',Icon:ClipboardList},
        {title:'Обращений в работе',value:String(supportOpen),detail:'Не закрыты',Icon:Headset},
        {title:'Подтверждено вне sandbox',value:money(realNet),detail:'Операции за 30 дней, до сверки',Icon:ShieldCheck}
      ].map(({title,value,detail,Icon})=><div className="adm-stat" key={title}>
        <div className="adm-stat-top"><span>{title}</span><Icon size={19}/></div>
        <strong>{value}</strong><small>{detail}</small>
      </div>)}
    </div>
    <div className="operations-grid">
      <section className="adm-card operations-panel">
        <div className="adm-card-head"><div><h2><BarChart3 size={17}/> Статусы заказов</h2>
          <p>30 дней · без интерпретации как оплаченных продаж</p></div></div>
        <div className="operations-bars">
          {Object.entries(labels).map(([status,title])=>{
            const amount=orders.find(x=>x.status===status)?._count.id||0;
            return <div className="operations-bar" key={status}>
              <div><span>{title}</span><strong>{amount}</strong></div>
              <div className="operations-bar-track">
                <span style={{width:(amount/max*100)+'%'}}/>
              </div>
            </div>;
          })}
        </div>
      </section>
      <section className="adm-card operations-panel">
        <div className="adm-card-head"><div><h2>Нагрузка команды</h2>
          <p>Текущие незавершённые работы</p></div></div>
        <div className="operations-breakdown">
          {tasks.map(t=><div key={t.status}><span>{t.status}</span><strong>{t._count.id}</strong></div>)}
          <div><span>Возраст самой старой открытой задачи</span><strong>{oldestOpen?
            Math.max(0,Math.floor((Date.now()-oldestOpen.createdAt.getTime())/3600000))+' ч':'Нет задач'}</strong></div>
        </div>
        <div className="operations-actions">
          <Link href="/admin/queue" className="adm-btn">Открыть очередь <ArrowUpRight size={15}/></Link>
          <Link href="/admin/support" className="adm-btn">Обращения <ArrowUpRight size={15}/></Link>
        </div>
      </section>
      <section className="adm-card operations-panel">
        <div className="adm-card-head"><div><h2>Платёжный журнал</h2>
          <p>Отдельные тестовые и нетестовые события</p></div></div>
        <div className="operations-ledger">
          <div><span>Не-sandbox события, нетто</span><strong>{money(realNet)}</strong></div>
          <div><span>Sandbox события, нетто (только тест)</span><strong>{money(sandboxNet)}</strong></div>
          <small>Это не бухгалтерский учёт и не расчёт налоговой выручки. Нет комиссии, частичных возвратов и сверки с банком.</small>
        </div>
      </section>
      <section className="adm-card operations-panel">
        <div className="adm-card-head"><div><h2><Download size={17}/> Экспорт заказов</h2>
          <p>CSV для Excel и других табличных программ</p></div></div>
        <form className="operations-export" action="/api/admin/reports/orders" method="get">
          <label>С даты (UTC)<input className="adm-field" type="date" name="from" required defaultValue={defaultFrom}/></label>
          <label>По дату (UTC)<input className="adm-field" type="date" name="to" required defaultValue={defaultTo}/></label>
          <label>Статус<select className="adm-field" name="status">
            <option value="">Все</option>
            {Object.entries(labels).map(([value,title])=><option value={value} key={value}>{title}</option>)}
          </select></label>
          <button className="adm-btn primary" type="submit"><Download size={16}/> Скачать CSV</button>
        </form>
        <p className="adm-note">Максимум 93 дня и 5000 заказов. Файл может содержать персональные данные покупателей.
          Скачивание доступно только администратору и фиксируется в аудите.</p>
      </section>
    </div>
  </>;
}
