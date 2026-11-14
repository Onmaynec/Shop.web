import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { staffGate,adminApiError,readAdminBody } from '../../../../../lib/admin-api';
import { currentUser } from '../../../../../lib/auth';
import { auditEntry } from '../../../../../lib/audit';
import { actionableStatuses,addCustomerNotification,hasVerifiedPayment } from '../../../../../lib/order-operations';

const base=z.object({orderId:z.string().cuid()});
const input=z.discriminatedUnion('action',[
  base.extend({action:z.literal('prepare')}).strict(),
  base.extend({
    action:z.literal('task'),taskId:z.string().cuid(),
    status:z.enum(['OPEN','IN_PROGRESS','BLOCKED','DONE']),
    assignedToId:z.string().cuid().nullable().optional()
  }).strict(),
  base.extend({
    action:z.literal('note'),
    visibility:z.enum(['STAFF','CUSTOMER']),
    message:z.string().trim().min(2).max(2000)
  }).strict()
]);

class ActionConflict extends Error {}

export async function POST(req:Request){
  const denied=await staffGate(req,'fulfillment',true);if(denied)return denied;
  try{
    const actor=await currentUser();
    if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const data=input.parse(await readAdminBody(req));
    if(actor.role!=='ADMIN'&&data.action!=='task')return NextResponse.json({error:'Недостаточно прав'},{status:403});
    if(actor.role==='FULFILLMENT'&&data.action==='task'&&data.assignedToId!==undefined&&data.assignedToId!==null&&data.assignedToId!==actor.id){return NextResponse.json({error:'Исполнитель может назначать задачи только себе'},{status:403});}
    const result=await db.$transaction(async tx=>{
      // Lock the order row to serialize fulfillment changes against refund transitions.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${data.orderId} FOR UPDATE`;
      const order=await tx.order.findUnique({
        where:{id:data.orderId},
        select:{id:true,status:true,userId:true}
      });
      if(!order)throw new ActionConflict('Заказ не найден');
      if(data.action==='note'){
        const customer=data.visibility==='CUSTOMER';
        const row=await tx.orderActivity.create({data:{
          orderId:order.id,authorId:actor.id,
          kind:customer?'MESSAGE':'NOTE',visibility:data.visibility,
          title:customer?'Сообщение от магазина':'Внутренняя заметка',
          message:data.message
        }});
        if(customer){
          await addCustomerNotification(tx,{
            orderId:order.id,userId:order.userId,
            title:'Сообщение по заказу',body:'В кабинете появилось новое сообщение по заказу.'
          });
        }
        await tx.auditLog.create({data:auditEntry({
          actorId:actor.id,action:customer?'order.message':'order.note',
          targetType:'order',targetId:order.id,details:{activityId:row.id}
        })});
        return {ok:true,activityId:row.id};
      }
      if(!actionableStatuses.includes(order.status)||!(await hasVerifiedPayment(tx,order.id))){
        throw new ActionConflict('Работа над заказом доступна только после проверенной оплаты.');
      }
      if(data.action==='prepare'){
        const items=await tx.orderItem.findMany({
          where:{orderId:order.id},select:{id:true}
        });
        const tasks=await tx.orderTask.createMany({
          data:items.map(item=>({orderId:order.id,orderItemId:item.id})),
          skipDuplicates:true
        });
        if(tasks.count){
          await tx.orderActivity.create({data:{
            orderId:order.id,authorId:actor.id,kind:'TASK',visibility:'STAFF',
            title:'Очередь обработки подготовлена',message:'Задач создано: '+tasks.count
          }});
        }
        return {ok:true,created:tasks.count};
      }
      const task=await tx.orderTask.findUnique({
        where:{id:data.taskId},select:{id:true,orderId:true,status:true,assignedToId:true}
      });
      if(!task||task.orderId!==order.id)throw new ActionConflict('Задача не найдена в данном заказе');
      if(order.status==='FULFILLED')throw new ActionConflict('Заказ уже выполнен.');
      if(data.assignedToId){
        const assignee=await tx.user.findFirst({
          where:{id:data.assignedToId,role:{in:['ADMIN','FULFILLMENT']}},select:{id:true}
        });
        if(!assignee)throw new ActionConflict('Назначить можно только администратора');
      }
      const changed=await tx.orderTask.update({
        where:{id:task.id},data:{
          status:data.status,
          ...(data.assignedToId!==undefined?{assignedToId:data.assignedToId}:{})
        }
      });
      await tx.orderActivity.create({data:{
        orderId:order.id,authorId:actor.id,kind:'TASK',visibility:'STAFF',
        title:'Задача обновлена',message:task.status+' → '+changed.status
      }});
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'order.task',targetType:'task',targetId:changed.id,
        details:{orderId:order.id,from:task.status,to:changed.status,
          assignedToId:changed.assignedToId}
      })});
      return {ok:true,task:{id:changed.id,status:changed.status,
        assignedToId:changed.assignedToId}};
    },{timeout:15000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
    return NextResponse.json(result);
  }catch(error){
    if(error instanceof ActionConflict)return NextResponse.json({error:error.message},{status:409});
    return adminApiError(error);
  }
}
