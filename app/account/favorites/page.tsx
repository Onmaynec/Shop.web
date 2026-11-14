import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,Heart,ArrowUpRight} from 'lucide-react';
import {currentUser} from '../../../lib/auth';
import {db} from '../../../lib/db';
import FavoriteButton from '../../../components/FavoriteButton';

export const dynamic='force-dynamic';
const money=(v:number)=>(v/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
export default async function Favorites(){
  const user=await currentUser();if(!user)notFound();
  const favorites=await db.favorite.findMany({
    where:{userId:user.id},orderBy:{createdAt:'desc'},take:100,
    include:{product:{include:{
      images:{take:1,orderBy:{position:'asc'}},
      category:{select:{name:true}}
    }}}
  });
  return <main className="content favorites-page">
    <Link href="/account" className="product-back"><ArrowLeft size={16}/> Личный кабинет</Link>
    <div className="eyebrow">STANDOFFSHOP / SAVED PRODUCTS</div>
    <h1>Избранное</h1>
    <p className="muted">Сохранённые товары и услуги. В списке {favorites.length} предложений.</p>
    {!favorites.length?<div className="favorites-empty">
      <Heart size={42}/><h2>Пока ничего не сохранено</h2>
      <p className="muted">Откройте интересующий товар и нажмите «Добавить в избранное».</p>
      <Link className="button button-light" href="/catalog">Выбрать товары <ArrowUpRight size={16}/></Link>
    </div>:
      <div className="favorites-grid">{favorites.map(f=>{
        const p=f.product,active=p.status==='ACTIVE';
        const image=p.images[0]?.url||p.imageUrl;
        return <article className="favorite-card" key={p.id}>
          {active?<Link href={'/product/'+p.slug} className="favorite-card-image">
            {image?<img src={image} alt={p.name} loading="lazy"/>:<span>STANDOFFSHOP</span>}
          </Link>:<div className="favorite-card-image disabled">{image?
            <img src={image} alt="" loading="lazy"/>:<span>STANDOFFSHOP</span>}</div>}
          <div className="favorite-card-body">
            <span className="eyebrow">{p.category.name}</span>
            <h2>{active?<Link href={'/product/'+p.slug}>{p.name}</Link>:p.name}</h2>
            {active?<strong>{money(p.priceKopecks)}</strong>:<span className="muted">Временно недоступен</span>}
            <FavoriteButton productId={p.id} initial signedIn/>
          </div>
        </article>;
      })}</div>}
  </main>;
}
