import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const db=new PrismaClient();
const base='http://127.0.0.1:3000';
const email='security-'+Date.now()+'@example.test';
const goodPassword='SecurityTestPassword_123456';
const updatedPassword='AnotherSecurityPassword_654321';
let cookie='';

async function send(path, method='GET',body,withCookie=true) {
  const response=await fetch(base+path,{
    method,headers:{
      ...(method!=='GET'?{'Origin':base,'Content-Type':'application/json'}:{}),
      ...(withCookie&&cookie?{'Cookie':cookie}:{})
    },
    body:method!=='GET'?JSON.stringify(body):undefined
  });
  return {status:response.status,body:await response.json().catch(()=>null),headers:response.headers};
}

async function run() {
 try{
  const missingOrigin=await fetch(base+'/api/auth/register',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password:goodPassword})
  });
  assert.equal(missingOrigin.status,403);

  const registered=await send('/api/auth/register','POST',{email,password:goodPassword},false);
  assert.equal(registered.status,201,JSON.stringify(registered.body));
  cookie=registered.headers.get('set-cookie')?.split(';')[0]||'';
  assert.ok(cookie.startsWith('ss_session='));
  assert.ok(!cookie.includes(email),'Cookie must be opaque');

  const sessions=await send('/api/account/sessions');
  assert.equal(sessions.status,200,JSON.stringify(sessions.body));
  assert.equal(sessions.body.sessions.length,1);
  assert.equal(sessions.body.sessions[0].current,true);
  const cookieA=cookie;

  const login=await send('/api/auth/login','POST',{email,password:goodPassword},false);
  assert.equal(login.status,200,JSON.stringify(login.body));
  const cookieB=login.headers.get('set-cookie')?.split(';')[0]||'';
  assert.notEqual(cookieA,cookieB);

  cookie=cookieB;
  const both=await send('/api/account/sessions');
  assert.equal(both.status,200,JSON.stringify(both.body));
  assert.equal(both.body.sessions.length,2);

  const others=await send('/api/account/sessions','DELETE',{action:'revoke_others'});
  assert.equal(others.status,200,JSON.stringify(others.body));

  cookie=cookieA;
  const revoked=await send('/api/auth/session');
  assert.equal(revoked.body.user,null,'Revoked session must not authenticate');
  cookie=cookieB;

  const password=await send('/api/account/password','POST',{currentPassword:goodPassword,newPassword:updatedPassword});
  assert.equal(password.status,200,JSON.stringify(password.body));
  const oldAfterChange=await send('/api/auth/session');
  assert.equal(oldAfterChange.body.user,null,'Password change must invalidate sessions');

  const oldPasswordLogin=await send('/api/auth/login','POST',{email,password:goodPassword},false);
  assert.equal(oldPasswordLogin.status,401);
  const newLogin=await send('/api/auth/login','POST',{email,password:updatedPassword},false);
  assert.equal(newLogin.status,200,JSON.stringify(newLogin.body));
  cookie=newLogin.headers.get('set-cookie')?.split(';')[0]||'';

  const otherEmail='limited-'+Date.now()+'@example.test';
  for(let i=0;i<10;i++){
    const response=await send('/api/auth/login','POST',{email:otherEmail,password:'WrongPassword_1234'},false);
    assert.equal(response.status,401);
  }
  const blocked=await send('/api/auth/login','POST',{email:otherEmail,password:'WrongPassword_1234'},false);
  assert.equal(blocked.status,429,JSON.stringify(blocked.body));
  assert.ok(Number(blocked.headers.get('retry-after'))>0);

  await db.user.update({where:{email},data:{role:'ADMIN'}});
  const auditCategory=await send('/api/admin/categories','POST',{
    name:'Security '+Date.now(),slug:'security-'+Date.now(),description:'Testing security'
  });
  assert.equal(auditCategory.status,201,JSON.stringify(auditCategory.body));
  const audit=await db.auditLog.findFirst({
    where:{action:'category.create',targetId:auditCategory.body.category.id}
  });
  assert.ok(audit,'Admin writes must create an audit event');
  assert.equal(audit.actorId,(await db.user.findUniqueOrThrow({where:{email}})).id);

  const invalidForeignOrigin=await fetch(base+'/api/admin/categories',{
    method:'POST',headers:{'Origin':'https://forged.example','Cookie':cookie,'Content-Type':'application/json'},
    body:JSON.stringify({name:'Forged',slug:'forged'})
  });
  assert.equal(invalidForeignOrigin.status,403);

  const all=await send('/api/account/sessions','DELETE',{action:'revoke_all'});
  assert.equal(all.status,200);
  assert.equal((await send('/api/auth/session')).body.user,null);
  console.log('Security integration passed: opaque/revocable sessions, password rotation, rate limiting, admin audit, CSRF origin guard');
 }finally{await db.$disconnect();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
