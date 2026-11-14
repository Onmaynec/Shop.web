import { z } from 'zod';
import { imageSource } from './admin-schemas';

export const defaultHome={
  key:'home' as const,
  headline:'Игровые товары.',
  subheadline:'Без лишнего.',
  description:'Один магазин для цифровых товаров и услуг. Минималистичный интерфейс, понятный каталог и контроль каждого заказа.',
  eyebrow:'DIGITAL MARKETPLACE / STANDOFF 2',
  ctaLabel:'Открыть каталог',
  ctaHref:'/catalog',
  backgroundUrl:null as string|null,
  published:false
};
export const homeInput=z.object({
  headline:z.string().trim().min(3).max(90),
  subheadline:z.string().trim().min(3).max(90),
  description:z.string().trim().min(10).max(400),
  eyebrow:z.string().trim().min(3).max(100),
  ctaLabel:z.string().trim().min(3).max(40),
  ctaHref:z.enum(['/catalog','/account','/cart']),
  backgroundUrl:z.union([z.literal(''),imageSource]).default(''),
  published:z.boolean()
}).strict();
