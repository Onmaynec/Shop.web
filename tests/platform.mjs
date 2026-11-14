import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createHmac} from 'node:crypto';

const db=new PrismaClient();
const base='http://127.0.0.1:3000',stamp=Date.now().toString();
const password='PlatformReleaseSecureTest_2026!';
async function request(path,method='GET',body,cookie=''){
  const response=await fetch(base+path,{
    method,headers:{
      ...(method!=='GET'?{'Origin':base}:{}),
      ...(body!==undefined?{'Content-Type':'application/json'}:{}),
      ...(cookie?{'Cookie':cookie}:{})
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const raw=await response.text();
  let json;try{json=JSON.parse(raw)}catch{json=null;}
  return {status:response.status,json,headers:response.headers,raw};
}
function totp(secret,step){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let value=0,bits=0;
  const bytes=[];
  for(const letter of secret){
    value=(value<<5)|chars.indexOf(letter);bits+=5;
    if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}
  }
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const hash=createHmac('sha1',Buffer.from(bytes)).update(counter).digest();
  const offset=hash[hash.length-1]&15;
  return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}

async function signup(prefix){
  const email=prefix+'-'+stamp+'@example.test';
  const res=await request('/api/auth/register','POST',{email,password});
  assert.equal(res.status,201,JSON.stringify(res.json));
  return {email,cookie:res.headers.get('set-cookie')?.split(';')[0]||'',
    id:res.json.user.id};
}
async function run(){
  try{
    const account=await signup('platform');
    const other=await signup('platform-other');
    let cookie=account.cookie;

    // Initial MFA state.
    const initial=await request('/api/account/mfa','GET',undefined,cookie);
    assert.equal(initial.status,200);
    assert.equal(initial.json.enabled,false);
    const noPassword=await request('/api/account/mfa','POST',{
      action:'start',password:'wrong'
    },cookie);
    assert.equal(noPassword.status,401);
    const start=await request('/api/account/mfa','POST',{
      action:'start',password
    },cookie);
    assert.equal(start.status,200,JSON.stringify(start.json));
    assert.match(start.json.secret,/^[A-Z2-7]{32}$/);
    const pending=await db.user.findUniqueOrThrow({where:{id:account.id}});
    assert.ok(pending.mfaPendingCiphertext);
    assert.ok(!pending.mfaPendingCiphertext.includes(start.json.secret));

    const step=Math.floor(Date.now()/30000);
    const enrollment=await request('/api/account/mfa','POST',{
      action:'confirm',code:totp(start.json.secret,step)
    },cookie);
    assert.equal(enrollment.status,200,JSON.stringify(enrollment.json));
    const codes=enrollment.json.recoveryCodes;
    assert.equal(codes.length,8);
    const state=await request('/api/account/mfa','GET',undefined,cookie);
    assert.equal(state.json.enabled,true);
    assert.equal(state.json.recoveryRemaining,8);
    assert.ok(!JSON.stringify(state.json).includes(start.json.secret));

    const passwordOnly=await request('/api/auth/login','POST',{email:account.email,password});
    assert.equal(passwordOnly.status,401);
    assert.equal(passwordOnly.json.mfaRequired,true);
    const replay=await request('/api/auth/login','POST',{
      email:account.email,password,mfaCode:totp(start.json.secret,step)
    });
    assert.equal(replay.status,401,'Enrollment OTP must not be replayable');

    const withRecovery=await request('/api/auth/login','POST',{
      email:account.email,password,mfaCode:codes[0]
    });
    assert.equal(withRecovery.status,200,JSON.stringify(withRecovery.json));
    const restoredCookie=withRecovery.headers.get('set-cookie')?.split(';')[0]||'';
    assert.equal((await db.mfaRecoveryCode.count({where:{userId:account.id}})),7);
    const recoveryReplay=await request('/api/auth/login','POST',{
      email:account.email,password,mfaCode:codes[0]
    });
    assert.equal(recoveryReplay.status,401);
    const loginAgain=await request('/api/auth/login','POST',{
      email:account.email,password,mfaCode:codes[1]
    });
    assert.equal(loginAgain.status,200);
    cookie=loginAgain.headers.get('set-cookie')?.split(';')[0]||'';
    const disable=await request('/api/account/mfa','POST',{
      action:'disable',password,code:codes[2]
    },cookie);
    assert.equal(disable.status,200,JSON.stringify(disable.json));
    assert.equal((await db.mfaRecoveryCode.count({where:{userId:account.id}})),0);
    assert.equal((await request('/api/auth/session','GET',undefined,restoredCookie)).json.user,null);
    const normal=await request('/api/auth/login','POST',{email:account.email,password});
    assert.equal(normal.status,200,'Password-only login must work after disabling MFA');

    const category=await db.category.create({data:{
      name:'Favorites '+stamp,slug:'favorites-'+stamp
    }});
    const product=await db.product.create({data:{
      name:'Saved product '+stamp,slug:'saved-product-'+stamp,
      description:'Favoriting product integration',priceKopecks:45000,
      categoryId:category.id,status:'ACTIVE'
    }});
    const buyerCookie=normal.headers.get('set-cookie')?.split(';')[0]||'';
    const unauthorized=await request('/api/me/favorites','POST',{productId:product.id});
    assert.equal(unauthorized.status,401);
    const saved=await request('/api/me/favorites','POST',{productId:product.id},buyerCookie);
    assert.equal(saved.status,200,JSON.stringify(saved.json));
    assert.equal(saved.json.favorite,true);
    const duplicate=await request('/api/me/favorites','POST',{productId:product.id},buyerCookie);
    assert.equal(duplicate.status,200);
    assert.equal((await db.favorite.count({where:{userId:account.id}})),1);
    const mine=await request('/api/me/favorites','GET',undefined,buyerCookie);
    assert.equal(mine.status,200);
    assert.equal(mine.json.favorites.length,1);
    const someoneElse=await request('/api/me/favorites','GET',undefined,other.cookie);
    assert.equal(someoneElse.json.favorites.length,0);
    const page=await request('/account/favorites','GET',undefined,buyerCookie);
    assert.equal(page.status,200);
    assert.ok(page.raw.includes('Saved product '+stamp));
    await db.product.update({where:{id:product.id},data:{status:'ARCHIVED'}});
    const stale=await request('/api/me/favorites','POST',{productId:product.id},buyerCookie);
    assert.equal(stale.status,404,'Archived product must not be newly favorited');
    const removed=await request('/api/me/favorites','DELETE',{productId:product.id},buyerCookie);
    assert.equal(removed.status,200);
    assert.equal((await db.favorite.count({where:{userId:account.id}})),0);
    console.log('Platform integration passed: TOTP enrollment, replay rejection, recovery consumption, session revocation, favorites isolation and archive handling');
  }finally{await db.$disconnect();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
