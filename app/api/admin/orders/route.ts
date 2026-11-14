import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { adminGate,adminApiError,readAdminBody } from '../../../../lib/admin-api';
import { adminOrderTransitions } from '../../../../lib/order-workflow';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';

const input=z.object({
  id:z.string().cuid(),
  status:z.enum(['CANCELLED','PROCESSING','FULFILLED'])
}).strict();

export async function PATCH(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id,status}=input.parse(await readAdminBody(req));
    const count=await db.$transaction(async tx=>{
      const result=await tx.order.updateMany({
        where:{id,status:adminOrderTransitions[status]},
        data:{status}
      });
      if(result.count)await tx.auditLog.create({
        data:auditEntry({actorId:actor.id,action:'order.status',targetType:'order',targetId:id,details:{from:adminOrderTransitions[status],to:status}})
      });
      return result.count;
    });
    if(!count)return NextResponse.json({error:'Недопустимый переход статуса. Неоплаченный заказ нельзя выполнить.'},{status:409});
    return NextResponse.json({ok:true,status});
  }catch(error){return adminApiError(error);}
}
