import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate,adminApiError,readAdminBody } from '../../../../lib/admin-api';
import { homeInput } from '../../../../lib/storefront-content';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';

export async function PATCH(request:Request){
  const denied=await adminGate(request,true);if(denied)return denied;
  try{
    const user=await currentUser();if(!user)return NextResponse.json({error:'Нет доступа'},{status:403});
    const body=homeInput.parse(await readAdminBody(request));
    const record=await db.$transaction(async tx=>{
      const data={...body,backgroundUrl:body.backgroundUrl||null};
      const value=await tx.storefrontContent.upsert({
        where:{key:'home'},
        update:data,create:{key:'home',...data}
      });
      await tx.auditLog.create({data:auditEntry({
        actorId:user.id,action:'content.home.update',targetType:'content',targetId:'home',
        details:{published:body.published,ctaHref:body.ctaHref}
      })});
      return value;
    });
    return NextResponse.json({content:record});
  }catch(error){return adminApiError(error);}
}
