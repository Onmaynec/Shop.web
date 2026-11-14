import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db=new PrismaClient();
const base='http://127.0.0.1:3000';
const suffix=Date.now().toString();
const email='catalog-admin-'+suffix+'@example.test';
let cookie='';

async function request(path,method='GET',body){
  const response=await fetch(base+path,{
    method,headers:{
      ...(body?{'Content-Type':'application/json'}:{}),
      ...(method!=='GET'?{'Origin':base}:{}),
      ...(cookie?{'Cookie':cookie}:{})
    },
    body:body?JSON.stringify(body):undefined
  });
  const content=await response.text();
  let json;try{json=JSON.parse(content)}catch{json={content}};
  return {status:response.status,json,headers:response.headers};
}

async function run(){
  try{
    const registration=await request('/api/auth/register','POST',{
      email,password:'CatalogProSecurePassword_1234'
    });
    assert.equal(registration.status,201,JSON.stringify(registration.json));
    cookie=registration.headers.get('set-cookie')?.split(';')[0]||'';
    const account=await db.user.findUniqueOrThrow({where:{email}});
    await db.user.update({where:{id:account.id},data:{role:'ADMIN'}});

    const root=await request('/api/admin/categories','POST',{
      name:'Catalog Root '+suffix,slug:'catalog-root-'+suffix,description:'Test parent',parentId:null
    });
    assert.equal(root.status,201,JSON.stringify(root.json));
    const parentId=root.json.category.id;
    const child=await request('/api/admin/categories','POST',{
      name:'Catalog Child '+suffix,slug:'catalog-child-'+suffix,description:'Test nested',parentId
    });
    assert.equal(child.status,201,JSON.stringify(child.json));
    const categoryId=child.json.category.id;

    const tooDeep=await request('/api/admin/categories','POST',{
      name:'Invalid Grandchild',slug:'catalog-too-deep-'+suffix,description:'',parentId:categoryId
    });
    assert.equal(tooDeep.status,400);
    const cycle=await request('/api/admin/categories','PATCH',{
      id:parentId,name:root.json.category.name,slug:root.json.category.slug,description:'',parentId:categoryId
    });
    assert.equal(cycle.status,400);

    const imgBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RrwAAAAASUVORK5CYII=','base64');
    const data=new FormData();
    data.set('file',new Blob([imgBytes],{type:'image/png'}),'fixture.png');
    const upload=await fetch(base+'/api/admin/media',{
      method:'POST',headers:{'Origin':base,'Cookie':cookie},body:data
    });
    const image=await upload.json();
    assert.equal(upload.status,201,JSON.stringify(image));
    assert.match(image.url,/^\/api\/media\/[0-9a-f]{32}\.png$/);
    const served=await fetch(base+image.url);
    assert.equal(served.status,200);
    assert.equal(served.headers.get('content-type'),'image/png');
    assert.equal(Buffer.compare(Buffer.from(await served.arrayBuffer()),imgBytes),0);

    const newProduct={
      name:'Catalog Test '+suffix,slug:'catalog-test-'+suffix,
      description:'Test product with variants, gallery and characteristics',
      categoryId,priceKopecks:25000,status:'DRAFT',sku:'CAT-'+suffix,
      imageUrl:'',tags:['Тренировка','Разбор'],
      specs:[{name:'Формат',value:'Онлайн'}],
      images:[{url:image.url,alt:'Демонстрационный товар'}],
      variants:[
        {label:'Базовый',sku:'CAT-'+suffix+'-BASIC',priceKopecks:60000,active:true},
        {label:'Расширенный',sku:'CAT-'+suffix+'-PRO',priceKopecks:110000,active:true}
      ]
    };
    const created=await request('/api/admin/products','POST',newProduct);
    assert.equal(created.status,201,JSON.stringify(created.json));
    const productId=created.json.product.id;
    let product=await db.product.findUniqueOrThrow({
      where:{id:productId},include:{images:true,variants:true}
    });
    assert.equal(product.images.length,1);
    assert.equal(product.variants.length,2);
    assert.deepEqual(product.tags,['Тренировка','Разбор']);
    assert.equal(product.sku,newProduct.sku);
    const inactive=await request('/product/'+newProduct.slug);
    assert.equal(inactive.status,404);
    const preview=await request('/admin/preview/'+productId);
    assert.equal(preview.status,200);

    const published=await request('/api/admin/products/bulk','PATCH',{
      ids:[productId],status:'ACTIVE'
    });
    assert.equal(published.status,200,JSON.stringify(published.json));
    assert.equal(published.json.updated,1);
    const catalog=await request('/catalog?category='+child.json.category.slug);
    assert.equal(catalog.status,200);
    assert.ok(catalog.json.content.includes(newProduct.name));
    const main=await request('/catalog?category='+root.json.category.slug);
    assert.equal(main.status,200);
    assert.ok(main.json.content.includes(newProduct.name));
    const detail=await request('/product/'+newProduct.slug);
    assert.equal(detail.status,200);
    assert.ok(detail.json.content.includes('Базовый'));
    const baseVariant=product.variants.find(v=>v.label==='Базовый');
    assert.ok(baseVariant);

    const checkout=async(items,key=randomUUID())=>{
      const response=await fetch(base+'/api/orders',{
        method:'POST',
        headers:{'Origin':base,'Cookie':cookie,'Content-Type':'application/json','Idempotency-Key':key},
        body:JSON.stringify({email,items})
      });
      return {status:response.status,json:await response.json()};
    };
    const missingVariant=await checkout([{productId,quantity:1}]);
    assert.equal(missingVariant.status,400);
    const ordered=await checkout([{productId,variantId:baseVariant.id,quantity:2}]);
    assert.equal(ordered.status,201,JSON.stringify(ordered.json));
    assert.equal(ordered.json.order.totalKopecks,120000);
    const record=await db.order.findUniqueOrThrow({
      where:{id:ordered.json.order.id},include:{items:true}
    });
    assert.equal(record.items[0].skuSnapshot,baseVariant.sku);
    assert.equal(record.items[0].variantSnapshot,'Базовый');
    assert.equal(record.items[0].unitPriceKopecks,60000);

    const savedVariants=product.variants.map(v=>({
      id:v.id,sku:v.sku,label:v.label,
      priceKopecks:v.id===baseVariant.id?72000:v.priceKopecks,active:v.active
    }));
    const updated=await request('/api/admin/products','PATCH',{
      ...newProduct,id:productId,status:'ACTIVE',variants:savedVariants
    });
    assert.equal(updated.status,200,JSON.stringify(updated.json));
    const nextOrder=await checkout([{productId,variantId:baseVariant.id,quantity:1}]);
    assert.equal(nextOrder.status,201);
    assert.equal(nextOrder.json.order.totalKopecks,72000);
    const historical=await db.orderItem.findUniqueOrThrow({where:{id:record.items[0].id}});
    assert.equal(historical.unitPriceKopecks,60000,'Existing order must retain price snapshot');

    const audit=await db.auditLog.findMany({
      where:{actorId:account.id,action:{in:['product.create','product.update','product.bulk-status']}}
    });
    assert.equal(audit.length,3);
    console.log('Catalog Pro passed: nested categories, secure upload, gallery, preview, bulk publish, variant pricing, immutable snapshots, audit');
  }finally{await db.$disconnect();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
