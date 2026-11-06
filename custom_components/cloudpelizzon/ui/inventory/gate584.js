export const GATE_MODES584={slide_double:'Correr duplo · duas folhas',slide_single:'Correr simples · uma folha',tilt:'Basculante',swing_double:'Abrir · duas folhas',rollup:'Enrolar'};
export const GATE_FILLS584={grid:'Grade aberta',solid:'Chapa fechada',slats:'Ripado / veneziana'};
export const GATE_CATALOG584=[
 ['slide_double','grid','Correr duplo de grade'],['slide_single','grid','Correr simples de grade'],
 ['slide_double','solid','Correr duplo fechado'],['slide_single','solid','Correr simples fechado'],
 ['tilt','solid','Basculante fechado'],['tilt','grid','Basculante de grade'],
 ['swing_double','grid','Abrir duplo de grade'],['swing_double','solid','Abrir duplo fechado'],['rollup','solid','Enrolar fechado'],['slide_double','slats','Correr duplo ripado']
].map(([mode,fill,label])=>({mode,fill,label}));
const color=s=>/^#[0-9a-f]{6}$/i.test(s||'')?s:'#52636a';
GATE_CATALOG584.push({mode:'slide_double',fill:'grid',label:'Correr duplo com pedestre',wicket:true});
export function gateLeaves584(o,width,height){
 const mode=o.gate_mode||'slide_double',open=Math.max(0,Math.min(1,o.gate_open||0)),direction=o.gate_direction==='right'?1:-1;
 if(mode==='slide_double')return [-1,1].map((sign,lane)=>({width:width/2-.015,height,x:sign*(o.gate_retract==='sides'?width/4+open*width/2:width/4*(1-open)),y:height/2,lane:o.gate_retract==='sides'?0:lane,rotation:0}));
 if(mode==='slide_single')return [{width:width-.03,height,x:open*width*direction,y:height/2,rotation:0}];
 if(mode==='swing_double')return [-1,1].map(sign=>({width:width/2-.02,height,x:sign*width/2,y:0,pivot:true,sign,rotation:sign*open*Math.PI/2}));
 if(mode==='tilt')return [{width:width-.03,height,x:0,y:height,pivot:true,tilt:true,rotation:open*Math.PI/2}];
 return [{width:width-.03,height:Math.max(.025,height*(1-open)),x:0,y:height/2+height*open/2,rotation:0}];
}
export function gateSVG584(o,width=180,height=80){
 const fill=o.gate_fill||'grid',mode=o.gate_mode||'slide_double',c=color(o.gate_color),double=mode.endsWith('double'),leaf=double?width/2:width,top=8,bottom=height-9;
 const bar=fill==='grid'?Array.from({length:Math.max(3,Math.floor(width/12))},(_,i)=>`<path d="M${8+i*(width-16)/Math.max(2,Math.floor(width/12)-1)} ${top}V${bottom}"/>`).join(''):fill==='slats'?Array.from({length:6},(_,i)=>`<path d="M5 ${top+i*(bottom-top)/5}H${width-5}"/>`).join(''):`<rect x="5" y="${top}" width="${width-10}" height="${bottom-top}" fill="${c}" opacity=".8"/>`;
 return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><g stroke="${c}" stroke-width="3" fill="none"><rect x="3" y="${top}" width="${width-6}" height="${bottom-top}" rx="2"/>${bar}${double?`<path d="M${leaf} ${top}V${bottom}"/>`:''}<path d="M0 ${height-4}H${width}"/></g><g fill="#e6bb77"><path d="M${width*.3} 0l-7 4 7 4v-3h${width*.1}V3h-${width*.1}Z"/><path d="M${width*.7} 0l7 4-7 4v-3h-${width*.1}V3h${width*.1}Z"/></g></svg>`;
}
export function gatePlan584(o,width){
 const c=color(o.gate_color),leaves=gateLeaves584(o,width,20),mode=o.gate_mode||'slide_double';
 const inset585=['bottom','left'].includes(o.side)?-9:9;const panels=leaves.map(p=>{if(p.tilt)return `<rect x="${-p.width/2}" y="${-(o.gate_open||0)*60}" width="${p.width}" height="8" fill="${c}"/>`;
  if(p.pivot)return `<g transform="translate(${p.x},0) rotate(${-p.rotation*180/Math.PI})"><rect x="${p.sign<0?0:-p.width}" y="${(mode.startsWith('slide')?inset585:0)-4+(p.lane||0)*7*Math.sign(inset585)}" width="${p.width}" height="8" fill="${c}"/></g>`;
  return `<g><rect x="${p.x-p.width/2}" y="${(mode.startsWith('slide')?inset585:0)-4+(p.lane||0)*7*Math.sign(inset585)}" width="${p.width}" height="8" fill="${c}"/>${o.gate_wicket&&((o.gate_wicket_leaf==='right')?p.x>=0:p.x<=0)?`<path d="M${p.x-Math.min(p.width*.8,(o.gate_wicket_width_m||.8)*width/(o.width_m||width))/2} -7h${Math.min(p.width*.8,(o.gate_wicket_width_m||.8)*width/(o.width_m||width))}" stroke="#edbd70" stroke-width="4"/>`:''}</g>`;}).join('');
 return `<g class="gate-plan584"><path d="M${-width/2} 0H${width/2}" stroke="#18262a" stroke-width="15"/>${mode.startsWith('slide')?`<path d="M${-width/2} ${inset585}H${width/2}" stroke="#8d9798" stroke-width="2" stroke-dasharray="5 3"/>`:''}${panels}<circle cx="${-width/2}" cy="0" r="5" fill="#b8b8a9"/><circle cx="${width/2}" cy="0" r="5" fill="#b8b8a9"/><title>Portão ${GATE_MODES584[mode]} · ${GATE_FILLS584[o.gate_fill||'grid']} · ${o.gate_retract==='sides'?'recolhimento lateral':'sobreposição central'} · abertura ${Math.round((o.gate_open||0)*100)}%</title></g>`;
}
export function roomGatesSVG584(room,w,d){
 const mw=room.width_m||3,md=room.depth_m||3;
 return `<svg class="gates-overlay584" viewBox="0 0 ${w} ${d}" preserveAspectRatio="none">${(room.openings||[]).filter(o=>o.type==='gate'&&!room.open_walls?.includes(o.side)).map(o=>{
  const hor=['top','bottom'].includes(o.side),len=hor?mw:md,actual=Math.min(len-.05,o.width_m),center=Math.max(actual/2,Math.min(len-actual/2,o.offset*len))/len,x=hor?center*w:o.side==='right'?w:0,y=hor?(o.side==='bottom'?d:0):center*d,pixels=actual/len*(hor?w:d);
  return `<g transform="translate(${x},${y}) rotate(${hor?0:90})">${gatePlan584(o,pixels)}</g>`;
 }).join('')}</svg>`;
}
