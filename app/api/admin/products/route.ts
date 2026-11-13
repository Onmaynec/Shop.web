import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate, adminApiError } from '../../../../lib/admin-api';
import { productInput, idInput } from '../../../../lib/admin-schemas';

function normalized(data: ReturnType<typeof productInput.parse>) {
  return { ...data, imageUrl: data.imageUrl || null };
}

export async function POST(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const data = normalized(productInput.parse(await req.json()));
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return NextResponse.json({ error: 'Категория не найдена' }, { status: 400 });
    const product = await db.product.create({ data });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) { return adminApiError(error); }
}

export async function PATCH(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const body = await req.json();
    const { id } = idInput.parse({ id: body.id });
    const data = normalized(productInput.parse({
      name: body.name, slug: body.slug, description: body.description,
      categoryId: body.categoryId, priceKopecks: body.priceKopecks,
      imageUrl: body.imageUrl, status: body.status
    }));
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return NextResponse.json({ error: 'Категория не найдена' }, { status: 400 });
    const product = await db.product.update({ where: { id }, data });
    return NextResponse.json({ product });
  } catch (error) { return adminApiError(error); }
}

export async function DELETE(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const { id } = idInput.parse(await req.json());
    const product = await db.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return NextResponse.json({ product });
  } catch (error) { return adminApiError(error); }
}
