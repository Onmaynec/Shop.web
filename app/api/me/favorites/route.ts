import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '../../../../lib/db';
import {currentUser} from '../../../../lib/auth';
import {requireSameOrigin,requireJson,readBoundedJson,inputError,limitResponse} from '../../../../lib/http-security';
import {takeRateLimit} from '../../../../lib/rate-limit';

export const dynamic='force-dynamic';
const schema=z.object({productId:z.string().cuid()}).strict();

export async function GET(){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Необходима авторизация'},{status:401});
  const favorites=await db.favorite.findMany({
    where:{userId:user.id},orderBy:{createdAt:'desc'},take:100,
    include:{product:{select:{id:true,slug:true,name:true,status:true,
      priceKopecks:true,imageUrl:true}}}
  });
  return NextResponse.json({favorites:favorites.map(f=>({
    productId:f.productId,createdAt:f.createdAt,
    product:f.product
  }))},{headers:{'Cache-Control':'private, no-store'}});
}

async function change(request:Request,remove:boolean){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Необходима авторизация'},{status:401});
  const denied=requireSameOrigin(request)||requireJson(request);if(denied)return denied;
  const limited=limitResponse(await takeRateLimit('favorites-change',user.id,60,3600));
  if(limited)return limited;
  try{
    const {productId}=schema.parse(await readBoundedJson(request,1024));
    if(remove){
      await db.favorite.deleteMany({where:{userId:user.id,productId}});
      return NextResponse.json({ok:true,favorite:false});
    }
    const product=await db.product.findFirst({
      where:{id:productId,status:'ACTIVE'},select:{id:true}
    });
    if(!product)return NextResponse.json({error:'Товар недоступен'},{status:404});
    const existing=await db.favorite.findUnique({where:{
      userId_productId:{userId:user.id,productId}
    }});
    if(!existing){
      const count=await db.favorite.count({where:{userId:user.id}});
      if(count>=100)return NextResponse.json({error:'В избранном не может быть больше 100 товаров'},{status:409});
      await db.favorite.upsert({
        where:{userId_productId:{userId:user.id,productId}},
        create:{userId:user.id,productId},update:{}
      });
    }
    return NextResponse.json({ok:true,favorite:true});
  }catch(e){return inputError(e);}
}

export async function POST(request:Request){return change(request,false);}
export async function DELETE(request:Request){return change(request,true);}
