import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/auth';
import { requireSameOrigin,requireJson,readBoundedJson,inputError,RequestTooLargeError } from '../../../../lib/http-security';
import { limitResponse } from '../../../../lib/http-security';
import { takeRateLimit } from '../../../../lib/rate-limit';

export const dynamic='force-dynamic';

export async function GET(){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Войдите в аккаунт'},{status:401});
  const [unread,items]=await Promise.all([
    db.customerNotification.count({where:{userId:user.id,readAt:null}}),
    db.customerNotification.findMany({
      where:{userId:user.id},orderBy:{createdAt:'desc'},take:50,
      select:{id:true,orderId:true,title:true,body:true,createdAt:true,readAt:true}
    })
  ]);
  return NextResponse.json({items,unread},{headers:{'Cache-Control':'private, no-store'}});
}

const input=z.object({id:z.string().cuid()}).strict();
export async function PATCH(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Войдите в аккаунт'},{status:401});
  const invalid=requireSameOrigin(request)||requireJson(request);
  if(invalid)return invalid;
  const limited=limitResponse(await takeRateLimit('notification-read',user.id,100,3600));
  if(limited)return limited;
  try{
    const {id}=input.parse(await readBoundedJson(request,2048));
    const result=await db.customerNotification.updateMany({
      where:{id,userId:user.id,readAt:null},data:{readAt:new Date()}
    });
    return NextResponse.json({ok:true,changed:result.count});
  }catch(error){
    if(error instanceof z.ZodError || error instanceof SyntaxError ||
      error instanceof RequestTooLargeError)return inputError(error);
    console.error('Notification update failed',error);
    return NextResponse.json({error:'Не удалось обновить уведомление'},{status:500});
  }
}
