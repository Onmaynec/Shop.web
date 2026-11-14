import { describe,expect,it } from 'vitest';
import { imageSource,categoryInput,productInput } from '../lib/admin-schemas';
import { homeInput } from '../lib/storefront-content';
import { identifyImage } from '../lib/media-store';
import { checkoutFingerprint } from '../lib/checkout';

const base={
  name:'Проверка игрового матча',slug:'match-review',description:'Описание тестовой услуги',
  categoryId:'cln9jwmjm0000a121q4or6b93',priceKopecks:49000,
  imageUrl:'',status:'DRAFT' as const
};
describe('Catalog Pro validators',()=>{
  it('accepts a nested category but rejects unexpected data',()=>{
    expect(categoryInput.safeParse({name:'Тренировки',slug:'training',parentId:'cln9jwmjm0000a121q4or6b93'}).success).toBe(true);
    expect(categoryInput.safeParse({name:'Тренировки',slug:'training',isAdmin:true}).success).toBe(false);
  });
  it('accepts local media paths or https while forbidding dangerous formats',()=>{
    expect(imageSource.safeParse('/api/media/'+'a'.repeat(32)+'.webp').success).toBe(true);
    expect(imageSource.safeParse('https://assets.example.org/img.webp').success).toBe(true);
    expect(imageSource.safeParse('javascript:alert(1)').success).toBe(false);
    expect(imageSource.safeParse('/api/media/../../secrets').success).toBe(false);
    expect(imageSource.safeParse('http://example.com/image.png').success).toBe(false);
  });
  it('validates SKU, galleries, variant uniqueness, tags and specifications',()=>{
    const input={...base,sku:'MATCH-001',tags:['Обучение'],
      specs:[{name:'Формат',value:'Онлайн'}],
      images:[{url:'/api/media/'+'a'.repeat(32)+'.png',alt:'Test'}],
      variants:[{sku:'MATCH-001-STD',label:'Стандарт',priceKopecks:75000,active:true}]
    };
    expect(productInput.safeParse(input).success).toBe(true);
    expect(productInput.safeParse({...input,variants:[input.variants[0],input.variants[0]]}).success).toBe(false);
    expect(productInput.safeParse({...input,images:Array(9).fill(input.images[0])}).success).toBe(false);
    expect(productInput.safeParse({...input,tags:['А','а']}).success).toBe(false);
    expect(productInput.safeParse({...input,variants:[{...input.variants[0],priceKopecks:-1}]}).success).toBe(false);
  });
  it('rejects unsupported image signatures',()=>{
    expect(identifyImage(new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]))).toBeNull();
    expect(identifyImage(new Uint8Array([137,80,78,71,13,10,26,10,...Array(8).fill(0)]))).toBe('png');
  });
  it('keeps variant identity in the idempotency hash',()=>{
    const a=checkoutFingerprint({email:'test@example.com',items:[{productId:'a',variantId:'x',quantity:1}]});
    const b=checkoutFingerprint({email:'test@example.com',items:[{productId:'a',variantId:'y',quantity:1}]});
    expect(a).not.toBe(b);
  });
  it('restricts CTA links to local site pages',()=>{
    expect(homeInput.safeParse({
      headline:'Игровой каталог',subheadline:'Услуги',description:'Понятный игровой магазин и каталог товаров.',
      eyebrow:'STANDOFF',ctaLabel:'Каталог',ctaHref:'/catalog',backgroundUrl:'',published:true
    }).success).toBe(true);
    expect(homeInput.safeParse({
      headline:'Игровой каталог',subheadline:'Услуги',description:'Понятный игровой магазин и каталог товаров.',
      eyebrow:'STANDOFF',ctaLabel:'Каталог',ctaHref:'https://evil.invalid',backgroundUrl:'',published:true
    }).success).toBe(false);
  });
});
