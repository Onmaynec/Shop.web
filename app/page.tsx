import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Layers3, ShieldCheck, CreditCard, UserRound } from 'lucide-react';

const features = [
  {number:'01',title:'Единый каталог',description:'Все предложения в одном пространстве. Поиск, категории и прозрачные описания.',Icon:Layers3},
  {number:'02',title:'Понятные заказы',description:'Состав и стоимость фиксируются сервером. История остаётся в личном кабинете.',Icon:ShieldCheck},
  {number:'03',title:'Готовность к оплате',description:'Платёжная архитектура подготовлена. Реальные списания пока отключены.',Icon:CreditCard},
];

export default function Home() {
  return <main className="home">
    <section className="home-hero">
      <div className="hero-inner">
        <div className="hero-outline" aria-hidden="true">STANDOFF</div>
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow"><span className="tiny-square"/> DIGITAL MARKETPLACE / STANDOFF 2</div>
          <h1>Игровые товары.<br/><span>Без лишнего.</span></h1>
          <p>Один магазин для цифровых товаров и услуг. Минималистичный интерфейс, понятный каталог и контроль каждого заказа.</p>
          <div className="hero-buttons">
            <Link href="/catalog" className="button button-light">Открыть каталог <ArrowUpRight size={17}/></Link>
            <Link href="/account" className="button button-ghost">Личный кабинет <ArrowRight size={17}/></Link>
          </div>
          <div className="hero-footnote"><span className="pulse-dot"/> DEMO ENVIRONMENT <span className="hero-footnote-line"/> Платежи не подключены</div>
        </div>
        <div className="hero-bottom-label"><span>01 / СТАРТОВАЯ СТРАНИЦА</span><span>SCROLL TO EXPLORE ↓</span></div>
      </div>
    </section>

    <section className="section editorial-section">
      <div className="section-top"><span className="section-index">/ 01</span><span className="section-line"/><span className="section-index">ВОЗМОЖНОСТИ</span></div>
      <div className="section-heading"><div><h2>Всё важное.<br/><span>Ничего лишнего.</span></h2><p>Продуманная витрина для покупателя — быстрый выбор, аккуратные карточки, прозрачное оформление.</p></div><Link href="/catalog" className="text-link">Перейти к товарам <ArrowUpRight size={17}/></Link></div>
      <div className="feature-grid">
        {features.map(({number,title,description,Icon})=><article className="feature-card" key={number}>
          <div className="feature-card-top"><span>{number} / PRODUCT EXPERIENCE</span><Icon size={20}/></div>
          <div><h3>{title}</h3><p>{description}</p></div>
          <div className="feature-card-arrow"><ArrowUpRight size={18}/></div>
        </article>)}
      </div>
    </section>

    <section className="section process-section">
      <div className="section-top"><span className="section-index">/ 02</span><span className="section-line"/><span className="section-index">КАК ЭТО РАБОТАЕТ</span></div>
      <div className="process-layout"><div><h2>От выбора<br/>до заказа.</h2><p>Пока магазин работает в демо-режиме, можно изучить каталог и проверить весь путь оформления без списания средств.</p><Link href="/catalog" className="button button-light">Посмотреть каталог <ArrowUpRight size={16}/></Link></div>
        <div className="process-list">
          <div><span>01</span><div><h3>Найдите предложение</h3><p>Категории, поиск и подробные страницы.</p></div><ArrowUpRight size={17}/></div>
          <div><span>02</span><div><h3>Соберите корзину</h3><p>Изменяйте количество и проверяйте итог.</p></div><ArrowUpRight size={17}/></div>
          <div><span>03</span><div><h3>Создайте заказ</h3><p>Заказ сохраняется, оплата не производится.</p></div><ArrowUpRight size={17}/></div>
        </div>
      </div>
    </section>

    <section className="final-cta"><div><span className="eyebrow">STANDOFFSHOP / 2026</span><h2>Готовы начать?</h2><p>Откройте витрину и посмотрите доступные предложения.</p></div><Link className="button button-light" href="/catalog">В каталог <ArrowUpRight size={18}/></Link><UserRound className="cta-watermark" size={240} strokeWidth={.35}/></section>
  </main>;
}
