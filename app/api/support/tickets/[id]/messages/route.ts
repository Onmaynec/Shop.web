import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {db} from '../../../../../../lib/db';
import {currentUser} from '../../../../../../lib/auth';
import {hasPermission} from '../../../../../../lib/permissions';
import {ticketReply} from '../../../../../../lib/support-schemas';
import {requireSameOrigin,requireJson,readBoundedJson,inputError,limitResponse} from '../../../../../../lib/http-security';
import {takeRateLimit} from '../../../../../../lib/rate-limit';
import {auditEntry} from '../../../../../../lib/audit';

class TicketConflict extends Error {}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Требуется авторизация'},{status:401});
  const denied=requireSameOrigin(request)||requireJson(request);
  if(denied)return denied;
  const limited=limitResponse(await takeRateLimit('support-reply',user.id,35,3600));
  if(limited)return limited;
  try{
    const {id}=await params;
    const input=ticketReply.parse(await readBoundedJson(request,5600));
    const staff=hasPermission(user.role,'support');
    if(input.internal&&!staff)return NextResponse.json({error:'Недостаточно прав'},{status:403});
    const result=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "SupportTicket" WHERE "id"=${id} FOR UPDATE`;
      const ticket=await tx.supportTicket.findUnique({
        where:{id},select:{id:true,customerId:true,status:true}
      });
      if(!ticket||(ticket.customerId!==user.id&&!staff))
        throw new TicketConflict('Обращение не найдено');
      if(ticket.status==='CLOSED')
        throw new TicketConflict('Обращение закрыто. Создайте новое или попросите сотрудника открыть его.');
      const message=await tx.supportMessage.create({data:{
        ticketId:id,authorId:user.id,body:input.message,internal:input.internal
      }});
      const status=input.internal?ticket.status:staff?'WAITING_CUSTOMER':'OPEN';
      await tx.supportTicket.update({where:{id},data:{status}});
      await tx.auditLog.create({data:auditEntry({
        actorId:user.id,action:input.internal?'support.note':'support.reply',
        targetType:'ticket',targetId:id,details:{messageId:message.id,staff}
      })});
      return message.id;
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted,timeout:10000});
    return NextResponse.json({ok:true,messageId:result});
  }catch(e){
    if(e instanceof TicketConflict)return NextResponse.json({error:e.message},{status:409});
    return inputError(e);
  }
}
