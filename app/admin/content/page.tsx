import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/auth';
import { notFound } from 'next/navigation';
import StorefrontEditor from '../../../components/admin/StorefrontEditor';
import { defaultHome } from '../../../lib/storefront-content';

export const dynamic='force-dynamic';
export default async function ContentPage(){
  const user=await currentUser();if(!user||user.role!=='ADMIN')notFound();
  const saved=await db.storefrontContent.findUnique({where:{key:'home'}});
  return <StorefrontEditor initial={{
    headline:saved?.headline||defaultHome.headline,
    subheadline:saved?.subheadline||defaultHome.subheadline,
    description:saved?.description||defaultHome.description,
    eyebrow:saved?.eyebrow||defaultHome.eyebrow,
    ctaLabel:saved?.ctaLabel||defaultHome.ctaLabel,
    ctaHref:(saved?.ctaHref||defaultHome.ctaHref) as '/catalog'|'/account'|'/cart',
    backgroundUrl:saved?.backgroundUrl||'',
    published:saved?.published||false
  }}/>;
}
