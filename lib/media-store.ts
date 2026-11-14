import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES=2*1024*1024;
export const MEDIA_DIR=process.env.MEDIA_STORAGE_DIR
  ? path.resolve(process.env.MEDIA_STORAGE_DIR)
  : path.join(process.cwd(),'data','media');

export type ImageKind='png'|'jpg'|'webp';

export function identifyImage(bytes:Uint8Array):ImageKind|null{
  if(bytes.length<16)return null;
  if(bytes.subarray(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index]))return 'png';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'jpg';
  if(String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&
    String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return 'webp';
  return null;
}

export async function saveImage(buffer:Uint8Array){
  if(!buffer.length||buffer.length>MAX_IMAGE_BYTES)throw Error('Изображение должно быть не больше 2 МБ');
  const ext=identifyImage(buffer);
  if(!ext)throw Error('Разрешены только PNG, JPEG и WebP');
  await mkdir(MEDIA_DIR,{recursive:true,mode:0o700});
  const name=randomBytes(16).toString('hex')+'.'+ext;
  await writeFile(path.join(MEDIA_DIR,name),buffer,{flag:'wx',mode:0o600});
  return {url:'/api/media/'+name,name,ext};
}

export async function readImage(filename:string){
  if(!/^[a-f0-9]{32}\.(?:png|jpg|webp)$/.test(filename))return null;
  try{
    return await readFile(path.join(MEDIA_DIR,filename));
  }catch(error){
    if(error && typeof error==='object' && 'code' in error && error.code==='ENOENT')return null;
    throw error;
  }
}
