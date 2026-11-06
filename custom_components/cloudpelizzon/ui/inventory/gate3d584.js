import {gatePanel585} from './gatePanel585.js?v=586';
import * as T from './vendor/three.module.min.js';
import {gateLeaves584} from './gate584.js?v=586';
function box(parent,w,h,d,material,x=0,y=0,z=0){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
export function buildGate584(parent,o,width,height){
 const group=new T.Group();parent.add(group);group.userData.gate584=true;group.userData.gate_mode=o.gate_mode||'slide_double';group.userData.gate_fill=o.gate_fill||'grid';
 const metal=new T.MeshStandardMaterial({color:o.gate_color||'#52636a',metalness:.6,roughness:.46}),rail=new T.MeshStandardMaterial({color:'#9ba2a3',metalness:.8,roughness:.35}),dark=new T.MeshStandardMaterial({color:'#292e30',roughness:.8}),fill=o.gate_fill||'grid',mode=o.gate_mode||'slide_double',inward=['bottom','right'].includes(o.side)?-1:1;
 for(const x of [-width/2-.055,width/2+.055])box(group,.1,height+.12,.15,metal,x,(height+.12)/2,0);
 const panel=(g,w,h,hasWicket)=>gatePanel585(g,w,h,metal,fill,{enabled:hasWicket,width:o.gate_wicket_width_m,height:o.gate_wicket_height_m,position:o.gate_wicket_position,open:o.gate_wicket_open},inward);
 if(mode.startsWith('slide'))group.position.z=inward*.12;
 for(const [index585,leaf] of gateLeaves584(o,width,height).entries()){
  const hasWicket585=!!o.gate_wicket&&mode!=='rollup'&&(!mode.endsWith('double')||index585===(o.gate_wicket_leaf==='right'?1:0));
  const moving=new T.Group();group.add(moving);moving.position.set(leaf.x,leaf.y,.015+(leaf.lane||0)*inward*.10);moving.userData.gateLeaf584=true;
  if(leaf.tilt){moving.rotation.x=-inward*leaf.rotation;const actual=new T.Group();actual.position.y=-height/2;moving.add(actual);panel(actual,leaf.width,leaf.height,hasWicket585);}
  else if(leaf.pivot){moving.rotation.y=inward*leaf.rotation;const actual=new T.Group();actual.position.set(-leaf.sign*leaf.width/2,height/2,0);moving.add(actual);panel(actual,leaf.width,leaf.height,hasWicket585);}
  else panel(moving,leaf.width,leaf.height,hasWicket585);
  if(mode.startsWith('slide'))for(const x of [-leaf.width*.35,leaf.width*.35]){const wheel=new T.Mesh(new T.CylinderGeometry(.045,.045,.055,20),dark);wheel.rotation.x=Math.PI/2;wheel.position.set(x,-height/2+.015,.01);moving.add(wheel);}
 }
 if(mode.startsWith('slide')){
  const wallLength=o.wall_length585||width,length=Math.min(width*2,wallLength-.04),offset=wallLength/2-(o.opening_center585??wallLength/2);
  for(const lane of mode==='slide_double'&&o.gate_retract!=='sides'?[0,1]:[0]){const track=box(group,length,.018,.06,rail,offset,.018,.015+lane*inward*.10);track.userData.internalTrack585=true;}
  for(const [index,x] of (mode==='slide_double'?(o.gate_motor_position==='sides'?[-width/2-.14,width/2+.14]:[-.14,.14]):[width/2+.14]).entries()){const motor=box(group,.17,.23,.18,metal,x,.115,inward*(.13+index*.10));motor.userData.gateMotor585=true;box(group,.08,.08,.04,dark,x,.13,inward*(.24+index*.10));}
 }else if(mode==='rollup'){
  box(group,width+.16,.24,.25,metal,0,height+.13,0);
 }else if(mode==='tilt'){
  box(group,width+.1,.07,.12,rail,0,height+.055,0);
  for(const x of [-width/2-.035,width/2+.035])box(group,.045,height,.06,rail,x,height/2,inward*.09);
 }
 return group;
}
