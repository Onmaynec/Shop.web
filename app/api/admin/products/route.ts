import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate, adminApiError, readAdminBody } from '../../../../lib/admin-api';
import { productInput, idInput } from '../../../../lib/admin-schemas';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';

function normalized(data:ReturnType<typeof productInput.parse>){
  return {...data,imageUrl:data.imageUrl||null};
}

export async function POST(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const data=normalized(productInput.parse(await readAdminBody(req)));
    const product=await db.$transaction(async tx=>{
      const row=await tx.product.create({data});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'product.create',targetType:'product',targetId:row.id,details:{slug:row.slug,status:row.status,priceKopecks:row.priceKopecks}})});
      return row;
    });
    return NextResponse.json({product},{status:201});
  }catch(error){return adminApiError(error);}
}

export async function PATCH(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const body=await readAdminBody(req) as Record<string,unknown>;
    const {id}=idInput.parse({id:body.id});
    const data=normalized(productInput.parse({
      name:body.name,slug:body.slug,description:body.description,
      categoryId:body.categoryId,priceKopecks:body.priceKopecks,
      imageUrl:body.imageUrl,status:body.status
    }));
    const product=await db.$transaction(async tx=>{
      const before=await tx.product.findUniqueOrThrow({where:{id},select:{status:true,priceKopecks:true}});
      const row=await tx.product.update({where:{id},data});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'product.update',targetType:'product',targetId:id,details:{slug:row.slug,oldStatus:before.status,newStatus:row.status,oldPrice:before.priceKopecks,newPrice:row.priceKopecks}})});
      return row;
    });
    return NextResponse.json({product});
  }catch(error){return adminApiError(error);}
}

export async function DELETE(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id}=idInput.parse(await readAdminBody(req));
    const product=await db.$transaction(async tx=>{
      const row=await tx.product.update({where:{id},data:{status:'ARCHIVED'}});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'product.archive',targetType:'product',targetId:id,details:{slug:row.slug}})});
      return row;
    });
    return NextResponse.json({product});
  }catch(error){return adminApiError(error);}
}
