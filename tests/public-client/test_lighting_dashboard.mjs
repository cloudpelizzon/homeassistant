import assert from 'node:assert/strict';
import test from 'node:test';
import {renderLightingDashboard, mountLightingDashboard, LIGHTING_DASHBOARD_THEMES} from '../../staging/lighting/dashboard.mjs';

function light(id, name, area='Sala', state='on', brightness=null) {
  return {entity_id:id, name, area, state, brightness_pct:brightness,
    capabilities:{brightness:brightness !== null}};
}
function fixture() {
  return {sku:'CP-LIGHTING',locked:false,configuration:{theme:'grafite'},lights:[
    light('light.sala','Principal','Sala','on',66),
    light('light.quarto','Quarto','Quarto','off'),
    {entity_id:'switch.rele_cozinha',source_kind:'configured_switch', name:'Cozinha', area:'Cozinha',state:'on',brightness_pct:80,capabilities:{brightness:true}},
    light('light.garagem','Garagem','Externo','unavailable'),
    light('light.desconhecida','Falhou','Quarto','unknown'),
  ]};
}
const countCards = html => (html.match(/<article class="cp-ld-light"/g)||[]).length;

test('locked or invalid SKU exposes no lamps, filters or trial offer', () => {
  for(const view of [undefined,null,{}, {...fixture(),locked:true},{...fixture(),sku:'CP-SOLAR'}]) {
    const h=renderLightingDashboard(view,{theme:'flux',query:'Principal'});
    assert.match(h,/Visão Geral e contratação/);
    assert.doesNotMatch(h,/data-entity=|Principal|data-cp-lighting-search|<button|trial_active/);
  }
});
test('shows three distinct selected themes using existing saved preference',()=>{
  assert.deepEqual(LIGHTING_DASHBOARD_THEMES,['grafite','flux','neo-soft']);
  for(const name of LIGHTING_DASHBOARD_THEMES){
    const h=renderLightingDashboard({...fixture(),configuration:{theme:name}});
    assert.match(h,new RegExp(`data-theme="${name}"`));
    assert.equal(countCards(h),5);
  }
  assert.match(renderLightingDashboard({...fixture(),configuration:{theme:'unknown'}}),/data-theme="grafite"/);
});
test('temporary theme preview does not change original preferences',()=>{
  const view=fixture();const before=structuredClone(view);
  const h=renderLightingDashboard(view,{theme:'neo-soft'});
  assert.match(h,/data-theme="neo-soft"/);
  assert.deepEqual(view,before);
});
test('counts all authorized lights regardless of filters or page',()=>{
  const h=renderLightingDashboard(fixture(),{room:'Quarto',query:'light.quarto'});
  assert.match(h,/<strong>5<\/strong><span>Total/);
  assert.match(h,/<strong>2<\/strong><span>Ligadas/);
  assert.match(h,/<strong>1<\/strong><span>Desligadas/);
  assert.equal(countCards(h),1);
  assert.match(h,/1 luz\(es\) na busca/);
});
test('switch requires persisted binding marker and never gets dimmer',()=>{
  const h=renderLightingDashboard(fixture());
  assert.match(h,/data-entity="switch.rele_cozinha"/);
  assert.match(h,/Relé confirmado/);
  assert.doesNotMatch(h,/80%/);
  const input=fixture();input.lights.push({entity_id:'switch.unbound',state:'on',name:'Desconhecido'});
  assert.doesNotMatch(renderLightingDashboard(input),/switch.unbound/);
});
test('filters by searchable local name, ID or exact room without cascades',()=>{
  const v=fixture();
  assert.equal(countCards(renderLightingDashboard(v,{query:'GARAGEM'})),1);
  assert.equal(countCards(renderLightingDashboard(v,{query:'switch.rele_cozinha'})),1);
  assert.equal(countCards(renderLightingDashboard(v,{room:'Quarto'})),2);
  assert.equal(countCards(renderLightingDashboard(v,{room:'Inexistente'})),5);
  assert.doesNotMatch(renderLightingDashboard(v),/<details|cp-ld-cascade/);
});
test('paginates 150 lights without hiding them permanently or inventing entity IDs',()=>{
  const v={...fixture(),lights:Array.from({length:150},(_,i)=>light(`light.l_${i}`,'Luz '+i))};
  let total=0;const ids=new Set();
  for(let page=0;page<5;page++) {
    const h=renderLightingDashboard(v,{page});total+=countCards(h);
    for(const m of h.matchAll(/data-entity="(light\.[^"]+)"/g))ids.add(m[1]);
    assert.match(h,/<strong>150<\/strong><span>Total/);
    assert.match(h,/Página [1-5]\/5/);
  }
  assert.equal(total,150);assert.equal(ids.size,150);
  assert.equal(countCards(renderLightingDashboard(v,{page:90000})),6);
});
test('escapes untrusted name, room, query and attribute data',()=>{
  const v={...fixture(),lights:[light('light.good','<img src=x onerror=alert(1)>','A&B "quoted"')]};
  const h=renderLightingDashboard(v);
  const searched=renderLightingDashboard(v,{query:'<svg onload=1>'});
  assert.match(h,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(h,/A&amp;B &quot;quoted&quot;/);
  assert.match(searched,/&lt;svg onload=1&gt;/);
  assert.doesNotMatch(h,/<img|<svg/);
});
test('rejects malformed IDs, duplicate IDs and unknown states in favor of safe state',()=>{
  const v={...fixture(),lights:[
    light('light.l','Primeira'),light('light.l','Ultima'), light('light.x<script>','Attack'),
    {...light('light.unknown','Desconhecido'),state:'open'},
  ]};
  const h=renderLightingDashboard(v);
  assert.equal(countCards(h),2);
  assert.doesNotMatch(h,/Attack/);
  assert.match(h,/Desconhecida/);
});
test('brightness displayed only if light is on and capability explicitly supports it',()=>{
  const v={...fixture(),lights:[
    {...light('light.a','A','Sala','off',90)},
    {...light('light.b','B','Sala','on',40),capabilities:{brightness:false}},
    {...light('light.c','C','Sala','on',70),brightness_pct:Infinity},
    {...light('light.d','D','Sala','on',25)}
  ]};
  const h=renderLightingDashboard(v);
  assert.equal((h.match(/25%/g)||[]).length,1);
  assert.doesNotMatch(h,/90%|40%|Infinity/);
});
test('interactive preview handlers support search, room, paging, theme without HA calls',()=>{
  const handlers=new Map();let view={...fixture(),lights:Array.from({length:80},(_,i)=>light(`light.l_${i}`,'Luz '+i))};
  const root={innerHTML:'',addEventListener(k,fn){handlers.set(k,fn)},removeEventListener(k){handlers.delete(k)},
    querySelector(){return{focus(){},setSelectionRange(){}}}};
  const widget=mountLightingDashboard(root,{getView:()=>view});
  assert.equal(countCards(root.innerHTML),36);
  handlers.get('click')({target:{closest(){return{dataset:{cpLightingPage:'next'},disabled:false}}}});
  assert.match(root.innerHTML,/Página 2\/3/);
  handlers.get('change')({target:{dataset:{cpLightingTheme:'1'},value:'flux'}});
  assert.match(root.innerHTML,/data-theme="flux"/);
  handlers.get('input')({target:{dataset:{cpLightingSearch:'1'},value:'Luz 55',selectionStart:6}});
  assert.equal(countCards(root.innerHTML),1);
  handlers.get('change')({target:{dataset:{cpLightingRoom:'1'},value:'Sala'}});
  assert.equal(countCards(root.innerHTML),1);
  view={sku:'CP-LIGHTING',locked:true,lights:[]};widget.update();
  assert.doesNotMatch(root.innerHTML,/data-entity=|Luz 55/);
  widget.dispose();assert.equal(root.innerHTML,'');assert.equal(handlers.size,0);
});
test('render path has reduced motion and no device actions or made-up watts',()=>{
  const h=renderLightingDashboard({...fixture(),measured_power_w:790000});
  assert.match(h,/prefers-reduced-motion:reduce/);
  assert.match(h,/data-cp-lighting-search/);
  assert.doesNotMatch(h,/790000|callService|hass\.|turn_on|turn_off|onclick=|<script/);
});
test('rejects missing container or missing trusted view provider',()=>{
  assert.throws(()=>mountLightingDashboard(null,{}),TypeError);
  assert.throws(()=>mountLightingDashboard({addEventListener(){}},{}),TypeError);
});

test('provider exception erases previously rendered entities (fail-closed)',()=>{
  let fail=false; const v=fixture();
  const root={innerHTML:'',addEventListener(){},removeEventListener(){}};
  const dashboard=mountLightingDashboard(root,{getView(){if(fail)throw Error('private-exception');return v;}});
  assert.match(root.innerHTML,/data-entity=/);
  fail=true;dashboard.update();
  assert.match(root.innerHTML,/Somente Visão Geral/);
  assert.doesNotMatch(root.innerHTML,/data-entity=|private-exception|Principal/);
  dashboard.dispose();
});
