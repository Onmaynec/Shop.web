import {notFound} from 'next/navigation';
import Link from 'next/link';
import {Activity,ShieldCheck,AlertTriangle,ShieldAlert,ArrowUpRight} from 'lucide-react';
import {currentUser} from '../../../lib/auth';
import {readinessChecks} from '../../../lib/readiness';

export const dynamic='force-dynamic';
export default async function Readiness(){
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const checks=await readinessChecks();
  const pass=checks.filter(x=>x.state==='pass').length;
  const warnings=checks.filter(x=>x.state==='warning').length;
  const blockers=checks.filter(x=>x.state==='blocker').length;
  return <>
    <div className="adm-head"><div>
      <div className="adm-eyebrow">PLATFORM / LAUNCH READINESS</div>
      <h1>Готовность магазина</h1>
      <p>Диагностика приложения и список блокирующих факторов перед запуском продаж.</p>
    </div><Link href="/admin/operations" className="adm-btn">Операции <ArrowUpRight size={17}/></Link></div>
    <div className="adm-hint">Эта панель не является сертификацией безопасности. Проверка внешних сервисов,
      юридических документов, резервных копий и платёжного провайдера требует отдельного запуска и аудита.</div>
    <div className="adm-stat-grid">
      {[
        {name:'Пройдено',value:pass,Icon:ShieldCheck},
        {name:'Предупреждения',value:warnings,Icon:AlertTriangle},
        {name:'Блокирующие факторы',value:blockers,Icon:ShieldAlert}
      ].map(({name,value,Icon})=><div className="adm-stat" key={name}>
        <div className="adm-stat-top"><span>{name}</span><Icon size={19}/></div>
        <strong>{value}</strong><small>Из {checks.length} проверок</small>
      </div>)}
    </div>
    <section className="adm-card readiness-panel">
      <div className="adm-card-head"><div><h2><Activity size={18}/> Проверки запуска</h2>
        <p>Текущее состояние серверной конфигурации</p></div></div>
      <div className="readiness-list">{checks.map(c=><article key={c.code} className="readiness-item">
        <span className={'readiness-indicator '+c.state} aria-hidden="true"/>
        <div><h3>{c.title}</h3><p>{c.description}</p></div>
        <span className="readiness-state">
          {c.state==='pass'?'Проверено':c.state==='warning'?'Внимание':'Блокер'}
        </span>
      </article>)}</div>
    </section>
    <div className="adm-hint">Даже если все локальные проверки пройдены, подключение настоящих платежей,
      вопросы безопасности и юридическая готовность остаются отдельными этапами.
      <Link href="https://github.com/Onmaynec/Shop.web/blob/main/docs/LAUNCH-READINESS.md" target="_blank">
        {' '}Чеклист запуска <ArrowUpRight size={13}/>
      </Link>
    </div>
  </>;
}
