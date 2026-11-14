import type {MetadataRoute} from 'next';
import {db} from '../lib/db';
import {publicIndexingEnabled,siteOrigin} from '../lib/public-indexing';

export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  if(!publicIndexingEnabled())return [];
  const origin=siteOrigin();if(!origin)return [];
  const products=await db.product.findMany({
    where:{status:'ACTIVE'},select:{slug:true,createdAt:true},take:5000,
    orderBy:{createdAt:'desc'}
  });
  return [
    {url:origin+'/',changeFrequency:'weekly',priority:1},
    {url:origin+'/catalog',changeFrequency:'daily',priority:.8},
    ...products.map(p=>({
      url:origin+'/product/'+encodeURIComponent(p.slug),
      lastModified:p.createdAt,changeFrequency:'weekly' as const,priority:.6
    }))
  ];
}
