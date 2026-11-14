'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type {UserRole} from '@prisma/client';
import { hasPermission,staffLanding,type Permission } from '../../lib/permissions';
import { LayoutDashboard,Package,Layers3,ReceiptText,Users,ArrowUpRight,
  ShieldCheck,ScrollText,PanelsTopLeft,ClipboardList,Headset,UserCog,ChartNoAxesCombined,Activity } from 'lucide-react';
const links:{href:string;label:string;Icon:typeof LayoutDashboard;permission:Permission}[]=[
  {href:'/admin',label:'Обзор',Icon:LayoutDashboard,permission:'admin'},
  {href:'/admin/products',label:'Товары',Icon:Package,permission:'admin'},
  {href:'/admin/categories',label:'Категории',Icon:Layers3,permission:'admin'},
  {href:'/admin/content',label:'Главная страница',Icon:PanelsTopLeft,permission:'admin'},
  {href:'/admin/orders',label:'Заказы',Icon:ReceiptText,permission:'admin'},
  {href:'/admin/queue',label:'Очередь',Icon:ClipboardList,permission:'fulfillment'},
  {href:'/admin/support',label:'Обращения',Icon:Headset,permission:'support'},
  {href:'/admin/operations',label:'Операции и отчёты',Icon:ChartNoAxesCombined,permission:'admin'},
  {href:'/admin/staff',label:'Сотрудники',Icon:UserCog,permission:'admin'},
  {href:'/admin/readiness',label:'Готовность',Icon:Activity,permission:'admin'},
  {href:'/admin/customers',label:'Покупатели',Icon:Users,permission:'admin'},
  {href:'/admin/audit',label:'Аудит',Icon:ScrollText,permission:'admin'}
];
export default function AdminNav({email,role}:{email:string;role:UserRole}){
  const path=usePathname();
  return <aside className="adm-sidebar">
    <Link href="/" className="adm-brand"><span className="adm-brand-mark">S<span>2</span></span>
      <span>STANDOFF<em>SHOP</em><small>CONTROL CENTER</small></span></Link>
    <div className="adm-nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
    <nav className="adm-nav" aria-label="Меню сотрудников">
      {links.filter(x=>hasPermission(role,x.permission)).map(({href,label,Icon})=>{
        const active=href==='/admin'?path==='/admin':path===href||path.startsWith(href+'/');
        return <Link key={href} href={href} className={'adm-nav-link'+(active?' active':'')}
          aria-current={active?'page':undefined}><Icon size={18}/><span>{label}</span></Link>;
      })}
    </nav>
    <div className="adm-sidebar-bottom">
      <div className="adm-role"><ShieldCheck size={18}/><span><strong>
        {role==='ADMIN'?'Администратор':role==='SUPPORT'?'Поддержка':'Исполнитель'}
      </strong><small title={email}>{email}</small></span></div>
      <Link className="adm-back" href={staffLanding(role)}>Моё рабочее пространство <ArrowUpRight size={16}/></Link>
      <Link className="adm-back" href="/">Вернуться в магазин <ArrowUpRight size={16}/></Link>
    </div>
  </aside>;
}
