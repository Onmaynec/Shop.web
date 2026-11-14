import { z } from 'zod';

const slug = z.string().trim().toLowerCase().min(2,'Адрес слишком короткий').max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Адрес: латинские буквы, цифры и дефис');
const sku=z.string().trim().toUpperCase().min(2).max(64)
  .regex(/^[A-Z0-9][A-Z0-9._-]+$/,'SKU: латиница, цифры, точка, дефис или подчёркивание');

export const imageSource=z.string().max(1000).refine(value=>{
  if(/^\/api\/media\/[a-f0-9]{32}\.(?:png|jpg|webp)$/.test(value))return true;
  try{const uri=new URL(value);return uri.protocol==='https:'&&Boolean(uri.hostname)&&!uri.username&&!uri.password;}
  catch{return false;}
},'Изображение: HTTPS-ссылка либо файл, загруженный в библиотеку');

export const categoryInput=z.object({
  name:z.string().trim().min(2).max(100),
  slug,
  description:z.string().trim().max(500).default(''),
  parentId:z.string().cuid().nullable().optional().default(null)
}).strict();

export const imageInput=z.object({
  url:imageSource,
  alt:z.string().trim().max(150).default('')
}).strict();
export const specInput=z.object({
  name:z.string().trim().min(1).max(60),
  value:z.string().trim().min(1).max(200)
}).strict();
export const variantInput=z.object({
  id:z.string().cuid().optional(),
  sku,
  label:z.string().trim().min(1).max(100),
  priceKopecks:z.number().int().min(1).max(100000000),
  active:z.boolean().default(true)
}).strict();

export const productInput=z.object({
  name:z.string().trim().min(2,'Название минимум 2 символа').max(150),
  slug,
  description:z.string().trim().min(5,'Добавьте описание товара').max(5000),
  categoryId:z.string().cuid(),
  priceKopecks:z.number().int().min(1,'Цена должна быть положительной').max(100000000),
  imageUrl:z.union([z.literal(''),imageSource]).default(''),
  status:z.enum(['DRAFT','ACTIVE','ARCHIVED']),
  sku:z.union([z.literal(''),sku]).default(''),
  tags:z.array(z.string().trim().min(1).max(35)).max(12).default([]),
  specs:z.array(specInput).max(16).default([]),
  images:z.array(imageInput).max(8).default([]),
  variants:z.array(variantInput).max(12).default([])
}).strict().superRefine((data,ctx)=>{
  const variants=new Set<string>();
  for(const v of data.variants){
    if(variants.has(v.sku))ctx.addIssue({code:'custom',path:['variants'],message:'SKU вариантов должны быть уникальны'});
    variants.add(v.sku);
  }
  if(data.sku&&variants.has(data.sku))ctx.addIssue({code:'custom',path:['sku'],message:'SKU товара совпадает с вариантом'});
  if(new Set(data.tags.map(t=>t.toLowerCase())).size!==data.tags.length)ctx.addIssue({code:'custom',path:['tags'],message:'Теги не должны повторяться'});
});
export const idInput=z.object({id:z.string().cuid()}).strict();
