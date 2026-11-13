import { db } from '../../../lib/db';
import { notFound } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function ProductPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const p=await db.product.findUnique({where:{slug},include:{category:true}});if(!p||p.status!=='ACTIVE')notFound();return <main className="content"><div className="eyebrow">КАТАЛОГ / {p.category.name}</div><h1>{p.name}</h1><p className="muted">{p.description}</p><h2>{(p.priceKopecks/100).toLocaleString('ru-RU')} ₽</h2><div className="notice">Оформление платежей пока недоступно. Это демонстрационная версия.</div></main>}
