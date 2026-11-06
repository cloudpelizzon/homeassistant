import * as T from './vendor/three.module.min.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)));
const option=(v,label,current)=>`<option value="${v}" ${v===current?'selected':''}>${label}</option>`;
export function doorControls592(o,height=2.6){
 const sliding=o.door_mode==='slide_double';
 return `<label>Modelo da porta<select data-opening585="door_mode">${option('swing','Porta de abrir',o.door_mode||'swing')}${option('slide_double','Correr dupla · abre para os dois lados',o.door_mode)}</select></label>
 <label>Altura da porta (m)<input type="number" data-opening585="height_m" min=".5" max="${height}" step=".05" value="${o.height_m||2.1}"></label>
 ${sliding?`<label>Abertura das folhas: ${Math.round((o.door_open||0)*100)}%<input type="range" data-opening585="door_open" min="0" max="100" value="${(o.door_open||0)*100}"></label>
 <label><input type="checkbox" data-opening585="door_glass" ${o.door_glass?'checked':''}> Vidros quadrados na madeira</label>
 ${o.door_glass?`<label>Lado de cada vidro (cm)<input type="number" data-opening585="door_glass_size_m" min="10" max="60" step="1" value="${Math.round((o.door_glass_size_m||.2)*100)}"></label><p>Os vidros mantêm a medida escolhida; os montantes de madeira completam a largura das folhas.</p>`:''}`:
 `<label>Abertura da porta<select data-opening585="swing">${option('in','Para dentro do cômodo',o.swing||'out')}${option('out','Para fora do cômodo',o.swing||'out')}</select></label><label>Dobradiça · olhando de dentro<select data-opening585="hinge">${option('left','À esquerda',o.hinge||'left')}${option('right','À direita',o.hinge||'left')}</select></label>`}
 <label>Cor da madeira / porta<input type="color" data-opening585="door_color" value="${o.door_color||'#8a5b35'}"></label>`;
}
export function updateDoor592(o,key,value,height){
 if(key==='door_mode'){o.door_mode=value==='slide_double'?'slide_double':'swing';if(o.door_mode==='swing')o.door_glass=false;return true;}
 if(key==='door_open'){o.door_open=clamp(value/100,0,1);return true;}
 if(key==='door_glass'){o.door_glass=value===true;return true;}
 if(key==='door_glass_size_m'){o.door_glass_size_m=clamp(value/100,.1,.6);return true;}
 if(key==='height_m'&&o.type==='door'){o.height_m=clamp(value,.5,height);return true;}
 return false;
}
export function slidingDoorPlan592(o,w){
 const a=(o.door_open||0)*w/2;
 return `<g class="sliding-door592" fill="${o.door_color||'#8a5b35'}" stroke="#b6d9de" stroke-width="2"><path d="M${-w} 12H${w}" fill="none" stroke="#777"/><rect x="${-w/2-a}" y="-4" width="${w/2}" height="9"/><rect x="${a}" y="-4" width="${w/2}" height="9"/><path d="M${-w*.35} 22h${-w*.18}m8-5-8 5 8 5M${w*.35} 22h${w*.18}m-8-5 8 5-8 5" fill="none"/><title>Porta de correr dupla · folhas recolhem para lados opostos</title></g>`;
}
export function buildSlidingDoor592(parent,o,w,h,side){
 const inward=['bottom','right'].includes(side)?-1:1;
 const wood=new T.MeshStandardMaterial({color:o.door_color||'#8a5b35',roughness:.62});
 const glass=new T.MeshPhysicalMaterial({color:'#d9edf0',transparent:true,opacity:.26,roughness:.06,metalness:0,ior:1.5,clearcoat:1,side:T.DoubleSide,depthWrite:false});
 const metal=new T.MeshStandardMaterial({color:'#555a5b',metalness:.8,roughness:.28});
 const box=(g,x,y,z,px,py,pz,m)=>{const a=new T.Mesh(new T.BoxGeometry(x,y,z),m);a.position.set(px,py,pz);a.castShadow=m!==glass;a.receiveShadow=true;g.add(a);return a;};
 box(parent,w*2,.035,.035,0,h+.08,inward*.1,metal);
 const pw=w/2,cell=o.door_glass_size_m||.2;
 for(const sign of [-1,1]){
  const leaf=new T.Group();parent.add(leaf);leaf.userData.doorLeaf592=true;
  leaf.position.set(sign*(w/4+(o.door_open||0)*pw),o.bottom||0,inward*.055);
  if(!o.door_glass||pw<cell+.1||h<cell+.25)box(leaf,pw-.012,h,.045,0,h/2,0,wood);
  else{
   const nx=Math.max(1,Math.floor((pw-.1+.025)/(cell+.025))),ny=Math.max(1,Math.floor((h-.25+.025)/(cell+.025)));
   const gw=nx*cell+(nx-1)*.025,gh=ny*cell+(ny-1)*.025,bx=(pw-gw)/2,by=(h-gh)/2;
   for(const x of [-1,1])box(leaf,bx,h,.05,x*(pw-bx)/2,h/2,0,wood);
   for(const y of [-1,1])box(leaf,gw,by,.05,0,h/2+y*(h-by)/2,0,wood);
   for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){
    const pane=box(leaf,cell,cell,.008,-gw/2+cell/2+x*(cell+.025),h/2-gh/2+cell/2+y*(cell+.025),0,glass);pane.userData.glassCell592=cell;
   }
   for(let x=1;x<nx;x++)box(leaf,.025,gh,.05,-gw/2+x*(cell+.025)-.0125,h/2,0,wood);
   for(let y=1;y<ny;y++)box(leaf,gw,.025,.05,0,h/2-gh/2+y*(cell+.025)-.0125,0,wood);
  }
  box(leaf,.022,.23,.065,-sign*(pw/2-.075),h*.48,inward*.055,metal);
  for(const x of [-pw*.32,pw*.32])box(leaf,.025,.08,.04,x,h+.035,inward*.025,metal);
 }
 parent.userData.slidingDouble592=true;return parent;
}
