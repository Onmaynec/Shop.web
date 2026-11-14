'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Layers3, ReceiptText, Users, ArrowUpRight, ShieldCheck, ScrollText, PanelsTopLeft, ClipboardList } from 'lucide-react';
const links = [
  { href:'/admin', label:'Обзор', Icon:LayoutDashboard },
  { href:'/admin/products', label:'Товары', Icon:Package },
  { href:'/admin/categories', label:'Категории', Icon:Layers3 },
  { href:'/admin/content', label:'Главная страница', Icon:PanelsTopLeft },
  { href:'/admin/orders', label:'Заказы', Icon:ReceiptText },
  { href:'/admin/queue', label:'Очередь', Icon:ClipboardList },
  { href:'/admin/customers', label:'Покупатели', Icon:Users },
  { href:'/admin/audit', label:'Аудит', Icon:ScrollText }
];
export default function AdminNav({email}:{email:string}) {
  const path = usePathname();
  return <aside className="adm-sidebar">
    <Link href="/" className="adm-brand"><span className="adm-brand-mark">S<span>2</span></span><span>STANDOFF<em>SHOP</em><small>CONTROL CENTER</small></span></Link>
    <div className="adm-nav-caption">УПРАВЛЕНИЕ</div>
    <nav className="adm-nav" aria-label="Административное меню">{links.map(({href,label,Icon})=>{
      const active=href==='/admin'?path==='/admin':path.startsWith(href);
      return <Link key={href} href={href} className={'adm-nav-link'+(active?' active':'')} aria-current={active?'page':undefined}><Icon size={18}/><span>{label}</span></Link>;
    })}</nav>
    <div className="adm-sidebar-bottom"><div className="adm-role"><ShieldCheck size={18}/><span><strong>Администратор</strong><small title={email}>{email}</small></span></div><Link className="adm-back" href="/">Вернуться в магазин <ArrowUpRight size={16}/></Link></div>
  </aside>;
}
