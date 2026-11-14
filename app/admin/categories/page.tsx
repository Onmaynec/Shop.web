import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import CategoryManager from '../../../components/admin/CategoryManager';
export const dynamic='force-dynamic';
export default async function CategoriesPage(){
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const categories=await db.category.findMany({include:{_count:{select:{products:true,children:true}}},orderBy:{name:'asc'}});
  return <CategoryManager initialCategories={categories.map(c=>({id:c.id,name:c.name,slug:c.slug,description:c.description,parentId:c.parentId,products:c._count.products,children:c._count.children}))}/>;
}
