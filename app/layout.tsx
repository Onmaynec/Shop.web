import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import SiteHeader from '../components/SiteHeader';
import './style.css';

export const metadata = {
  title: {default:'StandoffShop — цифровые товары и услуги',template:'%s | StandoffShop'},
  description:'Независимый магазин цифровых товаров и услуг для игроков Standoff 2'
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ru"><body>
    <div className="preview-bar"><span className="preview-dot" aria-hidden="true"/> Витрина работает в демонстрационном режиме <span className="preview-divider">/</span> Реальная оплата отключена</div>
    <SiteHeader/>
    {children}
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand"><Link href="/" className="footer-wordmark">STANDOFF<span>SHOP</span></Link><p>Цифровая витрина для игрового сообщества.<br/>Независимый проект, не аффилированный с разработчиками Standoff 2.</p></div>
        <div className="footer-menu"><span>Навигация</span><Link href="/catalog">Каталог <ArrowUpRight size={13}/></Link><Link href="/cart">Корзина <ArrowUpRight size={13}/></Link><Link href="/account">Личный кабинет <ArrowUpRight size={13}/></Link></div>
        <div className="footer-menu"><span>StandoffShop</span><p>Сейчас доступно создание тестовых заказов. Подключение эквайринга запланировано отдельно.</p></div>
      </div>
      <div className="footer-bottom"><span>© 2026 StandoffShop</span><span>Independent digital marketplace · v0.7.0</span><span>RU / RUB</span></div>
    </footer>
  </body></html>;
}
