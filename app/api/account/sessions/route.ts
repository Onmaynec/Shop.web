import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { activeSession, clearSession } from '../../../../lib/auth';
import { requireSameOrigin, requireJson, readBoundedJson, inputError } from '../../../../lib/http-security';

export async function GET() {
  const session = await activeSession();
  if (!session) return NextResponse.json({error:'Необходима авторизация'}, {status:401});
  const rows = await db.session.findMany({
    where:{userId:session.userId,revokedAt:null,expiresAt:{gt:new Date()}},
    select:{id:true,createdAt:true,lastSeenAt:true,expiresAt:true},
    orderBy:{createdAt:'desc'},take:30
  });
  return NextResponse.json({
    sessions:rows.map(row=>({...row,current:row.id===session.id}))
  }, {headers:{'Cache-Control':'private, no-store'}});
}

const bodySchema=z.object({
  action:z.enum(['revoke','revoke_others','revoke_all']),
  sessionId:z.string().cuid().optional()
}).strict();

export async function DELETE(request:Request) {
  const denied = requireSameOrigin(request)||requireJson(request);
  if(denied)return denied;
  const current=await activeSession();
  if(!current)return NextResponse.json({error:'Необходима авторизация'}, {status:401});
  try {
    const data=bodySchema.parse(await readBoundedJson(request));
    if(data.action==='revoke' && !data.sessionId) return NextResponse.json({error:'Не указан идентификатор сессии'},{status:400});
    if(data.action==='revoke') {
      await db.session.updateMany({
        where:{id:data.sessionId,userId:current.userId,revokedAt:null},
        data:{revokedAt:new Date()}
      });
      if(data.sessionId===current.id)await clearSession();
      return NextResponse.json({ok:true,signedOut:data.sessionId===current.id});
    }
    await db.session.updateMany({
      where: {userId:current.userId,revokedAt:null,...(data.action==='revoke_others'?{id:{not:current.id}}:{})},
      data: {revokedAt:new Date()}
    });
    if(data.action==='revoke_all') await clearSession();
    return NextResponse.json({ok:true,signedOut:data.action==='revoke_all'});
  } catch(error) {return inputError(error);}
}
