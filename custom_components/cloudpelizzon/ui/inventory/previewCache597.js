// Coordinates and rotation belong to the placement, not the source image.
const resolved=new Map();
export const previewKey597=f=>JSON.stringify([f.type,f.model||'',f.variant||'',f.color||'',f.material||'',f.width_m,f.depth_m,f.height_m||0,f.photo_id||'']);
export function cachedPreview597(f){const key=previewKey597(f),src=resolved.get(key);if(src){resolved.delete(key);resolved.set(key,src);}return src||'';}
export function rememberPreview597(f,src){if(typeof src!=='string'||!/^data:image\/(?:png|jpeg);base64,/.test(src)||src.length>4*1024*1024)return;const key=previewKey597(f);resolved.delete(key);resolved.set(key,src);while(resolved.size>128)resolved.delete(resolved.keys().next().value);}
export function gardenFallback597(f){
 const lawn=f.type==='lawn',corner=f.type==='flower_bed_corner';if(!lawn&&!corner&&f.type!=='flower_bed')return '';
 const path=corner?'M2 2H98V98H84V16H2Z':'M2 2H98V98H2Z';
 const flowers=corner?Array.from({length:9},(_,i)=>[8+i*10,9]).concat(Array.from({length:8},(_,i)=>[91,23+i*10])):Array.from({length:10},(_,i)=>[10+i%5*20,25+Math.floor(i/5)*50]);
 return `<svg class="garden-placeholder597" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="${lawn?f.color||'#729951':'#614d35'}" stroke="${lawn?'#67914b':'#d4c6a7'}" stroke-width="2"/>${lawn?'<path d="M5 25H95M5 50H95M5 75H95" stroke="#a2b981" stroke-opacity=".25"/>':flowers.map(([x,y],i)=>`<path d="M${x} ${y+4}v-7" stroke="#68a261" stroke-width="1.5"/><circle cx="${x}" cy="${y-4}" r="2.8" fill="${['#f3d07d','#dfb5c8','#ede4cd'][i%3]}"/>`).join('')}</svg>`;
}
