// Local CI fixture only. Never run against a real customer database.
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('node:crypto');
const db = new PrismaClient();
async function main() {
  if (process.env.CI !== 'true') throw new Error('Visual fixtures may only be seeded in CI');
  const category = await db.category.upsert({
    where: {slug:'visual-demo'},
    update: {name:'Демо-услуги',description:'Данные для визуальных тестов'},
    create: {name:'Демо-услуги',slug:'visual-demo',description:'Данные для визуальных тестов'}
  });
  for (const [slug,name,priceKopecks] of [
    ['visual-match-review','Анализ игрового матча',49000],
    ['visual-personal-training','Индивидуальная тренировка',129000],
    ['visual-strategy-session','Разбор игровых стратегий',75000],
    ['visual-training-plan','План тренировок',39000]
  ]) {
    await db.product.upsert({
      where:{slug},update:{name,description:'Демонстрационная услуга для проверки интерфейса.',status:'ACTIVE',priceKopecks,categoryId:category.id},
      create:{slug,name,description:'Демонстрационная услуга для проверки интерфейса.',status:'ACTIVE',priceKopecks,categoryId:category.id}
    });
  }
  const email='visual-admin@example.test';
  const salt=randomBytes(16).toString('hex');
  const passwordHash=salt+':'+scryptSync('VisualTestingPassword_123',salt,64).toString('hex');
  await db.user.upsert({
    where:{email},
    update:{passwordHash,role:'ADMIN'},
    create:{email,passwordHash,role:'ADMIN'}
  });
  console.log('CI-only visual fixtures created');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
