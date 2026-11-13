import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
const schema=z.object({email:z.string().trim().email().max(254),items:z.array(z.object({productId:z.string().min(1),quantity:z.number().int().min(1).max(20)})).min(1).max(30)});
export async function POST(req:Request){
 try{
 const body=schema.parse(await req.json());const user=await currentUser();
 const quantities=new Map<string,number>();for(const item of body.items)quantities.set(item.productId,(quantities.get(item.productId)??0)+item.quantity);
 if([...quantities.values()].some(q=>q>20))return NextResponse.json({error:'Invalid quantity'},{status:400});
 const products=await db.product.findMany({where:{id:{in:[...quantities.keys()]},status:'ACTIVE'}});
 if(products.length!==quantities.size)return NextResponse.json({error:'Product unavailable'},{status:400});
 const total=products.reduce((sum,p)=>sum+p.priceKopecks*quantities.get(p.id)!,0);
 if(!Number.isSafeInteger(total)||total<=0)return NextResponse.json({error:'Invalid total'},{status:400});
 const order=await db.order.create({data:{email:user?.email??body.email,userId:user?.id,totalKopecks:total,items:{create:products.map(p=>({productId:p.id,nameSnapshot:p.name,unitPriceKopecks:p.priceKopecks,quantity:quantities.get(p.id)!}))}},select:{id:true,status:true,totalKopecks:true}});
 return NextResponse.json({order,payment:{available:false,message:'Payment provider is not connected'}},{status:201});
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return NextResponse.json({error:'Invalid request'},{status:400});console.error('Order creation failed',e);return NextResponse.json({error:'Internal error'},{status:500});}
}
