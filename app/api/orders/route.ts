import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { checkoutFingerprint, hashCheckoutKey, validCheckoutKey } from '../../../lib/checkout';
import { takeRateLimit } from '../../../lib/rate-limit';
import { ipLimit,limitResponse } from '../../../lib/http-security';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().trim().email().max(254),
  items: z.array(z.object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(20)
  }).strict()).min(1).max(30)
}).strict();

type ResponseOrder = { id: string; status: string; totalKopecks: number };

function reply(order: ResponseOrder, reused: boolean) {
  return NextResponse.json({
    order, reused,
    payment: {available: false, message: 'Real payment provider is not connected'}
  }, {status: reused ? 200 : 201, headers: {'Cache-Control':'no-store'}});
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host || (()=>{try{return new URL(origin).host!==host;}catch{return true;}})()) {
    return NextResponse.json({error:'Недопустимый источник запроса'}, {status:403});
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({error:'Ожидается JSON'}, {status:415});
  }
  const key = request.headers.get('idempotency-key');
  if (!validCheckoutKey(key)) {
    return NextResponse.json({error:'Idempotency-Key обязателен (12–128 символов)'}, {status:400});
  }
  if (Number(request.headers.get('content-length')||0)>32768) {
    return NextResponse.json({error:'Слишком большой запрос'},{status:413});
  }
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw,'utf8')>32768) {
      return NextResponse.json({error:'Слишком большой запрос'},{status:413});
    }
    const body = schema.parse(JSON.parse(raw));
    const user = await currentUser();
    const email = user?.email || body.email.toLowerCase();
    const requestHash = checkoutFingerprint({email, items:body.items});
    const idempotencyKeyHash = hashCheckoutKey(key);

    const existing = await db.order.findUnique({
      where:{idempotencyKeyHash},
      select:{id:true,status:true,totalKopecks:true,requestHash:true}
    });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return NextResponse.json({error:'Ключ уже использован для другого заказа'}, {status:409});
      }
      return reply(existing, true);
    }

    // Rate limiting is AFTER the idempotency replay check: network retries are free.
    const ipDenied=await ipLimit(request,'checkout-ip',60,3600);
    if(ipDenied)return ipDenied;
    const limited=limitResponse(await takeRateLimit('checkout-customer',user?.id||email,20,3600));
    if(limited)return limited;

    const quantities = new Map<string,number>();
    for (const item of body.items) {
      quantities.set(item.productId,(quantities.get(item.productId)||0)+item.quantity);
    }
    if ([...quantities.values()].some(q=>q>20)) {
      return NextResponse.json({error:'Недопустимое количество'}, {status:400});
    }
    const products = await db.product.findMany({
      where:{id:{in:[...quantities.keys()]},status:'ACTIVE'}
    });
    if (products.length!==quantities.size) {
      return NextResponse.json({error:'Некоторые товары недоступны'}, {status:400});
    }
    const total=products.reduce((sum,p)=>sum+p.priceKopecks*quantities.get(p.id)!,0);
    if (!Number.isSafeInteger(total)||total<=0) {
      return NextResponse.json({error:'Некорректная стоимость'}, {status:400});
    }
    try {
      const order=await db.order.create({
        data:{
          email,userId:user?.id,idempotencyKeyHash,requestHash,totalKopecks:total,
          items:{create:products.map(p=>({
            productId:p.id,nameSnapshot:p.name,
            unitPriceKopecks:p.priceKopecks,quantity:quantities.get(p.id)!
          }))}
        },
        select:{id:true,status:true,totalKopecks:true}
      });
      return reply(order,false);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002')) throw error;
      const concurrent=await db.order.findUnique({
        where:{idempotencyKeyHash},
        select:{id:true,status:true,totalKopecks:true,requestHash:true}
      });
      if (concurrent?.requestHash===requestHash) return reply(concurrent,true);
      return NextResponse.json({error:'Ключ уже использован для другого заказа'},{status:409});
    }
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({error:'Некорректные данные заказа'}, {status:400});
    }
    console.error('Checkout failed',error);
    return NextResponse.json({error:'Внутренняя ошибка сервера'}, {status:500});
  }
}
