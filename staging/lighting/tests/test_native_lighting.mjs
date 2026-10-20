import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const clientCode=fs.readFileSync(path.join(dir,'../module/frontend/panel.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'../module/frontend/style.css'),'utf8');
global.HTMLElement=class{constructor(){this.isConnected=false;this.shadowRoot=null;} attachShadow(){return(this.shadowRoot={innerHTML:'',addEventListener(){},removeEventListener(){},querySelector(){return null},querySelectorAll(){return []}})}dispatchEvent(){}}
global.customElements={_map:new Map,get(n){return this._map.get(n)},define(n,c){this._map.set(n,c)}};
const {CloudPelizzonLightingPanel,hasVerifiedLightingAccess,projectLightingPortResult}=await import('../module/frontend/panel.js');
const SKU='CP-LIGHTING';
const status=(opts={})=>({status_verified:true,modules:[{sku:SKU,installed:true,license:{allowed:true,status:'licensed'},trial:{verified:true,phase:'not_started',paid_confirmed:false},...opts}]});
const item=(id,name,room='sala',kind='light')=>({entity_id:id,name,room_id:room,icon:'bulb',visible:true,kind,capabilities:kind==='light'?['on_off']:[]});
const state=(id,st='on',bright=155)=>({entity_id:id,state:st,attributes:{supported_color_modes: ['brightness'],brightness:bright,device_id:'never-leak',longitude:99}});
const snapshot=(n=6)=>({sku:SKU,configuration:{revision:8,rooms:[{id:'sala',name:'Sala'},{id:'cozinha',name:'Cozinha'},{id:'suite',name:'Suíte'},{id:'jardim',name:'Jardim'},{id:'garagem',name:'Garagem'},{id:'escritorio',name:'Escritório'}],
 items:[...Array.from({length:n},(_,i)=>item(`light.luz_${i}`,'Luz '+i,i%2===0?'sala':'cozinha')),item('switch.rele_sala','Spots da TV','sala')],total:n+1,preferences:{theme:'neo-soft'}},
 states:{...Object.fromEntries(Array.from({length:n},(_,i)=>[`light.luz_${i}`,state(`light.luz_${i}`,i%3===0?'off':'on')])),
 'switch.rele_sala':{entity_id:'switch.rele_sala',state:'on',attributes:{brightness:255,supported_color_modes:['onoff']}}}});

function makePanel(value=snapshot(),current=status()){
 const v=new CloudPelizzonLightingPanel();v.isConnected=true;v._active=true;v._hass={user:{id:'user1'},callWS:async ({type,operation,parameters})=>{
   v._calls.push([type,operation,parameters]);
   if(type==='cloudpelizzon/core/status')return current;
   if(type==='cloudpelizzon/lighting/v1/snapshot')return value;
   if(type==='cloudpelizzon/lighting/v1/operation'){
      if(operation==='lighting.entities.discover')return {items:[{entity_id:'light.luz_20',name:'Luz 20',kind:'light',capabilities:['on_off']},{entity_id:'switch.rele_teto',name:'Relé teto',kind:'review',capabilities:['on_off']}],total:2};
      return {saved:true,revision:value.configuration.revision+1};
   }
   throw Error('unapproved_ws:'+type);
 }};v._calls=[];
 return v;
}

test('Commercial module element exists only as CloudPelizzon child',()=>{
 assert.equal(customElements.get('cloudpelizzon-lighting-panel'),CloudPelizzonLightingPanel);
 assert(!clientCode.includes('panel_custom'));
 assert(!clientCode.includes('callService('));
 assert(!clientCode.includes('hass.states['));
 assert(!clientCode.includes('localStorage'));
 assert(!clientCode.includes('/api/states'));
 assert.match(clientCode,/lighting\.entities\.discover/);
});

test('Active, installed, signed paid license gate works',()=>{
 assert.equal(hasVerifiedLightingAccess(status()),true);
 assert.equal(hasVerifiedLightingAccess(status({installed:false})),false);
 assert.equal(hasVerifiedLightingAccess(status({license:{allowed:false}})),false);
 assert.equal(hasVerifiedLightingAccess({...status(),status_verified:false}),false);
 assert.equal(hasVerifiedLightingAccess({modules:[]}),false);
});

test('7-day trial is only a signed active server lifecycle, no reset in browser',()=>{
 const t={license:{allowed:false},trial:{verified:true,phase:'trial_active',paid_confirmed:false,blocks_at:new Date(Date.now()+600000).toISOString()}};
 assert.equal(hasVerifiedLightingAccess(status(t)),true);
 assert.equal(hasVerifiedLightingAccess(status({...t,trial:{...t.trial,blocks_at:new Date(Date.now()-1000).toISOString()}})),false);
 assert.equal(hasVerifiedLightingAccess(status({...t,trial:{...t.trial,verified:false}})),false);
 assert.equal(hasVerifiedLightingAccess(status({...t,trial:{...t.trial,phase:'trial_blocked'}})),false);
 assert.equal(hasVerifiedLightingAccess(status({...t,trial:{...t.trial,paid_confirmed:true}})),false);
 assert.doesNotMatch(clientCode,/trial\/v2\/start/);
});

test('Normalized snapshot preserves original IDs, room, approved switches and capabilities',()=>{
 const p=projectLightingPortResult(snapshot());
 assert.equal(p.lights.length,7);
 const r=p.lights.find(x=>x.id==='switch.rele_sala');
 assert(r?.isSwitch);
 assert.equal(r.brightness,null);
 assert.equal(p.lights.find(x=>x.id==='light.luz_1').brightness,61);
 assert.equal(p.lights[0].room,'Sala');
 assert(!JSON.stringify(p.lights).includes('device_id'));
 assert(!JSON.stringify(p.lights).includes('longitude'));
});

test('Rejects malformed, duplicate or excess contract data',()=>{
 const variations=[
  {...snapshot(),sku:'CP-SOLAR'},
  {...snapshot(),configuration:{...snapshot().configuration,total:1}},
  {...snapshot(),configuration:{...snapshot().configuration,items:[...snapshot().configuration.items,snapshot().configuration.items[0]],total:8}},
  {...snapshot(),configuration:{...snapshot().configuration,preferences:{theme:'bad'}}},
  {...snapshot(),configuration:{...snapshot().configuration,items:[{...snapshot().configuration.items[0],entity_id:'switch.bad/..'},...snapshot().configuration.items.slice(1)]}},
 ];
 for(const x of variations)assert.throws(()=>projectLightingPortResult(x));
});

test('No extra unbound switches discovered from state map appear',()=>{
 const x=snapshot();x.states['switch.unknown']={entity_id:'switch.unknown',state:'on',attributes:{}};
 const p=projectLightingPortResult(x);
 assert.equal(p.lights.filter(x=>x.isSwitch).length,1);
});

test('Sensor binding never presented as a light',()=>{
 const x=snapshot();x.configuration.items.push(item('binary_sensor.motion','Movimento','sala','sensor'));x.configuration.total++;
 assert.equal(projectLightingPortResult(x).lights.length,7);
});

test('Locked module exposes overview and purchase only',()=>{
 const p=makePanel();p._allowed=false;p._snapshot=null;p.render();
 assert.match(p.shadowRoot.innerHTML,/Ir à Visão Geral/);
 assert.match(p.shadowRoot.innerHTML,/Solicitar contratação/);
 assert.doesNotMatch(p.shadowRoot.innerHTML,/Descoberta e sincronização/);
 assert.doesNotMatch(p.shadowRoot.innerHTML,/data-save-entity/);
});

test('Renders the three specifically different approved layouts',()=>{
 const p=makePanel();p._allowed=true;p._snapshot=projectLightingPortResult(snapshot());
 p._theme='neo-soft';p.render();const neo=p.shadowRoot.innerHTML;
 assert.match(neo,/cp-neo-room-strip/);assert.match(neo,/cp-neo-grid/);assert.match(neo,/cp-neo-aside/);
 p._theme='flux';p.render();const flux=p.shadowRoot.innerHTML;
 assert.match(flux,/cp-flux-categories/);assert.match(flux,/cp-flux-room-grid/);assert.match(flux,/cp-flux-lamp-list/);
 p._theme='grafite';p.render();const grafite=p.shadowRoot.innerHTML;
 assert.match(grafite,/cp-grafite-shell/);assert.match(grafite,/cp-grafite-grid/);assert.match(grafite,/cp-grafite-detail/);
 assert.notEqual(neo,flux);assert.notEqual(neo,grafite);assert.notEqual(flux,grafite);
 assert.match(css,/\.cp-theme-neo-soft/);assert.match(css,/\.cp-theme-flux/);assert.match(css,/\.cp-theme-grafite/);
});

test('Shared configuration includes native discovery, rooms, review, theme selector',()=>{
 const p=makePanel();p._allowed=true;p._snapshot=projectLightingPortResult(snapshot());p._view='config';p.render();const html=p.shadowRoot.innerHTML;
 for(const item of ['Descoberta e sincronização','Mapeamento e organização','Vinculação e revisão individual','GRAFITE','FLUX','NEO SOFT','Buscar entidades agora'])assert(html.includes(item));
 assert(html.includes('cp-config-layout'));
});

test('Approved shared-settings map covers scenes, consumption, paging and alerts without fake saves',()=>{
 const panel=makePanel();panel._allowed=true;panel._snapshot=projectLightingPortResult(snapshot());panel._view='config';panel.render();
 const html=panel.shadowRoot.innerHTML;
 for(const title of ['Cenas rápidas','Sensores e consumo (opcional)','Paginação, favoritos e ordem','Alertas, filtros e animações'])assert(html.includes(title));
 assert(html.includes('Pendente do gateway'));
 assert(html.includes('Persistência pendente'));
 assert(!html.includes('data-action="toggle-scene"'));
});

test('No fake physical device commands: all effect controls are disabled',()=>{
 const p=makePanel();p._allowed=true;p._snapshot=projectLightingPortResult(snapshot());
 p._theme='neo-soft';p.render();assert.match(p.shadowRoot.innerHTML,/data-theme="neo-soft"/);assert.match(p.shadowRoot.innerHTML,/cp-orange-action" disabled/);
 p._theme='grafite';p.render();assert.match(p.shadowRoot.innerHTML,/<button disabled>⏻ Apagar sala/);
 assert.doesNotMatch(clientCode,/lighting\.device\.(?:on|off|set)/);
});

test('Read session obtains rights first, then private snapshot only',async()=>{
 const p=makePanel();await p.refresh();assert(p._allowed);assert.equal(p._snapshot.lights.length,7);
 assert.deepEqual(p._calls.map(c=>c[0]),['cloudpelizzon/core/status','cloudpelizzon/lighting/v1/snapshot']);
});

test('Revocation invalidates snapshot and cannot reveal config',async()=>{
 const p=makePanel();await p.refresh();p._calls.length=0;p._hass.callWS=async ()=>status({license:{allowed:false},trial:{verified:false}});
 await p.refresh();assert.equal(p._allowed,false);assert.equal(p._snapshot,null);assert.match(p.shadowRoot.innerHTML,/Somente a Visão Geral|Ir à Visão Geral/);
});

test('Discovered switch is never auto bound; explicit review required',async()=>{
 const p=makePanel();await p.refresh();await p.discover();assert.equal(p._discover.length,2);
 assert.equal(p._snapshot.lights.filter(x=>x.isSwitch).length,1);
 assert.equal(p._calls.filter(x=>x[1]==='lighting.entity.bind').length,0);
 assert.equal(p._calls.filter(x=>x[1]==='lighting.entities.discover').length,1);
});

test('Sends revisioned private preference update, not local storage',async()=>{
 const p=makePanel();await p.refresh();p._calls.length=0;await p.mutate('lighting.preferences.write',{theme:'flux'});
 const op=p._calls.find(x=>x[1]==='lighting.preferences.write');
 assert.equal(op[2].revision,8);assert.equal(op[2].theme,'flux');
 assert(!p._calls.some(x=>x[0].includes('services')));
});

test('Request-id and actor identity never originate from UI forms',()=>{
 assert.doesNotMatch(clientCode,/installation_id\s*:/);
 assert.doesNotMatch(clientCode,/actor_id\s*:/);
 assert.match(clientCode,/crypto\.randomUUID/);
 assert.match(clientCode,/request_id:issueId\(\)/);
});

test('Untrusted HTML markup in names is escaped',()=>{
 const x=snapshot();x.configuration.rooms[0].name='<img src=x onerror=alert(1)>';
 const p=makePanel();p._allowed=true;p._snapshot=projectLightingPortResult(x);p._theme='neo-soft';p.render();
 assert.match(p.shadowRoot.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert(!p.shadowRoot.innerHTML.includes('<img src=x onerror='));
});

test('Supports more than 100 lights and room pagination',()=>{
 const x=snapshot(180);const p=makePanel();p._allowed=true;p._snapshot=projectLightingPortResult(x);p._theme='flux';p.render();
 assert.equal(p._snapshot.lights.length,181);
 assert.match(p.shadowRoot.innerHTML,/181/);
 assert.match(p.shadowRoot.innerHTML,/cp-pager/);
});
