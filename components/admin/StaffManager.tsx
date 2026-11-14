'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ShieldCheck,UserRound,Headset,ClipboardList} from 'lucide-react';

type Role='CUSTOMER'|'SUPPORT'|'FULFILLMENT'|'ADMIN';
type Member={id:string;email:string;role:Role;createdAt:string};
const titles:Record<Role,string>={
  CUSTOMER:'Покупатель',SUPPORT:'Поддержка',FULFILLMENT:'Исполнитель',ADMIN:'Администратор'
};
export default function StaffManager({initial,actorId}:{initial:Member[];actorId:string}){
  const router=useRouter();
  const [members,setMembers]=useState(initial);
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>setMembers(initial),[initial]);
  async function setRole(member:Member,role:Role){
    if(busy||member.role===role)return;
    if(!confirm('Изменить роль '+member.email+' на «'+titles[role]+'»? Его сессии будут отозваны.'))return;
    setBusy(member.id);setMessage('');
    try{
      const response=await fetch('/api/admin/staff',{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:member.id,role})
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось изменить роль');
      setMembers(current=>current.map(u=>u.id===member.id?{...u,role}:u));
      setMessage('Права обновлены. Пользователю необходимо снова войти в аккаунт.');
      router.refresh();
    }catch(e){setMessage(e instanceof Error?e.message:'Ошибка');}
    finally{setBusy(null);}
  }
  return <div className="adm-card">
    {message&&<div className="adm-alert" role="status">{message}</div>}
    <div className="adm-table-wrap"><table className="adm-table">
      <thead><tr><th>Пользователь</th><th>Сейчас</th><th>Создан</th><th>Права доступа</th></tr></thead>
      <tbody>{members.map(m=><tr key={m.id}>
        <td><span className="staff-user"><UserRound size={17}/><strong>{m.email}</strong></span>
          {m.id===actorId&&<small className="staff-self">Ваш аккаунт — роль заблокирована</small>}</td>
        <td><span className={'staff-role '+m.role.toLowerCase()}>{titles[m.role]}</span></td>
        <td>{new Date(m.createdAt).toLocaleDateString('ru-RU')}</td>
        <td><select className="adm-field" aria-label={'Роль '+m.email}
          disabled={busy!==null||m.id===actorId} value={m.role}
          onChange={e=>setRole(m,e.target.value as Role)}>
          <option value="CUSTOMER">Покупатель</option>
          <option value="SUPPORT">Поддержка</option>
          <option value="FULFILLMENT">Исполнитель</option>
          <option value="ADMIN">Администратор</option>
        </select></td>
      </tr>)}</tbody>
    </table></div>
    {!members.length&&<div className="adm-empty-large"><UserRound size={40}/>
      <h3>Пользователи не найдены</h3><p>Уточните поисковый запрос.</p></div>}
  </div>;
}
