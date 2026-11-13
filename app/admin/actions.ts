'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser } from '../../lib/auth';
import { db } from '../../lib/db';

async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.role !== 'ADMIN') throw new Error('Доступ запрещён');
  return user;
}
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const categorySchema = z.object({ name: z.string().trim().min(2).max(100), slug });
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug,
  description: z.string().trim().min(5).max(5000),
  categoryId: z.string().min(1),
  priceKopecks: z.coerce.number().int().min(1).max(100000000),
  status: z.enum(['DRAFT','ACTIVE','ARCHIVED'])
});
export async function createCategory(form: FormData) {
  await requireAdmin();
  const data = categorySchema.parse({name:form.get('name'),slug:form.get('slug')});
  await db.category.create({data});
  revalidatePath('/admin'); revalidatePath('/catalog');
}
export async function createProduct(form: FormData) {
  await requireAdmin();
  const data = productSchema.parse(Object.fromEntries(form));
  await db.product.create({data});
  revalidatePath('/admin'); revalidatePath('/catalog');
}
export async function updateProduct(form: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(form.get('id'));
  const data = productSchema.parse(Object.fromEntries(form));
  await db.product.update({where:{id},data});
  revalidatePath('/admin'); revalidatePath('/catalog'); revalidatePath('/product/'+data.slug);
}
export async function archiveProduct(form: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(form.get('id'));
  await db.product.update({where:{id},data:{status:'ARCHIVED'}});
  revalidatePath('/admin'); revalidatePath('/catalog');
}
export async function updateOrderStatus(form: FormData) {
  await requireAdmin();
  const id = z.string().min(1).parse(form.get('id'));
  // Payment status must only be changed by a verified payment integration.
  const status = z.enum(['PROCESSING','FULFILLED','CANCELLED']).parse(form.get('status'));
  const order = await db.order.findUnique({where:{id},select:{status:true}});
  if(!order) throw new Error('Заказ не найден');
  if(status==='PROCESSING' && order.status!=='PAID') throw new Error('Нельзя обрабатывать неоплаченный заказ');
  if(status==='FULFILLED' && order.status!=='PROCESSING') throw new Error('Сначала переведите оплаченный заказ в обработку');
  if(status==='CANCELLED' && order.status!=='PENDING_PAYMENT') throw new Error('Можно отменить только неоплаченный заказ');
  await db.order.update({where:{id,status:order.status},data:{status}});
  revalidatePath('/admin');
}
