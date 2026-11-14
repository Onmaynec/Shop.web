import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '../../../../../../lib/db';
import { adminGate,staffGate,adminApiError,readAdminBody } from '../../../../../../lib/admin-api';
import { currentUser } from '../../../../../../lib/auth';
import { requireSameOrigin,limitResponse } from '../../../../../../lib/http-security';
import { takeRateLimit } from '../../../../../../lib/rate-limit';
import { PRIVATE_MAX_BYTES,savePrivateFile } from '../../../../../../lib/private-assets';
import { hasVerifiedPayment,addCustomerNotification } from '../../../../../../lib/order-operations';
import { auditEntry } from '../../../../../../lib/audit';

export const runtime='nodejs';
const requestInput=z.object({
  action:z.enum(['release','revoke']),
  deliveryId:z.string().cuid()
}).strict();
class DeliveryConflict extends Error {}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const denied=await staffGate(request,'fulfillment',false);if(denied)return denied;
  const origin=requireSameOrigin(request);if(origin)return origin;
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data')){
    return NextResponse.json({error:'Нужна форма с файлом'},{status:415});
  }
  const declared=Number(request.headers.get('content-length')||0);
  if(!declared)return NextResponse.json({error:'Не указан размер запроса'},{status:411});
  if(declared>PRIVATE_MAX_BYTES+65536)return NextResponse.json({error:'Файл слишком большой'},{status:413});
  const {id}=await params;
  if(!z.string().cuid().safeParse(id).success)return NextResponse.json({error:'Неверный заказ'},{status:400});
  const actor=await currentUser();
  if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
  const limited=limitResponse(await takeRateLimit('delivery-upload',actor.id,25,3600));
  if(limited)return limited;
  try{
    // Upload happens only for orders with an existing trusted payment event.
    const eligible=await db.$transaction(async tx=>{
      const order=await tx.order.findUnique({where:{id},select:{status:true}});
      return !!order&&['PAID','PROCESSING'].includes(order.status)&&await hasVerifiedPayment(tx,id);
    });
    if(!eligible)return NextResponse.json({error:'Файлы можно прикреплять только к оплаченным заказам до завершения исполнения'},{status:409});
    if(actor.role==='FULFILLMENT'){
      const owned=await db.orderTask.count({where:{
        orderId:id,assignedToId:actor.id,status:{in:['IN_PROGRESS','DONE']}
      }});
      if(!owned)return NextResponse.json({error:'Сначала получите назначение на задачу заказа'},{status:403});
    }
    const form=await request.formData();
    const file=form.get('file');
    if(!(file instanceof File)||!file.size||file.size>PRIVATE_MAX_BYTES){
      return NextResponse.json({error:'Нужен файл до 4 МБ'},{status:400});
    }
    const saved=await savePrivateFile(new Uint8Array(await file.arrayBuffer()),file.type,file.name);
    const delivery=await db.$transaction(async tx=>{
      const order=await tx.order.findUnique({where:{id},select:{status:true}});
      if(!order||!['PAID','PROCESSING'].includes(order.status)||!(await hasVerifiedPayment(tx,id))){
        throw new DeliveryConflict('Статус заказа изменился во время загрузки');
      }
      if(actor.role==='FULFILLMENT'){
        const owned=await tx.orderTask.count({where:{
          orderId:id,assignedToId:actor.id,status:{in:['IN_PROGRESS','DONE']}
        }});
        if(!owned)throw new DeliveryConflict('Назначение сотрудника изменилось');
      }
      const asset=await tx.orderDelivery.create({data:{
        orderId:id,uploadedById:actor.id,...saved
      }});
      await tx.orderActivity.create({data:{
        orderId:id,authorId:actor.id,kind:'DELIVERY',visibility:'STAFF',
        title:'Файл добавлен',message:asset.originalName
      }});
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'order.delivery.upload',targetType:'delivery',targetId:asset.id,
        details:{orderId:id,bytes:asset.bytes,checksum:asset.checksum}
      })});
      return asset;
    });
    return NextResponse.json({
      delivery:{id:delivery.id,originalName:delivery.originalName,bytes:delivery.bytes,
        releasedAt:delivery.releasedAt,revokedAt:delivery.revokedAt}
    },{status:201});
  }catch(error){
    if(error instanceof DeliveryConflict)return NextResponse.json({error:error.message},{status:409});
    return adminApiError(error);
  }
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const denied=await adminGate(request,true);if(denied)return denied;
  const {id}=await params;
  if(!z.string().cuid().safeParse(id).success)return NextResponse.json({error:'Неверный заказ'},{status:400});
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const input=requestInput.parse(await readAdminBody(request));
    const result=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order=await tx.order.findUnique({
        where:{id},select:{status:true,userId:true}
      });
      const asset=await tx.orderDelivery.findFirst({
        where:{id:input.deliveryId,orderId:id}
      });
      if(!asset||!order)throw new DeliveryConflict('Файл или заказ не найден');
      if(input.action==='release'){
        if(order.status!=='FULFILLED'||!(await hasVerifiedPayment(tx,id))){
          throw new DeliveryConflict('Выдача доступна только после проверки оплаты и выполнения заказа');
        }
        if(asset.revokedAt)throw new DeliveryConflict('Отозванный файл нельзя опубликовать повторно');
      }
      const now=new Date();
      const updated=await tx.orderDelivery.update({
        where:{id:asset.id},
        data:input.action==='release'?{releasedAt:asset.releasedAt||now}:{revokedAt:asset.revokedAt||now}
      });
      await tx.orderActivity.create({data:{
        orderId:id,authorId:actor.id,kind:'DELIVERY',visibility:'CUSTOMER',
        title:input.action==='release'?'Материал доступен для скачивания':'Доступ к материалу отозван'
      }});
      await addCustomerNotification(tx,{
        orderId:id,userId:order.userId,
        title:input.action==='release'?'Новый материал к заказу':'Изменён доступ к материалу',
        body:input.action==='release'?'Материал доступен в личном кабинете.':
          'Доступ к одному из материалов заказа закрыт.'
      });
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'order.delivery.'+input.action,
        targetType:'delivery',targetId:updated.id,details:{orderId:id}
      })});
      return {id:updated.id,releasedAt:updated.releasedAt,revokedAt:updated.revokedAt};
    },{timeout:15000,isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
    return NextResponse.json({ok:true,delivery:result});
  }catch(error){
    if(error instanceof DeliveryConflict)return NextResponse.json({error:error.message},{status:409});
    return adminApiError(error);
  }
}
