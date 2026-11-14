import {NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
import {currentUser} from '../../../../lib/auth';
import {ticketCreate} from '../../../../lib/support-schemas';
import {requireSameOrigin,requireJson,readBoundedJson,inputError,limitResponse} from '../../../../lib/http-security';
import {takeRateLimit} from '../../../../lib/rate-limit';
import {auditEntry} from '../../../../lib/audit';

export async function POST(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Требуется авторизация'},{status:401});
  const denied=requireSameOrigin(request)||requireJson(request);
  if(denied)return denied;
  const limited=limitResponse(await takeRateLimit('support-create',user.id,5,3600));
  if(limited)return limited;
  try{
    const input=ticketCreate.parse(await readBoundedJson(request,6000));
    if(input.orderId){
      const owned=await db.order.count({where:{id:input.orderId,userId:user.id}});
      if(!owned)return NextResponse.json({error:'Заказ не найден в вашем аккаунте'},{status:404});
    }
    const open=await db.supportTicket.count({
      where:{customerId:user.id,status:{not:'CLOSED'}}
    });
    if(open>=10)return NextResponse.json({error:'Слишком много открытых обращений'},{status:409});
    const ticket=await db.$transaction(async tx=>{
      const row=await tx.supportTicket.create({data:{
        customerId:user.id,subject:input.subject,orderId:input.orderId,
        messages:{create:{authorId:user.id,body:input.message,internal:false}}
      }});
      await tx.auditLog.create({data:auditEntry({
        actorId:user.id,action:'support.ticket.create',targetType:'ticket',targetId:row.id,
        details:{orderId:input.orderId}
      })});
      return row;
    });
    return NextResponse.json({ticketId:ticket.id},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e){return inputError(e);}
}
