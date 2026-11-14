import { db } from '../../../lib/db';
import { notFound } from 'next/navigation';
import ProductView from '../../../components/catalog/ProductView';
export const dynamic='force-dynamic';

export default async function ProductPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const product=await db.product.findUnique({
    where:{slug},
    include:{
      category:{select:{name:true}},
      images:{orderBy:{position:'asc'}},
      variants:{orderBy:{position:'asc'}}
    }
  });
  if(!product||product.status!=='ACTIVE')notFound();
  return <ProductView p={product}/>;
}
