import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { activeSession, checkPassword, clearSession, hashPassword } from '../../../../lib/auth';
import { requireSameOrigin, requireJson, readBoundedJson, inputError, limitResponse } from '../../../../lib/http-security';
import { takeRateLimit } from '../../../../lib/rate-limit';

const schema=z.object({
  currentPassword:z.string().min(1).max(128),
  newPassword:z.string().min(12).max(128)
}).strict();

export async function POST(request:Request) {
  const denied = requireSameOrigin(request) || requireJson(request);
  if (denied) return denied;
  const session=await activeSession();
  if (!session) return NextResponse.json({error:'Необходима авторизация'}, {status:401});
  try {
    const input=schema.parse(await readBoundedJson(request));
    const rateDenied=limitResponse(await takeRateLimit('change-password',session.userId,5,3600));
    if (rateDenied) return rateDenied;
    const user=await db.user.findUnique({where:{id:session.userId}});
    if (!user || !checkPassword(input.currentPassword,user.passwordHash)) {
      return NextResponse.json({error:'Неверный текущий пароль'},{status:401});
    }
    if(input.currentPassword===input.newPassword) {
      return NextResponse.json({error:'Укажите новый пароль, отличный от текущего'},{status:400});
    }
    await db.$transaction(async tx=>{
      await tx.user.update({where:{id:user.id},data:{passwordHash:hashPassword(input.newPassword)}});
      await tx.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:new Date()}});
    });
    await clearSession();
    return NextResponse.json({ok:true,signedOut:true}, {headers:{'Cache-Control':'no-store'}});
  }catch(error){return inputError(error);}
}
