import { NextResponse } from 'next/server';
import { readImage } from '../../../../lib/media-store';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_:Request,{params}:{params:Promise<{name:string}>}){
  const {name}=await params;
  if(!/^[a-f0-9]{32}\.(?:png|jpg|webp)$/.test(name)){
    return new NextResponse('Not Found',{status:404});
  }
  const content=await readImage(name);
  if(!content)return new NextResponse('Not Found',{status:404});
  const extension=name.slice(name.lastIndexOf('.')+1);
  const mime:Record<string,string>={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};
  return new NextResponse(new Uint8Array(content),{
    headers:{
      'Content-Type':mime[extension],
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; sandbox",
      'Cache-Control':'public, max-age=31536000, immutable'
    }
  });
}
