import { z } from 'zod';

const slug = z.string().trim().toLowerCase().min(2, 'Адрес слишком короткий').max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Адрес: латинские буквы, цифры и дефис');

export const categoryInput = z.object({
  name: z.string().trim().min(2, 'Название минимум 2 символа').max(100),
  slug,
  description: z.string().trim().max(500).default('')
}).strict();

export const productInput = z.object({
  name: z.string().trim().min(2, 'Название минимум 2 символа').max(150),
  slug,
  description: z.string().trim().min(5, 'Добавьте описание товара').max(5000),
  categoryId: z.string().cuid(),
  priceKopecks: z.number().int().min(1, 'Цена должна быть положительной').max(100000000),
  imageUrl: z.union([z.literal(''), z.string().url().max(1000).refine(v => new URL(v).protocol === 'https:', 'Изображение должно использовать HTTPS')]).default(''),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
}).strict();

export const idInput = z.object({ id: z.string().cuid() }).strict();
