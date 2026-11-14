import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {db} from './db';

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS=6;
const WINDOW=1;
const PERIOD=30;

function signingKey():Buffer{
  const secret=process.env.SESSION_SECRET;
  if(!secret||secret.length<32||secret.startsWith('replace-with-'))
    throw new Error('SESSION_SECRET must be configured before enabling MFA');
  return createHash('sha256').update('standoffshop:mfa:v1:').update(secret).digest();
}

export function base32(bytes:Uint8Array):string{
  let bits=0,value=0,result='';
  for(const byte of bytes){
    value=(value<<8)|byte;bits+=8;
    while(bits>=5){result+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}
  }
  if(bits>0)result+=ALPHABET[(value<<(5-bits))&31];
  return result;
}
export function fromBase32(input:string):Buffer|null{
  const normalized=input.replace(/\s|=/g,'').toUpperCase();
  if(!/^[A-Z2-7]{16,128}$/.test(normalized))return null;
  let bits=0,value=0;const out:number[]=[];
  for(const letter of normalized){
    const digit=ALPHABET.indexOf(letter);
    if(digit<0)return null;
    value=(value<<5)|digit;bits+=5;
    if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}
  }
  if(bits&&((value&((1<<bits)-1))!==0))return null;
  return Buffer.from(out);
}

export function generateMfaSecret():string{return base32(randomBytes(20));}
export function totpAt(secret:string,step:number):string|null{
  const key=fromBase32(secret);
  if(!key||!Number.isSafeInteger(step)||step<0)return null;
  const counter=Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash=createHmac('sha1',key).update(counter).digest();
  const offset=hash[hash.length-1]&0x0f;
  const value=(hash.readUInt32BE(offset)&0x7fffffff)%(10**DIGITS);
  return String(value).padStart(DIGITS,'0');
}
export function verifyTotp(secret:string,code:string,now=Date.now()):number|null{
  if(!/^\d{6}$/.test(code))return null;
  const current=Math.floor(now/(PERIOD*1000));
  let matched:number|null=null;
  for(let delta=-WINDOW;delta<=WINDOW;delta++){
    const step=current+delta;
    const expected=totpAt(secret,step);
    if(expected){
      const ok=timingSafeEqual(Buffer.from(code),Buffer.from(expected));
      if(ok)matched=step;
    }
  }
  return matched;
}

export function encryptSecret(secret:string):string{
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',signingKey(),iv);
  const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')].join('.');
}
export function decryptSecret(encoded:string):string{
  const parts=encoded.split('.');
  if(parts.length!==4||parts[0]!=='v1')throw new Error('Unsupported encrypted MFA secret');
  const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url');
  if(iv.length!==12||tag.length!==16)throw new Error('Invalid encrypted MFA secret');
  const decipher=createDecipheriv('aes-256-gcm',signingKey(),iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8');
}
export function normalizeRecovery(code:string):string|null{
  const raw=code.trim().replace(/[\s-]/g,'').toUpperCase();
  return /^[A-F0-9]{20}$/.test(raw)?raw:null;
}
export function hashRecovery(code:string):string{
  const normalized=normalizeRecovery(code);
  if(!normalized)throw new Error('Invalid recovery code');
  return createHmac('sha256',signingKey()).update('recovery:').update(normalized).digest('hex');
}
export function createRecoveryCodes(count=8):string[]{
  return Array.from({length:count},()=>{
    const value=randomBytes(10).toString('hex').toUpperCase();
    return value.slice(0,5)+'-'+value.slice(5,10)+'-'+value.slice(10,15)+'-'+value.slice(15,20);
  });
}
export function otpAuthUrl(email:string,secret:string):string{
  const label=encodeURIComponent('StandoffShop:'+email);
  return 'otpauth://totp/'+label+'?secret='+encodeURIComponent(secret)+
    '&issuer=StandoffShop&algorithm=SHA1&digits=6&period=30';
}

/** Consume one factor atomically. Successful TOTPs are single-use per 30s counter;
 * recovery codes are removed immediately and cannot be replayed.
 */
export async function consumeMfaCode(userId:string,code:string):Promise<boolean>{
  const user=await db.user.findUnique({where:{id:userId},
    select:{mfaEnabledAt:true,mfaSecretCiphertext:true,mfaLastUsedStep:true}});
  if(!user?.mfaEnabledAt||!user.mfaSecretCiphertext)return false;
  if(/^\d{6}$/.test(code)){
    const step=verifyTotp(decryptSecret(user.mfaSecretCiphertext),code);
    if(step===null)return false;
    const updated=await db.user.updateMany({where:{
      id:userId,mfaEnabledAt:{not:null},
      OR:[{mfaLastUsedStep:null},{mfaLastUsedStep:{lt:step}}]
    },data:{mfaLastUsedStep:step}});
    return updated.count===1;
  }
  const recovery=normalizeRecovery(code);
  if(!recovery)return false;
  const deleted=await db.mfaRecoveryCode.deleteMany({
    where:{userId,codeHash:hashRecovery(recovery)}
  });
  return deleted.count===1;
}
