export function mergePedestrian586(room){
 const openings=structuredClone(room.openings||[]);if(room.kind!=='garage')return openings;
 const remove=new Set();
 for(const gate of openings){
  if(gate.type!=='gate'||gate.gate_fill&&gate.gate_fill!=='grid'||!['slide_double','slide_single','swing_double'].includes(gate.gate_mode||'slide_double'))continue;
  const len=['top','bottom'].includes(gate.side)?(room.width_m||room.w):(room.depth_m||room.d);if(!len)continue;
  const width=Math.min(len-.05,gate.width_m),lo=Math.max(0,Math.min(len-width,gate.offset*len-width/2)),hi=lo+width;
  const candidates=openings.map((o,i)=>({o,i})).filter(({o})=>o.type==='door'&&o.side===gate.side&&o.offset*len-o.width_m/2>=lo-.05&&o.offset*len+o.width_m/2<=hi+.05);
  if(!candidates.length)continue;
  const chosen=candidates[0].o,center=chosen.offset*len,double=gate.gate_mode!=='slide_single',right=double&&center>lo+width/2,leafWidth=double?width/2:width;
  if(leafWidth<chosen.width_m+.14)continue;
  if(!gate.gate_wicket)Object.assign(gate,{gate_wicket:true,gate_wicket_width_m:Math.max(.5,Math.min(1.5,chosen.width_m)),gate_wicket_height_m:Math.min(chosen.height_m||1.95,(gate.height_m||2.2)-.1),gate_wicket_position:Math.max(0,Math.min(1,(center-lo-(right?leafWidth:0))/leafWidth)),gate_wicket_leaf:right?'right':'left',gate_wicket_open:0});
  for(const {o,i} of candidates)if(Math.abs(o.offset-chosen.offset)*len<chosen.width_m/2)remove.add(i);
 }
 return openings.filter((_,i)=>!remove.has(i));
}
export function fencePicker586(owner,ctx){
 const initial=ctx.draft().electric_fence||{enabled:false,sides:[],post_height_m:.6,wires:4,spacing_m:1.5,controller_id:''},selected=new Set(initial.enabled?initial.sides:[]);
 const d=owner.dialog('<h2>Onde instalar a cerca elétrica?</h2><p>Selecione apenas os muros que têm cerca. A planta usa os mesmos lados do editor 2D; girar a câmera 3D não muda esses lados.</p><div class="fence-picker586"><button data-side586="top">Superior ↑</button><button data-side586="left">← Esquerda</button><div class="room-center586">Vista de cima<br>do cômodo</div><button data-side586="right">Direita →</button><button data-side586="bottom">Inferior ↓</button></div><p data-count586 role="status"></p><div class="fence-actions586"><button class="secondary" data-clear586>Remover de todos</button><button data-apply586>Aplicar lados escolhidos</button></div>');
 const paint=()=>{d.querySelectorAll('[data-side586]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.side586))));d.querySelector('[data-count586]').textContent=selected.size+' lado(s) com cerca · os demais ficam sem fios';};
 d.querySelectorAll('[data-side586]').forEach(b=>b.onclick=()=>{const side=b.dataset.side586;selected.has(side)?selected.delete(side):selected.add(side);paint();});d.querySelector('[data-clear586]').onclick=()=>{selected.clear();paint();};
 d.querySelector('[data-apply586]').onclick=()=>{ctx.edit(draft=>draft.electric_fence={...initial,enabled:selected.size>0,sides:[...selected]});d.close();};paint();return d;
}
