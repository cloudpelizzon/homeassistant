import * as T from './vendor/three.module.min.js';
function box(parent,w,h,d,m,x=0,y=0,z=0){if(w<=.002||h<=.002)return;const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function gatePanel585(parent,w,h,material,style,options={},inward=1){
 const frame=g=>{for(const x of [-w/2,w/2])box(g,.045,h,.065,material,x,0,0);for(const y of [-h/2,h/2])box(g,w,.05,.065,material,0,y,0);};frame(parent);
 const wicket=!!options.enabled,ww=Math.min(w-.14,Math.max(.5,options.width||.8)),dh=Math.min(h-.1,Math.max(.5,options.height||1.95)),cx=Math.max(-w/2+ww/2+.065,Math.min(w/2-ww/2-.065,(options.position??.5)*w-w/2)),bottom=-h/2+.045,top=bottom+dh;
 function fill(g,left,right,low,high){
  if(right-left<.005||high-low<.005)return;
  if(style==='grid'){
   const count=Math.max(2,Math.floor(w/.12));for(let i=1;i<count;i++){const x=-w/2+i*w/count;if(x>left+.005&&x<right-.005)box(g,.019,high-low,.025,material,x,(low+high)/2,0);}
   for(const y of [-h*.23,h*.23])if(y>=low&&y<=high)box(g,right-left,.028,.035,material,(left+right)/2,y,0);
  }else if(style==='slats'){
   const count=Math.max(3,Math.ceil(h/.11));for(let i=0;i<count;i++){const y=-h/2+(i+.5)*h/count,lo=Math.max(low,y-h/count*.41),hi=Math.min(high,y+h/count*.41);if(hi>lo){const slat=box(g,right-left,hi-lo,.026,material,(left+right)/2,(lo+hi)/2,0);slat.rotation.x=.2;}}
  }else{
   box(g,right-left,high-low,.027,material,(left+right)/2,(low+high)/2,0);
   for(let i=1;i<Math.floor(h/.18);i++){const y=-h/2+i*.18;if(y>=low&&y<=high)box(g,right-left,.012,.04,material,(left+right)/2,y,.015);}
  }
 }
 if(!wicket){fill(parent,-w/2+.025,w/2-.025,-h/2+.025,h/2-.025);return;}
 const lo=cx-ww/2,hi=cx+ww/2;fill(parent,-w/2+.025,lo-.025,-h/2+.025,h/2-.025);fill(parent,hi+.025,w/2-.025,-h/2+.025,h/2-.025);fill(parent,lo-.025,hi+.025,top+.025,h/2-.025);
 for(const x of [lo-.025,hi+.025])box(parent,.035,dh+.045,.08,material,x,bottom+dh/2,0);box(parent,ww+.08,.035,.08,material,cx,top+.025,0);
 const hinge=new T.Group();parent.add(hinge);hinge.position.set(lo,bottom,.02);hinge.rotation.y=-inward*Math.max(0,Math.min(1,options.open||0))*Math.PI/2;hinge.userData.wicket585=true;
 const leaf=new T.Group();hinge.add(leaf);leaf.position.set(ww/2,dh/2,0);gatePanel585(leaf,ww-.035,dh-.035,material,style,{},inward);
 const latch=new T.MeshStandardMaterial({color:'#c6c1ad',metalness:.85,roughness:.25});box(leaf,.105,.018,.045,latch,ww/2-.11,0,.065);box(leaf,.025,.16,.018,latch,ww/2-.11,0,.04);
 for(const y of [.15,dh-.15]){const pin=new T.Mesh(new T.CylinderGeometry(.014,.014,.09,16),latch);pin.position.set(0,y,.055);hinge.add(pin);}
 return hinge;
}
