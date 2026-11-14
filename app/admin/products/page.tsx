import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Prisma,ProductStatus } from '@prisma/client';
import ProductManager from '../../../components/admin/ProductManager';

export const dynamic='force-dynamic';
function specsOf(value:unknown){
  return Array.isArray(value)?value.filter((row):row is {name:string;value:string}=>Boolean(row)
    &&typeof row==='object'&&typeof row.name==='string'&&typeof row.value==='string'):[];
}
export default async function ProductsPage({
  searchParams
}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}){
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const params=await searchParams;
  const q=(params.q||'').trim().slice(0,80);
  const status=['DRAFT','ACTIVE','ARCHIVED'].includes(params.status||'')?params.status as ProductStatus:undefined;
  const page=Math.max(1,Math.min(10000,parseInt(params.page||'1',10)||1));
  const where:Prisma.ProductWhereInput={
    ...(status?{status}:{}),
    ...(q?{OR:[
      {name:{contains:q,mode:'insensitive'}},
      {slug:{contains:q,mode:'insensitive'}},
      {sku:{contains:q,mode:'insensitive'}},
      {variants:{some:{sku:{contains:q,mode:'insensitive'}}}}
    ]}:{})
  };
  const [products,total,categories]=await Promise.all([
    db.product.findMany({
      where,
      include:{
        category:{select:{name:true}},
        images:{orderBy:{position:'asc'}},
        variants:{orderBy:{position:'asc'}}
      },
      orderBy:{createdAt:'desc'},skip:(page-1)*24,take:24
    }),
    db.product.count({where}),
    db.category.findMany({orderBy:{name:'asc'},select:{
      id:true,name:true,parentId:true,parent:{select:{name:true}}
    }})
  ]);
  const items=products.map(p=>({
    id:p.id,name:p.name,slug:p.slug,description:p.description,categoryId:p.categoryId,
    categoryName:p.category.name,priceKopecks:p.priceKopecks,status:p.status,
    imageUrl:p.imageUrl,sku:p.sku,tags:p.tags,specs:specsOf(p.specs),
    images:p.images.map(i=>({url:i.url,alt:i.alt})),
    variants:p.variants.map(v=>({
      id:v.id,sku:v.sku,label:v.label,priceKopecks:v.priceKopecks,active:v.active
    }))
  }));
  const query=new URLSearchParams();if(q)query.set('q',q);if(status)query.set('status',status);
  const pages=Math.max(1,Math.ceil(total/24));
  return <>
    <ProductManager initialProducts={items} total={total} categories={categories.map(c=>({
      id:c.id,name:c.parent?c.parent.name+' / '+c.name:c.name
    }))}/>
    <div className="adm-pagination"><span>Страница {page} из {pages}</span><div>
      {page>1&&<Link href={'/admin/products?'+query.toString()+(query.size?'&':'')+'page='+(page-1)}>← Назад</Link>}
      {page<pages&&<Link href={'/admin/products?'+query.toString()+(query.size?'&':'')+'page='+(page+1)}>Далее →</Link>}
    </div></div>
  </>;
}
