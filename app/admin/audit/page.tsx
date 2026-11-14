import Link from 'next/link';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import { ScrollText } from 'lucide-react';
export const dynamic='force-dynamic';

export default async function AuditPage({searchParams}:{searchParams:Promise<{page?:string}>}){
  const actor=await currentUser();if(!actor||actor.role!=='ADMIN')notFound();
  const params=await searchParams;
  const page=Math.max(1,Math.min(10000,Number.parseInt(params.page||'1',10)||1));
  const [total,entries]=await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({
      orderBy:{createdAt:'desc'},skip:(page-1)*30,take:30,
      include:{actor:{select:{email:true}}}
    })
  ]);
  const pages=Math.max(1,Math.ceil(total/30));
  return <>
    <div className="adm-head"><div><div className="adm-eyebrow">БЕЗОПАСНОСТЬ / ЖУРНАЛ</div><h1>Аудит действий</h1><p>Изменения каталога, заказов и тестовых платежей. Записей: {total}.</p></div></div>
    <section className="adm-card"><div className="adm-table-wrap"><table className="adm-table">
      <thead><tr><th>Дата</th><th>Событие</th><th>Администратор</th><th>Объект</th><th>Изменения</th></tr></thead>
      <tbody>{entries.map(e=><tr key={e.id}>
        <td>{e.createdAt.toLocaleString('ru-RU')}</td>
        <td><strong>{e.action}</strong></td>
        <td>{e.actor?.email||'Удалённый аккаунт'}</td>
        <td><span className="adm-overline">{e.targetType} / {e.targetId?.slice(-10)||'—'}</span></td>
        <td className="audit-detail">{e.details?JSON.stringify(e.details):'—'}</td>
      </tr>)}</tbody>
    </table>
      {!entries.length&&<div className="adm-empty-large"><ScrollText size={40}/><h3>Записей пока нет</h3><p>Они появятся после действий в административной панели.</p></div>}
    </div></section>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>
      {page>1&&<Link href={'/admin/audit?page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/audit?page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
