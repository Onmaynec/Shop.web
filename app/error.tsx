'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  useEffect(()=>{console.error('Page rendering failed:',error);},[error]);
  return <main className="state-page" role="alert">
    <div className="state-error-icon"><AlertTriangle size={33}/></div>
    <div className="eyebrow">STANDOFFSHOP / SERVER ERROR</div>
    <h1>Не удалось загрузить страницу.</h1>
    <p>Возможно, сервис временно недоступен. Проверьте подключение к базе данных или попробуйте ещё раз.</p>
    <div className="state-actions"><button className="button button-light" onClick={reset}>Повторить <RefreshCw size={16}/></button><Link className="button button-ghost" href="/">На главную <ArrowLeft size={16}/></Link></div>
  </main>;
}
