'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Menu, Search, ShoppingBag, UserRound, X, Command } from 'lucide-react';

export default function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const countCart = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('standoffshop_cart_v1') || '[]');
        setCartCount(Array.isArray(saved) ? saved.reduce((sum:number, item:{quantity?:number}) =>
          sum + (Number.isInteger(item.quantity) && item.quantity! > 0 ? Math.min(item.quantity!, 20) : 0), 0) : 0);
      } catch { setCartCount(0); }
    };
    countCart();
    window.addEventListener('cart-updated', countCart);
    window.addEventListener('storage', countCart);
    return () => {
      window.removeEventListener('cart-updated', countCart);
      window.removeEventListener('storage', countCart);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(open => !open);
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchOpen(false);
    router.push('/catalog' + (query.trim() ? '?q=' + encodeURIComponent(query.trim()) : ''));
  }

  return <>
    <header className="site-header">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="StandoffShop — главная">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>STANDOFF<span className="brand-thin">SHOP</span></span>
          <span className="brand-version">/ 05</span>
        </Link>

        <nav className="desktop-nav" aria-label="Основное меню">
          <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Главная</Link>
          <Link href="/catalog" aria-current={pathname.startsWith('/catalog') || pathname.startsWith('/product') ? 'page' : undefined}>Каталог</Link>
          <Link href="/account" aria-current={pathname.startsWith('/account') ? 'page' : undefined}>Кабинет</Link>
        </nav>

        <div className="nav-actions">
          <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-label="Открыть поиск по каталогу">
            <Search size={16}/><span>Поиск...</span><kbd>Ctrl K</kbd>
          </button>
          <Link href="/cart" className="icon-link" aria-label={'Корзина: ' + cartCount + ' товаров'} title="Корзина">
            <ShoppingBag size={19}/>{cartCount > 0 && <span className="cart-counter">{cartCount > 99 ? '99+' : cartCount}</span>}
          </Link>
          <Link href="/account" className="icon-link icon-account" aria-label="Аккаунт"><UserRound size={19}/></Link>
          <button className="icon-link mobile-menu-trigger" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>
      {mobileOpen && <nav className="mobile-nav" aria-label="Мобильное меню">
        <Link href="/">Главная <ArrowUpRight size={16}/></Link>
        <Link href="/catalog">Каталог <ArrowUpRight size={16}/></Link>
        <Link href="/cart">Корзина <span>{cartCount}</span></Link>
        <Link href="/account">Личный кабинет <ArrowUpRight size={16}/></Link>
        <button type="button" onClick={() => { setMobileOpen(false); setSearchOpen(true); }}>Поиск <Search size={16}/></button>
      </nav>}
    </header>

    {searchOpen && <div className="command-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Поиск товаров">
        <form onSubmit={submitSearch}>
          <Search size={21}/>
          <input ref={inputRef} type="search" placeholder="Найти товар или услугу..." value={query} onChange={event => setQuery(event.target.value)} maxLength={80}/>
          <button type="button" aria-label="Закрыть поиск" onClick={() => setSearchOpen(false)}><X size={19}/></button>
        </form>
        <div className="command-hint"><span><Command size={14}/> Поиск по всему каталогу</span><span>Enter — искать · Esc — закрыть</span></div>
        <div className="command-suggestion">
          <span>Быстрый переход</span>
          <button type="button" onClick={() => { setSearchOpen(false); router.push('/catalog'); }}>
            <ShoppingBag size={16}/> Весь каталог <ArrowUpRight size={15}/>
          </button>
        </div>
      </section>
    </div>}
  </>;
}
