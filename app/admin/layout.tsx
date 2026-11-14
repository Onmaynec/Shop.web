import { currentUser } from '../../lib/auth';
import { redirect } from 'next/navigation';
import { isStaff } from '../../lib/permissions';
import AdminNav from '../../components/admin/AdminNav';
import './admin.css';
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const user=await currentUser();
  if(!user)redirect('/account');
  if(!isStaff(user.role))return <main className="content"><h1>Недостаточно прав</h1>
    <p className="muted">Для входа в управление магазином требуется роль сотрудника.</p></main>;
  return <div className="adm-shell"><AdminNav email={user.email} role={user.role}/>
    <div className="adm-workspace"><header className="adm-topbar">
      <span className="adm-topbar-title">Управление StandoffShop <span>/ v0.9.0-pre.1</span></span>
      <span className="adm-live"><i/> {user.role==='ADMIN'?'Администратор':user.role==='SUPPORT'?'Поддержка':'Исполнитель'}</span>
    </header><div className="adm-main">{children}</div></div></div>;
}
