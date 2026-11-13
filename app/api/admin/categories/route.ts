import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { adminGate, adminApiError } from '../../../../lib/admin-api';
import { categoryInput, idInput } from '../../../../lib/admin-schemas';

export async function POST(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const data = categoryInput.parse(await req.json());
    const category = await db.category.create({ data });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) { return adminApiError(error); }
}

export async function PATCH(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const body = await req.json();
    const { id } = idInput.parse({ id: body.id });
    const data = categoryInput.parse({name:body.name,slug:body.slug,description:body.description});
    const category = await db.category.update({ where: { id }, data });
    return NextResponse.json({ category });
  } catch (error) { return adminApiError(error); }
}

export async function DELETE(req: Request) {
  const denied = await adminGate(req, true); if (denied) return denied;
  try {
    const { id } = idInput.parse(await req.json());
    const category = await db.category.findUnique({ where: { id }, select: { _count: { select: { products: true } } } });
    if (!category) return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 });
    if (category._count.products) return NextResponse.json({ error: 'Сначала переместите товары в другую категорию' }, { status: 409 });
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) { return adminApiError(error); }
}
