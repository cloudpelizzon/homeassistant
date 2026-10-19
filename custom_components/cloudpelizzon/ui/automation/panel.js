/* CloudPelizzon Automation • v0.2.1 pilot • last change 12/10/2026
 * Every customer-facing editor control is visual: no JSON/YAML editing.
 * Selection is monitoring scope, NOT automatic engine activation.
 */
import './legacy-v1044.js?v=20699430ac6d';

// CP_CLIENT_EXPERIENCE_V025 — default immersive panel; no misleading demo KPIs.
// CP_AUTO_CLIENT_NATIVE_V026 — client reads automation.* from current Home Assistant only.
const STYLES = `
:host{display:block;min-height:100vh;color:#e5f7ff;background:#010813;font:13px Inter,Roboto,'Segoe UI',sans-serif}
*{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer;color:#aff0ff;border:1px solid #205773;background:#082236;border-radius:10px;padding:10px 14px}button:hover{background:#134064}button:disabled{opacity:.5;cursor:not-allowed}button.primary{background:linear-gradient(110deg,#075e83,#047a80);color:#fff;border-color:#21d7e4}button.danger{border-color:#823b4e;color:#ffa5b3;background:#260e1e}button.selected{border-color:#00dfef;background:#0b4258;color:#fff}
.top{position:sticky;top:0;z-index:5;background:linear-gradient(95deg,#061628,#020a17);border-bottom:1px solid #1a5269;padding:12px 15px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.brand{font-weight:950;color:#6feaff;letter-spacing:1.1px}.subbrand{font-size:10px;color:#79a8c1}.tabs{display:flex;flex-wrap:wrap;gap:5px}.tabs button{font-size:12px;padding:9px 11px}.tabs button.active{color:#fff;background:#105271;border-color:#2ad2eb}.statusbar{margin-left:auto;color:#91d4e0;font-size:11px}
main{padding:15px}.view{display:none}.view.active{display:block}h2{font-size:18px;margin:4px 0 6px;color:#62dcff}h3{font-size:14px;color:#71dbf2}p{line-height:1.5;color:#9cb8c9}.muted{color:#8fb1c1}.small{font-size:11px}.warn{color:#ffce77}.bad{color:#ff8799}.ok{color:#36ecad}.explain{padding:14px;border:1px solid #235374;border-radius:12px;background:linear-gradient(130deg,#0a2839,#081827);line-height:1.5;margin-bottom:16px}.explain.warn{border-color:#8a6837;background:#271c0d}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px}.metric{border:1px solid #146180;border-radius:13px;background:linear-gradient(125deg,#0c2a3b,#04131f);padding:15px}.metric small{color:#90adbd}.metric strong{display:block;font-size:30px;color:#b8f5ff;margin-top:5px}
.toolrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:15px 0}.toolrow input[type=search]{flex:1;min-width:180px}.panel{border:1px solid #1a4b67;background:linear-gradient(145deg,#061b2c,#04101e);padding:15px;border-radius:14px;margin:12px 0}.panel.light{background:#0b2839}input:not([type=checkbox]),select,textarea{width:100%;background:#071b2d;color:#eaffff;border:1px solid #24526a;padding:10px 11px;border-radius:8px;min-height:39px}input:focus,textarea:focus,select:focus{outline:2px solid #1cb5cc}textarea{min-height:70px;resize:vertical}label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#c4e4ef}label.check{flex-direction:row;align-items:center;gap:10px;cursor:pointer}label.check input{width:17px;height:17px;accent-color:#00e2e2}.controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.controls>label{flex:1;min-width:150px}
.catgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.cat{border:1px solid #21516b;background:#071e31;border-radius:12px;padding:13px;display:flex;gap:10px;align-items:center}.cat input{width:20px;height:20px;accent-color:#00dfe9}.cat b{display:block;font-size:13px}.cat small{color:#96b7c6}.tablewrap{width:100%;overflow:auto}table{border-collapse:collapse;width:100%;min-width:790px}th{text-align:left;font-size:11px;color:#69dfff;background:#0b2739}th,td{border-bottom:1px solid #193d56;padding:9px;font-size:12px}td code{color:#85dbec;font-size:10px}.pill{display:inline-block;padding:3px 8px;background:#0e3245;border:1px solid #225a72;border-radius:20px;font-size:10px}
.formgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wide{grid-column:1/-1}.block{position:relative;background:#071b2c;border:1px solid #20546a;border-radius:12px;padding:13px;margin:9px 0}.block>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.block>header b{color:#74e1f6}.block .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px}.block button{padding:5px 9px}.designer-note{font-size:11px;color:#d1c49c;margin:7px 0}.legacy{width:100%;min-height:590px}.legacy automation-control-center-v1044{width:100%;display:block}.feedback{white-space:pre-wrap;min-height:45px;border:1px solid #25546b;border-radius:11px;background:#082336;padding:13px;margin:10px 0;color:#bce8f4}.feedback.bad{color:#ff8799;border-color:#8a4550}.empty{padding:25px;text-align:center;color:#98b8c9}.right{margin-left:auto}[hidden]{display:none!important}
.cp-viewbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 10px;padding:7px 10px;border:1px solid #16455c;border-radius:10px;background:#04131e}
.cp-viewbar label{flex-direction:row;align-items:center;gap:9px;font-size:11px}
.cp-viewbar select{width:auto;min-width:180px;max-width:300px;min-height:30px;padding:5px 8px}
.cp-viewbar button{padding:6px 9px;font-size:11px}
.cp-datanote{color:#99c2d2;font-size:11px;line-height:1.4;padding:4px 3px}
#view-overview{padding:0}.client-overview-managed{margin-top:8px}.legacy{min-height:calc(100vh - 172px)}
#dynamic-map svg g[data-open-category]>circle{animation:cpauto-node-pulse 3.2s ease-in-out infinite}
.cp-ha-badge{font-size:11px;color:#65e7d6;font-weight:700;letter-spacing:.02em}
#dynamic-map svg g[data-open-category]{transform-box:fill-box;transform-origin:center;animation:cp-node-float 4.2s ease-in-out infinite}
#dynamic-map svg g[data-open-category]:nth-child(2n){animation-duration:5.1s;animation-delay:-2.3s}
#dynamic-map svg g[data-open-category]:nth-child(3n){animation-duration:3.7s;animation-delay:-1.1s}
@keyframes cp-node-float{50%{transform:translateY(-3px)}}
#legacy{position:relative;isolation:isolate}
#view-overview .cp-viewbar{background:linear-gradient(100deg,#062232,#041321,#071a2a);box-shadow:inset 0 0 18px #0d415135}
#dynamic-map svg path[data-cpauto-flow]{animation:cpauto-flow 2.2s linear infinite;stroke-dasharray:4 10}
@keyframes cpauto-flow{to{stroke-dashoffset:-84}}
@keyframes cpauto-node-pulse{50%{stroke-opacity:.55;filter:drop-shadow(0 0 6px #00dfff)}}
@media(prefers-reduced-motion:reduce){#dynamic-map svg g[data-open-category],#dynamic-map svg g[data-open-category]>circle,#dynamic-map svg path[data-cpauto-flow]{animation:none!important}}

@media(max-width:760px){.formgrid{grid-template-columns:1fr}.wide{grid-column:auto}.top{position:static}.tabs button{flex:1}.statusbar{margin-left:0}.catgrid{grid-template-columns:1fr}.legacy{min-height:700px}}
`;
const esc = x => String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const categoriesLabel = {ALR:'Alarmes',CAS:'Casa',DIA:'Diagnósticos',LUZ:'Iluminação',GAS:'Segurança de gás',SEG:'Segurança',SOL:'Energia solar',NOC:'Monitoramento',MAN:'Manutenção',INF:'Infraestrutura',ALX:'Alexa',LAV:'Lavadora',AGU:'Água',VID:'Vídeo',GOV:'Governança'};
const triggerKinds=[['state','Quando um dispositivo muda de estado'],['time','Em um horário específico'],['time_pattern','A cada X minutos'],['numeric_state','Quando um valor atinge um limite']];
const conditionKinds=[['state','Dispositivo em um estado'],['numeric_state','Valor maior ou menor'],['time','Dentro de horário'],['none','Sem condição']];
const actionKinds=[['light.turn_on','Ligar iluminação'],['light.turn_off','Desligar iluminação'],['light.toggle','Alternar iluminação'],['switch.turn_on','Ligar dispositivo'],['switch.turn_off','Desligar dispositivo'],['switch.toggle','Alternar dispositivo'],['input_boolean.turn_on','Ativar modo/controle'],['input_boolean.turn_off','Desativar modo/controle']];
const selectOptions=(choices,chosen)=>choices.map(([v,n])=>`<option value="${esc(v)}" ${v===chosen?'selected':''}>${esc(n)}</option>`).join('');

class CloudPelizzonAutomationPanel extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._hass=null;this._status=null;this._dataSource='ha';this._overviewExpanded=false;try{this._overviewExpanded=window.localStorage.getItem('cp_auto_overview_expanded')==='1'}catch(_e){};this._view='overview';this._loading=false;this._initialized=false;this._last=0;this._editor=null;this._editCode='';this._blocks={triggers:[],conditions:[],actions:[]};this._readOnlyComplex=false;this._filter='';}
  set hass(value){this._hass=value;if(this._initialized&&Date.now()-this._last>30000)this.refresh();else if(this._cockpit&&this._status)this._updateCockpitSource(false)}
  get hass(){return this._hass}
  connectedCallback(){if(!this._initialized){this._initialized=true;this._build();this.refresh()}this._timer??=setInterval(()=>this.refresh(false),45000)}
  disconnectedCallback(){if(this._timer)clearInterval(this._timer);this._timer=null;}
  async ws(type,data={}){if(!this._hass)throw Error('Home Assistant não conectado.');return this._hass.callWS({type,...data})}
  _build(){this.shadowRoot.innerHTML=`<style>${STYLES}</style><header class="top"><div><div class="brand">◉ CLOUDPELIZZON · AUTOMATION</div><div class="subbrand">CENTRAL INTELIGENTE · CLOUDPELIZZON</div></div><nav class="tabs">${[['overview','Visão geral'],['categories','Categorias'],['rules','Automações'],['builder','Criar e editar'],['settings','Preferências']].map(([v,t])=>`<button data-tab="${v}" class="${v==='overview'?'active':''}">${t}</button>`).join('')}</nav><span class="statusbar" id="online">Carregando...</span></header><main>
<section class="view active" id="view-overview"><div class="cp-viewbar"><button type="button" data-action="toggleOverview" id="cp-toggle-overview" aria-controls="cp-overview-manager" aria-expanded="false">Mostrar configurações e categorias</button><label>Exibir <select id="cp-count-scope"><option value="all">Todas as automações</option><option value="home">Rotinas da casa</option><option value="technical">Diagnósticos NOC/DIA</option></select></label><span class="cp-ha-badge">● Leitura automática das automações deste Home Assistant</span></div><div id="cp-source-note" class="cp-datanote"></div><div id="cp-overview-manager" class="client-overview-managed" hidden><div class="explain"><b>Seu centro de automações, do seu jeito.</b> Escolha as categorias e regras que deseja acompanhar. <b>Selecionar não modifica suas automações:</b> nenhuma automação nativa será alterada.</div><div id="metrics" class="grid"></div><div class="toolrow"><button class="primary" data-tab="categories">Personalizar categorias</button><button data-tab="builder">Criar automação sem código</button><button data-action="refresh">Atualizar painel</button></div><div class="panel" id="visual-network"><h3>Mapa inteligente de categorias</h3><p class="small">Mapa dinâmico: selecione uma categoria para abrir as automações relacionadas.</p><div id="dynamic-map"></div></div></div><div id="cp-no-native" class="explain" hidden></div><div class="legacy" id="legacy"></div></section>
<section class="view" id="view-categories"><h2>Quais categorias quer gerenciar?</h2><p>Você escolhe. O botão <b>Todas</b> apresenta tudo que estiver disponível; <b>Personalizar</b> permite selecionar apenas o que deseja.</p><div class="toolrow"><button data-action="all" class="primary">✓ Todas</button><button data-action="selected">Personalizar</button><button data-action="clear">Nenhuma</button><button data-action="saveCategories">Salvar preferências</button></div><div class="catgrid" id="categories"></div></section>
<section class="view" id="view-rules"><h2>Minhas automações</h2><p>Escolha quais automações desta instalação deseja acompanhar. A seleção não liga, desliga nem altera suas rotinas.</p><div class="toolrow"><input type="search" id="filter" placeholder="Buscar nome, código ou categoria"><select id="filter-cat" style="max-width:260px"><option value="">Todas as categorias</option></select><button data-action="ruleAll">Todas</button><button data-action="ruleNone">Nenhuma</button><button data-action="saveRules">Salvar seleção</button></div><div class="panel"><div id="rule-table" hidden></div></div><div class="panel"><h3>Automações do seu Home Assistant</h3><p class="small">Os dados são descobertos automaticamente nesta instalação. Use Todas, Nenhuma ou a seleção individual.</p><div id="native-table" class="tablewrap"></div></div></section>
<section class="view" id="view-builder"><h2>Assistente de automações</h2><p>Descreva o que deve acontecer, em que situação e o que a casa deve fazer. Nenhum código é necessário.</p><div class="panel"><div class="toolrow"><button data-action="new" class="primary">+ Nova automação</button><select id="choose-rule" style="flex:1;min-width:220px"><option value="">Ou escolha uma automação para editar</option></select></div><div id="editor" class="empty">Selecione uma regra existente ou clique em Nova automação.</div><div id="feedback" class="feedback">Alterações só são aplicadas após salvar. Regras novas começam desativadas.</div></div></section>
<section class="view" id="view-settings"><h2>Preferências do cliente</h2><div class="panel"><h3>Permissões de execução</h3><p>Escolha separadamente os sensores cujos estados poderão ser enviados ao servidor e os dispositivos que poderão receber comandos. Nenhum dispositivo vem autorizado. Limite: 200 entidades em cada lista. As seleções de categorias e do inventário continuam sendo apenas preferências de visualização.</p><p id="cp-execution-status">Consultando conexão...</p><div class="formgrid"><label>Leitura de estados e atributos<select multiple size="10" id="cp-read-permissions"></select></label><label>Dispositivos que podem receber comandos<select multiple size="10" id="cp-effect-permissions"></select></label></div><p class="small">Use Ctrl ou Shift para selecionar vários itens. Remover uma permissão interrompe a sessão anterior.</p><button data-action="permissionsSave">Salvar permissões de execução</button></div><div class="panel"><p class="small">O painel acompanha exclusivamente as automações locais do Home Assistant. Selecione categorias e regras nas respectivas abas.</p><input id="native-visible" type="checkbox" checked hidden></div><div class="panel"><h3>Segurança e funcionamento</h3><p>Este painel consulta suas automações existentes sem modificá-las. Os recursos de criação e edição permanecem supervisionados e exigem confirmação separada.</p><div class="toolrow"><button data-action="export">Exportar configurações e inventário</button><button data-action="refresh">Atualizar diagnóstico</button></div></div></section></main><datalist id="entities"></datalist>`;
    this.shadowRoot.addEventListener('click',e=>this._click(e));
    this.shadowRoot.addEventListener('change',e=>this._change(e));
    this.shadowRoot.getElementById('cp-count-scope').addEventListener('change',e=>{this._countScope=e.target.value;this._updateCockpitSource(true)});
    this._updateManagementVisibility();
    this.shadowRoot.getElementById('filter').addEventListener('input',e=>{this._filter=e.target.value.toLowerCase();this._renderRules()});
    this.shadowRoot.getElementById('filter-cat').addEventListener('change',()=>this._renderRules());
    this.shadowRoot.getElementById('choose-rule').addEventListener('change',e=>this.loadRule(e.target.value));
    this._cockpit=document.createElement('automation-control-center-v1044');this._cockpit.setConfig({type:'custom:automation-control-center-v1044',title:'Automation Intelligence Center',update_interval:20,inventory_sensor:'',category_registry_sensor:''});this.shadowRoot.getElementById('legacy').append(this._cockpit);
  }
  _updateManagementVisibility(){
    const expanded=!!this._overviewExpanded;
    const node=this.shadowRoot.getElementById('cp-overview-manager');
    if(node)node.hidden=!expanded;
    const btn=this.shadowRoot.getElementById('cp-toggle-overview');
    if(btn){btn.textContent=expanded?'Ocultar configurações e categorias':'Mostrar configurações e categorias';btn.setAttribute('aria-expanded',String(expanded))}
  }
  _updateCockpitSource(force=false){
    if(!this._cockpit||!this._hass)return;
    const native=this._native();
    const selected=native.filter(n=>n.selected&&this._inCountScope(n));
    const message=this.shadowRoot.getElementById('cp-source-note');
    if(message){
      message.textContent=`Monitoramento local do Home Assistant: ${native.length} automações encontradas • ${selected.length} nesta visão. ${this._daily?.complete?'Contagem por contexto único de execução em '+this._daily.time_zone+' ('+this._daily.day+'). Diagnósticos NOC/DIA: '+native.filter(n=>['NOC','DIA'].includes(n.category)).reduce((sum,n)=>sum+(this._daily.counts[n.entity_id]||0),0).toLocaleString('pt-BR')+' disparos. Em exibição: '+selected.length+' automações.':'Contagem diária indisponível: '+(this._dailyError||'consultando registro de atividades…')}`;
    }
    const empty=this.shadowRoot.getElementById('cp-no-native');
    const box=this.shadowRoot.getElementById('legacy');
    if(empty){empty.hidden=selected.length>0;empty.textContent='Nenhuma automação selecionada neste Home Assistant. Abra Automações e utilize Todas para acompanhar as regras locais.';}
    if(box)box.hidden=!selected.length;
    if(!selected.length)return;
    // Never use owner-specific CMDB counters or rule-engine inventory as the client source.
    this._cockpit.config.daily_counts=this._daily?.counts||{};
    this._cockpit.config.daily_hours=this._daily?.entity_hours?selected.reduce((hours,n)=>hours.map((v,i)=>v+(this._daily.entity_hours[n.entity_id]?.[i]||0)),Array(24).fill(0)):this._daily?.hours||null;
    this._cockpit.config.daily_complete=this._daily?.complete===true;
    this._cockpit.config.inventory_sensor='';
    this._cockpit.config.category_registry_sensor='';
    if(force)this._cockpit._last=0;
    this._cockpit.hass=this._observedHass();
  }
  _inCountScope(n){const technical=['NOC','DIA'].includes(n.category);return this._countScope==='home'?!technical:this._countScope==='technical'?technical:true;}
  _observedHass(){
    if(!this._hass)return this._hass;
    const selected=new Set(this._native().filter(n=>n.selected&&this._inCountScope(n)).map(n=>n.entity_id));
    const states={...this._hass.states};
    for(const id of Object.keys(states)){
      if(id.startsWith('automation.')&&!selected.has(id))delete states[id];
      // The customer view must not consume the owner's seed, inventory or engine counters.
      if(id.startsWith('sensor.cp_automation_inventory')||id.startsWith('counter.auto_cp_'))delete states[id];
    }
    return {...this._hass,states};
  }
  _native(){
    const states=this._hass?.states||{};
    const settings=this._settings();
    const isSelected=settings.scope!=='selected';
    const explicit=new Set(settings.native_selection||[]);
    const categories=new Set(settings.category_selection||[]);
    return Object.values(states)
      .filter(v=>typeof v?.entity_id==='string'&&v.entity_id.startsWith('automation.'))
      .map(v=>{
        const name=String(v.attributes?.friendly_name||v.entity_id);
        const match=name.match(/^(?:MAN[-_](INF|CAR|CAS|GAS|TEC|ENE)[-_]\d{3}|([A-Z]{2,6})[-_]\d{3})/i);
        const category=match?(match[1]?'MAN':match[2].toUpperCase()):'SEM';
        return {entity_id:v.entity_id,name,category,state:v.state,selected:isSelected||explicit.has(v.entity_id)||categories.has(category),last_triggered:v.attributes?.last_triggered||null};
      })
      .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }
  _rules(){return (this._status?.rules||[]).filter(r=>r.origin==='customer')}
  _categories(){
    const result=new Map();
    for(const n of this._native()){
      const row=result.get(n.category)||{code:n.category,count:0};
      row.count++;result.set(n.category,row);
    }
    return [...result.values()].sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
  }

    _toast(message,bad=false){const v=this.shadowRoot.getElementById('feedback');v.textContent=message;v.className='feedback'+(bad?' bad':'')}
  _tab(tab){this._view=tab;for(const v of ['overview','categories','rules','builder','settings']){this.shadowRoot.getElementById('view-'+v).classList.toggle('active',v===tab);this.shadowRoot.querySelectorAll(`[data-tab="${v}"]`).forEach(b=>b.classList.toggle('active',v===tab))}}
  async refresh(force=true){
    if(!this._hass||this._loading)return;
    if(!force&&Date.now()-this._last<30000)return;
    this._loading=true;
    try{
      this._status=await this.ws('cloudpelizzon/automation/status');
      await this._loadDaily();
    }catch(error){
      // HA local inventory is still usable when the optional engine backend is unavailable.
      if(!this._status)this._status={rules:[],native_rules:[],settings:{scope:'all',category_selection:[],rule_selection:[],native_selection:[],category_names:{},native_visible:true},categories:[],total:0,active:0};
      console.warn('CloudPelizzon: configurações indisponíveis; inventário HA somente leitura',error);
    }finally{
      this._last=Date.now();this._loading=false;
      this._render();
      const n=this._native();
      const badge=this.shadowRoot.getElementById('online');
      if(badge)badge.innerHTML=`<span class="ok">● Home Assistant conectado</span> · ${n.length} automações locais`;
    }
  }

  async _loadDaily(){
    try{
      if(this._hass.states?.['sensor.cloudpelizzon_homolog_mirror'])this._daily=await this.ws('cloudpelizzon/automation/daily_counts');
      else{
        const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);const ids=this._native().map(x=>x.entity_id),counts=Object.fromEntries(ids.map(id=>[id,0])),hours=Array(24).fill(0),seen=new Set();
        for(let offset=0;offset<ids.length;offset+=40){const rows=await this.ws('logbook/get_events',{start_time:start.toISOString(),end_time:now.toISOString(),entity_ids:ids.slice(offset,offset+40)});if(!Array.isArray(rows))throw Error('Formato de histórico indisponível');for(const row of rows){const key=JSON.stringify([row.entity_id,row.context_id]);if(row.domain==='automation'&&typeof row.context_id==='string'&&row.context_id&&Object.hasOwn(counts,row.entity_id)&&/^triggered(?: by |$)/.test(row.message||'')&&row.when>=start.getTime()/1000&&row.when<now.getTime()/1000&&!seen.has(key)){seen.add(key);counts[row.entity_id]++;hours[new Date(row.when*1000).getHours()]++;}}}
        this._daily={counts,hours,complete:true,day:start.toLocaleDateString('pt-BR')};
      }
      this._dailyError='';
    }catch(error){this._daily=null;this._dailyError=String(error?.message||error);}
  }
  _settings(){return this._status?.settings||{scope:'all',category_selection:[],rule_selection:[],native_selection:[],category_names:{},native_visible:true}}
  _categoryName(c){return this._settings().category_names?.[c]||categoriesLabel[c]||c}
  _render(){
    const n=this._native(),c=this._categories();
    const metrics=this.shadowRoot.getElementById('metrics');
    metrics.innerHTML=[['Automações descobertas',n.length],['Selecionadas',n.filter(x=>x.selected).length],['Ativas no HA',n.filter(x=>x.state==='on').length],['Categorias',c.length]].map(([a,v])=>`<div class="metric"><small>${esc(a)}</small><strong>${esc(v)}</strong></div>`).join('');
    this._renderCategories();this._renderNetwork();this._renderRules();this._renderRuleSelect();this._updateEntities();
    this._updateCockpitSource(true);
  }

    _renderCategories(){const s=this._settings();this.shadowRoot.getElementById('categories').innerHTML=this._categories().map(c=>`<label class="cat"><input type="checkbox" class="catbox" data-category="${esc(c.code)}" ${s.scope==='all'||s.category_selection.includes(c.code)?'checked':''}><span style="flex:1"><b>${esc(c.code)} · ${c.count} regras</b><small>Nome exibido para esta categoria</small><input aria-label="Nome da categoria ${esc(c.code)}" class="catname" data-category="${esc(c.code)}" value="${esc(this._categoryName(c.code))}" maxlength="55" style="margin-top:6px"></span></label>`).join('')||'<div class="empty">Nenhuma categoria ainda. Crie a primeira automação no assistente.</div>'}
  _renderNetwork(){const target=this.shadowRoot.getElementById('dynamic-map');if(!target)return;const cats=this._categories();if(!cats.length){target.innerHTML='<div class="empty">Nenhuma automação encontrada. Crie sua primeira rotina no assistente.</div>';return}
    const count=cats.length;const managed=this._settings().scope==='all'?cats.length:cats.filter(c=>this._settings().category_selection.includes(c.code)||this._rules().some(r=>r.category===c.code&&r.managed)||this._native().some(n=>n.category===c.code&&n.selected)).length;
    const colors=['#12e4f8','#00e6a0','#f9c954','#ac74ff','#58b9ff','#ff6b83'];
    const n=cats.map((c,i)=>{const angle=(i/count)*Math.PI*2-Math.PI/2;const ring=i%3===0?147:180;const x=500+ring*2.18*Math.cos(angle),y=220+ring*Math.sin(angle);const color=colors[i%colors.length];const selected=this._settings().scope==='all'||this._settings().category_selection.includes(c.code)||this._rules().some(r=>r.category===c.code&&r.managed)||this._native().some(n=>n.category===c.code&&n.selected);const opacity=selected?1:.32;
      return `<g style="cursor:pointer;opacity:${opacity}" data-open-category="${esc(c.code)}"><path data-cpauto-flow="1" d="M500,220 L${x.toFixed(1)},${y.toFixed(1)}" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 9" opacity=".52"/><circle cx="${x}" cy="${y}" r="${count>18?23:29}" stroke="${color}" stroke-width="2.4" fill="#061d2f"/><circle cx="${x}" cy="${y}" r="${count>18?28:34}" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="1.5"/><text x="${x}" y="${y-2}" fill="#e5faff" text-anchor="middle" font-size="${count>18?10:12}" font-weight="900">${esc(c.code.substring(0,8))}</text><text x="${x}" y="${y+13}" fill="${color}" text-anchor="middle" font-size="13" font-weight="800">${c.count}</text><title>${esc(this._categoryName(c.code))} • ${c.count} automações</title></g>`;
    }).join('');
    target.innerHTML=`<svg role="img" aria-label="Mapa dinâmico de ${cats.length} categorias" viewBox="0 0 1000 440" style="width:100%;height:min(400px,44vw);min-height:220px;display:block;background:radial-gradient(ellipse at center,#072537 0%,#04121f 50%,#020b15 100%);border:1px solid #1b5169;border-radius:12px"><defs><radialGradient id="cp-reactor"><stop offset="0%" stop-color="#106584"/><stop offset="90%" stop-color="#042339"/></radialGradient></defs><circle cx="500" cy="220" r="80" stroke="#00dfee" stroke-opacity=".25" stroke-width="10" stroke-dasharray="18 12" fill="none"><animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 500 220" to="360 500 220" dur="55s" repeatCount="indefinite" /></circle><circle cx="500" cy="220" r="66" stroke="#35dff4" stroke-width="2" fill="url(#cp-reactor)"/><circle cx="500" cy="220" r="54" stroke="#04e7a6" stroke-width="1.5" stroke-dasharray="4 8" fill="none"><animateTransform attributeName="transform" attributeType="XML" type="rotate" from="360 500 220" to="0 500 220" dur="26s" repeatCount="indefinite" /></circle><text x="500" y="208" fill="#e4faff" text-anchor="middle" font-weight="900" font-size="17">CORE</text><text x="500" y="227" fill="#64dffc" text-anchor="middle" font-size="12">${cats.length} categorias</text><text x="500" y="245" fill="#60ecb9" text-anchor="middle" font-size="13" font-weight="800">${managed} escolhidas</text>${n}</svg>`;
  }
  _renderRules(){
    const query=this._filter||'';
    const cat=this.shadowRoot.getElementById('filter-cat');
    const old=cat.value;
    cat.innerHTML='<option value="">Todas as categorias</option>'+this._categories().map(c=>`<option value="${esc(c.code)}">${esc(this._categoryName(c.code))}</option>`).join('');
    cat.value=old;
    const nat=this._native().filter(n=>(!query||[n.name,n.entity_id,n.category].join(' ').toLowerCase().includes(query))&&(!cat.value||n.category===cat.value));
    const div=this.shadowRoot.getElementById('native-table');
    div.innerHTML=nat.length?`<table><thead><tr><th>Acompanhar</th><th>Automação local</th><th>Categoria</th><th>Estado</th><th>Último disparo conhecido</th></tr></thead><tbody>${nat.map(n=>`<tr><td><input type="checkbox" class="nativebox" data-id="${esc(n.entity_id)}" ${n.selected?'checked':''}></td><td><b>${esc(n.name)}</b><div class="small muted">${esc(n.entity_id)}</div></td><td>${esc(this._categoryName(n.category))}</td><td class="${n.state==='on'?'ok':n.state==='off'?'warn':'muted'}">${esc(n.state==='on'?'Ativa':n.state==='off'?'Desativada':n.state)}</td><td>${esc(n.last_triggered?new Date(n.last_triggered).toLocaleString('pt-BR'):'Sem registro disponível')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nenhuma automação encontrada para este filtro.</div>';
    const oldRules=this.shadowRoot.getElementById('rule-table');
    if(oldRules)oldRules.replaceChildren();
  }

    _renderRuleSelect(){const sel=this.shadowRoot.getElementById('choose-rule'),selected=sel.value;sel.innerHTML='<option value="">Ou escolha uma automação para editar</option>'+this._rules().map(r=>`<option value="${esc(r.code)}">${esc(r.alias)} (${esc(r.code)})</option>`).join('');sel.value=this._editCode||selected||''}
  _updateEntities(){this.shadowRoot.getElementById('entities').innerHTML=Object.entries(this._hass?.states||{}).slice(0,3000).map(([id,v])=>`<option value="${esc(id)}">${esc(v?.attributes?.friendly_name||'')}</option>`).join('')}

    _blocksInit(){return {triggers:[{kind:'state',entity_id:'',to:'on'}],conditions:[],actions:[{kind:'light.turn_on',entity_id:''}]}}
  _blockHTML(section,i,model){const kind=model.kind|| (section==='actions'?'light.turn_on':'state');const options=section==='triggers'?triggerKinds:section==='conditions'?conditionKinds:actionKinds;const attr=(k,def='')=>esc(model[k]??def);let fields='';if(section==='triggers'){
      if(['state','numeric_state'].includes(kind))fields+=`<label>Entidade / dispositivo<input list="entities" data-f="entity_id" value="${attr('entity_id')}" placeholder="light.sala"></label>`;
      if(kind==='state')fields+=`<label>Estado desejado<input data-f="to" value="${attr('to','on')}" placeholder="on / off"></label>`;
      if(kind==='time')fields+=`<label>Horário<input type="time" step="1" data-f="at" value="${attr('at','08:00:00')}"></label>`;
      if(kind==='time_pattern')fields+=`<label>Repetir a cada (minutos)<input type="number" min="1" max="59" data-f="minutes" value="${attr('minutes',5)}"></label>`;
      if(kind==='numeric_state')fields+=`<label>Acima de<input type="number" step="any" data-f="above" value="${attr('above')}"></label><label>Abaixo de<input type="number" step="any" data-f="below" value="${attr('below')}"></label>`;
    }else if(section==='conditions'){
      if(['state','numeric_state'].includes(kind))fields+=`<label>Entidade<input list="entities" data-f="entity_id" value="${attr('entity_id')}"></label>`;
      if(kind==='state')fields+=`<label>Estado exigido<input data-f="state" value="${attr('state','on')}"></label>`;
      if(kind==='numeric_state')fields+=`<label>Acima de<input type="number" step="any" data-f="above" value="${attr('above')}"></label><label>Abaixo de<input type="number" step="any" data-f="below" value="${attr('below')}"></label>`;
      if(kind==='time')fields+=`<label>Início<input type="time" data-f="after" value="${attr('after','08:00')}"></label><label>Fim<input type="time" data-f="before" value="${attr('before','20:00')}"></label>`;
    }else {fields+=`<label>Entidade a controlar<input list="entities" data-f="entity_id" value="${attr('entity_id')}" placeholder="light.sala"></label>`}
    return `<div class="block" data-section="${section}" data-index="${i}"><header><b>${section==='triggers'?'QUANDO':section==='conditions'?'SE':'ENTÃO'} #${i+1}</b><button type="button" data-remove="${section}:${i}">Remover</button></header><div class="fields"><label>Tipo<select class="kind" data-f="kind">${selectOptions(options,kind)}</select></label>${fields}</div></div>`}
  _readBlocks(){if(this._readOnlyComplex)return;for(const section of ['triggers','conditions','actions']){const blocks=[];this.shadowRoot.querySelectorAll(`[data-section="${section}"]`).forEach(el=>{const obj={};el.querySelectorAll('[data-f]').forEach(input=>{obj[input.dataset.f]=input.value});blocks.push(obj)});this._blocks[section]=blocks}}
  _renderBlocks(){for(const sec of ['triggers','conditions','actions']){const target=this.shadowRoot.getElementById('blocks-'+sec);if(target)target.innerHTML=this._blocks[sec].map((x,i)=>this._blockHTML(sec,i,x)).join('')||'<p class="small muted">Nenhum item configurado.</p>'}}
  _designerHTML(){return `<div class="formgrid"><label>Nome da automação<input id="auto-name" value="${esc(this._editor?.alias||'')}"></label><label>Categoria (nova ou existente)<input id="auto-category" list="cat-datalist" value="${esc(this._editor?.cp_category||'CASA')}"></label><datalist id="cat-datalist">${this._categories().map(c=>`<option value="${esc(c.code)}">${esc(this._categoryName(c.code))}</option>`).join('')}</datalist><label class="wide">Descrição opcional<textarea id="auto-description">${esc(this._editor?.description||'')}</textarea></label><label>Comportamento quando disparar novamente<select id="auto-mode">${selectOptions([['single','Aguardar execução atual'],['restart','Reiniciar a rotina'],['queued','Colocar em fila'],['parallel','Executar em paralelo']],this._editor?.mode||'single')}</select></label></div>${this._readOnlyComplex?`<div class="explain warn"><b>Regra avançada importada.</b> Seus gatilhos e ações são preservados integralmente. Nesta versão, você pode modificar nome, descrição e modo sem alterar o comportamento técnico. A edição visual dessas sequências complexas ainda exige homologação específica.</div>`: ['triggers','conditions','actions'].map(sec=>`<div class="panel light"><h3>${sec==='triggers'?'1. Quando isso acontecer…':sec==='conditions'?'2. Somente se… (opcional)':'3. Então faça isto…'}</h3><div id="blocks-${sec}"></div><button type="button" data-add="${sec}">+ Adicionar ${sec==='triggers'?'gatilho':sec==='conditions'?'condição':'ação'}</button></div>`).join('')}<div class="toolrow"><button class="primary" data-action="validate">Validar sem executar</button><button class="primary" data-action="save">${this._editCode?'Salvar alterações':'Criar automação desativada'}</button>${this._editCode?`<button data-action="activate">Ativar somente esta regra</button><button data-action="deactivate">Desativar</button>`:''}${this._editCode&&this._editor?.cp_origin==='customer'?'<button data-action="delete" class="danger">Excluir</button>':''}</div>`}
  _renderDesigner(){this.shadowRoot.getElementById('editor').innerHTML=this._designerHTML();this._renderBlocks()}
  newRule(){this._editRevision=null;this._editCode='';this._editor={alias:'',description:'',cp_category:'CASA',cp_origin:'customer',mode:'single'};this._blocks=this._blocksInit();this._readOnlyComplex=false;this._renderDesigner();this._tab('builder');this._toast('Nova regra: preencha os campos e salve. Nada será executado automaticamente.')}
  _parsedBlocks(rule){const trigger=[],condition=[],action=[];for(const t of rule.triggers||[]){const kind=t.trigger||t.platform;if(!triggerKinds.some(x=>x[0]===kind)||!['state','numeric_state','time','time_pattern'].includes(kind))return null;
      if(kind==='state'){if(typeof t.entity_id!=='string'||t.from!==undefined)return null;trigger.push({kind,entity_id:t.entity_id,to:t.to||''})}
      if(kind==='time'){if(typeof t.at!=='string')return null;trigger.push({kind,at:t.at})}
      if(kind==='time_pattern'){const min=String(t.minutes||'').replace('/','');if(!/^\d+$/.test(min))return null;trigger.push({kind,minutes:Number(min)})}
      if(kind==='numeric_state'){if(typeof t.entity_id!=='string')return null;trigger.push({kind,entity_id:t.entity_id,above:t.above||'',below:t.below||''})}
    }
    for(const c of rule.conditions||[]){const kind=c.condition;if(!conditionKinds.some(x=>x[0]===kind))return null;if(!['state','numeric_state','time'].includes(kind))return null;if(typeof c.entity_id!=='string'&&kind!=='time')return null;condition.push({kind,entity_id:c.entity_id||'',state:c.state||'',above:c.above??'',below:c.below??'',after:c.after||'',before:c.before||''})}
    for(const a of rule.actions||[]){const kind=a.action||a.service;if(!actionKinds.some(x=>x[0]===kind)||typeof a.target?.entity_id!=='string'||a.data&&Object.keys(a.data).length)return null;action.push({kind,entity_id:a.target.entity_id})}
    return {triggers:trigger,conditions:condition,actions:action}}
  async loadRule(code){if(!code)return;try{const r=await this.ws('cloudpelizzon/automation/get',{code});this._editor=r.rule;this._editCode=code;this._editRevision=r.revision;this._uncertainMutation=false;const blocks=this._parsedBlocks(r.rule);this._readOnlyComplex=!blocks;this._blocks=blocks||{triggers:[],conditions:[],actions:[]};this._renderDesigner();this._tab('builder');this._toast(this._readOnlyComplex?'Configuração complexa preservada. Edite campos gerais ou escolha outra regra simples.':'Regra carregada para edição visual. Desative antes de salvar.')}catch(e){this._toast('Erro ao abrir regra: '+e.message,true)}}
  _payload(){const alias=this.shadowRoot.getElementById('auto-name').value.trim();const category=this.shadowRoot.getElementById('auto-category').value.trim().toUpperCase();const description=this.shadowRoot.getElementById('auto-description').value.trim();const mode=this.shadowRoot.getElementById('auto-mode').value;if(!alias)throw Error('Dê um nome para sua automação.');if(!/^[A-Z][A-Z0-9]{1,7}$/.test(category))throw Error('A categoria deve ter 2 a 8 letras ou números.');if(this._editCode&&category!==this._editor.cp_category)throw Error('Categoria de uma regra existente não pode mudar neste piloto. Crie outra regra na categoria desejada.');if(this._readOnlyComplex)return {...this._editor,alias,description,mode};
    this._readBlocks();const triggers=this._blocks.triggers.map(x=>{if(x.kind==='state')return {trigger:'state',entity_id:x.entity_id,to:x.to};if(x.kind==='time')return {trigger:'time',at:x.at};if(x.kind==='time_pattern')return {trigger:'time_pattern',minutes:'/'+Math.max(1,Math.min(59,parseInt(x.minutes)||5))};if(x.kind==='numeric_state'){const t={trigger:'numeric_state',entity_id:x.entity_id};if(x.above!=='')t.above=Number(x.above);if(x.below!=='')t.below=Number(x.below);return t}throw Error('Gatilho não reconhecido')});
    const conditions=this._blocks.conditions.filter(x=>x.kind!=='none').map(x=>{if(x.kind==='state')return {condition:'state',entity_id:x.entity_id,state:x.state};if(x.kind==='time')return {condition:'time',after:x.after,before:x.before};if(x.kind==='numeric_state'){const c={condition:'numeric_state',entity_id:x.entity_id};if(x.above!=='')c.above=Number(x.above);if(x.below!=='')c.below=Number(x.below);return c}throw Error('Condição não reconhecida')});
    const actions=this._blocks.actions.map(x=>({action:x.kind,target:{entity_id:x.entity_id}}));if(!triggers.length||!actions.length)throw Error('Adicione pelo menos um gatilho e uma ação.');for(const t of [...triggers,...conditions,...actions])if('entity_id'in t&&!t.entity_id||t.target&&!t.target.entity_id)throw Error('Selecione uma entidade para cada etapa.');return {...this._editor,alias,description,mode,category,triggers,conditions,actions}}
  async _saveScope(origin){
    const current=this._settings();
    const catSel=[...this.shadowRoot.querySelectorAll('.catbox:checked')].map(e=>e.dataset.category);
    const names=Object.fromEntries([...this.shadowRoot.querySelectorAll('.catname')].map(e=>[e.dataset.category,e.value.trim()||e.dataset.category]));
    const prev=new Set(this._native().filter(n=>n.selected).map(n=>n.entity_id));
    if(this._ruleBulk==='all')for(const n of this._native())prev.add(n.entity_id);
    else if(this._ruleBulk==='none')prev.clear();
    else this.shadowRoot.querySelectorAll('.nativebox').forEach(e=>e.checked?prev.add(e.dataset.id):prev.delete(e.dataset.id));
    const scope=this._scopeDraft||current.scope;
    const payload={scope,category_selection:origin==='categories'?catSel:current.category_selection,
      native_selection:[...prev],category_names:origin==='categories'?names:current.category_names||{},
      // Preserve existing module-created rule selection; never activate or modify private imports.
      rule_selection:current.rule_selection||[],native_visible:true};
    await this.ws('cloudpelizzon/automation/settings',{settings:payload});
    this._scopeDraft=null;this._ruleBulk=null;
    await this.refresh(true);
    this._toast('Categorias e automações selecionadas. Nenhuma automação nativa foi modificada.');
  }

  _exportConfiguration(){
    // Explicit local download: never dump _hass, tokens, YAML or private rules.
    const s=this._settings(),strings=(values,pattern,max)=>Array.isArray(values)?values.filter(x=>typeof x==='string'&&pattern.test(x)).slice(0,max):[];
    const names={};
    for(const [key,value] of Object.entries(s.category_names||{}).slice(0,100)){
      if(/^[A-Z][A-Z0-9]{1,7}$/.test(key)&&typeof value==='string')names[key]=value.slice(0,80);
    }
    const output={schema:'cp.automation.client.export.v1',exported_at:new Date().toISOString(),
      settings:{scope:s.scope==='selected'?'selected':'all',native_visible:true,
        category_selection:strings(s.category_selection,/^[A-Z][A-Z0-9]{1,7}$/,100),
        native_selection:strings(s.native_selection,/^automation\.[a-z0-9_]+$/,2000),
        rule_selection:strings(s.rule_selection,/^CUS-[0-9]{8}$/,1000),category_names:names},
      native_automations:this._native().slice(0,2000).map(n=>({entity_id:String(n.entity_id),
        name:String(n.name).slice(0,350),category:String(n.category).slice(0,8),
        state:String(n.state).slice(0,64),selected:n.selected===true,
        last_triggered:typeof n.last_triggered==='string'?n.last_triggered.slice(0,64):null})),
      module_rules:this._rules().slice(0,1000).map(r=>({code:r.code,alias:String(r.alias||'').slice(0,350),
        category:String(r.category||'CASA').slice(0,8),revision:Number.isInteger(r.revision)?r.revision:null,
        active:r.active===true}))};
    const raw=JSON.stringify(output,null,2);
    if(raw.length>2097152)throw Error('A exportação excedeu o limite permitido.');
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
    let anchor;
    try{
      anchor=document.createElement('a');anchor.href=url;
      anchor.download='cloudpelizzon-automacoes-'+output.exported_at.slice(0,10)+'.json';
      document.body.appendChild(anchor);anchor.click();
    }finally{if(anchor)anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0)}
    this._toast('Configurações e inventário exportados neste navegador.');
  }

  async _loadPermissions(){
    const value=await this.ws('cloudpelizzon/automation/permissions');
    const states=this._hass?.states||{},keys=[...new Set([...Object.keys(states),...value.policy.reads,...value.policy.targets])].filter(k=>/^[a-z_]+\.[a-z0-9_]+$/.test(k)).sort();
    for(const [id,selected,allowed] of [['cp-read-permissions',value.policy.reads,()=>true],['cp-effect-permissions',value.policy.targets,k=>/^(light|switch|input_boolean)\./.test(k)]]){
      this.shadowRoot.getElementById(id).innerHTML=keys.filter(allowed).map(k=>`<option value="${esc(k)}" ${selected.includes(k)?'selected':''}>${esc(states[k]?.attributes?.friendly_name||k)} · ${esc(k)}</option>`).join('');
    }
    this.shadowRoot.getElementById('cp-execution-status').textContent=value.connected?'Conexão com o executor disponível.':'Aguardando conexão com o executor.';
  }
  async _click(event){
    const node=event.target?.closest?.('[data-tab],[data-action],[data-open-category],[data-add],[data-remove]');
    if(!node||!this.shadowRoot.contains(node)||node.disabled)return;
    if(this._busyEditor)return;
    if(node.dataset.tab){this._tab(node.dataset.tab);if(node.dataset.tab==='settings')await this._loadPermissions();return}
    if(node.dataset.openCategory){this._tab('rules');this.shadowRoot.getElementById('filter-cat').value=node.dataset.openCategory;this._renderRules();return}
    if(node.dataset.add){const section=node.dataset.add;if(!['triggers','conditions','actions'].includes(section))return;this._readBlocks();this._blocks[section].push({kind:section==='actions'?'light.turn_on':'state'});this._renderBlocks();return}
    if(node.dataset.remove){const [section,text]=node.dataset.remove.split(':');const index=Number(text);if(!['triggers','conditions','actions'].includes(section)||!Number.isInteger(index)||index<0)return;this._readBlocks();this._blocks[section].splice(index,1);this._renderBlocks();return}
    const action=node.dataset.action;
    try{
      if(action==='toggleOverview'){this._overviewExpanded=!this._overviewExpanded;try{window.localStorage.setItem('cp_auto_overview_expanded',this._overviewExpanded?'1':'0')}catch(_e){}this._updateManagementVisibility();return}
      if(action==='new'){this.newRule();return}
      if(action==='refresh'){await this.refresh(true);return}
      if(['all','selected','clear'].includes(action)){this._scopeDraft=action==='all'?'all':'selected';if(action!=='selected')this.shadowRoot.querySelectorAll('.catbox').forEach(e=>{e.checked=action==='all'});return}
      if(['ruleAll','ruleNone'].includes(action)){this._ruleBulk=action==='ruleAll'?'all':'none';this._scopeDraft='selected';this.shadowRoot.querySelectorAll('.nativebox').forEach(e=>{e.checked=action==='ruleAll'});return}
      if(action==='saveCategories'||action==='saveRules'){this._busyEditor=true;await this._saveScope(action==='saveCategories'?'categories':'rules');return}
      if(action==='permissionsSave'){
        const reads=[...this.shadowRoot.getElementById('cp-read-permissions').selectedOptions].map(x=>x.value);
        const targets=[...this.shadowRoot.getElementById('cp-effect-permissions').selectedOptions].map(x=>x.value);
        if(!window.confirm('Autorizar o envio dos estados selecionados e comandos somente para os dispositivos selecionados?'))return;
        this._busyEditor=true;await this.ws('cloudpelizzon/automation/permissions/save',{policy:{reads,targets},confirmed:true});await this._loadPermissions();this._toast('Permissões salvas. Ative individualmente as regras desejadas.');return;
      }
      if(action==='activate'||action==='deactivate'){
        if(!this._editCode||!Number.isInteger(this._editRevision))throw Error('Abra uma regra salva antes de alterar sua ativação.');
        if(!window.confirm(action==='activate'?'Ativar somente esta regra? Ela poderá comandar os dispositivos autorizados em Preferências.':'Desativar somente esta regra?'))return;
        this._busyEditor=true;const value=await this.ws('cloudpelizzon/automation/'+action,{code:this._editCode,revision:this._editRevision});
        if(value.active!==(action==='activate'))throw Error('Ativação não confirmada. Atualize o status antes de tentar novamente.');
        await this.refresh(true);this._toast(action==='activate'?'Ativação solicitada ao executor. Acompanhe a conexão em Preferências.':'Regra desativada.');return;
      }
      if(action==='export'){this._exportConfiguration();return}
      if(!['validate','save','delete'].includes(action))return;
      this._busyEditor=true;
      if(action==='validate'){
        const result=await this.ws('cloudpelizzon/automation/validate',{code:this._editCode||'',rule:this._payload()});
        if(result.valid!==true||result.executed!==false)throw Error('Resposta de validação inválida.');
        this._toast('Validação concluída. Nenhuma ação foi executada.');return
      }
      if(this._uncertainMutation){this._toast('O resultado anterior é incerto. Atualize a lista e abra a regra antes de repetir a alteração.',true);return}
      if(this._editCode&&(!Number.isInteger(this._editRevision)||this._editRevision<1))throw Error('Reabra a regra para obter a revisão atual.');
      if(action==='delete'){
        if(!this._editCode||!window.confirm('Excluir esta regra criada no módulo? Suas automações nativas não serão alteradas.'))return;
        this._uncertainMutation=true;
        const result=await this.ws('cloudpelizzon/automation/delete',{code:this._editCode,revision:this._editRevision});
        if(result.deleted!==true)throw Error('Exclusão não confirmada.');
        this._uncertainMutation=false;this.newRule();await this.refresh(true);this._toast('Regra excluída.');return
      }
      const rule=this._payload();
      const expectedRevision=this._editCode?this._editRevision+1:1;
      const args=this._editCode?{code:this._editCode,revision:this._editRevision,rule}:{rule};
      this._uncertainMutation=true;
      const result=await this.ws(this._editCode?'cloudpelizzon/automation/save':'cloudpelizzon/automation/create',args);
      if((result.saved!==true&&result.created!==true)||result.active!==false||!result.rule||result.revision!==expectedRevision||!/^CUS-[0-9]{8}$/.test(result.code))throw Error('Gravação não confirmada.');
      this._editor=result.rule;this._editCode=result.code;this._editRevision=result.revision;this._uncertainMutation=false;
      const blocks=this._parsedBlocks(result.rule);this._readOnlyComplex=!blocks;this._blocks=blocks||{triggers:[],conditions:[],actions:[]};
      this._renderDesigner();await this.refresh(true);this._toast('Regra salva e mantida desativada.');
    }catch(error){this._toast(this._uncertainMutation?'Não foi possível confirmar a alteração. Atualize a lista e reabra a regra; nenhuma tentativa automática será feita.':'Não foi possível concluir: '+error.message,true)}
    finally{this._busyEditor=false}
  }

    _change(e){const node=e.target;if(node.classList?.contains('kind')){this._readBlocks();const block=node.closest('[data-section]');const s=block.dataset.section;const i=Number(block.dataset.index);this._blocks[s][i]={kind:node.value};this._renderBlocks();return}if(node.matches('.catbox,.rulebox,.nativebox')){this._scopeDraft='selected'}}
}
if(!customElements.get('cloudpelizzon-automation-panel'))customElements.define('cloudpelizzon-automation-panel',CloudPelizzonAutomationPanel);
