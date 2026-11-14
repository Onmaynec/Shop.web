import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import { Prisma, OrderStatus } from '@prisma/client';
import Link from 'next/link';
import OrderManager from '../../../components/admin/OrderManager';
import { sandboxEnabled } from '../../../lib/payments';
export const dynamic='force-dynamic';
export default async function OrdersPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}){
 const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
 const params=await searchParams;const q=(params.q||'').trim().slice(0,80);
 const status=['PENDING_PAYMENT','PAID','PROCESSING','FULFILLED','CANCELLED','REFUNDED'].includes(params.status||'')?params.status as OrderStatus:undefined;
 const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
 const where:Prisma.OrderWhereInput={...(status?{status}:{}),...(q?{OR:[{email:{contains:q,mode:'insensitive'}},{id:{contains:q}}]}:{})};
 const [total,orders]=await Promise.all([db.order.count({where}),db.order.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*20,take:20,include:{items:true,paymentEvents:{orderBy:{createdAt:'desc'}}}})]);
 const mapped=orders.map(o=>({id:o.id,email:o.email,status:o.status,totalKopecks:o.totalKopecks,createdAt:o.createdAt.toISOString(),items:o.items.map(i=>({id:i.id,name:i.nameSnapshot,unitPriceKopecks:i.unitPriceKopecks,quantity:i.quantity,sku:i.skuSnapshot,variant:i.variantSnapshot})),paymentEvents:o.paymentEvents.map(e=>({id:e.id,type:e.eventType,provider:e.provider,amountKopecks:e.amountKopecks,createdAt:e.createdAt.toISOString()}))}));
 const query=new URLSearchParams();if(q)query.set('q',q);if(status)query.set('status',status);const pages=Math.max(1,Math.ceil(total/20));
 return <><OrderManager initialOrders={mapped} total={total} query={q} filterStatus={status||''} sandboxEnabled={sandboxEnabled()}/>
 <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>{page>1&&<Link href={'/admin/orders?'+query.toString()+(query.size?'&':'')+'page='+(page-1)}>← Назад</Link>}{page<pages&&<Link href={'/admin/orders?'+query.toString()+(query.size?'&':'')+'page='+(page+1)}>Далее →</Link>}</div></div>
 </>;
}
