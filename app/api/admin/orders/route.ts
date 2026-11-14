import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { adminGate,adminApiError,readAdminBody } from '../../../../lib/admin-api';
import { adminOrderTransitions } from '../../../../lib/order-workflow';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';
import { addCustomerNotification,hasVerifiedPayment,statusTitle } from '../../../../lib/order-operations';

const input=z.object({
  id:z.string().cuid(),
  status:z.enum(['CANCELLED','PROCESSING','FULFILLED'])
}).strict();

class OrderConflict extends Error {}

export async function PATCH(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();
    if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id,status}=input.parse(await readAdminBody(req));
    const updated=await db.$transaction(async tx=>{
      const order=await tx.order.findUnique({
        where:{id},select:{status:true,userId:true}
      });
      const from=adminOrderTransitions[status];
      if(!order||order.status!==from)throw new OrderConflict('Недопустимый переход статуса.');
      if(status!=='CANCELLED'&&!(await hasVerifiedPayment(tx,id))){
        throw new OrderConflict('Нужна проверенная оплата. Сам статус PAID не даёт права на исполнение.');
      }
      if(status==='FULFILLED'){
        const [total,unfinished]=await Promise.all([
          tx.orderTask.count({where:{orderId:id}}),
          tx.orderTask.count({where:{orderId:id,status:{not:'DONE'}}})
        ]);
        if(!total||unfinished)throw new OrderConflict('Сначала завершите все задачи по позициям заказа.');
      }
      const result=await tx.order.updateMany({
        where:{id,status:from},data:{status}
      });
      if(result.count!==1)throw new OrderConflict('Статус изменился. Обновите страницу.');
      await tx.orderActivity.create({data:{
        orderId:id,authorId:actor.id,
        kind:'STATUS',visibility:'CUSTOMER',title:statusTitle(status),
        fromStatus:from,toStatus:status
      }});
      await addCustomerNotification(tx,{
        orderId:id,userId:order.userId,title:statusTitle(status),
        body:status==='FULFILLED'?'Исполнение заказа завершено. Проверьте доступные материалы в кабинете.':
          status==='CANCELLED'?'Заказ отменён без списания средств.':
            'Ваш заказ принят в обработку.'
      });
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'order.status',targetType:'order',targetId:id,
        details:{from,to:status}
      })});
      return true;
    });
    return NextResponse.json({ok:updated,status});
  }catch(error){
    if(error instanceof OrderConflict)return NextResponse.json({error:error.message},{status:409});
    return adminApiError(error);
  }
}
