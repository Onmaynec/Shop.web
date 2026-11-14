import { currentUser } from '../../lib/auth';
import { redirect } from 'next/navigation';
import AdminNav from '../../components/admin/AdminNav';
import './admin.css';
export default async function AdminLayout({children}:{children:React.ReactNode}) {
  const user = await currentUser();
  if (!user) redirect('/account');
  if (user.role !== 'ADMIN') return <main className="content"><h1>Недостаточно прав</h1><p className="muted">Для входа в управление магазином требуется роль администратора.</p></main>;
  return <div className="adm-shell"><AdminNav email={user.email}/><div className="adm-workspace"><header className="adm-topbar"><span className="adm-topbar-title">Панель администратора <span>/ v0.6.0</span></span><span className="adm-live"><i/> Локальное управление</span></header><div className="adm-main">{children}</div></div></div>;
}
