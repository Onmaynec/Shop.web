import {db} from './db';

export type CheckState='pass'|'warning'|'blocker';
export type ReadinessCheck={
  code:string;title:string;state:CheckState;description:string
};

/** Diagnostics are deliberately advisory, not a certification of payment safety. */
export async function readinessChecks():Promise<ReadinessCheck[]>{
  const secret=process.env.SESSION_SECRET||'';
  const sandbox=process.env.PAYMENT_SANDBOX_ENABLED==='true';
  let dbOk=false;
  let migrations=false;
  try{
    await db.$queryRaw`SELECT 1`;
    dbOk=true;
    const rows=await db.$queryRaw<Array<{migration_name:string}>>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    migrations=rows.some(x=>x.migration_name==='20261114100000_platform_release');
  }catch{
    // Local visual test environments may use db push instead of migrations.
  }
  return [
    {code:'database',title:'PostgreSQL',state:dbOk?'pass':'blocker',
      description:dbOk?'Соединение с базой доступно':'Нет соединения с PostgreSQL'},
    {code:'migrations',title:'Миграции',state:migrations?'pass':'warning',
      description:migrations?'Миграция v1.0.0 зарегистрирована':
        'Не найдено подтверждение миграции v1.0.0; выполните npm run db:migrate'},
    {code:'secret',title:'Секрет сессий',state:secret.length>=32&&!secret.startsWith('replace-with-')&&!secret.startsWith('ci-only-')?'pass':'blocker',
      description:'Нужен уникальный SESSION_SECRET длиной от 32 символов, не тестовое значение'},
    {code:'staff-mfa',title:'Двухфакторная защита сотрудников',
      state:process.env.ENFORCE_STAFF_MFA==='true'?'pass':'warning',
      description:process.env.ENFORCE_STAFF_MFA==='true'?'Политика MFA для персонала включена':
        'Рекомендуется включить ENFORCE_STAFF_MFA=true после настройки MFA на аккаунтах сотрудников'},
    {code:'sandbox',title:'Тестовые платежи',state:sandbox?'warning':'pass',
      description:sandbox?'Включён локальный платёжный sandbox. Для открытого сервера его необходимо отключить':
        'Тестовые платежи отключены в текущем процессе'},
    {code:'real-payment',title:'Реальный эквайринг',state:'blocker',
      description:'Подключение и проверка реального платёжного провайдера не реализованы'},
    {code:'email',title:'Почта и подтверждение email',state:'blocker',
      description:'Email-верификация, восстановление аккаунта и SMTP-оповещения отсутствуют'},
    {code:'storage',title:'Постоянное файловое хранилище',state:'warning',
      description:'Проверка независимого резервного копирования data/media и data/deliveries выполняется вручную'},
    {code:'external-security',title:'Внешняя безопасность и юридическая проверка',state:'blocker',
      description:'Нужны независимые аудит, WAF/reverse proxy, политики обработки данных и проверка разрешённости услуг'}
  ];
}
