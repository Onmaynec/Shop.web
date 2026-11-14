import { db } from '../../lib/db';
import { Prisma } from '@prisma/client';
import Link from 'next/link';
import { Search, PackageSearch, ArrowUpRight, SlidersHorizontal } from 'lucide-react';

export const dynamic='force-dynamic';
type SearchParams={q?:string;category?:string;tag?:string;min?:string;max?:string;sort?:string;page?:string};
const money=(n:number)=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
function numeric(value:string|undefined){
  if(!value||!/^\d{1,8}(?:\.\d{1,2})?$/.test(value))return undefined;
  return Math.round(Number(value)*100);
}

export default async function Catalog({searchParams}:{searchParams:Promise<SearchParams>}){
  const params=await searchParams;
  const q=(params.q||'').trim().slice(0,80);
  const category=(params.category||'').slice(0,80);
  const tag=(params.tag||'').trim().slice(0,35);
  const min=numeric(params.min),max=numeric(params.max);
  const sort=['newest','price-asc','price-desc','title'].includes(params.sort||'')?params.sort:'newest';
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const categories=await db.category.findMany({
    orderBy:[{parentId:'asc'},{name:'asc'}],
    select:{id:true,parentId:true,name:true,slug:true,children:{select:{id:true}}}
  });
  const target=categories.find(c=>c.slug===category);
  const chosen=target?[target.id,...target.children.map(c=>c.id)]:[];
  const bound:Prisma.IntFilter={...(min!==undefined?{gte:min}:{}),...(max!==undefined?{lte:max}:{})};
  const hasBound=min!==undefined||max!==undefined;
  const constraints:Prisma.ProductWhereInput[]=[];
  if(q)constraints.push({OR:[
    {name:{contains:q,mode:'insensitive'}},
    {description:{contains:q,mode:'insensitive'}},
    {sku:{contains:q,mode:'insensitive'}}
  ]});
  if(hasBound)constraints.push({OR:[
    {variants:{none:{active:true}},priceKopecks:bound},
    {variants:{some:{active:true,priceKopecks:bound}}}
  ]});
  const where:Prisma.ProductWhereInput={
    status:'ACTIVE',
    ...(constraints.length?{AND:constraints}:{}),
    ...(target?{categoryId:{in:chosen}}:{}),
    ...(category&&!target?{id:{in:[]}}:{}),
    ...(tag?{tags:{has:tag}}:{})
  };
  const orderBy:Prisma.ProductOrderByWithRelationInput=sort==='price-asc'?{priceKopecks:'asc'}:
    sort==='price-desc'?{priceKopecks:'desc'}:sort==='title'?{name:'asc'}:{createdAt:'desc'};
  const [total,products]=await Promise.all([
    db.product.count({where}),
    db.product.findMany({
      where,
      include:{
        category:{select:{name:true}},
        images:{orderBy:{position:'asc'},take:1},
        variants:{where:{active:true},select:{priceKopecks:true}}
      },
      orderBy,skip:(page-1)*24,take:24
    })
  ]);
  const pages=Math.max(1,Math.ceil(total/24));
  const filters=(options:Partial<SearchParams>)=>{
    const u=new URLSearchParams();
    const current={q,category,tag,min:params.min||'',max:params.max||'',sort:sort||''};
    for(const [key,value] of Object.entries({...current,...options}))if(value)u.set(key,value);
    return '/catalog'+(u.size?'?'+u.toString():'');
  };
  return <main className="catalog-wrap">
    <section className="catalog-banner">
      <div className="eyebrow">STANDOFFSHOP / КАТАЛОГ</div>
      <h1>Выбирай своё.</h1>
      <p>Подбор цифровых услуг, понятные характеристики, варианты предложений. Магазин работает в демо-режиме.</p>
    </section>
    <div className="catalog-body">
      <form method="get" className="catalog-advanced-filters">
        <label className="catalog-field search"><Search size={18}/><input name="q" type="search" placeholder="Название, артикул, услуга..." defaultValue={q} maxLength={80}/></label>
        {category&&<input type="hidden" name="category" value={category}/>}
        {tag&&<input type="hidden" name="tag" value={tag}/>}
        <label className="catalog-field compact"><span>От, ₽</span><input name="min" type="number" min="0" max="99999999" step=".01" defaultValue={params.min||''} placeholder="0"/></label>
        <label className="catalog-field compact"><span>До, ₽</span><input name="max" type="number" min="0" max="99999999" step=".01" defaultValue={params.max||''} placeholder="Без лимита"/></label>
        <label className="catalog-field select"><SlidersHorizontal size={17}/><select name="sort" defaultValue={sort} aria-label="Сортировка">
          <option value="newest">Сначала новые</option>
          <option value="price-asc">Базовая цена: по возрастанию</option>
          <option value="price-desc">Базовая цена: по убыванию</option>
          <option value="title">По названию</option>
        </select></label>
        <button className="button" type="submit">Применить</button>
      </form>
      <nav className="catalog-categories" aria-label="Категории товаров">
        <Link href={filters({category:''})} className={!category?'selected':''}>Все товары</Link>
        {categories.filter(c=>!c.parentId).map(root=><div key={root.id} className="catalog-category-group">
          <Link href={filters({category:root.slug})} className={category===root.slug?'selected':''}>{root.name}</Link>
          {categories.filter(c=>c.parentId===root.id).map(child=><Link key={child.id} href={filters({category:child.slug})} className={'catalog-child'+(category===child.slug?' selected':'')}>{child.name}</Link>)}
        </div>)}
      </nav>
      {tag&&<div className="catalog-active-tag">Тег: <strong>{tag}</strong> <Link href={filters({tag:''})}>Сбросить ×</Link></div>}
      <div className="catalog-heading"><h2>Предложения <span>({total})</span></h2><span>Доступные сейчас</span></div>
      {products.length?<div className="products">{products.map(p=>{
        const image=p.images[0]?.url||p.imageUrl;
        const price=p.variants.length?Math.min(...p.variants.map(v=>v.priceKopecks)):p.priceKopecks;
        return <Link href={'/product/'+p.slug} className="store-product" key={p.id}>
          <div className="store-product-image">{image?<img src={image} alt={p.name} loading="lazy"/>:<span>STANDOFF<em>SHOP</em></span>}</div>
          <div className="store-product-body">
            <small>{p.category.name}{p.sku?' · '+p.sku:''}</small>
            <h3>{p.name}</h3>
            <p>{p.description.length>95?p.description.slice(0,95)+'…':p.description}</p>
            {p.tags.length>0&&<div className="store-tags">{p.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div>}
            <div className="store-product-bottom"><strong>{p.variants.length?'от ':''}{money(price)}</strong><ArrowUpRight size={18}/></div>
          </div>
        </Link>;
      })}</div>:
        <div className="catalog-empty"><PackageSearch size={44}/><h3>Товары не найдены</h3><p>Попробуйте изменить поиск, категорию или диапазон цен.</p><Link href="/catalog" className="button">Сбросить фильтры</Link></div>}
      {pages>1&&<nav className="catalog-pages" aria-label="Страницы каталога">
        {page>1&&<Link href={filters({page:String(page-1)})}>← Назад</Link>}
        <span>{page} / {pages}</span>
        {page<pages&&<Link href={filters({page:String(page+1)})}>Далее →</Link>}
      </nav>}
    </div>
  </main>;
}
