import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { adminGate,adminApiError,readAdminBody } from '../../../../../lib/admin-api';
import { currentUser } from '../../../../../lib/auth';
import { auditEntry } from '../../../../../lib/audit';

const input=z.object({
  ids:z.array(z.string().cuid()).min(1).max(50),
  status:z.enum(['DRAFT','ACTIVE','ARCHIVED'])
}).strict();

export async function PATCH(request:Request){
  const denied=await adminGate(request,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const parsed=input.parse(await readAdminBody(request));
    const ids=[...new Set(parsed.ids)];
    const count=await db.$transaction(async tx=>{
      const existing=await tx.product.count({where:{id:{in:ids}}});
      if(existing!==ids.length)return -1;
      const changed=await tx.product.updateMany({
        where:{id:{in:ids}},data:{status:parsed.status}
      });
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'product.bulk-status',targetType:'product',details:{count:ids.length,status:parsed.status}
      })});
      return changed.count;
    });
    if(count<0)return NextResponse.json({error:'Некоторые товары отсутствуют'},{status:404});
    return NextResponse.json({ok:true,updated:count});
  }catch(error){return adminApiError(error);}
}
