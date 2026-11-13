import { db } from '../../lib/db';
import { Prisma } from '@prisma/client';
import Link from 'next/link';
import { Search, PackageSearch, ArrowRight } from 'lucide-react';
export const dynamic='force-dynamic';
export default async function Catalog({searchParams}:{searchParams:Promise<{q?:string;category?:string;page?:string}>}){
 const params=await searchParams;const q=(params.q||'').trim().slice(0,80);const category=(params.category||'').slice(0,80);const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
 const where:Prisma.ProductWhereInput={status:'ACTIVE',...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{description:{contains:q,mode:'insensitive'}}]}:{}),...(category?{category:{slug:category}}:{})};
 const [categories,total,products]=await Promise.all([db.category.findMany({orderBy:{name:'asc'}}),db.product.count({where}),db.product.findMany({where,include:{category:true},orderBy:{createdAt:'desc'},skip:(page-1)*24,take:24})]);
 const pages=Math.max(1,Math.ceil(total/24));
 const link=(pageNo:number)=>{const p=new URLSearchParams();if(q)p.set('q',q);if(category)p.set('category',category);p.set('page',String(pageNo));return '/catalog?'+p;};
 return <main className="catalog-wrap"><div className="catalog-banner"><div className="eyebrow">МАГАЗИН / КАТАЛОГ</div><h1>Выбирай своё.</h1><p>Услуги и цифровые товары — в одном каталоге. Все покупки в демо-режиме без оплаты.</p></div>
 <div className="catalog-body"><form method="get" className="catalog-search"><Search size={20}/><input name="q" placeholder="Что ищем?" defaultValue={q}/>{category&&<input type="hidden" name="category" value={category}/>}<button className="button">Поиск</button></form><nav className="catalog-categories" aria-label="Категории товаров"><Link href="/catalog" className={!category?'selected':''}>Все товары</Link>{categories.map(c=><Link key={c.id} className={category===c.slug?'selected':''} href={'/catalog?category='+encodeURIComponent(c.slug)}>{c.name}</Link>)}</nav>
 <div className="catalog-heading"><h2>Предложения <span>({total})</span></h2><span>Актуальные товары</span></div>
 {products.length?<div className="products">{products.map(p=><Link href={'/product/'+p.slug} className="store-product" key={p.id}><div className="store-product-image">{p.imageUrl?<img src={p.imageUrl} alt={p.name} loading="lazy"/>:<span>STANDOFF<em>SHOP</em></span>}</div><div className="store-product-body"><small>{p.category.name}</small><h3>{p.name}</h3><p>{p.description.length>95?p.description.slice(0,95)+'…':p.description}</p><div className="store-product-bottom"><strong>{(p.priceKopecks/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'})}</strong><ArrowRight size={18}/></div></div></Link>)}</div>:
 <div className="catalog-empty"><PackageSearch size={44}/><h3>Пока ничего не найдено</h3><p>Попробуйте другой запрос или измените категорию. Если каталог пуст, администратор ещё не опубликовал товары.</p><Link href="/catalog" className="button">Все категории</Link></div>}
 {pages>1&&<div className="catalog-pages">{page>1&&<Link href={link(page-1)}>← Назад</Link>}<span>{page} / {pages}</span>{page<pages&&<Link href={link(page+1)}>Далее →</Link>}</div>}
 </div></main>;
}
