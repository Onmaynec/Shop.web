const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
async function main() {
  const category = await db.category.upsert({
    where:{slug:'demo-training'},
    update:{name:'Демо: обучение',description:'Тестовая категория для локальной проверки'},
    create:{name:'Демо: обучение',slug:'demo-training',description:'Тестовая категория для локальной проверки'}
  });
  const products=[
    {name:'Демо: разбор матча',slug:'demo-match-review',description:'Тестовая карточка для проверки каталога и оформления заказа.',priceKopecks:59000},
    {name:'Демо: индивидуальная тренировка',slug:'demo-personal-coaching',description:'Тестовая карточка. Услуга не продаётся, пока магазин не готов.',priceKopecks:129000}
  ];
  for(const product of products) await db.product.upsert({
    where:{slug:product.slug},update:{...product,status:'DRAFT',categoryId:category.id},
    create:{...product,status:'DRAFT',categoryId:category.id}
  });
  console.log('Created demo category and 2 DRAFT products. Nothing was published.');
}
main().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>db.$disconnect());
