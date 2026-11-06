import * as T from './vendor/three.module.min.js';
import {roomHeight581} from './studio581.js?v=611';
export function fence3D585(parent,room){const f=room.electric_fence;if(!f?.enabled)return null;const group=new T.Group();parent.add(group);group.userData.fence585=true;const steel=new T.MeshStandardMaterial({color:'#879598',metalness:.7,roughness:.42}),ceramic=new T.MeshStandardMaterial({color:'#d8ded4',roughness:.55}),wire=new T.MeshStandardMaterial({color:'#8a9190',metalness:.8,roughness:.3}),base=roomHeight581(room),height=f.post_height_m||.6;
 const cylinder=(g,r,h,x,y,z,m,rotate=false)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,h,8),m);o.position.set(x,y,z);if(rotate)o.rotation.z=Math.PI/2;g.add(o);return o;};
 for(const side of f.sides||[]){if(room.open_walls?.includes(side))continue;const horizontal=['top','bottom'].includes(side),len=horizontal?room.w:room.d,g=new T.Group();group.add(g);g.position.set(room.x+(side==='right'?room.w:horizontal?room.w/2:0),base,room.y+(side==='bottom'?room.d:horizontal?0:room.d/2));if(!horizontal)g.rotation.y=Math.PI/2;
  const posts=Math.max(1,Math.ceil(len/(f.spacing_m||1.5)));for(let i=0;i<=posts;i++){const x=-len/2+i*len/posts;cylinder(g,.012,height,x,height/2,0,steel);for(let j=1;j<=(f.wires||4);j++){const y=.05+j*(height-.08)/(f.wires||4);cylinder(g,.025,.045,x,y,.035,ceramic);}}
  for(let j=1;j<=(f.wires||4);j++){const y=.05+j*(height-.08)/(f.wires||4),o=cylinder(g,.003,len,0,y,.06,wire,true);o.userData.fenceWire585=true;}
 }
 return group;
}
