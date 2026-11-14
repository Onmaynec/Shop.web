import { OrderStatus, Prisma } from '@prisma/client';
import { sandboxEnabled } from './payments';

export const actionableStatuses:OrderStatus[]=['PAID','PROCESSING','FULFILLED'];

/**
 * A browser flag or PAID status alone is not evidence of payment.
 * Require a recorded payment.succeeded event from a trusted adapter and
 * the matching succeeded attempt. Sandbox is allowed ONLY in local dev.
 */
export async function hasVerifiedPayment(tx:Prisma.TransactionClient,orderId:string):Promise<boolean>{
  const recorded=await tx.paymentEvent.findFirst({
    where:{
      orderId,
      eventType:'payment.succeeded',
      attempt:{status:'SUCCEEDED'}
    },
    select:{
      provider:true,amountKopecks:true,currency:true,
      attempt:{select:{provider:true,orderId:true,amountKopecks:true,currency:true}}
    },
    orderBy:{createdAt:'desc'}
  });
  if(!recorded)return false;
  const order=await tx.order.findUnique({
    where:{id:orderId},select:{totalKopecks:true,currency:true}
  });
  return Boolean(order
    &&recorded.amountKopecks===order.totalKopecks
    &&recorded.currency===order.currency
    &&recorded.provider===recorded.attempt.provider
    &&recorded.attempt.orderId===orderId
    &&recorded.attempt.amountKopecks===order.totalKopecks
    &&recorded.attempt.currency===order.currency
    &&(recorded.provider!=='sandbox'||sandboxEnabled()));
}

export async function addCustomerNotification(tx:Prisma.TransactionClient,input:{
  orderId:string;userId:string|null|undefined;title:string;body:string
}){
  if(!input.userId)return;
  await tx.customerNotification.create({data:{
    userId:input.userId,orderId:input.orderId,title:input.title,body:input.body
  }});
}

export function statusTitle(status:OrderStatus):string{
  const titles:Record<OrderStatus,string>={
    PENDING_PAYMENT:'Ожидает оплаты',PAID:'Оплата подтверждена',
    PROCESSING:'Заказ в обработке',FULFILLED:'Заказ выполнен',
    CANCELLED:'Заказ отменён',REFUNDED:'Оплата возвращена'
  };
  return titles[status];
}
