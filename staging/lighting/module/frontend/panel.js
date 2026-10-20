/**
 * CloudPelizzon | CP-LIGHTING — commercial module frontend (UI/transport only).
 * Last updated: 2026-10-20.
 * The private Release Center owns distribution; the private gateway owns every
 * entitlement, Trial clock, configuration operation and device command.
 * Never install as a standalone HA panel; no native HA state/service bypass.
 */
const SKU = 'CP-LIGHTING';
const WS = Object.freeze({
  status: 'cloudpelizzon/core/status',
  snapshot: 'cloudpelizzon/lighting/v1/snapshot',
  operation: 'cloudpelizzon/lighting/v1/operation',
});
const THEMES = Object.freeze(['grafite', 'flux', 'neo-soft']);
const OPERATIONS = new Set([
  'lighting.config.read', 'lighting.entities.discover',
  'lighting.room.create', 'lighting.room.update', 'lighting.entity.bind',
  'lighting.entity.configure', 'lighting.entities.assign_room',
  'lighting.preferences.write',
]);
const ICONS = Object.freeze(['bulb','pendant','spot','led','wall','floodlight','sensor']);
const DOMAINS = Object.freeze(['light','switch','binary_sensor']);
const ENTITY_ID = /^(?:light|switch|binary_sensor)\.[a-z0-9_]{1,128}$/;
const ROOM_ID = /^[a-zA-Z0-9_-]{1,128}$/;
const STATES = new Set(['on','off','unavailable','unknown']);
const ALLOWED_COLOR_MODES = new Set(['onoff','brightness','color_temp','white','hs','xy','rgb','rgbw','rgbww']);
const BASE = new URL('./', import.meta.url);
const asset = filename => new URL(`assets/${filename}`, BASE).href;
const esc = value => String(value ?? '').replace(/[&<>"'\u0000-\u001f\u007f]/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[c] ?? ''));
const isRecord = v => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const saneText = (v,max=80) => typeof v === 'string' && v.trim() && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const nameSort = (a,b) => a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'});
const friendlyTheme = t => t === 'neo-soft' ? 'NEO SOFT' : t.toUpperCase();
const noop = () => {};
const ROOM_LABELS = Object.freeze({
  sala:['sala','estar','living','tv'], cozinha:['cozinha','kitchen','gourmet'],
  suite:['suíte','suite','quarto','dormitório','closet'],
  jardim:['jardim','externa','externo','varanda','piscina','quintal'],
  garagem:['garagem','garage','portao'],
  escritorio:['escritório','escritorio','office','trabalho'],
});
const LIGHT_LABELS = Object.freeze({
  lustre:['lustre','pendente','chandelier'], spots:['spot','trilho','refletor'],
  'fita-led':['fita','led','perfil'], arandelas:['arandela','parede'],
  abajur:['abajur','mesa'], leitura:['leitura','luminária','luminaria'],
});
const norm = x => String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function assetFor(name, table, prefix, fallback) {
  const key = norm(name);
  const hit = Object.entries(table).find(([,words]) => words.some(w => key.includes(norm(w))))?.[0] || fallback;
  return asset(`${prefix}-${hit}.webp`);
}
const roomPicture = name => assetFor(name,ROOM_LABELS,'room','sala');
const lightPicture = name => assetFor(name,LIGHT_LABELS,'light','spots');
function copy(value){return JSON.parse(JSON.stringify(value));}
function assert(condition,label='lighting_invalid_contract'){if(!condition)throw new Error(label);}
function issueId(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID().replaceAll('-','');const b=new Uint8Array(16);if(globalThis.crypto?.getRandomValues){crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}throw new Error('secure_request_id_unavailable');}

/** Display gate only. The private SDK and gateway reauthorize every operation. */
export function hasVerifiedLightingAccess(claim) {
  if(!isRecord(claim) || claim.status_verified===false || !Array.isArray(claim.modules)) return false;
  const match=claim.modules.filter(row=>row?.sku===SKU);
  if(match.length!==1 || match[0].installed!==true) return false;
  const m=match[0];
  if(m.license?.allowed===true && m.license?.status==='licensed')return true;
  if(m.trial?.verified!==true || m.trial?.phase!=='trial_active' || m.trial?.paid_confirmed!==false) return false;
  const until=Date.parse(m.trial.blocks_at||'');
  return Number.isFinite(until)&&Date.now()<until;
}

function safeConfiguration(configuration,states){
  assert(isRecord(configuration),'lighting_configuration_unavailable');
  const {revision,rooms,items,total,preferences}=configuration;
  assert(Number.isSafeInteger(revision)&&revision>=0 && Array.isArray(rooms)&&rooms.length<=200
    && Array.isArray(items)&&items.length<=2000 && Number.isSafeInteger(total) && total===items.length
    && isRecord(preferences)&&THEMES.includes(preferences.theme),'lighting_configuration_unavailable');
  assert(isRecord(states)&&Object.keys(states).length<=2100,'lighting_states_unavailable');
  const ids=new Set(),roomNames=new Map();
  for(const r of rooms){
    assert(isRecord(r)&&ROOM_ID.test(r.id)&&saneText(r.name)&&!roomNames.has(r.id),'lighting_room_invalid');
    roomNames.set(r.id,r.name);
  }
  const result=[];
  for(const x of items){
    assert(isRecord(x)&&ENTITY_ID.test(x.entity_id)&&!ids.has(x.entity_id)
      && saneText(x.name)&&typeof x.visible==='boolean'
      && (x.room_id===null||roomNames.has(x.room_id))
      && ICONS.includes(x.icon)&&Array.isArray(x.capabilities),'lighting_entity_invalid');
    ids.add(x.entity_id);
    if(x.kind==='sensor'){
      assert(x.entity_id.startsWith('binary_sensor.')&&x.capabilities.length===0,'lighting_sensor_invalid');
      continue;
    }
    assert(x.kind==='light'&&x.capabilities.length===1&&x.capabilities[0]==='on_off','lighting_bind_invalid');
    if(!x.visible)continue;
    const st=states[x.entity_id];
    if(st!==undefined)assert(isRecord(st)&&st.entity_id===x.entity_id,'lighting_state_identity_mismatch');
    const state=STATES.has(st?.state)?st.state:'unavailable';
    const modes=Array.isArray(st?.attributes?.supported_color_modes)&&st.attributes.supported_color_modes.every(x=>ALLOWED_COLOR_MODES.has(String(x)))?st.attributes.supported_color_modes:[];
    const brightness=(state==='on'&&modes.some(m=>m!=='onoff')&&Number.isInteger(st?.attributes?.brightness)&&st.attributes.brightness>=0&&st.attributes.brightness<=255)
      ?Math.round(st.attributes.brightness/255*100):null;
    const kelvin=Number.isInteger(st?.attributes?.color_temp_kelvin)?st.attributes.color_temp_kelvin:null;
    result.push({id:x.entity_id,name:x.name,icon:x.icon,roomId:x.room_id,
      room:roomNames.get(x.room_id)||'Sem ambiente',state,brightness,kelvin,
      isSwitch:x.entity_id.startsWith('switch.'),available:state==='on'||state==='off'});
  }
  return {revision,rooms:rooms.map(x=>({id:x.id,name:x.name})),items:items.map(x=>({...x})),
    lights:result.sort((a,b)=>{
      const preferred=['lustre','spots','fita-led','arandelas','abajur','leitura'];
      const key=x=>Object.entries(LIGHT_LABELS).find(([,words])=>words.some(w=>norm(x.name).includes(norm(w))))?.[0];
      const ia=preferred.indexOf(key(a)),ib=preferred.indexOf(key(b));
      return (ia<0?99:ia)-(ib<0?99:ib)||nameSort(a.name,b.name)||nameSort(a.id,b.id);
    }),theme:preferences.theme};
}

/** Every bit of readable lighting data must be delivered by the signed native port. */
export function projectLightingPortResult(value) {
  assert(isRecord(value) && value.sku===SKU && value.locked!==true && isRecord(value.configuration) && isRecord(value.states),
    'lighting_snapshot_unavailable');
  return safeConfiguration(value.configuration,value.states);
}

function summarize(lights){return {total:lights.length,on:lights.filter(x=>x.state==='on').length,off:lights.filter(x=>x.state==='off').length,
  unavailable:lights.filter(x=>x.state==='unavailable').length,unknown:lights.filter(x=>x.state==='unknown').length};}
function groupRooms(snap){
  const map=new Map(snap.rooms.map(x=>[x.id,{...x,lights:[],count:0,on:0,off:0,unavailable:0}]));
  for(const l of snap.lights){if(!map.has(l.roomId))map.set(l.roomId,{id:l.roomId,name:l.room,lights:[],count:0,on:0,off:0,unavailable:0});const r=map.get(l.roomId);r.lights.push(l);r.count++;r.on+=l.state==='on'?1:0;r.off+=l.state==='off'?1:0;r.unavailable+=l.state==='unavailable'?1:0;}
  const preferred=['sala','cozinha','suite','jardim','garagem','escritorio'];
  const priority=r=>{const name=norm(r.name);const key=Object.entries(ROOM_LABELS).find(([,terms])=>terms.some(t=>name.includes(norm(t))))?.[0];return key ? preferred.indexOf(key) : preferred.length;};
  return [...map.values()].filter(r=>r.count).sort((a,b)=>priority(a)-priority(b)||nameSort(a.name,b.name));
}
function controlVisual(l,css=''){return `<span class="cp-light-toggle ${l.state==='on'?'is-on':''} ${l.available?'':'is-unavailable'} ${css}" role="img" aria-label="${l.state==='on'?'Ligada':l.state==='off'?'Desligada':'Indisponível'}"><i></i></span>`;}
function roomCard(r,active,kind){const label=esc(r.name);return `<button class="cp-room-card ${r.id===active?'selected':''}" type="button" data-room="${esc(r.id||'')}">
 <img loading="lazy" src="${roomPicture(r.name)}" alt=""><span class="cp-room-gradient"></span>
 <span class="cp-room-meta"><span class="cp-room-badge">${kind==='grafite'?'⌂':'✦'}</span><span class="cp-room-text"><strong>${label}</strong><small>${r.count} luzes · <em>${r.on} acesas</em></small></span><span class="cp-room-chevron">›</span></span></button>`;}
function lightInfo(l){return `${esc(l.name)}<small>${l.isSwitch?'Relé confirmado · ':''}${l.state==='on'?'● Acesa':l.state==='off'?'● Apagada':'● Indisponível'}</small>`;}
function lampCard(l){return `<article class="cp-lamp-card ${l.state==='on'?'on':'off'}"><img loading="lazy" src="${lightPicture(l.name)}" alt=""><span class="cp-lamp-shade"></span>${controlVisual(l,'card-toggle')}
 <div class="cp-lamp-caption"><b>${esc(l.name)}</b><span>${l.state==='on'?'● Ligada':l.state==='off'?'● Desligada':'● Indisponível'}</span>
 ${l.brightness!==null?`<div class="cp-bright"><small>Intensidade</small><i><u style="width:${l.brightness}%"></u></i><small>${l.brightness}%</small></div>`:''}</div></article>`;}
function lampRow(l){return `<article class="cp-lamp-row ${l.state==='on'?'on':'off'}"><img src="${lightPicture(l.name)}" loading="lazy" alt=""><div class="cp-lamp-details"><strong>${esc(l.name)}</strong><small>${esc(l.room)} · ${l.isSwitch?'Relé confirmado':'Luz individual'} · ${l.state==='on'?'Acesa':l.state==='off'?'Apagada':'Indisponível'}</small>
 ${l.brightness===null?'':`<span class="cp-bright-row">Intensidade <span class="cp-bright-bar"><i style="width:${l.brightness}%"></i></span> ${l.brightness}%</span>`}</div>${controlVisual(l)}</article>`;}
function pagination(type,page,total,size){const pages=Math.max(1,Math.ceil(total/size));return `<div class="cp-pager"><button data-page="${type}:prev" ${page===0?'disabled':''} aria-label="Página anterior">‹</button><span>${total===0?0:Math.min((page+1)*size,total)} de ${total} ${type==='room'?'ambientes':'luzes'}</span><button data-page="${type}:next" ${page>=pages-1?'disabled':''} aria-label="Próxima página">›</button></div>`;}

/** Host-compatible element. The private Release Center serves this file as frontend/panel.js. */
export class CloudPelizzonLightingPanel extends HTMLElement {
 constructor(){super();this.attachShadow({mode:'open'});this._hass=null;this._actor=null;this._active=false;this._loading=false;this._allowed=false;this._snapshot=null;this._discover=[];this._view='overview';this._theme='grafite';this._search='';this._reviewSearch='';this._room=null;this._roomPage=0;this._lightPage=0;this._reviewPage=0;this._filter='all';this._category='Todos';this._message='';this._req=0;this._pending=false;this._configRevision=null;this._handlers=false;this._lastRightCheck=0;this._timer=null;this._deadlineTimer=null;this._trialDeadline=null;this._draft=null;}
 set hass(hass){const next=hass?.user?.id||null;if(this._actor!==next){this._reset();this._actor=next;}this._hass=hass||null;if(this.isConnected&&!this._handlers)this._attach();if(this.isConnected&&this._hass&&!this._loading){if(Date.now()-this._lastRightCheck>30000)void this.refresh();else this.render();}}
 get hass(){return this._hass;}
 connectedCallback(){this._active=true;this._attach();this.render();if(this._hass)void this.refresh();}
 disconnectedCallback(){this._active=false;this._reset();this._detach();}
 _reset(){this._clearDeadline();this._req++;this._allowed=false;this._snapshot=null;this._discover=[];this._room=null;this._roomPage=0;this._lightPage=0;this._reviewPage=0;this._pending=false;this._configRevision=null;this._draft=null;this._lastRightCheck=0;}
 _attach(){if(this._handlers)return;this._click=e=>this.onClick(e);this._change=e=>this.onChange(e);this._input=e=>this.onInput(e);this.shadowRoot.addEventListener('click',this._click);this.shadowRoot.addEventListener('change',this._change);this.shadowRoot.addEventListener('input',this._input);this._handlers=true;}
 _detach(){if(!this._handlers)return;this.shadowRoot.removeEventListener('click',this._click);this.shadowRoot.removeEventListener('change',this._change);this.shadowRoot.removeEventListener('input',this._input);this._handlers=false;}
 get ws(){return this._hass?.callWS?.bind(this._hass)}

 _clearDeadline(){if(this._deadlineTimer!==null)clearTimeout(this._deadlineTimer);this._deadlineTimer=null;this._trialDeadline=null;}
 _expireAt(deadline){
   if(!this._active || this._trialDeadline!==deadline)return;
   const remaining=deadline-Date.now();
   if(remaining>0){this._deadlineTimer=setTimeout(()=>this._expireAt(deadline),Math.min(2147483647,Math.max(1,remaining)));return;}
   // UI-level cleanup only. Real server must deny after expiry regardless of browser clock.
   this._reset();this._message='Prazo do Trial encerrado. Visão Geral e contratação disponíveis.';
   this.render();this._openCore();
 }
 _trackDeadline(status){
   this._clearDeadline();
   const mod=status?.modules?.find(x=>x?.sku===SKU);
   if(!mod || (mod.license?.allowed===true&&mod.license?.status==='licensed'))return;
   if(mod.trial?.verified!==true || mod.trial?.phase!=='trial_active' || mod.trial?.paid_confirmed!==false)
     throw new Error('lighting_access_denied');
   const deadline=Date.parse(mod.trial.blocks_at||'');
   if(!Number.isFinite(deadline)||deadline<=Date.now())throw new Error('lighting_access_denied');
   this._trialDeadline=deadline;
   this._deadlineTimer=setTimeout(()=>this._expireAt(deadline),Math.min(2147483647,Math.max(1,deadline-Date.now())));
 }
 async _access(){const call=this.ws;assert(call,'lighting_session_missing');const status=await call({type:WS.status});const ok=hasVerifiedLightingAccess(status);this._lastRightCheck=Date.now();if(ok)this._trackDeadline(status);return ok;}
 async refresh(){if(this._loading||!this._active||!this.ws)return;const req=++this._req;this._loading=true;this._message='';this.render();try{
   if(!await this._access())throw new Error('lighting_access_denied');
   const raw=await this.ws({type:WS.snapshot});
   assert(req===this._req&&this._active,'lighting_request_cancelled');
   const snap=projectLightingPortResult(raw);this._snapshot=snap;this._allowed=true;this._configRevision=snap.revision;this._theme=snap.theme;
   if(this._room!==null&&!snap.rooms.some(r=>r.id===this._room))this._room=null;
 }catch(e){if(req===this._req){this._reset();this._message=e?.message==='lighting_access_denied'?'Licença/Trial não autorizado pelo servidor.':'Leitura protegida indisponível. Verifique gateway e módulo instalado.';}}
 finally{this._loading=false;if(this._active)this.render();}}
 async _execute(op,parameters){assert(OPERATIONS.has(op),'lighting_operation_unsupported');assert(!this._pending&&this._allowed&&this._snapshot,'lighting_no_active_session');this._pending=true;this.render();const req=this._req;
 try{
   if(!await this._access())throw new Error('lighting_access_denied');
   const ret=await this.ws({type:WS.operation,operation:op,parameters:copy(parameters),request_id:issueId()});
   assert(req===this._req&&this._active,'lighting_request_cancelled');
   assert(isRecord(ret),'lighting_save_unverified');
   if(op!=='lighting.entities.discover')assert(ret.saved===true&&Number.isSafeInteger(ret.revision),'lighting_save_unverified');
   return ret;
 }catch(e){if(e.message==='lighting_access_denied'){this._reset();}throw e;}
 finally{this._pending=false;this.render();}}
 async discover(){if(!this._allowed)return;const found=[];const seen=new Set();const session=this._req;let expected=null;
 try{for(let page=0;page<20;page++){
   assert(this._active&&session===this._req&&this._allowed,'lighting_discovery_cancelled');
   const chunk=await this._execute('lighting.entities.discover',{offset:found.length,limit:100});
   assert(this._active&&session===this._req&&this._allowed,'lighting_discovery_cancelled');
   assert(isRecord(chunk)&&Array.isArray(chunk.items)&&Number.isSafeInteger(chunk.total)
     &&chunk.total>=0&&chunk.total<=2000,'lighting_discovery_invalid');
   if(expected===null)expected=chunk.total;
   assert(chunk.total===expected&&found.length<=expected,'lighting_discovery_revision_changed');
   assert(chunk.items.length===Math.min(100,expected-found.length),'lighting_discovery_partial');
   for(const x of chunk.items){
     assert(isRecord(x)&&ENTITY_ID.test(x.entity_id)&&!seen.has(x.entity_id)
       &&saneText(x.name)&&['light','review','sensor'].includes(x.kind)
       &&Array.isArray(x.capabilities)&&x.capabilities.length<=12
       &&x.capabilities.every(c=>typeof c==='string'&&c.length<=32),'lighting_discovery_invalid');
     assert(x.entity_id.startsWith('light.')?x.kind==='light':
       x.entity_id.startsWith('switch.')?x.kind==='review':x.kind==='sensor','lighting_discovery_kind_invalid');
     seen.add(x.entity_id);found.push({entity_id:x.entity_id,name:x.name,kind:x.kind,capabilities:[...x.capabilities]});
   }
   if(found.length===expected)break;
 }
 assert(expected!==null&&found.length===expected&&session===this._req&&this._active,'lighting_discovery_incomplete');
 this._discover=found;this._reviewPage=0;this._message=`${found.length} entidades encontradas para revisão.`;
 }catch(e){if(session===this._req){this._discover=[];this._message='Falha na descoberta autorizada. Nenhum resultado parcial foi importado.';}}
 if(this._active)this.render();}
 async mutate(op,args,success='Configuração salva'){try{const result=await this._execute(op,{revision:this._configRevision,...args});this._message=success;await this.refresh();return result;}catch(e){this._message=e.message==='lighting_access_denied'?'Acesso encerrado.':'Alteração recusada. Dados atualizados antes de tentar novamente.';await this.refresh();return null;}}
 _rooms(){return this._snapshot?groupRooms(this._snapshot):[];}
 _selectedRoom(){const rooms=this._rooms();return rooms.find(r=>r.id===this._room)||rooms[0]||{id:null,name:'Sala',count:0,on:0,off:0,unavailable:0,lights:[]};}
 _filteredRooms(){let rooms=this._rooms(),q=norm(this._search);if(q)rooms=rooms.filter(r=>norm(r.name).includes(q)||r.lights.some(l=>norm(l.name+' '+l.id).includes(q)));if(this._category!=='Todos')rooms=rooms.filter(r=>{
 const s=norm(r.name);return this._category==='Sociais'?/sala|cozinha|estar/.test(s):this._category==='Privativos'?/quarto|suite|banheiro/.test(s):this._category==='Externos'?/jardim|garagem|extern/.test(s):this._category==='Serviço'?/servico|lavanderia|area/.test(s):/escritorio|trabalho/.test(s);
 });return rooms;}
 _filteredLights(){const r=this._selectedRoom(),q=norm(this._search);return r.lights.filter(l=>(this._filter==='all'||(this._filter==='on'&&l.state==='on')||(this._filter==='offline'&&!l.available))&&(!q||norm(l.name+' '+l.id+' '+l.room).includes(q)));}
 _frame(content,theme='grafite'){const hdr=`<div class="cp-header"><div class="cp-heading"><span class="cp-eyebrow">CP-LIGHTING · ${friendlyTheme(theme)}</span><h1>${theme==='grafite'?'Iluminação inteligente':'Iluminação'}</h1></div>${this._metrics()}<label class="cp-search">⌕ <input data-search="1" placeholder="Buscar luz ou ambiente" value="${esc(this._search)}" autocomplete="off" maxlength="100"></label><button class="cp-settings-button" data-tab="config" title="Configurações">⚙</button></div>`;
 const extra=this._message?`<div class="cp-notice" role="status">${esc(this._message)}</div>`:'';
 return `<div class="cp-root cp-theme-${theme}" data-theme="${theme}">${hdr}${extra}${content}</div>`;}
 _metrics(){const n=summarize(this._snapshot?.lights||[]);return `<div class="cp-metrics"><span>♧ <b>${n.total}</b><small>luzes</small></span><span>☼ <b>${n.on}</b><small>acesas</small></span><span>⊘ <b>${n.unavailable+n.unknown}</b><small>indisponíveis</small></span><span>⌂ <b>${this._rooms().length}</b><small>ambientes</small></span></div>`;}
 _leftMenu(active){const items=[['overview','◉','Iluminação'],['rooms','⌂','Ambientes'],['scenes','▣','Cenas'],['automation','ϟ','Automações'],['config','⚙','Configurações']];return `<aside class="cp-side-nav"><div class="cp-side-head"><b>Iluminação</b><small>CloudPelizzon</small></div>${items.map(([id,ico,title])=>`<button data-tab="${id}" class="${active===id?'selected':''}"><span>${ico}</span>${title}</button>`).join('')}
 <div class="cp-side-foot">Configuração compartilhada entre temas</div></aside>`;}
 _roomPager(rooms,limit){return pagination('room',this._roomPage,rooms.length,limit);}
 _lightPager(lights,limit){return pagination('light',this._lightPage,lights.length,limit);}
 _footerControls(lights){return `<div class="cp-light-nav">${this._lightPager(lights,6)}<span class="cp-no-effect">Controles disponíveis após autorização operacional privada</span></div>`;}
 _neo(){const rooms=this._filteredRooms();const room=this._selectedRoom();const lights=this._filteredLights();const roomChunk=rooms.slice(this._roomPage*6,(this._roomPage+1)*6);const lightChunk=lights.slice(this._lightPage*6,(this._lightPage+1)*6);
 return `<div class="cp-neo-top"><div class="cp-neo-room-strip">${roomChunk.map(r=>roomCard(r,room.id,'neo')).join('')||'<p>Nenhum ambiente configurado.</p>'}</div></div><div class="cp-neo-main"><section class="cp-neo-lights"><div class="cp-room-bar"><div><h2>${esc(room.name)}</h2><span>${room.count} luzes · ${room.on} acesas</span></div>${this._roomPager(rooms,6)}</div><div class="cp-neo-grid">${lightChunk.map(lampCard).join('')||'<p class="cp-empty">Nenhuma luz configurada nesse ambiente.</p>'}</div></section><aside class="cp-neo-aside"><button class="cp-orange-action" disabled title="Aguardando gateway privado">⏻ Apagar sala</button><p class="cp-aside-count"><strong>${room.count} luzes</strong><strong>${room.on} acesas</strong></p><div class="cp-aside-scenes"><small>CENAS DO AMBIENTE</small>${['Cinema','Relaxar','Boa noite'].map((s,i)=>`<button disabled>${['▣','❀','☾'][i]} &nbsp;${s}</button>`).join('')}</div>${this._footerControls(lights)}</aside></div>`;}
 _flux(){const rooms=this._filteredRooms(),room=this._selectedRoom(),lights=this._filteredLights();const roomChunk=rooms.slice(this._roomPage*6,(this._roomPage+1)*6);const lightChunk=lights.slice(this._lightPage*6,(this._lightPage+1)*6);
 return `<div class="cp-flux-shell"><aside class="cp-flux-categories"><h3>Ambientes</h3>${['Todos','Sociais','Privativos','Externos','Serviço','Trabalho'].map((x,i)=>`<button data-category="${x}" class="${this._category===x?'selected':''}"><span>${['⌂','▱','♧','♧','⚙','⌘'][i]}</span>${x}</button>`).join('')}</aside>
 <section class="cp-flux-rooms"><div class="cp-flux-room-grid">${roomChunk.map(r=>roomCard(r,room.id,'flux')).join('')||'<p>Nenhum ambiente.</p>'}</div>${this._roomPager(rooms,6)}</section><section class="cp-flux-lights"><div class="cp-flux-hero" style="--cp-hero:url('${roomPicture(room.name)}')"><h2>${esc(room.name)}</h2><span>${room.count} luzes · ${room.on} acesas</span></div><div class="cp-flux-lamp-list">${lightChunk.map(lampRow).join('')||'<div class="cp-empty">Nenhuma luz configurada.</div>'}</div>${this._lightPager(lights,6)}</section></div>`;}
 _grafite(){const rooms=this._filteredRooms(),room=this._selectedRoom(),lights=this._filteredLights();const roomChunk=rooms.slice(this._roomPage*6,(this._roomPage+1)*6),lightChunk=lights.slice(this._lightPage*6,(this._lightPage+1)*6);
 return `<div class="cp-grafite-shell">${this._leftMenu('overview')}<section class="cp-grafite-rooms"><div class="cp-grafite-grid">${roomChunk.map(r=>roomCard(r,room.id,'grafite')).join('')||'<p>Nenhum ambiente configurado.</p>'}</div>${this._roomPager(rooms,6)}</section><section class="cp-grafite-detail"><header><div><h2>${esc(room.name)}</h2><span>${room.count} luzes · ${room.on} acesas</span></div><button disabled>⏻ Apagar sala</button></header><div class="cp-filter-line">${[['all',`Todas (${room.count})`],['on',`Acesas (${room.on})`],['offline',`Indisponíveis (${room.unavailable})`]].map(([k,label])=>`<button class="${this._filter===k?'active':''}" data-filter="${k}">${label}</button>`).join('')}</div><div class="cp-grafite-lamp-list">${lightChunk.map(lampRow).join('')||'<p class="cp-empty">Nenhuma luz configurada.</p>'}</div>${this._lightPager(lights,6)}</section></div>`;}
 _fieldMarkup({label,id,value='',placeholder='',max=80,type='text'}){return `<label class="cp-field"><span>${esc(label)}</span><input data-form="${id}" type="${type}" maxlength="${max}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;}
 _configHeader(){return `<div class="cp-config-header"><div><small>CP-LIGHTING · CADASTRO COMPARTILHADO</small><h1>Configurações da Iluminação</h1><p>Os três dashboards utilizam o mesmo cadastro autorizado</p></div><button class="cp-save-button" data-action="refresh">↻ Atualizar leitura</button></div>`;}
 _themes(){return `<div class="cp-theme-selector">${THEMES.map(x=>`<button class="cp-theme-choice ${this._theme===x?'selected':''}" data-theme="${x}"><img loading="lazy" src="${asset('ref-'+(x==='neo-soft'?'neo':x)+'.webp')}" alt=""><b>${friendlyTheme(x)}</b><small>${x==='grafite'?'Elegância clássica':x==='flux'?'Neon fluido':'Aconchego e leveza'}</small><i></i></button>`).join('')}</div>`;}
 _config(){const snap=this._snapshot,rooms=this._rooms(),cats=this._discover;const query=norm(this._reviewSearch);const matches=cats.filter(x=>!query||norm(x.name+' '+x.entity_id).includes(query));const start=this._reviewPage*20;const reviewRows=matches.slice(start,start+20);const bound=new Set(snap.items.map(x=>x.entity_id));
 const colors=this._theme==='flux'?'flux':this._theme==='neo-soft'?'neo':'grafite';const count=summarize(snap.lights);
 return `<div class="cp-config-layout">${this._leftMenu('config')}<main class="cp-config-content">${this._configHeader()}<div class="cp-config-grid">
 <section class="cp-panel cp-discovery"><div class="cp-panel-title"><div><h2>↗ Descoberta e sincronização Home Assistant</h2><p>Fonte: Home Assistant autenticado · autorização privada obrigatória</p></div><span class="cp-connected">● Leitura autenticada</span></div><div class="cp-action-bar"><button data-action="discover" class="cp-primary" ${this._pending?'disabled':''}>⌕ Buscar entidades agora</button><button data-action="refresh" ${this._pending?'disabled':''}>↻ Sincronizar e atualizar</button><button data-action="connection">✧ Testar conexão</button></div><div class="cp-domain-chips"><span>Domínios suportados:</span>${DOMAINS.map(x=>`<span class="cp-domain-tag">${x}</span>`).join('')}</div><div class="cp-discovery-stats">${[['Encontradas',cats.length],['Luzes',cats.filter(x=>x.entity_id.startsWith('light.')).length],['Switches',cats.filter(x=>x.entity_id.startsWith('switch.')).length],['Sensores',cats.filter(x=>x.entity_id.startsWith('binary_sensor.')).length]].map(([k,v])=>`<span><strong>${v}</strong><small>${k}</small></span>`).join('')}</div><p class="cp-help">Entidades switch.* exigem confirmação individual. Sensores de presença não são lâmpadas. A descoberta não grava vínculos automaticamente.</p></section>
 <section class="cp-panel cp-preview-settings"><div class="cp-panel-title"><div><h2>◉ Tema visual da interface</h2><p>Preferência do usuário salva no backend privado</p></div></div>${this._themes()}<div class="cp-theme-actions"><span>${rooms.length} ambientes · ${count.total} luzes · ${count.on} acesas</span><button data-tab="overview">Abrir ${friendlyTheme(this._theme)} ↗</button></div></section>
 <section class="cp-panel cp-mapping"><div class="cp-panel-title"><div><h2>⌂ Mapeamento e organização</h2><p>Ambientes e nomes de entidades preservam seus IDs HA</p></div></div><div class="cp-mapping-controls">${this._fieldMarkup({label:'Novo ambiente',id:'newroom',placeholder:'Ex.: Sala de estar'})}<button data-action="create-room" ${this._pending?'disabled':''}>+ Criar ambiente</button></div><div class="cp-room-chips">${snap.rooms.map(r=>`<button data-room="${esc(r.id)}">⌂ ${esc(r.name)}</button>`).join('')||'<em>Crie um ambiente para mapear as entidades.</em>'}</div><div class="cp-help">Alterações de cômodo, nome, ícone e visibilidade são gravadas no cadastro central, com revisão e autorização em cada operação.</div></section>
 <section class="cp-panel cp-summary"><div class="cp-panel-title"><div><h2>♧ Exibição das luzes</h2><p>O mesmo inventário é exibido nos três temas</p></div></div><div class="cp-config-list"><div>✓ Luzes individuais, sem cascata</div><div>✓ Contagem de acesas, apagadas e indisponíveis</div><div>✓ Dimmer somente quando o HA informa suporte</div><div>✓ Relés apenas após confirmação</div><div>✓ Busca e paginação até 2.000 vínculos</div></div><div class="cp-config-note">Cenas rápidas, consumo e efeitos físicos dependem de operações privadas específicas. Não são simulados nem configurados como ativos.</div></section>
 <section class="cp-panel cp-scenes-settings"><div class="cp-panel-title"><div><h2>▣ Cenas rápidas</h2><p>Atalhos autorizados por ambiente</p></div><span class="cp-disabled-tag">Pendente do gateway</span></div><div class="cp-options"><span>Exibir cenas da sala <b>Aguardando catálogo assinado</b></span><span>Executar cena <b>Desabilitado</b></span><span>Posição das cenas <b>Lateral direita</b></span></div><p class="cp-help">As cenas somente serão liberadas após uma operação privada assinada e autorização do usuário.</p></section>
 <section class="cp-panel cp-energy-settings"><div class="cp-panel-title"><div><h2>▥ Sensores e consumo (opcional)</h2><p>Sem dados simulados nem medição inferida</p></div><span class="cp-disabled-tag">Opcional</span></div><div class="cp-options"><span>Potência instantânea <b>Somente sensor W real</b></span><span>Consumo acumulado <b>Somente sensor kWh real</b></span><span>Entidade de consumo <b>Aguardando vínculo seguro</b></span></div><p class="cp-help">O total só aparecerá quando uma fonte autorizada estiver vinculada e validada.</p></section>
 <section class="cp-panel cp-pagination-settings"><div class="cp-panel-title"><div><h2>▤ Paginação, favoritos e ordem</h2><p>Configuração consistente nas três visões</p></div><span class="cp-disabled-tag">Contrato complementar</span></div><div class="cp-options"><span>Ambientes por página <b>6 nesta versão</b></span><span>Luzes por página <b>6 nesta versão</b></span><span>Favoritos e ordem personalizada <b>Persistência pendente</b></span></div><p class="cp-help">Não será criado um segundo cadastro: favoritos e ordem serão estendidos no serviço privado existente.</p></section>
 <section class="cp-panel cp-alert-settings"><div class="cp-panel-title"><div><h2>⚡ Alertas, filtros e animações</h2><p>Recursos visuais e estados de disponibilidade</p></div></div><div class="cp-options"><span>Identificar indisponíveis <b>Habilitado</b></span><span>Busca global de luzes e ambientes <b>Habilitada</b></span><span>Animações <b>Moderadas</b></span><span>Notificações proativas <b>Requerem backend privado</b></span></div></section>
 <section class="cp-panel cp-review"><div class="cp-panel-title"><div><h2>▤ Vinculação e revisão individual</h2><p>Somente o que você confirmar entra no módulo</p></div><span>${matches.length} itens</span></div><label class="cp-review-search">⌕ <input data-review-search="1" value="${esc(this._reviewSearch)}" placeholder="Buscar luz, relé ou entity_id"></label>
 <div class="cp-review-list">${reviewRows.map(row=>{const saved=bound.has(row.entity_id),sensor=row.kind==='sensor',switcher=row.entity_id.startsWith('switch.'),existing=snap.items.find(i=>i.entity_id===row.entity_id);return `<div class="cp-review-row" data-row="${esc(row.entity_id)}"><div class="cp-review-entity"><b>${esc(row.name)}</b><small>${esc(row.entity_id)}</small><small class="${switcher?'pending':''}">${sensor?'Sensor (não iluminação)':switcher?'Relé • requer revisão':'Luz nativa'}</small></div><label><span>Nome local</span><input data-entity-field="name" value="${esc(existing?.name||row.name)}" maxlength="80"></label><label><span>Ambiente</span><select data-entity-field="room">${'<option value="">Sem ambiente</option>'}${snap.rooms.map(r=>`<option value="${esc(r.id)}" ${existing?.room_id===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><label><span>Ícone</span><select data-entity-field="icon">${ICONS.map(icon=>`<option value="${icon}" ${existing?.icon===icon?'selected':''}>${icon}</option>`).join('')}</select></label><label><span>Exibir</span><input data-entity-field="visible" type="checkbox" ${existing?.visible!==false?'checked':''} ${!saved?'disabled':''}></label><button data-save-entity="${esc(row.entity_id)}" ${this._pending||sensor?'disabled':''}>${saved?'Salvar':'Vincular'}</button></div>`}).join('')||'<div class="cp-empty">Clique em Buscar entidades agora. Nenhum dado foi alterado.</div>'}</div>
 ${pagination('review',this._reviewPage,matches.length,20)}<p class="cp-help">As alterações são recusadas em caso de conflito de revisão ou perda de licença. Nada é salvo apenas no navegador.</p></section>
 </div></main></div>`;}
 _locked(){return `<div class="cp-locked"><div class="cp-locked-symbol">♧</div><h1>CP-LIGHTING</h1><h2>Iluminação Inteligente</h2><p>${esc(this._message||'O módulo exige licenciamento ou Trial de 7 dias validado pelo servidor CloudPelizzon.')}</p><div class="cp-locked-actions"><button data-action="overview">Ir à Visão Geral</button><button data-action="buy">Solicitar contratação</button></div><small>Nenhuma leitura, configuração ou comando disponível sem autorização.</small></div>`;}
 render(){if(!this.shadowRoot)return;this.shadowRoot.innerHTML=`<link rel="stylesheet" href="${new URL('./style.css',BASE).href}">`+(!this._allowed||!this._snapshot?this._locked():this._view==='config'?this._config():this._frame(this._theme==='neo-soft'?this._neo():this._theme==='flux'?this._flux():this._grafite(),this._theme));}
 _openCore(){this.dispatchEvent(new CustomEvent('cloudpelizzon-open-module',{detail:{path:'core'},bubbles:true,composed:true}));}
 onClick(e){const node=e.target.closest('button[data-tab],button[data-action],button[data-room],button[data-page],button[data-category],button[data-filter],button[data-theme],button[data-save-entity]');if(!node||node.disabled)return;const d=node.dataset;
 if(d.action==='overview'||d.action==='buy'){this._openCore();return;}
 if(!this._allowed||!this._snapshot)return;
 if(d.tab){if(['scenes','automation'].includes(d.tab)){this._message='Cenas e automações são gerenciadas pela CloudPelizzon e pelo Home Assistant; operação privada ainda não disponível.';}else{this._view=d.tab==='config'?'config':'overview';this._message='';this._roomPage=0;this._lightPage=0;}this.render();return;}
 if(d.theme){void this.mutate('lighting.preferences.write',{theme:d.theme},'Tema atualizado para todas as visões.');return;}
 if(d.action==='refresh'||d.action==='connection'){void this.refresh();return;}
 if(d.action==='discover'){void this.discover();return;}
 if(d.action==='create-room'){const name=this.shadowRoot.querySelector('[data-form="newroom"]')?.value?.trim();if(!saneText(name))return this._tell('Informe um nome de ambiente válido.');const slug=norm(name).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,64);if(!ROOM_ID.test(slug))return this._tell('Nome de ambiente inválido.');void this.mutate('lighting.room.create',{room_id:slug,name},'Ambiente criado.');return;}
 if(d.saveEntity){void this.saveEntity(d.saveEntity);return;}
 if(d.room!==undefined){this._room=d.room||null;this._lightPage=0;this._filter='all';this._view='overview';this.render();return;}
 if(d.category){this._category=d.category;this._roomPage=0;this.render();return;}
 if(d.filter){this._filter=d.filter;this._lightPage=0;this.render();return;}
 if(d.page){const [kind,dir]=d.page.split(':');const limit=kind==='review'?20:6;const size=kind==='room'?this._filteredRooms().length:kind==='review'?this._discover.filter(x=>norm(x.name+' '+x.entity_id).includes(norm(this._reviewSearch))).length:this._filteredLights().length;const prop=kind==='room'?'_roomPage':kind==='review'?'_reviewPage':'_lightPage';this[prop]=clamp(this[prop]+(dir==='next'?1:-1),0,Math.max(0,Math.ceil(size/limit)-1));this.render();}
 }
 _tell(message){this._message=message;this.render();}
 onInput(e){const t=e.target;if(t.dataset.search!==undefined){this._search=t.value;this._roomPage=0;this._lightPage=0;this._deferInput('search');}if(t.dataset.reviewSearch!==undefined){this._reviewSearch=t.value;this._reviewPage=0;this._deferInput('review-search');}}
 onChange(_e){}
 _deferInput(which){clearTimeout(this._timer);const root=this.shadowRoot;const node=root.querySelector(`[data-${which}]`),pos=node?.selectionStart??0;this._timer=setTimeout(()=>{this.render();const n=this.shadowRoot.querySelector(`[data-${which}]`);if(n){n.focus();n.setSelectionRange(Math.min(pos,n.value.length),Math.min(pos,n.value.length));}},180);}
 async saveEntity(id){const row=this.shadowRoot.querySelectorAll('.cp-review-row');const node=[...row].find(x=>x.dataset.row===id);if(!node)return;const get=k=>node.querySelector(`[data-entity-field="${k}"]`);const name=get('name')?.value.trim(),room_id=get('room')?.value||null,icon=get('icon')?.value,visible=get('visible')?.checked;
 if(!saneText(name)||!ICONS.includes(icon))return this._tell('Nome ou ícone inválido.');const saved=this._snapshot.items.some(x=>x.entity_id===id);const source=this._discover.find(x=>x.entity_id===id);if(!saved&&!source)return;
 const op=saved?'lighting.entity.configure':'lighting.entity.bind';if(!saved&&source.kind==='sensor')return;
 const fields=saved?{entity_id:id,name,room_id,icon,visible}:{entity_id:id,name,room_id,icon,confirm_light:id.startsWith('switch.')};
 if(!saved&&id.startsWith('switch.')&&!confirm(`Confirmar que ${name} é um relé de iluminação?`))return;
 await this.mutate(op,fields,saved?'Entidade atualizada.':'Entidade vinculada.');}
}
if(!customElements.get('cloudpelizzon-lighting-panel'))customElements.define('cloudpelizzon-lighting-panel',CloudPelizzonLightingPanel);
