'use client';
import {useState,type ChangeEvent} from 'react';
import {UploadCloud,ShieldCheck} from 'lucide-react';
import {useRouter} from 'next/navigation';

export default function FulfillmentUpload({orderId,enabled}:{orderId:string;enabled:boolean}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      if(file.size>4*1024*1024)throw new Error('Файл не должен превышать 4 МиБ');
      const form=new FormData();form.set('file',file);
      const response=await fetch('/api/admin/orders/'+orderId+'/deliveries',{
        method:'POST',body:form
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error||'Не удалось загрузить документ');
      setMessage('Файл сохранён приватно. Администратор опубликует его после проверки заказа.');
      router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки');}
    finally{setBusy(false);}
  }
  return <div className="adm-worker-upload">
    <h2><ShieldCheck size={18}/> Материалы исполнения</h2>
    <p className="adm-note">Загружать файлы может назначенный исполнитель. Клиент не получит материал,
      пока администратор не проверит оплату, не завершит заказ и не опубликует файл.</p>
    <label className="adm-btn adm-upload-delivery"><UploadCloud size={17}/>
      {busy?'Загрузка...':'Загрузить PDF, PNG, JPG или TXT (до 4 МиБ)'}
      <input type="file" hidden disabled={busy||!enabled} accept=".pdf,.png,.jpg,.jpeg,.txt"
        onChange={upload}/>
    </label>
    {error&&<p role="alert" className="adm-alert">{error}</p>}
    {message&&<p role="status" className="adm-hint">{message}</p>}
  </div>;
}
