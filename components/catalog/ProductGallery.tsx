'use client';
import { useState } from 'react';
import { ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

type Image={url:string;alt:string};
export default function ProductGallery({images,name}:{images:Image[];name:string}){
  const [active,setActive]=useState(0);
  const selected=images[active];
  function move(delta:number){setActive(index=>(index+delta+images.length)%images.length);}
  return <div className="gallery">
    <div className="gallery-main">
      {selected?<img src={selected.url} alt={selected.alt||name} fetchPriority="high"/>:
        <div className="gallery-placeholder"><ImageIcon size={36}/><strong>STANDOFF<span>SHOP</span></strong><small>PRODUCT IMAGE</small></div>}
      {images.length>1&&<><button type="button" className="gallery-arrow prev" aria-label="Предыдущее изображение" onClick={()=>move(-1)}><ChevronLeft size={20}/></button>
        <button type="button" className="gallery-arrow next" aria-label="Следующее изображение" onClick={()=>move(1)}><ChevronRight size={20}/></button>
        <span className="gallery-count">{active+1} / {images.length}</span></>}
    </div>
    {images.length>1&&<div className="gallery-thumbs" role="group" aria-label="Изображения товара">
      {images.map((img,i)=><button type="button" key={img.url+'-'+i} className={'gallery-thumb'+(active===i?' active':'')}
        aria-label={'Показать изображение '+(i+1)} aria-pressed={i===active} onClick={()=>setActive(i)}>
        <img src={img.url} alt={img.alt||name} loading="lazy"/>
      </button>)}
    </div>}
  </div>;
}
