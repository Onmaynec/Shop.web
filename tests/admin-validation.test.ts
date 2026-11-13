import { describe, expect, it } from 'vitest';
import { categoryInput, productInput } from '../lib/admin-schemas';

describe('admin input validation', () => {
  it('allows a normal category', () => {
    const result=categoryInput.parse({name:'Тренировки',slug:'training'});
    expect(result.description).toBe('');
  });
  it('blocks incorrect slugs and excessive input', () => {
    expect(categoryInput.safeParse({name:'OK',slug:'../../secrets'}).success).toBe(false);
    expect(categoryInput.safeParse({name:'OK',slug:'test',role:'ADMIN'}).success).toBe(false);
  });
  it('requires positive prices and valid HTTPS images', () => {
    const base={name:'Разбор матча',slug:'match-review',description:'Демонстрационная услуга',categoryId:'cln9jwmjm0000a121q4or6b93',status:'DRAFT' as const,priceKopecks:10000,imageUrl:''};
    expect(productInput.safeParse(base).success).toBe(true);
    expect(productInput.safeParse({...base,priceKopecks:-1}).success).toBe(false);
    expect(productInput.safeParse({...base,imageUrl:'http://example.com/image.jpg'}).success).toBe(false);
    expect(productInput.safeParse({...base,status:'PAID'}).success).toBe(false);
  });
});
