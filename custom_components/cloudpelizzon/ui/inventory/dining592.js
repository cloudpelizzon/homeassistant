import * as T from './vendor/three.module.min.js';
export const DINING592=[
 ['dining_6','Mesa de jantar · 6 lugares',2.65,1.85,.95],['dining_8','Mesa de jantar · 8 lugares',3.05,1.85,.95],['dining_10','Mesa de jantar · 10 lugares',3.65,1.85,.95],
 ['dining_round_6','Mesa redonda · 6 lugares',2.45,2.45,.95],['dining_oval_8','Mesa oval · 8 lugares',3.05,1.95,.95],['dining_oval_10','Mesa oval · 10 lugares',3.65,1.95,.95],
 ['buffet_low','Balcão buffet · 3 portas e gavetas',1.8,.48,.85],['buffet_long','Buffet longo · 4 portas',2.25,.5,.85],['buffet_classic','Buffet clássico com pés torneados',1.65,.48,.95],
 ['glass_cabinet','Cristaleira · 2 portas de vidro',.95,.42,1.9],['glass_cabinet_wide','Cristaleira larga · 4 portas',1.65,.45,1.85],['glass_cabinet_corner','Cristaleira compacta',.78,.78,1.9]
].map(([id,label,w,d,h])=>({id,label,group:'dining',w,d,h}));
export const diningKind592=type=>DINING592.some(v=>v.id===type);
function material(color,metalness=0,roughness=.55){return new T.MeshStandardMaterial({color,metalness,roughness});}
function mesh(g,geo,m,x=0,y=0,z=0){const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;g.add(o);return o;}
function box(g,w,h,d,x,y,z,m,r=.012){
 const s=new T.Shape(),a=-w/2,b=-h/2;{const k=Math.min(r,w/4,h/4,d/4);s.moveTo(a+k,b);s.lineTo(a+w-k,b);s.quadraticCurveTo(a+w,b,a+w,b+k);s.lineTo(a+w,b+h-k);s.quadraticCurveTo(a+w,b+h,a+w-k,b+h);s.lineTo(a+k,b+h);s.quadraticCurveTo(a,b+h,a,b+h-k);s.lineTo(a,b+k);s.quadraticCurveTo(a,b,a+k,b);}
 const k=Math.min(r,w/4,h/4,d/4),geo=new T.ExtrudeGeometry(s,{depth:Math.max(.001,d-2*k),bevelEnabled:true,bevelSize:k,bevelThickness:k,bevelSegments:3,curveSegments:5});geo.translate(0,0,-d/2+k);return mesh(g,geo,m,x,y,z);
}
function cylinder(g,r,h,x,y,z,m){return mesh(g,new T.CylinderGeometry(r,r,h,24),m,x,y,z);}
function wineGlass(g,x,y,z,m){
 cylinder(g,.035,.006,x,y,z,m);cylinder(g,.004,.07,x,y+.035,z,m);
 const points=[new T.Vector2(.006,0),new T.Vector2(.027,.012),new T.Vector2(.041,.048),new T.Vector2(.033,.075)];mesh(g,new T.LatheGeometry(points,20),m,x,y+.07,z);
}
function chair(g,x,z,angle,wood,fabric){
 const c=new T.Group();c.userData.diningChair592=true;g.add(c);c.position.set(x,0,z);c.rotation.y=angle;
 box(c,.44,.075,.44,0,.46,0,fabric,.035);box(c,.43,.39,.065,0,.7,.19,fabric,.035);
 for(const a of [-.17,.17])for(const b of [-.16,.16]){const leg=box(c,.035,.45,.035,a,.225,b,wood,.008);leg.rotation.z=a*.12;}
 for(const a of [-.18,.18])box(c,.035,.4,.035,a,.68,.205,wood,.008);
}
export function diningFurniture592(group,f){
 if(!diningKind592(f.type))return false;
 const wood=material(f.color||'#956b45'),dark=material('#463c32'),brass=material('#b49a66',.8,.27),fabric=material(f.variant==='classic'?'#c5b08c':'#b4b1a9',0,.9),white=material('#eeeae1',0,.25);
 const glass=new T.MeshPhysicalMaterial({color:'#d5e8e8',transparent:true,opacity:.22,roughness:.06,metalness:0,ior:1.5,clearcoat:1,side:T.DoubleSide,depthWrite:false});
 const type=f.type;
 if(type.startsWith('dining')){
  const n=type.includes('10')?10:type.includes('8')?8:6,round=type.includes('round'),oval=type.includes('oval'),len=n===10?2.65:n===8?2.1:1.7;
  if(round||oval){const top=cylinder(group,round?.79:1,.065,0,.75,0,wood);if(oval)top.scale.set(len/2,1,.48);}
  else box(group,len,.065,.9,0,.75,0,wood,.05);
  if(round){cylinder(group,.15,.66,0,.36,0,dark);cylinder(group,.42,.055,0,.035,0,dark);}
  else for(const x of [-len*.36,len*.36])for(const z of [-.29,.29])box(group,.06,.73,.06,x,.365,z,dark);
  const seats=[];
  if(round){for(let i=0;i<n;i++){const a=i*Math.PI*2/n;seats.push([Math.sin(a)*1.04,Math.cos(a)*1.04,a]);}}
  else{const side=(n-2)/2;for(let i=0;i<side;i++)for(const sign of [-1,1])seats.push([(i-(side-1)/2)*.62,sign*.69,sign>0?0:Math.PI]);seats.push([-len/2-.22,0,Math.PI/2],[len/2+.22,0,-Math.PI/2]);}
  for(const [x,z,a] of seats){chair(group,x,z,a,wood,fabric);const tx=x*.68,tz=z*.58;
   const plate=cylinder(group,.11,.012,tx,.79,tz,white);plate.userData.tableSetting592=true;cylinder(group,.075,.008,tx,.799,tz,white);
   box(group,.04,.004,.13,tx+.16,.79,tz,fabric,.003);box(group,.012,.005,.16,tx-.145,.79,tz,brass,.002);wineGlass(group,tx+.12,.798,tz-.13,glass);
  }
  cylinder(group,.07,.15,0,.86,0,white);for(let i=0;i<5;i++){const leaf=mesh(group,new T.SphereGeometry(.055,12,8),material('#5c7953'),Math.sin(i)*.07,1.01,Math.cos(i)*.07);leaf.scale.set(.6,1.4,.35);}
 }else{
  const cabinet=type.startsWith('glass_cabinet'),corner=type.endsWith('corner'),w=type==='glass_cabinet_wide'?1.65:type==='glass_cabinet'? .95:corner?.78:type==='buffet_long'?2.25:1.8,h=cabinet?1.9:type==='buffet_classic'?.95:.85,d=corner?.65:.46;
  for(const x of [-w/2+.08,w/2-.08])for(const z of [-d/2+.06,d/2-.06]){const foot=cylinder(group,.028,.15,x,.075,z,brass);if(type==='buffet_classic')foot.scale.set(1.2,1,.9);}
  const bottom=.16;box(group,w,.055,d,0,bottom,0,wood);box(group,w+.025,.055,d+.02,0,h,0,wood);
  for(const x of [-w/2,w/2])box(group,.035,h-bottom,d,x,(h+bottom)/2,0,wood);
  box(group,w,h-bottom,.02,0,(h+bottom)/2,-d/2,dark);
  const doors=cabinet?(type==='glass_cabinet_wide'?4:2):(type==='buffet_long'?4:3),dw=(w-.06)/doors;
  for(let i=0;i<doors;i++){const x=-w/2+.03+(i+.5)*dw,dh=h-bottom-.045;
   if(cabinet){
    for(const edge of [-1,1])box(group,.035,dh,.045,x+edge*(dw/2-.025),(h+bottom)/2,d/2,wood);
    for(const y of [bottom+.035,h-.035])box(group,dw-.035,.045,.045,x,y,d/2,wood);
    const pane=box(group,dw-.095,dh-.09,.008,x,(h+bottom)/2,d/2+.002,glass,.002);pane.userData.cabinetGlass592=true;
    for(let shelf=1;shelf<4;shelf++){const y=bottom+shelf*(h-bottom)/4;box(group,dw-.035,.008,d-.04,x,y,0,glass,.002);for(let j=0;j<3;j++)wineGlass(group,x+(j-1)*dw*.25,y+.008,.015,glass);}
   }else{
    box(group,dw-.018,dh,.025,x,(h+bottom)/2,d/2,wood,.008);box(group,dw-.08,dh-.09,.014,x,(h+bottom)/2,d/2+.018,material(f.color||'#a37a50'),.007);
    box(group,dw-.035,.006,.03,x,h-.19,d/2+.025,dark,.001);
   }
   box(group,.012,.14,.04,x+dw*.3,h*.55,d/2+.035,brass,.003);
  }
  if(!cabinet){cylinder(group,.13,.08,-w*.25,h+.06,0,white);box(group,.28,.035,.2,w*.24,h+.035,0,dark,.005);}
 }
 const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
 for(const c of group.children){c.position.x-=center.x;c.position.y-=bounds.min.y;c.position.z-=center.z;}
 group.scale.set(f.width_m/size.x,(f.height_m||DINING592.find(v=>v.id===type).h)/size.y,f.depth_m/size.z);
 group.userData.customGeometry=true;group.traverse(o=>{if(o.isMesh)o.userData={...o.userData,id:f.id,kind:'furniture'};});return true;
}
export function diningArt592(type,color='#ad885f'){
 if(!diningKind592(type))return '';
 if(type.startsWith('dining')){const n=type.includes('10')?10:type.includes('8')?8:6,round=type.includes('round');
  const seats=round?Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return [50+Math.sin(a)*40,50+Math.cos(a)*40,a*180/Math.PI];}):[...Array.from({length:(n-2)/2},(_,i)=>[[20+i*60/((n-2)/2-1),10,0],[20+i*60/((n-2)/2-1),90,180]]).flat(),[5,50,90],[95,50,-90]];
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${seats.map(([x,y,r])=>`<rect x="${x-7}" y="${y-5}" width="14" height="10" rx="3" fill="#bcb6aa" stroke="#67513c" transform="rotate(${r} ${x} ${y})"/>`).join('')}${round?`<circle cx="50" cy="50" r="29" fill="${color}"/>`:`<rect x="13" y="24" width="74" height="52" rx="${type.includes('oval')?25:6}" fill="${color}"/>`}<circle cx="50" cy="50" r="5" fill="#648154"/></svg>`;
 }
 return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="3" y="8" width="94" height="84" rx="3" fill="${color}" stroke="#e4d4b5" stroke-width="3"/>${type.startsWith('glass')?'<rect x="10" y="15" width="80" height="70" fill="#a9d5db" fill-opacity=".5"/><path d="M50 15V85M10 37H90M10 61H90" stroke="#735b41" stroke-width="4"/>':'<path d="M34 13V87M66 13V87M8 30H92" stroke="#745b42" stroke-width="2"/>'}<path d="M43 45V57M57 45V57" stroke="#e0c394" stroke-width="3"/></svg>`;
}
