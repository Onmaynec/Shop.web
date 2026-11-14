import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate } from '../../../../lib/admin-api';
import { currentUser } from '../../../../lib/auth';
import { requireSameOrigin,limitResponse } from '../../../../lib/http-security';
import { takeRateLimit } from '../../../../lib/rate-limit';
import { MAX_IMAGE_BYTES,saveImage } from '../../../../lib/media-store';
import { auditEntry } from '../../../../lib/audit';

export const runtime='nodejs';

export async function POST(req:Request){
  const denied=await adminGate(req,false);
  if(denied)return denied;
  const origin=requireSameOrigin(req);
  if(origin)return origin;
  if(!req.headers.get('content-type')?.startsWith('multipart/form-data')){
    return NextResponse.json({error:'Требуется multipart/form-data'},{status:415});
  }
  const actor=await currentUser();
  if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
  const limited=limitResponse(await takeRateLimit('admin-media',actor.id,30,3600));
  if(limited)return limited;
  const size=Number(req.headers.get('content-length')||0);
  if(size>MAX_IMAGE_BYTES+65536){
    return NextResponse.json({error:'Слишком большой файл (максимум 2 МБ)'},{status:413});
  }
  try{
    const data=await req.formData();
    const value=data.get('file');
    if(!(value instanceof File)){
      return NextResponse.json({error:'Выберите файл изображения'},{status:400});
    }
    if(value.size>MAX_IMAGE_BYTES||value.size===0){
      return NextResponse.json({error:'Максимум 2 МБ'},{status:413});
    }
    if(!['image/png','image/jpeg','image/webp'].includes(value.type)){
      return NextResponse.json({error:'Допустимы PNG, JPG или WebP'},{status:400});
    }
    const saved=await saveImage(new Uint8Array(await value.arrayBuffer()));
    await db.auditLog.create({data:auditEntry({
      actorId:actor.id,action:'media.upload',targetType:'media',
      targetId:saved.name,details:{bytes:value.size,type:saved.ext}
    })});
    return NextResponse.json({url:saved.url},{status:201});
  }catch(error){
    console.error('Upload failed',error);
    return NextResponse.json({error:'Не удалось загрузить изображение'},{status:500});
  }
}
