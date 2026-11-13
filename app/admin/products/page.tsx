import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Prisma, ProductStatus } from '@prisma/client';
import ProductManager from '../../../components/admin/ProductManager';
export const dynamic='force-dynamic';
export default async function ProductsPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}) {
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const params=await searchParams;
  const q=(params.q||'').trim().slice(0,80);
  const status=['DRAFT','ACTIVE','ARCHIVED'].includes(params.status||'')?params.status as ProductStatus:undefined;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where:Prisma.ProductWhereInput={...(status?{status}:{}),...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{slug:{contains:q,mode:'insensitive'}}]}:{})};
  const [products,total,categories]=await Promise.all([
    db.product.findMany({where,include:{category:{select:{name:true}}},orderBy:{createdAt:'desc'},skip:(page-1)*24,take:24}),
    db.product.count({where}),db.category.findMany({orderBy:{name:'asc'},select:{id:true,name:true}})
  ]);
  const items=products.map(p=>({id:p.id,name:p.name,slug:p.slug,description:p.description,categoryId:p.categoryId,categoryName:p.category.name,priceKopecks:p.priceKopecks,status:p.status,imageUrl:p.imageUrl}));
  const query=new URLSearchParams();if(q)query.set('q',q);if(status)query.set('status',status);
  const pages=Math.max(1,Math.ceil(total/24));
  return <>
    <ProductManager initialProducts={items} categories={categories} total={total}/>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>{page>1&&<Link href={'/admin/products?'+query.toString()+(query.size?'&':'')+'page='+(page-1)}>← Назад</Link>}{page<pages&&<Link href={'/admin/products?'+query.toString()+(query.size?'&':'')+'page='+(page+1)}>Далее →</Link>}</div></div>
  </>;
}
