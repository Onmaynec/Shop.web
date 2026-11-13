import Link from 'next/link';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return <main className="state-page">
    <div className="state-code">404</div>
    <div className="eyebrow">STANDOFFSHOP / PAGE NOT FOUND</div>
    <h1>Такой страницы нет.</h1>
    <p>Возможно, адрес изменился или товар больше не доступен.</p>
    <div className="state-actions"><Link className="button button-light" href="/catalog">Открыть каталог <ArrowUpRight size={17}/></Link><Link className="button button-ghost" href="/">На главную <ArrowLeft size={17}/></Link></div>
  </main>;
}
