import { test, expect } from '@playwright/test';

async function screenshot(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, name: string) {
  await testInfo.attach(name,{body:await page.screenshot({fullPage:true,animations:'disabled'}),contentType:'image/png'});
}

test('home and global search', async ({page},testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('Игровые товары');
  await expect(page.getByRole('link',{name:/Открыть каталог/})).toBeVisible();
  await screenshot(page,testInfo,'home');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog',{name:'Поиск товаров'})).toBeVisible();
  await page.getByPlaceholder('Найти товар или услугу...').fill('Анализ');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog\?q=/);
  await expect(page.getByRole('heading',{name:'Выбирай своё.'})).toBeVisible();
});

test('catalog, product and cart',async({page},testInfo)=>{
  await page.goto('/catalog');
  await expect(page.getByText('Анализ игрового матча')).toBeVisible();
  await screenshot(page,testInfo,'catalog');
  await page.getByRole('link',{name:/Анализ игрового матча/}).click();
  await expect(page.getByRole('heading',{name:'Анализ игрового матча'})).toBeVisible();
  await screenshot(page,testInfo,'product');
  await page.getByRole('button',{name:'Добавить в корзину'}).click();
  await expect(page.getByRole('link',{name:/Перейти к заказу/})).toBeVisible();
  await page.getByRole('link',{name:/Перейти к заказу/}).click();
  await expect(page.getByRole('heading',{name:'Ваша корзина'})).toBeVisible();
  await screenshot(page,testInfo,'cart');
  await page.getByPlaceholder('you@example.com').fill('visual-buyer@example.test');
  await page.getByRole('button',{name:/Создать заказ без оплаты/}).click();
  await expect(page.getByRole('heading',{name:'Заказ создан!'})).toBeVisible();
  await screenshot(page,testInfo,'order-confirmation');
});

test('profile and admin UI',async({page},testInfo)=>{
  await page.goto('/account');
  await expect(page.getByRole('heading',{name:'Личный кабинет'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Войти в аккаунт'})).toBeVisible();
  await screenshot(page,testInfo,'login');
  await page.getByRole('textbox',{name:'Email'}).fill('visual-admin@example.test');
  await page.getByLabel('Пароль').fill('VisualTestingPassword_123');
  await page.getByRole('button',{name:'Войти в аккаунт'}).click();
  await expect(page.getByRole('link',{name:/Панель управления/})).toBeVisible();
  await page.goto('/account/security');
  await expect(page.getByRole('heading',{name:'Безопасность аккаунта'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Активные сессии/})).toBeVisible();
  await screenshot(page,testInfo,'account-security');
  await page.goto('/account');
  await page.getByRole('link',{name:/Панель управления/}).click();
  await expect(page.getByRole('heading',{name:'Панель управления'})).toBeVisible();
  await screenshot(page,testInfo,'admin-dashboard');
  await page.goto('/admin/products');
  await expect(page.getByRole('heading',{name:'Товары'})).toBeVisible();
  await page.getByRole('button',{name:'Добавить товар'}).click();
  await expect(page.getByRole('dialog',{name:'Новый товар'})).toBeVisible();
  await screenshot(page,testInfo,'admin-product-dialog');
  await page.goto('/admin/categories');
  await expect(page.getByRole('heading',{name:'Категории'})).toBeVisible();
  await screenshot(page,testInfo,'admin-categories');
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading',{name:'Заказы'})).toBeVisible();
  await screenshot(page,testInfo,'admin-orders');
  await page.goto('/admin/customers');
  await expect(page.getByRole('heading',{name:'Пользователи'})).toBeVisible();
  await screenshot(page,testInfo,'admin-customers');
  await page.goto('/admin/audit');
  await expect(page.getByRole('heading',{name:'Аудит действий'})).toBeVisible();
  await screenshot(page,testInfo,'admin-audit');
});

test('responsive navigation',async({page,isMobile},testInfo)=>{
  if(!isMobile){test.skip();}
  await page.goto('/');
  await page.getByRole('button',{name:'Открыть меню'}).click();
  await expect(page.getByRole('navigation',{name:'Мобильное меню'})).toBeVisible();
  await screenshot(page,testInfo,'mobile-navigation');
  await page.getByRole('navigation',{name:'Мобильное меню'}).getByRole('link',{name:/Каталог/}).click();
  await expect(page.getByRole('heading',{name:'Выбирай своё.'})).toBeVisible();
});
