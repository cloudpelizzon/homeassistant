import * as T from './vendor/three.module.min.js';
export function flowerBed585(parent,f){
 const w=f.width_m,d=f.depth_m,h=f.height_m||.45,edge=Math.min(.07,w*.12,d*.12),borderH=Math.min(.18,h*.4),soilY=borderH*.72,corner=f.type==='flower_bed_corner',arm=Math.min(.45,w*.3,d*.3),concrete=new T.MeshStandardMaterial({color:f.color||'#b1ab98',roughness:.9}),soil=new T.MeshStandardMaterial({color:'#463a2d',roughness:1}),greens=['#59754a','#6b9258','#83975c'].map(color=>new T.MeshStandardMaterial({color,roughness:.9})),petals=['#dfb147','#bc6f8c','#e2d2bd','#c8784a'].map(color=>new T.MeshStandardMaterial({color,roughness:.8}));
 const box=(ww,hh,dd,x,y,z,m)=>{if(ww<=0||dd<=0)return;const o=new T.Mesh(new T.BoxGeometry(ww,hh,dd),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 if(!corner){box(w-2*edge,soilY,d-2*edge,0,soilY/2,0,soil);for(const x of [-w/2+edge/2,w/2-edge/2])box(edge,borderH,d,x,borderH/2,0,concrete);for(const z of [-d/2+edge/2,d/2-edge/2])box(w,borderH,edge,0,borderH/2,z,concrete);}
 else{box(arm,soilY,d, w/2-arm/2,soilY/2,0,soil);box(w-arm,soilY,arm,-arm/2,soilY/2,-d/2+arm/2,soil);for(const [ww,dd,x,z] of [[edge,d,w/2-edge/2,0],[w,edge,0,-d/2+edge/2],[edge,d-arm,w/2-arm,-arm/2+arm],[w-arm,edge,-arm/2,-d/2+arm],[arm,edge,w/2-arm/2,d/2-edge/2],[edge,arm,-w/2+edge/2,-d/2+arm/2]])box(ww,borderH,dd,x,borderH/2,z,concrete);}
 const stemMat=new T.MeshStandardMaterial({color:'#687c4f',roughness:.95});const count=Math.max(4,Math.min(80,Math.ceil((corner?arm*(w+d-arm):w*d)*16)));
 for(let i=0;i<count;i++){
  let x,z;const u=((i*.61803398875)%1),v=((i*.41421356237+.2)%1);
  if(corner){if(i%2){x=w/2-arm*.15-u*arm*.7;z=-d/2+edge+v*(d-2*edge);}else{x=-w/2+edge+u*(w-arm-edge);z=-d/2+arm*.15+v*arm*.7;}}
  else{x=-w/2+edge*1.3+u*(w-2.6*edge);z=-d/2+edge*1.3+v*(d-2.6*edge);}
  const height=(h-soilY)*(.62+.35*((i*.732)%1)),stem=new T.Mesh(new T.CylinderGeometry(.004,.005,height,6),stemMat);stem.position.set(x,soilY+height/2,z);parent.add(stem);
  for(let j=0;j<4;j++){const a=j*2.4+i,leaf=new T.Mesh(new T.SphereGeometry(.035,10,6),greens[(i+j)%3]);leaf.scale.set(1.6,.18,.55);leaf.rotation.z=(j%2?1:-1)*.35;leaf.position.set(x+Math.cos(a)*.035,soilY+height*(.35+j*.12),z+Math.sin(a)*.035);parent.add(leaf);}
  for(let j=0;j<7;j++){const a=j*Math.PI*2/7,p=new T.Mesh(new T.SphereGeometry(.024,10,6),petals[i%petals.length]);p.scale.set(1.5,.2,.7);p.rotation.y=-a;p.position.set(x+Math.cos(a)*.024,soilY+height,z+Math.sin(a)*.024);parent.add(p);}
  const center=new T.Mesh(new T.SphereGeometry(.016,10,6),petals[(i+1)%4]);center.scale.y=.4;center.position.set(x,soilY+height+.003,z);parent.add(center);
 }
 parent.traverse(o=>{if(o.isMesh)o.castShadow=true;});parent.userData.customHeight585=true;return true;
}
