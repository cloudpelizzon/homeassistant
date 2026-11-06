const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function floorBounds592(house,floor,layout){
 const places=layout(house,floor,house.rooms.filter(r=>r.floor_id===floor.id));
 const x=Math.min(0,...places.map(p=>p.x)),y=Math.min(0,...places.map(p=>p.y));
 return {x,y,w:Math.max(.2,...places.map(p=>p.x+p.w))-x,d:Math.max(.2,...places.map(p=>p.y+p.d))-y,places};
}
export function fitFloor592(house,id,box,resize,layout){
 const result=structuredClone(house),floor=result.floors.find(f=>f.id===id);
 if(!floor||!['x1','x2','y1','y2'].every(k=>Number.isFinite(box[k])&&Math.abs(box[k])<=200)||box.x2-box.x1<.2||box.y2-box.y1<.2)throw Error('Informe início e fim válidos, com pelo menos 20 cm de extensão.');
 const old=floorBounds592(result,floor,layout);
 floor.origin_x_m=Math.round((box.x1-(resize?0:old.x))*100)/100;floor.origin_y_m=Math.round((box.y1-(resize?0:old.y))*100)/100;
 if(resize){const sx=(box.x2-box.x1)/old.w,sy=(box.y2-box.y1)/old.d;
  for(const p of old.places){const r=p.r;r.x_m=Math.round((p.x-old.x)*sx*100)/100;r.y_m=Math.round((p.y-old.y)*sy*100)/100;r.width_m=Math.round(p.w*sx*100)/100;r.depth_m=Math.round(p.d*sy*100)/100;r.area_m2=Math.round(r.width_m*r.depth_m*100)/100;}
  floor.width_m=Math.round((box.x2-box.x1)*100)/100;floor.depth_m=Math.round((box.y2-box.y1)*100)/100;
 }
 return result;
}
export function openFloorPlacement592(owner,layout,save){
 const house=owner.data.settings.house;
 const modal=owner.dialog(`<h2>Posição e extensão dos andares</h2><p>Defina onde cada pavimento começa e termina em relação ao térreo. X acompanha a largura da planta; Y acompanha a profundidade. Os móveis mantêm suas posições relativas no cômodo.</p><label>Andar<select data-placement-floor592>${house.floors.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label><div data-placement-fields592></div><p data-placement-status592 aria-live="polite"></p><div class="actions"><button data-placement-save592>Aplicar posição e extensão</button><button class="secondary" data-placement-close592>Fechar</button></div>`);
 const fields=modal.querySelector('[data-placement-fields592]');
 const paint=()=>{const f=house.floors.find(f=>f.id===modal.querySelector('[data-placement-floor592]').value),b=floorBounds592(house,f,layout),x=(f.origin_x_m||0)+b.x,y=(f.origin_y_m||0)+b.y;
  fields.innerHTML=`<div class="floor-placement-grid592">${[['x1','Início X (m)',x],['x2','Fim X (m)',x+b.w],['y1','Início Y (m)',y],['y2','Fim Y (m)',y+b.d]].map(([key,label,value])=>`<label>${label}<input type="number" step=".05" min="-200" max="200" data-placement-value592="${key}" value="${value.toFixed(2)}" ${key.endsWith('2')?'readonly':''}></label>`).join('')}</div><label><input type="checkbox" data-placement-resize592> Redimensionar os cômodos para caber entre início e fim (altera suas medidas)</label><details><summary>Usar cômodos do térreo como referência</summary><p>Marque a região sobre a qual o andar deve ficar. A referência preenche os limites; a mudança só é salva em Aplicar.</p>${house.rooms.filter(r=>r.floor_id===house.floors[0].id).map(r=>`<label><input type="checkbox" data-placement-reference592="${esc(r.area_id)}"> ${esc(r.label||r.name||owner.topologyData?.rooms?.find(a=>a.id===r.area_id)?.name||r.area_id)}</label>`).join('')}<button class="secondary" data-placement-use592>Usar limites selecionados</button></details><div data-placement-plan592></div>`;
  const inputs=Object.fromEntries([...fields.querySelectorAll('[data-placement-value592]')].map(e=>[e.dataset.placementValue592,e]));
  const preview=()=>{const boxes=house.floors.map(v=>{const b=floorBounds592(house,v,layout);return {id:v.id,label:v.name,x:(v.origin_x_m||0)+b.x,y:(v.origin_y_m||0)+b.y,w:b.w,d:b.d};});
   const chosen=boxes.find(v=>v.id===f.id);chosen.x=Number(inputs.x1.value);chosen.y=Number(inputs.y1.value);chosen.w=Math.max(.2,Number(inputs.x2.value)-chosen.x);chosen.d=Math.max(.2,Number(inputs.y2.value)-chosen.y);
   const x0=Math.min(...boxes.map(v=>v.x)),y0=Math.min(...boxes.map(v=>v.y)),x1=Math.max(...boxes.map(v=>v.x+v.w)),y1=Math.max(...boxes.map(v=>v.y+v.d));
   fields.querySelector('[data-placement-plan592]').innerHTML=`<svg viewBox="${x0-.5} ${y0-.5} ${x1-x0+1} ${y1-y0+1}" role="img" aria-label="Comparação dos limites dos andares">${boxes.map((v,i)=>`<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.d}" fill="${v.id===f.id?'#dbb15f':'#57818d'}" fill-opacity=".12" stroke="${v.id===f.id?'#edc975':'#67848d'}" stroke-width=".035" stroke-dasharray="${v.id===f.id?'':'.12 .08'}"/><text x="${v.x+.1}" y="${v.y+.25+i*.12}" font-size=".18" fill="#e4dfd4">${esc(v.label)}</text>`).join('')}</svg>`;
  };
  for(const e of Object.values(inputs))e.oninput=()=>{if(!fields.querySelector('[data-placement-resize592]').checked){inputs.x2.value=(Number(inputs.x1.value)+b.w).toFixed(2);inputs.y2.value=(Number(inputs.y1.value)+b.d).toFixed(2);}preview();};
  fields.querySelector('[data-placement-resize592]').onchange=e=>{inputs.x2.readOnly=inputs.y2.readOnly=!e.target.checked;};
  fields.querySelector('[data-placement-use592]').onclick=()=>{const ids=new Set([...fields.querySelectorAll('[data-placement-reference592]:checked')].map(e=>e.dataset.placementReference592));const ground=house.floors[0],all=floorBounds592(house,ground,layout),ps=all.places.filter(p=>ids.has(p.r.area_id));if(!ps.length)return;
   inputs.x1.value=Math.min(...ps.map(p=>p.x))+(ground.origin_x_m||0);inputs.x2.value=Math.max(...ps.map(p=>p.x+p.w))+(ground.origin_x_m||0);inputs.y1.value=Math.min(...ps.map(p=>p.y))+(ground.origin_y_m||0);inputs.y2.value=Math.max(...ps.map(p=>p.y+p.d))+(ground.origin_y_m||0);fields.querySelector('[data-placement-resize592]').checked=true;inputs.x2.readOnly=inputs.y2.readOnly=false;preview();};preview();
 };
 modal.querySelector('[data-placement-floor592]').onchange=paint;
 modal.querySelector('[data-placement-close592]').onclick=()=>modal.close();
 modal.querySelector('[data-placement-save592]').onclick=async()=>{const button=modal.querySelector('[data-placement-save592]');button.disabled=true;try{const box=Object.fromEntries([...fields.querySelectorAll('[data-placement-value592]')].map(e=>[e.dataset.placementValue592,Number(e.value)]));const result=fitFloor592(house,modal.querySelector('[data-placement-floor592]').value,box,fields.querySelector('[data-placement-resize592]').checked,layout);if(await save(owner,result,'Posição e extensão do andar salvas.'))modal.close();}catch(e){modal.querySelector('[data-placement-status592]').textContent=e.message;}finally{button.disabled=false;}};
 paint();return modal;
}
