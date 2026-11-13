import Link from 'next/link';
import { ShoppingCart, UserRound, ArrowUpRight } from 'lucide-react';
import './style.css';
export const metadata={title:'StandoffShop — цифровые товары и услуги',description:'Независимый магазин цифровых товаров и услуг для игроков Standoff 2'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ru"><body><div className="site-announcement">Демонстрационная версия. <strong>Оплата и выдача товаров отключены.</strong></div>
 <header className="header site-header"><Link className="logo" href="/" aria-label="StandoffShop — главная">STANDOFF<span>SHOP</span><small>MARKETPLACE</small></Link>
 <nav aria-label="Основное меню"><Link href="/">Главная</Link><Link href="/catalog">Каталог <ArrowUpRight size={13}/></Link></nav>
 <div className="site-header-actions"><Link href="/cart" title="Корзина"><ShoppingCart size={18}/><span>Корзина</span></Link><Link href="/account" title="Личный кабинет"><UserRound size={18}/><span>Аккаунт</span></Link></div>
 </header>{children}
 <footer className="site-footer"><div><Link className="logo" href="/">STANDOFF<span>SHOP</span></Link><p>Независимый проект, не связанный с разработчиками Standoff 2.</p></div><div><Link href="/catalog">Каталог</Link><Link href="/account">Личный кабинет</Link><Link href="/cart">Корзина</Link></div><small>© StandoffShop. Демонстрационный режим.</small></footer>
 </body></html>;
}
