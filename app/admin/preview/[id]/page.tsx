import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/auth';
import { notFound } from 'next/navigation';
import ProductView from '../../../../components/catalog/ProductView';

export const dynamic='force-dynamic';
export default async function Preview({params}:{params:Promise<{id:string}>}){
  const user=await currentUser();
  if(!user||user.role!=='ADMIN')notFound();
  const {id}=await params;
  const product=await db.product.findUnique({
    where:{id},
    include:{
      category:{select:{name:true}},
      images:{orderBy:{position:'asc'}},
      variants:{orderBy:{position:'asc'}}
    }
  });
  if(!product)notFound();
  return <ProductView p={product} preview/>;
}
