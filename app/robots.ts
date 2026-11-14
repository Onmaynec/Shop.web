import type {MetadataRoute} from 'next';
import {publicIndexingEnabled,siteOrigin} from '../lib/public-indexing';
export default function robots():MetadataRoute.Robots{
  if(!publicIndexingEnabled())return {rules:{userAgent:'*',disallow:'/'}};
  const origin=siteOrigin();
  return {
    rules:{userAgent:'*',allow:'/',disallow:[
      '/admin','/account','/api','/support','/cart'
    ]},
    ...(origin?{sitemap:origin+'/sitemap.xml'}:{})
  };
}
