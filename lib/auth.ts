import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
const COOKIE='ss_session';
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters');return value;}
function sign(payload:string){return createHmac('sha256',secret()).update(payload).digest('hex');}
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function checkPassword(password:string,stored:string){const [salt,hex]=stored.split(':');if(!salt||!hex||hex.length!==128)return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'));}
export async function setSession(userId:string){const payload=Buffer.from(JSON.stringify({id:userId,expires:Date.now()+7*86400000})).toString('base64url');(await cookies()).set(COOKIE,payload+'.'+sign(payload),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400});}
export async function clearSession(){(await cookies()).delete(COOKIE);}
export async function currentUser(){try{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const [payload,signature]=token.split('.');if(!payload||!signature||signature.length!==64)return null;if(!timingSafeEqual(Buffer.from(sign(payload),'hex'),Buffer.from(signature,'hex')))return null;const parsed=JSON.parse(Buffer.from(payload,'base64url').toString()) as {id:string;expires:number};if(parsed.expires<Date.now()||typeof parsed.id!=='string')return null;return db.user.findUnique({where:{id:parsed.id},select:{id:true,email:true,role:true}});}catch{return null;}}
