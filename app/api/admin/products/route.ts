import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../lib/db';
import { adminGate,adminApiError,readAdminBody } from '../../../../lib/admin-api';
import { productInput,idInput } from '../../../../lib/admin-schemas';
import { currentUser } from '../../../../lib/auth';
import { auditEntry } from '../../../../lib/audit';

class CatalogConflict extends Error {}
function normalize(raw:ReturnType<typeof productInput.parse>){
  const {images,variants,specs,sku,tags,...base}=raw;
  return {
    scalar:{
      ...base,
      sku:sku||null,
      imageUrl:base.imageUrl||null,
      tags,
      specs:specs as Prisma.InputJsonValue
    },
    images:images.map((img,position)=>({...img,position})),
    variants:variants.map((variant,position)=>({...variant,position}))
  };
}
async function categoryExists(id:string){
  return Boolean(await db.category.findUnique({where:{id},select:{id:true}}));
}

export async function POST(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const input=productInput.parse(await readAdminBody(req));
    if(input.variants.some(v=>v.id))return NextResponse.json({error:'Новый товар не может ссылаться на существующий вариант'},{status:400});
    if(!(await categoryExists(input.categoryId)))return NextResponse.json({error:'Категория не найдена'},{status:400});
    const {scalar,images,variants}=normalize(input);
    const product=await db.$transaction(async tx=>{
      const row=await tx.product.create({
        data:{
          ...scalar,
          images:{create:images},
          variants:{create:variants.map(({id,...variant})=>variant)}
        }
      });
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'product.create',targetType:'product',targetId:row.id,
        details:{slug:row.slug,status:row.status,priceKopecks:row.priceKopecks,images:images.length,variants:variants.length}
      })});
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
    const raw=productInput.parse({
      name:body.name,slug:body.slug,description:body.description,
      categoryId:body.categoryId,priceKopecks:body.priceKopecks,
      imageUrl:body.imageUrl,status:body.status,
      sku:body.sku,tags:body.tags,specs:body.specs,images:body.images,variants:body.variants
    });
    if(!(await categoryExists(raw.categoryId)))return NextResponse.json({error:'Категория не найдена'},{status:400});
    const {scalar,images,variants}=normalize(raw);
    const product=await db.$transaction(async tx=>{
      const before=await tx.product.findUniqueOrThrow({
        where:{id},select:{slug:true,status:true,priceKopecks:true}
      });
      const saved=await tx.productVariant.findMany({where:{productId:id},select:{id:true}});
      const owned=new Set(saved.map(v=>v.id));
      if(variants.some(v=>v.id&&!owned.has(v.id)))throw new CatalogConflict('Вариант не принадлежит этому товару');
      const row=await tx.product.update({where:{id},data:scalar});
      await tx.productImage.deleteMany({where:{productId:id}});
      if(images.length)await tx.productImage.createMany({data:images.map(img=>({...img,productId:id}))});
      const retained=variants.map(v=>v.id).filter((v):v is string=>Boolean(v));
      await tx.productVariant.updateMany({
        where:{productId:id,...(retained.length?{id:{notIn:retained}}:{})},
        data:{active:false}
      });
      for(const v of variants){
        const {id:variantId,...fields}=v;
        if(variantId){
          await tx.productVariant.update({where:{id:variantId,productId:id},data:fields});
        }else{
          await tx.productVariant.create({data:{...fields,productId:id}});
        }
      }
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'product.update',targetType:'product',targetId:id,
        details:{
          slug:row.slug,oldStatus:before.status,newStatus:row.status,
          oldPrice:before.priceKopecks,newPrice:row.priceKopecks,
          galleryImages:images.length,variants:variants.length
        }
      })});
      return row;
    });
    return NextResponse.json({product});
  }catch(error){
    if(error instanceof CatalogConflict)return NextResponse.json({error:error.message},{status:409});
    return adminApiError(error);
  }
}

export async function DELETE(req:Request){
  const denied=await adminGate(req,true);if(denied)return denied;
  try{
    const actor=await currentUser();if(!actor)return NextResponse.json({error:'Нет доступа'},{status:403});
    const {id}=idInput.parse(await readAdminBody(req));
    const product=await db.$transaction(async tx=>{
      const row=await tx.product.update({where:{id},data:{status:'ARCHIVED'}});
      await tx.auditLog.create({data:auditEntry({
        actorId:actor.id,action:'product.archive',targetType:'product',targetId:id,details:{slug:row.slug}
      })});
      return row;
    });
    return NextResponse.json({product});
  }catch(error){return adminApiError(error);}
}
