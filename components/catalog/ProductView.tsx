import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2, Package } from 'lucide-react';
import AddToCart from '../AddToCart';
import ProductGallery from './ProductGallery';
import FavoriteButton from '../FavoriteButton';

type RecordSpec={name:string;value:string};
type ProductModel={
  id:string;name:string;slug:string;description:string;priceKopecks:number;status:string;
  sku:string|null;imageUrl:string|null;tags:string[];specs:unknown;
  category:{name:string};
  images:{id:string;url:string;alt:string;position:number}[];
  variants:{id:string;sku:string;label:string;priceKopecks:number;active:boolean;position:number}[];
};

function specsOf(value:unknown):RecordSpec[]{
  if(!Array.isArray(value))return [];
  return value.filter((row):row is RecordSpec=>Boolean(row)&&
    typeof row==='object'&&typeof row.name==='string'&&typeof row.value==='string').slice(0,16);
}
const money=(n:number)=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});

export default function ProductView({p,preview=false,favorite=false,signedIn=false}:{p:ProductModel;preview?:boolean;favorite?:boolean;signedIn?:boolean}){
  const gallery=p.images.map(i=>({url:i.url,alt:i.alt}));
  if(p.imageUrl&&!gallery.some(i=>i.url===p.imageUrl))gallery.unshift({url:p.imageUrl,alt:p.name});
  const specs=specsOf(p.specs);
  const activeVariants=p.variants.filter(v=>v.active);
  const lowest=activeVariants.length?Math.min(...activeVariants.map(v=>v.priceKopecks)):p.priceKopecks;
  return <main className="product-page">
    <Link href={preview?'/admin/products':'/catalog'} className="product-back"><ArrowLeft size={17}/> {preview?'Назад в управление':'Назад в каталог'}</Link>
    {preview&&<div className="product-alert">Предпросмотр: статус «{p.status}». Покупатели не видят черновики и архив.</div>}
    <div className="product-detail">
      <ProductGallery images={gallery} name={p.name}/>
      <div className="product-detail-info">
        <div className="eyebrow">{p.category.name.toUpperCase()}</div>
        <h1>{p.name}</h1>
        {p.sku&&<div className="product-sku">Артикул: <code>{p.sku}</code></div>}
        {p.tags.length>0&&<div className="product-tags">{p.tags.map(tag=><Link key={tag} href={'/catalog?tag='+encodeURIComponent(tag)}>{tag}</Link>)}</div>}
        <p className="product-description">{p.description}</p>
        {specs.length>0&&<section className="product-specs">
          <h2>Характеристики</h2>
          <dl>{specs.map((spec,i)=><div key={i}><dt>{spec.name}</dt><dd>{spec.value}</dd></div>)}</dl>
        </section>}
        <div className="product-price"><small>{activeVariants.length?'Стоимость от':'Стоимость'}</small>
          <strong>{money(lowest)}</strong></div>
        {!preview?<AddToCart productId={p.id} name={p.name} priceKopecks={p.priceKopecks}
          variants={activeVariants.map(v=>({id:v.id,label:v.label,sku:v.sku,priceKopecks:v.priceKopecks}))}/>:
          <Link className="button button-ghost" href="/admin/products">Вернуться к редактированию</Link>}
        {!preview&&<FavoriteButton productId={p.id} initial={favorite} signedIn={signedIn}/>}
        <div className="product-alert">Реальные платежи и автоматическая выдача отключены. Оформление создаёт неоплаченный демо-заказ.</div>
        <div className="product-points">
          <span><ShieldCheck size={18}/> Проверка цены на сервере</span>
          <span><CheckCircle2 size={18}/> История заказа сохраняется</span>
          <span><Package size={18}/> Тестовый режим</span>
        </div>
      </div>
    </div>
  </main>;
}
