import { createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRIVATE_MAX_BYTES=4*1024*1024;
const configured=process.env.PRIVATE_DELIVERY_DIR;
export const PRIVATE_DELIVERY_DIR=configured?
  path.resolve(configured):path.join(process.cwd(),'data','deliveries');

function ensureOutsidePublic(){
  const publicDir=path.resolve(process.cwd(),'public');
  const relative=path.relative(publicDir,PRIVATE_DELIVERY_DIR);
  if(relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative))){
    throw new Error('PRIVATE_DELIVERY_DIR must be outside public/');
  }
}
type AllowedFile={ext:'pdf'|'png'|'jpg'|'txt';mime:string};

export function identifyPrivateFile(content:Uint8Array,mime:string):AllowedFile|null{
  if(!content.length||content.length>PRIVATE_MAX_BYTES)return null;
  const header=Buffer.from(content.subarray(0,12));
  if(mime==='application/pdf'&&header.subarray(0,5).toString()==='%PDF-')
    return {ext:'pdf',mime:'application/pdf'};
  if(mime==='image/png'&&header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return {ext:'png',mime:'image/png'};
  if(mime==='image/jpeg'&&header.subarray(0,3).equals(Buffer.from([255,216,255])))
    return {ext:'jpg',mime:'image/jpeg'};
  if(mime==='text/plain'&&!content.includes(0)){
    try{
      new TextDecoder('utf-8',{fatal:true}).decode(content);
      return {ext:'txt',mime:'text/plain; charset=utf-8'};
    }catch{return null;}
  }
  return null;
}
export function safeOriginalName(input:string){
  const last=input.replaceAll('\\','/').split('/').pop()||'delivery';
  return last.replace(/[\x00-\x1f\x7f"]/g,'').slice(0,140)||'delivery';
}
export async function savePrivateFile(bytes:Uint8Array,mime:string,original:string){
  ensureOutsidePublic();
  const kind=identifyPrivateFile(bytes,mime);
  if(!kind)throw Error('Разрешены PDF, PNG, JPEG, TXT до 4 МБ');
  await mkdir(PRIVATE_DELIVERY_DIR,{recursive:true,mode:0o700});
  const storageKey=randomBytes(16).toString('hex')+'.'+kind.ext;
  await writeFile(path.join(PRIVATE_DELIVERY_DIR,storageKey),bytes,{flag:'wx',mode:0o600});
  return {
    storageKey,mime:kind.mime,bytes:bytes.length,
    originalName:safeOriginalName(original),
    checksum:createHash('sha256').update(bytes).digest('hex')
  };
}
export async function readPrivateFile(storageKey:string){
  ensureOutsidePublic();
  if(!/^[0-9a-f]{32}\.(?:pdf|png|jpg|txt)$/.test(storageKey))return null;
  try{return await readFile(path.join(PRIVATE_DELIVERY_DIR,storageKey));}
  catch(e){
    if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return null;
    throw e;
  }
}
