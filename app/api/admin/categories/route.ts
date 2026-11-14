import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate, adminApiError, readAdminBody } from '../../../../lib/admin-api';
import { categoryInput, idInput } from '../../../../lib/admin-schemas';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';

export async function POST(req: Request) {
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const data=categoryInput.parse(await readAdminBody(req));
    const category=await db.$transaction(async tx=>{
      const row=await tx.category.create({data});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'category.create',targetType:'category',targetId:row.id,details:{slug:row.slug}})});
      return row;
    });
    return NextResponse.json({category},{status:201});
  }catch(error){return adminApiError(error);}
}

export async function PATCH(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const body=await readAdminBody(req) as Record<string,unknown>;
    const {id}=idInput.parse({id:body.id});
    const data=categoryInput.parse({name:body.name,slug:body.slug,description:body.description});
    const category=await db.$transaction(async tx=>{
      const row=await tx.category.update({where:{id},data});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'category.update',targetType:'category',targetId:id,details:{slug:row.slug}})});
      return row;
    });
    return NextResponse.json({category});
  }catch(error){return adminApiError(error);}
}

export async function DELETE(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id}=idInput.parse(await readAdminBody(req));
    const row=await db.category.findUnique({where:{id},select:{slug:true,_count:{select:{products:true}}}});
    if(!row)return NextResponse.json({error:'Категория не найдена'},{status:404});
    if(row._count.products)return NextResponse.json({error:'Сначала перенесите товары в другую категорию'},{status:409});
    await db.$transaction(async tx=>{
      await tx.category.delete({where:{id}});
      await tx.auditLog.create({data:auditEntry({actorId:actor.id,action:'category.delete',targetType:'category',targetId:id,details:{slug:row.slug}})});
    });
    return NextResponse.json({ok:true});
  }catch(error){return adminApiError(error);}
}
