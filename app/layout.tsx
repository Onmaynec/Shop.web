import Link from 'next/link';
import './style.css';
export const metadata={title:'StandoffShop — цифровой магазин',description:'Независимый магазин цифровых товаров и услуг для игроков Standoff 2'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body><header className="header"><Link className="logo" href="/">STANDOFF<span>SHOP</span></Link><nav><Link href="/">Главная</Link><Link href="/catalog">Каталог</Link><Link href="/cart">Корзина</Link><Link href="/account">Аккаунт</Link></nav><span className="demo">DEMO · ПЛАТЕЖИ ОТКЛЮЧЕНЫ</span></header>{children}<footer>© StandoffShop · Независимый проект, не связанный с разработчиками Standoff 2.</footer></body></html>}
