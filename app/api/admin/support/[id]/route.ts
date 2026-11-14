import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {db} from '../../../../../lib/db';
import {currentUser} from '../../../../../lib/auth';
import {staffGate,readAdminBody,adminApiError} from '../../../../../lib/admin-api';
import {ticketManage} from '../../../../../lib/support-schemas';
import {auditEntry} from '../../../../../lib/audit';

class TicketConflict extends Error {}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const denied=await staffGate(request,'support',true);
  if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id}=await params;
    const data=ticketManage.parse(await readAdminBody(request));
    if(actor.role!=='ADMIN'&&data.assignedToId!==undefined&&
      data.assignedToId!==null&&data.assignedToId!==actor.id){
      return NextResponse.json({error:'Можно назначать обращение только себе'},{status:403});
    }
    const updated=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "SupportTicket" WHERE "id"=${id} FOR UPDATE`;
      const previous=await tx.supportTicket.findUnique({
        where:{id},select:{id:true,status:true,priority:true,assignedToId:true}
      });
      if(!previous)throw new TicketConflict('Обращение не найдено');
      if(data.assignedToId){
        const staff=await tx.user.findFirst({
          where:{id:data.assignedToId,role:{in:['ADMIN','SUPPORT']}},
          select:{id:true}
        });
        if(!staff)throw new TicketConflict('Сотрудник поддержки не найден');
      }
      const ticket=await tx.supportTicket.update({where:{id},data});
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'support.ticket.update',targetType:'ticket',targetId:id,
        details:{
          fromStatus:previous.status,toStatus:ticket.status,
          fromPriority:previous.priority,toPriority:ticket.priority,
          reassigned:previous.assignedToId!==ticket.assignedToId
        }
      })});
      return ticket;
    },{timeout:10000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
    return NextResponse.json({ok:true,status:updated.status,
      priority:updated.priority,assignedToId:updated.assignedToId});
  }catch(e){
    if(e instanceof TicketConflict)return NextResponse.json({error:e.message},{status:409});
    return adminApiError(e);
  }
}
