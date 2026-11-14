import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '../../../../../../../lib/db';
import { currentUser } from '../../../../../../../lib/auth';
import { hasVerifiedPayment } from '../../../../../../../lib/order-operations';
import { readPrivateFile } from '../../../../../../../lib/private-assets';

export const runtime='nodejs';
export const dynamic='force-dynamic';

function denied(){return new NextResponse('Not found',{status:404,headers:{'Cache-Control':'no-store'}});}

export async function GET(_:Request,{params}:{
  params:Promise<{id:string;assetId:string}>
}){
  const user=await currentUser();
  if(!user)return denied();
  const {id,assetId}=await params;
  // No email-based access and no public download links.
  const order=await db.order.findFirst({
    where:{id,userId:user.id,status:'FULFILLED'},
    select:{id:true}
  });
  if(!order)return denied();
  const delivery=await db.orderDelivery.findFirst({
    where:{id:assetId,orderId:order.id,releasedAt:{not:null},revokedAt:null},
    select:{storageKey:true,originalName:true,mime:true,checksum:true}
  });
  if(!delivery)return denied();
  const verified=await db.$transaction(tx=>hasVerifiedPayment(tx,order.id));
  if(!verified)return denied();
  const bytes=await readPrivateFile(delivery.storageKey);
  if(!bytes||createHash('sha256').update(bytes).digest('hex')!==delivery.checksum)return denied();
  const name=encodeURIComponent(delivery.originalName);
  return new NextResponse(new Uint8Array(bytes),{
    headers:{
      'Content-Type':delivery.mime,
      'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${name}`,
      'Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; sandbox"
    }
  });
}
