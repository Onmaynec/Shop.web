import { db } from '../../../lib/db';
import { notFound } from 'next/navigation';
import {currentUser} from '../../../lib/auth';
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
  const user=await currentUser();
  const favorite=user?await db.favorite.findUnique({
    where:{userId_productId:{userId:user.id,productId:product.id}},select:{productId:true}
  }):null;
  return <ProductView p={product} signedIn={Boolean(user)} favorite={Boolean(favorite)}/>;
}
