// Print-only framing. No inventory writes or topology position changes.
export function zoomBox735(box, factor, anchor){
 const f=Math.max(.01,Number(factor)||1),a=anchor||{x:box.x+box.w/2,y:box.y+box.h/2};
 return {x:a.x+(box.x-a.x)*f,y:a.y+(box.y-a.y)*f,w:box.w*f,h:box.h*f};
}
export function panBox735(box,dx,dy){return {...box,x:box.x-dx,y:box.y-dy};}
export function createNetworkPrint735(modal,onChange=()=>{}){
 const saved=new Map();let tools=null,detach=()=>{};
 return {attach(frame,{key=null}={}){
  detach();detach=()=>{};tools?.remove();tools=null;
  if(key===null)return;
  const svg=frame.contentDocument?.querySelector('svg.network511-svg');if(!svg)return;
  const v=svg.viewBox.baseVal,base={x:v.x,y:v.y,w:v.width,h:v.height};
  // Clip to the selected world rectangle even when screen and paper aspect ratios differ.
  const ns='http://www.w3.org/2000/svg',doc=svg.ownerDocument;
  const defs=doc.createElementNS(ns,'defs'),clip=doc.createElementNS(ns,'clipPath'),rect=doc.createElementNS(ns,'rect'),layer=doc.createElementNS(ns,'g');
  clip.id='network-print-crop735';clip.setAttribute('clipPathUnits','userSpaceOnUse');clip.append(rect);defs.append(clip);
  layer.setAttribute('class','network-print-layer735');layer.setAttribute('clip-path','url(#network-print-crop735)');
  [...svg.children].filter(e=>e.tagName.toLowerCase()!=='defs').forEach(e=>layer.append(e));svg.append(defs,layer);

  let box=saved.has(key)?{...saved.get(key)}:{...base},drag=null;
  tools=modal.ownerDocument.createElement('div');tools.className='print-network-tools735';
  tools.innerHTML='<span>Arraste o mapa para escolher o trecho · roda do mouse para aproximar. A impressão usa a área visível.</span><button type="button" data-network-zoom735="in" aria-label="Aproximar mapa para impressão">+</button><button type="button" data-network-zoom735="out" aria-label="Afastar mapa para impressão">−</button><output aria-live="polite"></output><button type="button" data-network-fit735>Enquadrar tudo</button>';
  modal.querySelector('.print-preview596').before(tools);
  svg.style.touchAction='none';svg.style.cursor='grab';svg.style.overflow='hidden';
  // Prevent diagram-specific links from becoming interactive in the print workspace.
  svg.querySelectorAll('[tabindex]').forEach(e=>e.removeAttribute('tabindex'));
  const apply=(notify=true)=>{svg.setAttribute('viewBox',[box.x,box.y,box.w,box.h].join(' '));for(const [name,value] of Object.entries({x:box.x,y:box.y,width:box.w,height:box.h}))rect.setAttribute(name,String(value));saved.set(key,{...box});tools.querySelector('output').textContent=Math.round(base.w/box.w*100)+'%';if(notify)onChange();};
  const point=event=>{const matrix=svg.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):null;};
  const zoom=(factor,anchor)=>{const scale=Math.max(.05,Math.min(20,base.w/box.w/factor));box=zoomBox735(box,base.w/(scale*box.w),anchor);apply();};
  tools.querySelector('[data-network-zoom735="in"]').onclick=()=>zoom(1/1.25);
  tools.querySelector('[data-network-zoom735="out"]').onclick=()=>zoom(1.25);
  tools.querySelector('[data-network-fit735]').onclick=()=>{box={...base};apply();};
  const wheel=event=>{event.preventDefault();const a=point(event);if(a)zoom(Math.exp(Math.max(-1,Math.min(1,event.deltaY/500))),a);};
  const down=event=>{if(event.button!==0)return;const a=point(event);if(!a)return;event.preventDefault();drag={id:event.pointerId,point:a};svg.setPointerCapture(event.pointerId);svg.style.cursor='grabbing';};
  const move=event=>{if(!drag||event.pointerId!==drag.id)return;const a=point(event);if(!a)return;event.preventDefault();box=panBox735(box,a.x-drag.point.x,a.y-drag.point.y);apply();};
  const up=event=>{if(drag?.id!==event.pointerId)return;drag=null;svg.style.cursor='grab';if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);};
  svg.addEventListener('wheel',wheel,{passive:false});svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
  detach=()=>{svg.removeEventListener('wheel',wheel);svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerup',up);svg.removeEventListener('pointercancel',up);};
  apply(false);
 },dispose(){detach();tools?.remove();saved.clear();}};
}
