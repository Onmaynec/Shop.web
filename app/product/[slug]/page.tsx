import { db } from '../../../lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2, Package } from 'lucide-react';
import AddToCart from '../../../components/AddToCart';
export const dynamic='force-dynamic';
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const p=await db.product.findUnique({where:{slug},include:{category:true}});
 if(!p||p.status!=='ACTIVE')notFound();
 return <main className="product-page"><Link href="/catalog" className="product-back"><ArrowLeft size={17}/> Назад в каталог</Link><div className="product-detail">
 <div className="product-detail-image">{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<div>STANDOFF<span>SHOP</span><small>DIGITAL GOODS</small></div>}</div>
 <div className="product-detail-info"><div className="eyebrow">{p.category.name.toUpperCase()}</div><h1>{p.name}</h1><p className="product-description">{p.description}</p><div className="product-price"><small>Стоимость</small><strong>{(p.priceKopecks/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'})}</strong></div><AddToCart productId={p.id} name={p.name} priceKopecks={p.priceKopecks}/><div className="product-alert">Реальные платежи не подключены. Добавление в корзину создаёт только демо-заказ.</div><div className="product-points"><span><ShieldCheck size={18}/> Серверная проверка цены</span><span><CheckCircle2 size={18}/> Заказ сохраняется в базе</span><span><Package size={18}/> Выдача отключена</span></div></div>
 </div></main>;
}
