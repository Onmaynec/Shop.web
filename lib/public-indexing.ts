type IndexEnv={NODE_ENV?:string;PUBLIC_INDEXING_ENABLED?:string;SITE_ORIGIN?:string};
/** Search engines must not index a demo shop unless explicitly enabled at deployment. */
export function publicIndexingEnabled(env:IndexEnv=process.env):boolean{
  return env.NODE_ENV==='production'&&env.PUBLIC_INDEXING_ENABLED==='true'&&Boolean(siteOrigin(env));
}
export function siteOrigin(env:IndexEnv=process.env):string|null{
  const value=env.SITE_ORIGIN;
  if(!value)return null;
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
      url.pathname!=='/')return null;
    return url.origin;
  }catch{return null;}
}
