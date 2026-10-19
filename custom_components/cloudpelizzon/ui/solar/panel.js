import "/cloudpelizzon-energy/frontend/energy-card.js?v=974f2c679f2d";

class CloudPelizzonEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:"open"});
    this._hass=null;
    this._loaded=false;
    this._loading=false;
    this._mode="dashboard";
    this._cfg=null;
    this._normalized=null;
    this._discovery={power:[],energy:[],suggestions:{}};
    this._error="";
    this._status=null;
    this._autoSummary={};
  }

  set hass(value){
    this._hass=value;
    if(!this._loaded&&!this._loading)this._load();
    this._propagate();
  }

  get hass(){return this._hass;}

  _isAdmin(){
    return Boolean(this._hass?.user?.is_admin);
  }

  connectedCallback(){
    this._resizeViewport=()=>this._fitViewport();window.addEventListener('resize',this._resizeViewport);
    this._render();
    if(this._hass&&!this._loaded&&!this._loading)this._load();
  }

  disconnectedCallback(){window.removeEventListener('resize',this._resizeViewport);this._viewportObserver?.disconnect();}
  _fitViewport(){
    const shell=this.shadowRoot?.querySelector('.energy-shell');if(!shell)return;
    const top=Math.max(0,this.getBoundingClientRect().top),height=Math.max(260,window.innerHeight-top-3);
    if(shell.style.height!==height+'px')shell.style.height=height+'px';
  }

  async _ws(type,payload={}){
    if(!this._hass)throw new Error("Home Assistant indisponível.");
    return await this._hass.callWS({type,...payload});
  }

  _esc(value){
    return String(value??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  async _load(){
    this._loading=true;
    this._error="";
    this._render();

    try{
      const [cfg,status]=await Promise.all([
        this._ws("cloudpelizzon/energy/config/get"),
        this._ws("cloudpelizzon/energy/status"),
      ]);

      this._cfg=cfg.config||{};
      this._normalized=cfg.normalized_entities||{};
      this._status=status||{};

      try{
        this._discovery=await this._ws("cloudpelizzon/energy/discover");
      }catch(_error){
        this._discovery={power:[],energy:[],suggestions:{}};
      }

      if(
        !this._cfg?.configured
        && !(this._cfg?.generation||[]).length
        && !(this._cfg?.boards||[]).length
        && !this._cfg?.site?.house_power_entity
      ){
        this._autoDetect(false);
      }

      this._loaded=true;
      this._mode=this._cfg?.configured?"dashboard":"config";
    }catch(error){
      this._error=error?.message||String(error);
    }finally{
      this._loading=false;
      this._render();
      this._propagate();
    }
  }

  _emptyConfig(){
    return {
      configured:false,
      site:{
        name:"Instalação",
        grid_provider:"",
        phases:1,
        house_power_entity:"",
        house_energy_entity:"",
        generation_energy_entity:"",
      },
      grid:{
        mode:"derived",
        net_power_entity:"",
        net_sign:"import_positive",
        import_power_entity:"",
        export_power_entity:"",
        import_energy_entity:"",
        export_energy_entity:"",
      },
      generation:[],
      boards:[],
      ui:{profile:"cloudpelizzon_v1"},
    };
  }

  _ensureCfg(){
    const defaults=this._emptyConfig();
    if(!this._cfg)this._cfg=defaults;
    this._cfg.site={...defaults.site,...(this._cfg.site||{})};
    this._cfg.grid={...defaults.grid,...(this._cfg.grid||{})};
    this._cfg.generation=Array.isArray(this._cfg.generation)?this._cfg.generation:[];
    this._cfg.boards=Array.isArray(this._cfg.boards)?this._cfg.boards:[];
    this._cfg.ui={...defaults.ui,...(this._cfg.ui||{})};
  }


  _normText(value){
    return String(value||"")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g,"")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g," ")
      .trim();
  }

  _rowText(row){
    return this._normText(`${row?.entity_id||""} ${row?.name||""}`);
  }

  _hasAny(text,words=[]){
    const base=this._normText(text);
    return (words||[]).some(word=>base.includes(this._normText(word)));
  }

  _matchEnergy(powerEntity, role="generic"){
    if(!powerEntity)return "";

    const base=this._normText(
      String(powerEntity)
        .replace(/^sensor\./,"")
        .replace(/(?:_power|_potencia|_potência)$/i,"")
    );

    const rows=Array.isArray(this._discovery?.energy)?this._discovery.energy:[];
    const scoreRow=row=>{
      const text=this._rowText(row);
      if(role==='consumption'&&(!this._hasAny(text,['casa','house','consumo total','total consumption','consumption'])||this._hasAny(text,['tomada','plug'])))return -100;
      if(role==='board'&&!this._hasAny(text,['quadro','qd','board']))return -100;
      if(role==='source'){
        const micro=/\b(micro|microinversor|deye|hoymiles)\b/.test(base),targetMicro=/\b(micro|microinversor|deye|hoymiles)\b/.test(text);
        if(micro!==targetMicro||!this._hasAny(text,['inversor','inverter','micro','solar','geracao','production','produced']))return -100;
      }
      if(role==='grid_import'&&!this._hasAny(text,['import','importacao','importada']))return -100;
      if(role==='grid_export'&&!this._hasAny(text,['export','exportacao','exportada','injecao']))return -100;
      if(role==='load'){
        const tokens=base.split(' ').filter(x=>x.length>2&&!['sensor','power','potencia','energy','energia','total','today','hoje','consumo'].includes(x));
        if(!tokens.length||!tokens.some(token=>text.split(' ').includes(token)))return -100;
      }
      let score=0;

      for(const token of base.split(" ").filter(x=>x.length>2)){
        if(text.includes(token))score+=8;
      }

      if(["total","total_increasing"].includes(String(row.state_class||"")))score+=10;
      if(this._hasAny(text,["energia","energy","kwh","wh"]))score+=4;

      if(["generic","generation","source","board","consumption","grid_import","grid_export"].includes(role)){
        if(this._hasAny(text,["hoje","today","daily","dia","diaria","diario","day"]))score+=22;
        if(this._hasAny(text,["mes","month","ano","year"]))score-=18;
        if(this._hasAny(text,["vida util","life","lifetime","total life","lifetime total"]))score-=30;
      }

      if(role==="generation"||role==="source"){
        if(this._hasAny(text,["solar","geracao","generation","produced","inversor","inverter","microinversor"]))score+=12;
        if(this._hasAny(text,["consumo","consumption","grid","rede","copel","import","export","quadro"]))score-=24;
      }
      if(role==="consumption"||role==="board"){
        if(this._hasAny(text,["consumo","consumption","quadro","qd","house","casa"]))score+=10;
        if(this._hasAny(text,["solar","geracao","generation","grid","rede","copel","import","export"]))score-=22;
      }
      if(role==="grid_import"){
        if(this._hasAny(text,["importacao","import","copel","grid","rede"]))score+=14;
        if(this._hasAny(text,["exportacao","export"]))score-=18;
      }
      if(role==="grid_export"){
        if(this._hasAny(text,["exportacao","export","injecao","injection","copel","grid","rede"]))score+=14;
        if(this._hasAny(text,["importacao","import"]))score-=18;
      }

      return score;
    };

    const ranked=rows
      .map(row=>({row,score:scoreRow(row)}))
      .sort((a,b)=>b.score-a.score||String(a.row.name||"").localeCompare(String(b.row.name||"")));

    return ranked[0]?.score>0 ? String(ranked[0].row.entity_id||"") : "";
  }

  _bestEnergyByHint(kind="generation"){
    const rows=Array.isArray(this._discovery?.energy)?this._discovery.energy:[];
    const rank=row=>{
      const t=this._rowText(row);
      let score=0;
      if(this._hasAny(t,["hoje","today","daily","dia","diaria","diario","day"]))score+=30;
      if(["total","total_increasing"].includes(String(row.state_class||"")))score+=8;

      if(kind==='generation'&&!this._hasAny(t,['geracao total','generation total','solar total','energia solar gerada','solar energia gerada','producao solar total']))return -100;
      if(kind==='consumption'&&(!this._hasAny(t,['consumo total','consumo casa','house','casa','residencia','total consumption'])||this._hasAny(t,['tomada','plug','quadro','qd1','qd2'])))return -100;
      if(kind==='grid_import'&&!this._hasAny(t,['importacao','import','importada']))return -100;
      if(kind==='grid_export'&&!this._hasAny(t,['exportacao','export','exportada','injecao']))return -100;
      if(kind==="generation"){
        if(this._hasAny(t,["geracao total","generation total","solar hoje","solar total hoje","energia solar gerada","producao solar","geracao hoje"]))score+=34;
        if(this._hasAny(t,["solar","geracao","generation","produced","inversor","microinversor"]))score+=14;
        if(this._hasAny(t,["vida util","life","lifetime","mes","month","ano","year"]))score-=28;
      }
      if(kind==="consumption"){
        if(this._hasAny(t,["consumo total","consumption total","energia consumida hoje","consumo hoje"]))score+=34;
        if(this._hasAny(t,["consumo","consumption","casa","house","residencia"]))score+=14;
        if(this._hasAny(t,["vida util","life","lifetime","mes","month","ano","year"]))score-=28;
      }
      if(kind==="grid_import"){
        if(this._hasAny(t,["energia importada","import energy","importacao","copel importada","grid import"]))score+=34;
        if(this._hasAny(t,["copel","grid","rede"]))score+=10;
        if(this._hasAny(t,["exportacao","export"]))score-=26;
      }
      if(kind==="grid_export"){
        if(this._hasAny(t,["energia exportada","export energy","exportacao","copel exportada","grid export","injecao"]))score+=34;
        if(this._hasAny(t,["copel","grid","rede"]))score+=10;
        if(this._hasAny(t,["importacao","import"]))score-=26;
      }
      return score;
    };

    const ranked=rows
      .map(row=>({row,score:rank(row)}))
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||String(a.row.name||"").localeCompare(String(b.row.name||"")));

    return ranked[0]?.row?.entity_id||"";
  }


  async _importProduction(){
    this._detecting=true;this._detectFeedback='Lendo configuração de medição da produção…';this._render();
    try{const result=await this._ws('cloudpelizzon/energy/production_config');this._cfg=result.config;this._ensureCfg();this._detectFeedback='Configuração da produção carregada. Revise os sensores e clique em Salvar. Licenças e trials foram preservadas.';}
    catch(error){this._detectFeedback='Não foi possível importar: '+String(error?.message||error);}
    finally{this._detecting=false;this._render();}
  }

  async _refreshDiscovery(){
    this._syncDraft();this._detecting=true;this._detectFeedback='Consultando sensores de energia do Home Assistant…';this._render();
    try{
      this._discovery=await this._ws('cloudpelizzon/energy/discover');
      let imported=false;
      if(this._hass?.states?.['sensor.cloudpelizzon_homolog_mirror']){
        try{const source=await this._ws('cloudpelizzon/energy/production_config');
          if(source.config?.configured&&((source.config.generation||[]).length||(source.config.boards||[]).length)){
            this._cfg=source.config;this._ensureCfg();imported=true;
          }
        }catch(_){/* No source configuration: retain normal local discovery. */}
      }
      if(!imported)this._autoDetect(false);
      const n=(this._discovery.power||[]).length,e=(this._discovery.energy||[]).length;
      const loads=(this._cfg.boards||[]).reduce((sum,b)=>sum+(b.loads||[]).length,0);
      this._detectFeedback=`${imported?'Mapeamento da produção recuperado':'Detecção concluída'}: ${this._cfg.generation.length} fontes, ${this._cfg.boards.length} quadros, ${loads} cargas. ${n} sensores de potência e ${e} de energia disponíveis. Revise e salve.`;
    }
    catch(error){this._detectFeedback=`Não foi possível detectar: ${error?.message||String(error)}`;}
    finally{this._detecting=false;this._render();}
  }

  _autoDetect(render=true){
    this._ensureCfg();

    const power=Array.isArray(this._discovery?.power)?this._discovery.power:[];
    const energy=Array.isArray(this._discovery?.energy)?this._discovery.energy:[];

    const rowText=row=>this._rowText(row);
    const hasAny=(txt,words)=>this._hasAny(txt,words);

    const sortScored=rows=>rows
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||String(a.row.name||"").localeCompare(String(b.row.name||"")));

    const uniqueByKey=(items,keyFn)=>{
      const out=[];
      const seen=new Set();
      for(const item of items){
        const key=String(keyFn(item)||"").trim();
        if(!key||seen.has(key))continue;
        seen.add(key);
        out.push(item);
      }
      return out;
    };

    const boardKey=text=>{
      const qd=text.match(/\bqd\s*(\d+)\b/);
      if(qd)return `qd_${qd[1]}`;
      const quadro=text.match(/quadro\s*(\d+)/);
      if(quadro)return `quadro_${quadro[1]}`;
      return text
        .replace(/\b(sensor|power|potencia|potencia consumida|telemetria|energia|energy|consumo|consumida|quadro|board|fase|phase|l1|l2|l3)\b/g," ")
        .replace(/\s+/g," ")
        .trim();
    };

    const sourceKey=text=> text
      .replace(/\b(sensor|power|potencia|energia|energy|geracao|generation|solar|inversor|inverter|microinversor|micro inverter|today|hoje|daily|ct|ctl|external|battery|l1|l2|l3|fase|phase)\b/g," ")
      .replace(/\s+/g," ")
      .trim() || (text.includes("microinversor")?"microinversor":text.includes("inversor")?"inversor":"source");

    const generationScored=sortScored(power.map(row=>{
      const t=rowText(row);
      let score=0;
      if(/\b(micro|microinversor|microinverter|hoymiles|deye)\b/.test(t)||t.includes("micro inverter"))score+=44;
      if(/^sensor\.(inverter|micro)_power$/.test(row.entity_id))score+=50;
      if(t.includes("inversor")||t.includes("inverter"))score+=38;
      if(t.includes("solar"))score+=24;
      if(/\bpv\b/.test(t))score+=18;
      if(t.includes("geracao")||t.includes("generation"))score+=18;
      if(t.includes("production")||t.includes("produced"))score+=16;
      if(t.includes("power")||t.includes("potencia"))score+=4;

      if(hasAny(t,["battery","bateria","ct l1","ct l2","ctl 1","ctl 2","external ct","fase 1","fase 2","phase 1","phase 2","telemetria"]))score-=28;
      if(hasAny(t,["rede","grid","copel","importacao","import","exportacao","export"]))score-=42;
      if(/\bqd ?\d+\b/.test(t)||hasAny(t,["quadro","distribution board"]))score-=38;
      if(hasAny(t,["consumo","consumption","casa","house","home"]))score-=30;
      if(hasAny(t,["temperatura","temperature","frequencia","frequency","tensao","voltage","corrente","current","fator","factor"]))score-=32;

      return {row,score,text:t};
    }));

    let generationPick=uniqueByKey(generationScored.filter(x=>x.score>=20), x=>sourceKey(x.text));
    const cleanPrimary=generationPick.filter(x=>!hasAny(x.text,["battery","bateria","ct l1","ct l2","ctl 1","ctl 2","external ct","fase 1","fase 2","phase 1","phase 2","telemetria"]));
    if(cleanPrimary.length)generationPick=cleanPrimary;
    const isMicro=item=>/\b(micro|microinversor|microinverter|hoymiles|deye)\b/.test(item.text)||item.text.includes('micro inverter');
    const primary=generationPick.find(item=>!isMicro(item)),micro=generationPick.find(isMicro);
    generationPick=[primary,micro].filter(Boolean);
    if(!generationPick.length)generationPick=generationScored.filter(x=>x.score>=20).slice(0,2);

    const boardScored=sortScored(power.map(row=>{
      const t=rowText(row);
      let score=0;
      if(/\bqd ?\d+\b/.test(t))score+=46;
      if(/quadro ?\d+/.test(t))score+=40;
      if(t.includes("potencia consumida")||t.includes("consumo quadro"))score+=28;
      if(t.includes("quadro"))score+=20;
      if(t.includes("distribution board"))score+=18;
      if(t.includes("power")||t.includes("potencia"))score+=4;
      if(t.includes("telemetria"))score-=6;

      if(hasAny(t,["solar","inversor","inverter","microinversor","geracao","generation"]))score-=34;
      if(hasAny(t,["rede","grid","copel","importacao","import","exportacao","export"]))score-=34;
      if(hasAny(t,["temperatura","temperature","frequencia","frequency","tensao","voltage","corrente","current","fator","factor"]))score-=28;

      return {row,score,text:t};
    }));

    const boardPick=uniqueByKey(boardScored.filter(x=>x.score>=20), x=>boardKey(x.text)).slice(0,2);

    const houseScored=sortScored(power.map(row=>{
      const t=rowText(row);
      let score=0;
      if(hasAny(t,['tomada','plug','socket']))return {row,score:-100,text:t};
      if(/\bcasa\b.*\bpotencia\b.*\btotal\b/.test(t))score+=46;
      if(hasAny(t,["consumo total","consumption total","total consumption"]))score+=46;
      if(hasAny(t,["potencia da casa","potencia casa","house power","home power"]))score+=34;
      if(hasAny(t,["consumo casa","consumo residencia","residencia consumo"]))score+=30;
      if(t.includes("consumo"))score+=12;
      if(t.includes("casa")||t.includes("house")||t.includes("home"))score+=10;

      if(/\bqd ?\d+\b/.test(t)||t.includes("quadro"))score-=32;
      if(hasAny(t,["solar","inversor","inverter","microinversor","geracao","generation"]))score-=34;
      if(hasAny(t,["rede","grid","copel","importacao","import","exportacao","export"]))score-=30;
      if(hasAny(t,["tomada","plug","tv","geladeira","lavadora","washer","freezer","router","roteador"]))score-=22;

      return {row,score,text:t};
    }));

    const housePick=houseScored.find(x=>x.score>=22)?.row||null;

    const bestGrid=(mode)=>{
      const scored=sortScored(power.map(row=>{
        const t=rowText(row);
        let score=0;
        if(mode==="net"){
          if(hasAny(t,["potencia liquida","liquid power","net power","potencia net"]))score+=46;
          if(hasAny(t,["rede","grid","copel","concessionaria"]))score+=14;
          if(hasAny(t,["importacao","import","exportacao","export"]))score-=14;
        }
        if(mode==="import"){
          if(hasAny(t,["importacao","import power","grid import","rede import","copel importacao"]))score+=46;
          if(hasAny(t,["rede","grid","copel","concessionaria"]))score+=12;
          if(hasAny(t,["exportacao","export"]))score-=28;
        }
        if(mode==="export"){
          if(hasAny(t,["exportacao","export power","grid export","rede export","injecao","injection","copel exportacao"]))score+=46;
          if(hasAny(t,["rede","grid","copel","concessionaria"]))score+=12;
          if(hasAny(t,["importacao","import"]))score-=28;
        }
        if(hasAny(t,["solar","inversor","inverter","microinversor","geracao","generation","quadro","qd1","qd2"]))score-=28;
        return {row,score,text:t};
      }));
      return scored.find(x=>x.score>=24)?.row||null;
    };

    const net=bestGrid("net");
    const imp=bestGrid("import");
    const exp=bestGrid("export");

    const generation=generationPick.map((item,index)=>({
      id:`source_${index+1}`,
      name:String(item.row.name||`Fonte ${index+1}`).replace(/\s+(power|potencia|potência)$/i,"").trim(),
      manufacturer:"",
      model:"",
      power_entity:item.row.entity_id,
      energy_entity:this._matchEnergy(item.row.entity_id,"source"),
      power_transform:"absolute",
      loads:[],
    }));

    const boards=boardPick.map((item,index)=>({
      id:`board_${index+1}`,
      name:String(item.row.name||`Quadro ${index+1}`).replace(/\s+(power|potencia|potência)$/i,"").trim(),
      manufacturer:"",
      model:"",
      power_entity:item.row.entity_id,
      energy_entity:this._matchEnergy(item.row.entity_id,"board"),
      power_transform:"positive",
      loads:[],
    }));

    this._cfg.generation=generation;
    this._cfg.boards=boards;
    this._cfg.site.house_power_entity=housePick?.entity_id||"";
    this._cfg.site.house_energy_entity=this._bestEnergyByHint("consumption") || (housePick?this._matchEnergy(housePick.entity_id,"consumption"):"");
    this._cfg.site.generation_energy_entity=this._bestEnergyByHint("generation");
    this._cfg.grid.net_power_entity=net?.entity_id||"";
    this._cfg.grid.import_power_entity=imp?.entity_id||"";
    this._cfg.grid.export_power_entity=exp?.entity_id||"";
    this._cfg.grid.import_energy_entity=this._bestEnergyByHint("grid_import") || (imp?this._matchEnergy(imp.entity_id,"grid_import"):"");
    this._cfg.grid.export_energy_entity=this._bestEnergyByHint("grid_export") || (exp?this._matchEnergy(exp.entity_id,"grid_export"):"");
    this._cfg.grid.mode=(net||imp||exp)?"metered":"derived";
    this._cfg.grid.net_sign="import_positive";

    const providerText=this._normText([...power.map(row=>rowText(row)), ...energy.map(row=>rowText(row))].join(" "));
    const providers=[["Copel","copel"],["Enel","enel"],["Cemig","cemig"],["Celesc","celesc"],["Neoenergia","neoenergia"],["Equatorial","equatorial"],["Light","light"],["Energisa","energisa"]];
    if(!String(this._cfg.site.grid_provider||"").trim()){
      const found=providers.find(([,token])=>providerText.includes(token));
      if(found)this._cfg.site.grid_provider=found[0];
    }

    const consumptionMode=housePick ? `Consumo total: ${housePick.name||housePick.entity_id}` : boards.length ? `Consumo calculado por ${boards.length} quadro(s)` : "Consumo não identificado automaticamente";
    const gridMode=net ? `Rede líquida: ${net.name||net.entity_id}` : (imp||exp) ? `Rede: importação/exportação identificadas` : "Rede calculada por consumo − geração";
    this._autoSummary={
      generation:generation.map(x=>x.name),
      boards:boards.map(x=>x.name),
      consumption:consumptionMode,
      grid:gridMode,
      warning:(!housePick&&!boards.length)?"Não encontrei uma origem confiável de consumo. Selecione somente o sensor de consumo total abaixo.":"",
      notes:[
        this._cfg.site.generation_energy_entity ? "Energia diária de geração identificada." : "Energia diária de geração será calculada automaticamente.",
        this._cfg.grid.import_energy_entity ? "Energia de importação identificada." : "Importação em kWh será derivada se necessário.",
        this._cfg.grid.export_energy_entity ? "Energia de exportação identificada." : "Exportação em kWh será derivada se necessário.",
      ],
    };

    if(render)this._render();
  }

  _detectedLoads(){
    const used=new Set([...(this._cfg?.generation||[]),...(this._cfg?.boards||[])].map(row=>row.power_entity));used.add(this._cfg?.site?.house_power_entity);for(const key of ['net_power_entity','import_power_entity','export_power_entity'])used.add(this._cfg?.grid?.[key]);
    return (this._discovery?.power||[]).filter(row=>!used.has(row.entity_id)&&/\b(tomada|plug|socket|disjuntor|breaker)\b/.test(this._rowText(row)));
  }
  _assignDetectedLoad(entityId,board){
    this._syncDraft();const row=this._detectedLoads().find(x=>x.entity_id===entityId);if(!row)return;
    for(const item of this._cfg.boards)item.loads=(item.loads||[]).filter(x=>x.power_entity!==entityId);
    if(board!==''&&this._cfg.boards[Number(board)])this._cfg.boards[Number(board)].loads.push({id:'load_'+entityId.split('.')[1],name:row.name||entityId,power_entity:entityId,energy_entity:this._matchEnergy(entityId,'load'),power_transform:'positive'});
    this._render();
  }
  _detectedLoadsMarkup(){
    const rows=this._detectedLoads();if(!rows.length)return '';
    return `<section class="panel"><h2>Tomadas e disjuntores encontrados (${rows.length})</h2><p>Associe cada medição ao seu quadro. Quando essa associação não existe na origem, ela precisa ser confirmada para evitar somar a mesma carga no quadro errado.</p><div class="simple-grid two">${rows.map(row=>{
      const linked=(this._cfg.boards||[]).findIndex(board=>(board.loads||[]).some(load=>load.power_entity===row.entity_id));
      return `<label>${this._esc(row.name||row.entity_id)}<small>${this._esc(row.entity_id)}</small><select data-detected-load="${this._esc(row.entity_id)}"><option value="">Selecionar quadro</option>${this._cfg.boards.map((b,i)=>`<option value="${i}" ${linked===i?'selected':''}>${this._esc(b.name||'Quadro '+(i+1))}</option>`).join('')}</select></label>`;
    }).join('')}</div></section>`;
  }

  _options(kind,current=""){
    const rows=kind==="energy"
      ?(this._discovery.energy||[])
      :(this._discovery.power||[]);

    const first=`<option value="">— selecionar —</option>`;

    return first+rows.map(row=>`
      <option value="${this._esc(row.entity_id)}"
        ${row.entity_id===current?"selected":""}>
        ${this._esc(row.name)} · ${this._esc(row.entity_id)}
      </option>
    `).join("");
  }

  _syncDraft(){
    if(!this.shadowRoot||this._mode!=="config")return;
    this._ensureCfg();

    const q=id=>this.shadowRoot.querySelector(id);
    const value=id=>q(id)?.value??"";

    this._cfg.site.name=value("#site-name")||"Instalação";
    this._cfg.site.grid_provider=value("#grid-provider");
    this._cfg.site.phases=Number(value("#phases")||1);
    this._cfg.site.house_power_entity=value("#house-power");
    this._cfg.site.house_energy_entity=value("#house-energy");
    this._cfg.site.generation_energy_entity=value("#generation-energy-total");

    this._cfg.grid.mode=value("#grid-mode")||"derived";
    this._cfg.grid.net_power_entity=value("#grid-net");
    this._cfg.grid.net_sign=value("#grid-sign")||"import_positive";
    this._cfg.grid.import_power_entity=value("#grid-import");
    this._cfg.grid.export_power_entity=value("#grid-export");
    this._cfg.grid.import_energy_entity=value("#grid-import-energy");
    this._cfg.grid.export_energy_entity=value("#grid-export-energy");

    this._cfg.generation.forEach((row,i)=>{
      row.name=value(`#src-name-${i}`);
      row.manufacturer=value(`#src-mfg-${i}`);
      row.model=value(`#src-model-${i}`);
      row.power_entity=value(`#src-power-${i}`);
      row.energy_entity=value(`#src-energy-${i}`);
      row.power_transform=value(`#src-transform-${i}`)||"absolute";
    });

    this._cfg.boards.forEach((row,i)=>{
      row.name=value(`#board-name-${i}`);
      row.power_entity=value(`#board-power-${i}`);
      row.energy_entity=value(`#board-energy-${i}`);
      row.power_transform=value(`#board-transform-${i}`)||"positive";
      row.loads=Array.isArray(row.loads)?row.loads:[];

      row.loads.forEach((load,j)=>{
        load.name=value(`#load-name-${i}-${j}`);
        load.power_entity=value(`#load-power-${i}-${j}`);
        load.energy_entity=value(`#load-energy-${i}-${j}`);
        load.power_transform=value(`#load-transform-${i}-${j}`)||"positive";
      });
    });
  }

  _addSource(){
    this._syncDraft();
    this._ensureCfg();
    const n=this._cfg.generation.length+1;
    this._cfg.generation.push({
      id:`source_${n}`,
      name:`Fonte ${n}`,
      manufacturer:"",
      model:"",
      power_entity:"",
      energy_entity:"",
      power_transform:"absolute",
      loads:[],
    });
    this._render();
  }

  _removeSource(index){
    this._syncDraft();
    this._cfg.generation.splice(index,1);
    this._render();
  }

  _addBoard(){
    this._syncDraft();
    this._ensureCfg();
    const n=this._cfg.boards.length+1;
    this._cfg.boards.push({
      id:`board_${n}`,
      name:`Quadro ${n}`,
      manufacturer:"",
      model:"",
      power_entity:"",
      energy_entity:"",
      power_transform:"positive",
      loads:[],
    });
    this._render();
  }

  _removeBoard(index){
    this._syncDraft();
    this._cfg.boards.splice(index,1);
    this._render();
  }

  _addLoad(boardIndex){
    this._syncDraft();
    const board=this._cfg.boards[boardIndex];
    board.loads=Array.isArray(board.loads)?board.loads:[];
    const n=board.loads.length+1;
    board.loads.push({
      id:`load_${n}`,
      name:`Dispositivo ${n}`,
      power_entity:"",
      energy_entity:"",
      power_transform:"positive",
      icon:"flash",
    });
    this._render();
  }

  _removeLoad(boardIndex,loadIndex){
    this._syncDraft();
    this._cfg.boards[boardIndex].loads.splice(loadIndex,1);
    this._render();
  }

  async _save(){
    this._syncDraft();
    this._error="";
    this._loading=true;
    this._render();

    try{
      await this._ws(
        "cloudpelizzon/energy/config/save",
        {config_json:JSON.stringify(this._cfg)}
      );

      this._loaded=false;
      this._loading=false;
      this._renderMessage(
        "Configuração salva",
        "O CloudPelizzon está recarregando o CP-ENERGY e criando os sensores normalizados."
      );
    }catch(error){
      this._loading=false;
      this._error=error?.message||String(error);
      this._mode="config";
      this._render();
    }
  }

  _historyEnergyEntity(entityId,fallback){
    if(!entityId)return fallback;

    const state=this._hass?.states?.[entityId];
    const unit=String(
      state?.attributes?.unit_of_measurement||""
    ).trim().toLowerCase();

    return unit==="kwh"?entityId:fallback;
  }

  _cardConfig(){
    const n=this._normalized||{};
    const cfg=this._cfg||{};
    const generationCfg=cfg.generation||[];
    const boardCfg=cfg.boards||[];
    const boards=n.boards||[];
    const zero="sensor.cloudpelizzon_energy_not_configured";

    const boardA=boards[0]||{};
    const otherBoards=boards.slice(1);

    const primarySourceEnergy=this._historyEnergyEntity(
      generationCfg[0]?.energy_entity,
      n.generation_primary_energy
    );

    const secondarySourceEnergy=(
      generationCfg.length===2
        ?this._historyEnergyEntity(
            generationCfg[1]?.energy_entity,
            n.generation_secondary_energy
          )
        :n.generation_secondary_energy
    );

    const primaryBoardEnergy=this._historyEnergyEntity(
      boardCfg[0]?.energy_entity,
      n.board_primary_energy
    );

    const secondaryBoardEnergy=(
      boardCfg.length===2
        ?this._historyEnergyEntity(
            boardCfg[1]?.energy_entity,
            n.board_secondary_energy
          )
        :n.board_secondary_energy
    );

    const totalGenerationEnergy=this._historyEnergyEntity(
      cfg.site?.generation_energy_entity,
      n.generation_energy
    );

    const gridImportEnergy=this._historyEnergyEntity(
      cfg.grid?.import_energy_entity,
      n.grid_import_energy
    );

    const gridExportEnergy=this._historyEnergyEntity(
      cfg.grid?.export_energy_entity,
      n.grid_export_energy
    );

    const qd1Devices=(boardA.loads||[]).map((load,index)=>({
      key:load.id||`a_${index}`,
      name:load.name||`Dispositivo ${index+1}`,
      short:String(load.name||`DISPOSITIVO ${index+1}`).toUpperCase(),
      icon:load.icon||"flash",
      power:load.power||zero,
      energy:load.energy||zero,
    }));

    const qd2Devices=otherBoards.flatMap((board,boardIndex)=>
      (board.loads||[]).map((load,index)=>({
        key:load.id||`b_${boardIndex}_${index}`,
        name:load.name||`Dispositivo ${index+1}`,
        short:String(load.name||`DISPOSITIVO ${index+1}`).toUpperCase(),
        icon:load.icon||"flash",
        power:load.power||zero,
        energy:load.energy||zero,
      }))
    );

    return {
      solar_power:n.generation_power,
      sofar_power:n.generation_primary_power,
      sofar_power_fallback:n.generation_primary_power,
      deye_power:n.generation_secondary_power,
      sofar_energy_total:primarySourceEnergy,
      deye_energy_total:secondarySourceEnergy,

      qd1_power:n.board_primary_power,
      qd2_power:n.board_secondary_power,
      house_power:n.consumption_power,

      grid_import_power:n.grid_import_power,
      grid_export_power:n.grid_export_power,

      qd1_energy:primaryBoardEnergy,
      qd2_energy:secondaryBoardEnergy,

      solar_energy:totalGenerationEnergy,
      solar_energy_fallback:n.generation_energy,
      grid_import_energy:gridImportEnergy,
      grid_import_energy_fallback:n.grid_import_energy,
      grid_export_energy:gridExportEnergy,
      grid_export_energy_fallback:n.grid_export_energy,

      cloudpelizzon_entities:{
        solarPower:n.generation_power||zero,
        sofarPower:n.generation_primary_power||zero,
        sofarFallback:n.generation_primary_power||zero,
        deyePower:n.generation_secondary_power||zero,

        sofarEnergyTotal:primarySourceEnergy||zero,
        deyeEnergyTotal:secondarySourceEnergy||zero,

        qd1Power:n.board_primary_power||zero,
        qd2Power:n.board_secondary_power||zero,
        housePower:n.consumption_power||zero,

        importPower:n.grid_import_power||zero,
        exportPower:n.grid_export_power||zero,

        qd1Energy:primaryBoardEnergy||zero,
        qd2Energy:secondaryBoardEnergy||zero,

        solarEnergy:totalGenerationEnergy||zero,
        solarEnergyFallback:n.generation_energy||zero,
        importEnergy:gridImportEnergy||zero,
        importEnergyFallback:n.grid_import_energy||zero,
        exportEnergy:gridExportEnergy||zero,
        exportEnergyFallback:n.grid_export_energy||zero,

        devices:{
          qd1:qd1Devices,
          qd2:qd2Devices,
        },
      },
    };
  }

  _topology(){
    const cfg=this._cfg||{};
    const generation=cfg.generation||[];
    const boards=cfg.boards||[];
    const provider=cfg.site?.grid_provider||"Concessionária";

    return `
      <section class="topology">
        <div class="topo-title">
          <div>
            <span>TOPOLOGIA CONFIGURADA</span>
            <b>${this._esc(cfg.site?.name||"Instalação")}</b>
          </div>
          <small>${generation.length} fonte(s) · ${boards.length} quadro(s) · ${this._esc(provider)}</small>
        </div>

        <div class="topo-grid">
          <article class="topo-zone solar-zone">
            <header><ha-icon icon="mdi:solar-power-variant"></ha-icon><b>GERAÇÃO</b></header>
            ${generation.length?generation.map((row,i)=>`
              <div class="topo-row">
                <i>${String(i+1).padStart(2,"0")}</i>
                <div><b>${this._esc(row.name)}</b><small>${this._esc([row.manufacturer,row.model].filter(Boolean).join(" · ")||"Fonte configurada")}</small></div>
                <span>${this._esc(row.power_entity)}</span>
              </div>
            `).join(""):`<div class="empty-mini">Sem fonte de geração configurada.</div>`}
          </article>

          <div class="topo-arrow">→</div>

          <article class="topo-zone house-zone">
            <header><ha-icon icon="mdi:home-lightning-bolt"></ha-icon><b>DISTRIBUIÇÃO</b></header>
            ${boards.map((row,i)=>`
              <div class="topo-row">
                <i>${String(i+1).padStart(2,"0")}</i>
                <div><b>${this._esc(row.name)}</b><small>${(row.loads||[]).length} carga(s) monitorada(s)</small></div>
                <span>${this._esc(row.power_entity)}</span>
              </div>
            `).join("")||`<div class="empty-mini">Consumo direto configurado.</div>`}
          </article>

          <div class="topo-arrow">↔</div>

          <article class="topo-zone grid-zone">
            <header><ha-icon icon="mdi:transmission-tower"></ha-icon><b>REDE</b></header>
            <div class="topo-row">
              <i>01</i>
              <div><b>${this._esc(provider)}</b><small>${this._esc(String(cfg.site?.phases||1))} fase(s)</small></div>
              <span>IMPORTAÇÃO / EXPORTAÇÃO</span>
            </div>
          </article>
        </div>
      </section>
    `;
  }


  _renderDashboard(){
    const health=this._status?.health||{};
    const missing=health.missing_entities||[];

    this.shadowRoot.innerHTML=`
      ${this._css()}
      <main class="energy-shell">
        <header class="modulebar">
          <div>
            <span>CP-ENERGY · V1.0.1</span>
            <b>CloudPelizzon Energia</b>
            <small>Camada normalizada de geração, consumo, quadros e rede elétrica</small>
          </div>

          <div class="module-actions">
            <span class="health ${missing.length?"warn":"ok"}">
              <i></i>
              ${missing.length?`${missing.length} origem(ns) sem dado`:"Telemetria normalizada"}
            </span>
            ${this._isAdmin()?`
              <button id="open-installation">
                <ha-icon icon="mdi:sitemap-outline"></ha-icon>
                Instalação
              </button>
              <button id="configure">
                <ha-icon icon="mdi:tune-variant"></ha-icon>
                Configuração
              </button>
            `:""}
          </div>
        </header>

        <section class="legacy-wrap">
          <div class="compat">
            <div>
              <b>Malha operacional</b>
              <span>O mapa da instalação foi movido para o menu “Instalação / Configuração” para não poluir a visão principal do dashboard.</span>
            </div>
          </div>

          <casa-pelizzon-energy-ops-card id="energy-card"></casa-pelizzon-energy-ops-card>
        </section>
      </main>
    `;

    this.shadowRoot.querySelector('#energy-card')?.setAttribute('viewport-fit','');
    this._fitViewport();
    if(typeof ResizeObserver!=='undefined'){
      this._viewportObserver?.disconnect();this._viewportObserver=new ResizeObserver(()=>this._fitViewport());this._viewportObserver.observe(this);
    }
    this.shadowRoot.querySelector("#configure")?.addEventListener("click",()=>{
      this._mode="config";
      this._render();
    });

    this.shadowRoot.querySelector("#open-installation")?.addEventListener("click",()=>{
      this._mode="config";
      this._render();
      requestAnimationFrame(()=>{
        this.shadowRoot.querySelector(".topology")?.scrollIntoView({behavior:"smooth",block:"start"});
      });
    });

    const card=this.shadowRoot.querySelector("#energy-card");
    if(card){
      card.setConfig(this._cardConfig());
      if(this._hass)card.hass=this._hass;
    }
  }



  _renderConfig(){
    this._ensureCfg();

    const generation=this._cfg.generation||[];
    const boards=this._cfg.boards||[];
    const auto=this._autoSummary||{};
    const provider=this._cfg.site.grid_provider||"Não identificado";
    const gridDetected=this._cfg.grid.net_power_entity
      ||this._cfg.grid.import_power_entity
      ||this._cfg.grid.export_power_entity;

    const entityLabel=id=>{
      if(!id)return "";
      const row=[...(this._discovery.power||[]),...(this._discovery.energy||[])]
        .find(x=>x.entity_id===id);
      return row?.name||id;
    };

    this.shadowRoot.innerHTML=`
      ${this._css()}
      <style>
        .easy-config{max-width:1280px}
        .auto-setup{
          margin-top:14px;
          padding:18px;
          border:1px solid rgba(53,200,255,.24);
          border-radius:16px;
          background:
            radial-gradient(circle at 0 0,rgba(53,200,255,.12),transparent 35%),
            linear-gradient(135deg,rgba(6,25,40,.98),rgba(3,14,24,.98));
        }
        .auto-setup-top{display:flex;gap:18px;justify-content:space-between;align-items:center}
        .auto-setup h2{margin:0 0 5px;font-size:20px}
        .auto-setup p{margin:0;color:var(--muted);line-height:1.5}
        .auto-setup .primary{min-width:250px;display:flex;gap:8px;align-items:center;justify-content:center}
        .detected-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}
        .detected{
          padding:13px;
          border:1px solid rgba(93,184,228,.16);
          border-radius:12px;
          background:rgba(1,12,21,.62);
          min-height:94px;
        }
        .detected ha-icon{color:var(--cyan);--mdc-icon-size:21px}
        .detected small{display:block;color:#7090a4;font-size:10px;font-weight:800;letter-spacing:.8px;margin:6px 0 3px}
        .detected b{display:block;font-size:13px;line-height:1.35}
        .detected.good{border-color:rgba(80,232,141,.24)}
        .detected.good ha-icon{color:var(--green)}
        .simple-card{margin-top:12px}
        .simple-card header{align-items:center}
        .simple-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .simple-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
        .simple-row{
          display:grid;
          grid-template-columns:minmax(180px,.8fr) minmax(280px,1.8fr);
          gap:10px;
          align-items:end;
          margin-top:9px;
          padding:11px;
          border:1px solid rgba(93,184,228,.12);
          border-radius:12px;
          background:rgba(3,14,24,.55);
        }
        .simple-row label,.simple-grid label{margin:0}
        .automatic-note{
          margin-top:10px;
          display:flex;
          align-items:flex-start;
          gap:9px;
          padding:11px 12px;
          border-radius:10px;
          border:1px solid rgba(80,232,141,.18);
          background:rgba(80,232,141,.055);
          color:#bfead0;
          line-height:1.45;
          font-size:12px;
        }
        .automatic-note ha-icon{color:var(--green);--mdc-icon-size:20px}
        .warning-note{border-color:rgba(255,197,92,.3);background:rgba(255,197,92,.07);color:#ffe3a8}
        details.advanced{
          margin-top:14px;
          border:1px solid rgba(93,184,228,.18);
          border-radius:14px;
          background:rgba(3,14,24,.72);
          overflow:hidden;
        }
        details.advanced>summary{
          list-style:none;
          cursor:pointer;
          padding:15px 17px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          font-weight:800;
        }
        details.advanced>summary::-webkit-details-marker{display:none}
        .advanced-body{padding:0 14px 14px}
        .advanced .form-card{margin-top:10px}
        .advanced-tag{
          padding:5px 8px;border:1px solid rgba(53,200,255,.22);
          border-radius:999px;color:var(--cyan);font-size:10px;letter-spacing:.7px
        }
        .savebar.easy-save{position:sticky;bottom:10px;z-index:5;box-shadow:0 12px 34px rgba(0,0,0,.45)}
        @media(max-width:900px){
          .auto-setup-top{align-items:flex-start;flex-direction:column}
          .auto-setup .primary{width:100%}
          .detected-grid,.simple-grid,.simple-grid.two{grid-template-columns:1fr}
          .simple-row{grid-template-columns:1fr}
        }
      </style>

      <main class="config-shell easy-config">
        <header class="config-hero">
          <div>
            <span>CP-ENERGY · CONFIGURAÇÃO ASSISTIDA</span>
            <h1>Vamos encontrar sua instalação automaticamente</h1>
            <p>O CloudPelizzon procura os sensores de energia do Home Assistant, elimina duplicidades e sugere somente o que realmente precisa para montar a malha.</p>
          </div>
          ${this._cfg.configured?`<button id="back-dashboard">Voltar ao painel</button>`:""}
        </header>

        ${this._error?`<div class="error">${this._esc(this._error)}</div>`:""}

        <section class="auto-setup">
          <div class="auto-setup-top">
            <div>
              <h2>Configuração automática</h2>${this._detectFeedback?`<p role="status">${this._esc(this._detectFeedback)}</p>`:""}
              <p>Não é necessário conhecer entity_id, acumuladores ou tratamento de sinal. Revise o resumo e salve. Os detalhes técnicos ficam em “Configuração avançada”.</p>
            </div>
            <button id="import-production" ${this._detecting?"disabled":""}>Usar configuração da produção</button><button id="autodetect" class="primary" ${this._detecting?"disabled":""}>
              <ha-icon icon="mdi:radar"></ha-icon>
              ${generation.length||boards.length||this._cfg.site.house_power_entity?"Refazer detecção automática":"Detectar e configurar automaticamente"}
            </button>
          </div>

          <div class="detected-grid">
            <article class="detected ${generation.length?"good":""}">
              <ha-icon icon="mdi:solar-power-variant"></ha-icon>
              <small>GERAÇÃO</small>
              <b>${generation.length?`${generation.length} fonte(s): ${this._esc(generation.map(x=>x.name).join(", "))}`:"Nenhuma fonte detectada"}</b>
            </article>
            <article class="detected ${this._cfg.site.house_power_entity||boards.length?"good":""}">
              <ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>
              <small>CONSUMO</small>
              <b>${this._esc(auto.consumption||(this._cfg.site.house_power_entity?entityLabel(this._cfg.site.house_power_entity):(boards.length?`${boards.length} quadro(s)`:"Não identificado")))}</b>
            </article>
            <article class="detected ${gridDetected?"good":""}">
              <ha-icon icon="mdi:transmission-tower"></ha-icon>
              <small>REDE ELÉTRICA</small>
              <b>${this._esc(auto.grid||(gridDetected?"Medição da rede identificada":"Cálculo automático por consumo − geração"))}</b>
            </article>
            <article class="detected good">
              <ha-icon icon="mdi:database-clock-outline"></ha-icon>
              <small>ENERGIA ACUMULADA</small>
              <b>Automática quando não houver sensor nativo</b>
            </article>
          </div>

          ${auto.warning?`
            <div class="automatic-note warning-note">
              <ha-icon icon="mdi:alert-outline"></ha-icon>
              <span>${this._esc(auto.warning)}</span>
            </div>
          `:`
            <div class="automatic-note">
              <ha-icon icon="mdi:check-decagram-outline"></ha-icon>
              <span>O assistente usa somente candidatos de alta confiança. Sensores técnicos duplicados, telemetrias auxiliares e os próprios sensores CloudPelizzon são ignorados.</span>
            </div>
          `}
        </section>

        <section class="form-card simple-card">
          <header>
            <div><b>1 · Identificação da instalação</b><span>Somente informações que o cliente conhece</span></div>
          </header>
          <div class="simple-grid">
            <label>Nome da instalação
              <input id="site-name" value="${this._esc(this._cfg.site.name||"Minha residência")}">
            </label>
            <label>Concessionária
              <input id="grid-provider" value="${this._esc(this._cfg.site.grid_provider)}" placeholder="Detectada automaticamente quando possível">
            </label>
            <label>Número de fases
              <select id="phases">
                ${[1,2,3].map(n=>`<option value="${n}" ${Number(this._cfg.site.phases)===n?"selected":""}>${n}</option>`).join("")}
              </select>
            </label>
          </div>
        </section>

        <section class="form-card simple-card">
          <header>
            <div><b>2 · Geração encontrada</b><span>Você só precisa conferir se os nomes fazem sentido</span></div>
          </header>

          ${generation.length?generation.map((row,i)=>`
            <div class="simple-row">
              <label>Nome
                <input id="src-name-${i}" value="${this._esc(row.name)}">
              </label>
              <label>Sensor de potência
                <select id="src-power-${i}">${this._options("power",row.power_entity)}</select>
              </label>
            </div>
          `).join(""):`
            <div class="empty-config">Nenhuma geração foi detectada. Se esta instalação não possui geração local, deixe assim. Caso possua, abra a configuração avançada.</div>
          `}
        </section>

        <section class="form-card simple-card">
          <header>
            <div><b>3 · Consumo encontrado</b><span>O CloudPelizzon prefere consumo total; se não existir, soma os quadros</span></div>
          </header>

          <div class="simple-grid two">
            <label>Consumo total da casa
              <select id="house-power">${this._options("power",this._cfg.site.house_power_entity)}</select>
              <small>${this._cfg.site.house_power_entity?"Sensor total detectado.":"Opcional quando existem quadros medidos."}</small>
            </label>
            <div class="automatic-note">
              <ha-icon icon="mdi:calculator-variant-outline"></ha-icon>
              <span>${boards.length?`Sem sensor total, o consumo pode ser calculado automaticamente pela soma de ${boards.length} quadro(s).`:"Se nenhum sensor total ou quadro for identificado, selecione aqui apenas o sensor que representa o consumo total da residência."}</span>
            </div>
          </div>

          ${boards.length?boards.map((row,i)=>`
            <div class="simple-row">
              <label>Quadro
                <input id="board-name-${i}" value="${this._esc(row.name)}">
              </label>
              <label>Sensor de potência
                <select id="board-power-${i}">${this._options("power",row.power_entity)}</select>
              </label>
            </div>
          `).join(""):""}
        </section>

        <section class="form-card simple-card">
          <header><div><b>4 · Rede elétrica</b><span>Normalmente não exige preenchimento manual</span></div></header>
          <div class="detected-grid">
            <article class="detected">
              <ha-icon icon="mdi:swap-vertical-bold"></ha-icon>
              <small>MODO</small>
              <b>${this._cfg.grid.mode==="metered"?"Medidor da rede":"Derivado automaticamente"}</b>
            </article>
            <article class="detected">
              <ha-icon icon="mdi:transmission-tower-import"></ha-icon>
              <small>IMPORTAÇÃO</small>
              <b>${this._esc(entityLabel(this._cfg.grid.import_power_entity)||"Calculada")}</b>
            </article>
            <article class="detected">
              <ha-icon icon="mdi:transmission-tower-export"></ha-icon>
              <small>EXPORTAÇÃO</small>
              <b>${this._esc(entityLabel(this._cfg.grid.export_power_entity)||"Calculada")}</b>
            </article>
            <article class="detected">
              <ha-icon icon="mdi:approximately-equal"></ha-icon>
              <small>POTÊNCIA LÍQUIDA</small>
              <b>${this._esc(entityLabel(this._cfg.grid.net_power_entity)||"Calculada")}</b>
            </article>
          </div>
        </section>

        <section class="form-card simple-card">
          <header>
            <div><b>2 · Instalação detectada</b><span>Mapa resumido da topologia que alimenta o módulo</span></div>
          </header>
          ${this._topology()}
        </section>

        <details class="advanced">
          <summary>
            <span>Configuração avançada <small>— somente para instalações fora do padrão</small></span>
            <span class="advanced-tag">TÉCNICO</span>
          </summary>

          <div class="advanced-body">
            <section class="form-card">
              <header><b>Energia acumulada e rede</b><span>Opcional</span></header>
              <div class="form-grid">
                <label>Energia acumulada da casa
                  <select id="house-energy">${this._options("energy",this._cfg.site.house_energy_entity)}</select>
                </label>
                <label>Geração total acumulada
                  <select id="generation-energy-total">${this._options("energy",this._cfg.site.generation_energy_entity)}</select>
                </label>
                <label>Modo da rede
                  <select id="grid-mode">
                    <option value="derived" ${this._cfg.grid.mode==="derived"?"selected":""}>Calcular consumo − geração</option>
                    <option value="metered" ${this._cfg.grid.mode==="metered"?"selected":""}>Usar medidor da rede</option>
                  </select>
                </label>
                <label>Potência líquida
                  <select id="grid-net">${this._options("power",this._cfg.grid.net_power_entity)}</select>
                </label>
                <label>Sinal da potência líquida
                  <select id="grid-sign">
                    <option value="import_positive" ${this._cfg.grid.net_sign==="import_positive"?"selected":""}>Positivo = importando</option>
                    <option value="export_positive" ${this._cfg.grid.net_sign==="export_positive"?"selected":""}>Positivo = exportando</option>
                  </select>
                </label>
                <label>Potência de importação
                  <select id="grid-import">${this._options("power",this._cfg.grid.import_power_entity)}</select>
                </label>
                <label>Potência de exportação
                  <select id="grid-export">${this._options("power",this._cfg.grid.export_power_entity)}</select>
                </label>
                <label>Energia importada acumulada
                  <select id="grid-import-energy">${this._options("energy",this._cfg.grid.import_energy_entity)}</select>
                </label>
                <label>Energia exportada acumulada
                  <select id="grid-export-energy">${this._options("energy",this._cfg.grid.export_energy_entity)}</select>
                </label>
              </div>
            </section>

            <section class="form-card">
              <header>
                <div><b>Detalhes das fontes</b><span>Fabricante, modelo e tratamento do sinal</span></div>
                <button id="add-source">+ Adicionar fonte manualmente</button>
              </header>
              <div class="rows">
                ${generation.map((row,i)=>`
                  <article class="config-row">
                    <div class="row-head"><b>${this._esc(row.name||`Fonte ${i+1}`)}</b><button data-remove-source="${i}">Remover</button></div>
                    <div class="form-grid">
                      <label>Fabricante<input id="src-mfg-${i}" value="${this._esc(row.manufacturer||"")}"></label>
                      <label>Modelo<input id="src-model-${i}" value="${this._esc(row.model||"")}"></label>
                      <label>Energia nativa
                        <select id="src-energy-${i}">${this._options("energy",row.energy_entity)}</select>
                      </label>
                      <label>Tratamento do sinal
                        <select id="src-transform-${i}">
                          <option value="absolute" ${row.power_transform==="absolute"?"selected":""}>Valor absoluto</option>
                          <option value="positive" ${row.power_transform==="positive"?"selected":""}>Somente positivo</option>
                          <option value="signed" ${row.power_transform==="signed"?"selected":""}>Com sinal</option>
                        </select>
                      </label>
                    </div>
                  </article>
                `).join("")||`<div class="empty-config">Nenhuma fonte cadastrada.</div>`}
              </div>
            </section>

            <section class="form-card">
              <header>
                <div><b>Detalhes dos quadros e cargas</b><span>Opcional</span></div>
                <button id="add-board">+ Adicionar quadro manualmente</button>
              </header>

              <div class="rows">
                ${boards.map((row,i)=>`
                  <article class="config-row board-row">
                    <div class="row-head"><b>${this._esc(row.name||`Quadro ${i+1}`)}</b><button data-remove-board="${i}">Remover quadro</button></div>
                    <div class="form-grid">
                      <label>Energia nativa
                        <select id="board-energy-${i}">${this._options("energy",row.energy_entity)}</select>
                      </label>
                      <label>Tratamento do sinal
                        <select id="board-transform-${i}">
                          <option value="positive" ${row.power_transform==="positive"?"selected":""}>Somente positivo</option>
                          <option value="absolute" ${row.power_transform==="absolute"?"selected":""}>Valor absoluto</option>
                          <option value="signed" ${row.power_transform==="signed"?"selected":""}>Com sinal</option>
                        </select>
                      </label>
                    </div>

                    <div class="loads-head">
                      <b>Dispositivos monitorados</b>
                      <button data-add-load="${i}">+ Adicionar dispositivo</button>
                    </div>

                    <div class="loads">
                      ${(row.loads||[]).map((load,j)=>`
                        <div class="load-row">
                          <input id="load-name-${i}-${j}" value="${this._esc(load.name)}" placeholder="Nome">
                          <select id="load-power-${i}-${j}">${this._options("power",load.power_entity)}</select>
                          <select id="load-energy-${i}-${j}">${this._options("energy",load.energy_entity)}</select>
                          <select id="load-transform-${i}-${j}">
                            <option value="positive" ${load.power_transform==="positive"?"selected":""}>Positivo</option>
                            <option value="absolute" ${load.power_transform==="absolute"?"selected":""}>Absoluto</option>
                            <option value="signed" ${load.power_transform==="signed"?"selected":""}>Com sinal</option>
                          </select>
                          <button data-remove-load="${i}:${j}">×</button>
                        </div>
                      `).join("")||`<small>Nenhum dispositivo individual neste quadro.</small>`}
                    </div>
                  </article>
                `).join("")||`<div class="empty-config">Nenhum quadro cadastrado.</div>`}
              </div>
            </section>
          </div>
        </details>

        ${this._detectedLoadsMarkup()}
        <section class="savebar easy-save">
          <div>
            <b>Pronto para usar</b>
            <span>O CloudPelizzon cria e mantém os sensores normalizados automaticamente. Você não precisa preencher campos técnicos para uma instalação padrão.</span>
          </div>
          <button id="save" class="primary">Salvar e ativar módulo</button>
        </section>
      </main>
    `;

    this.shadowRoot.querySelector("#import-production")?.addEventListener("click",()=>this._importProduction());
    this.shadowRoot.querySelector("#autodetect")?.addEventListener("click",()=>this._refreshDiscovery());
    this.shadowRoot.querySelector("#add-source")?.addEventListener("click",()=>this._addSource());
    this.shadowRoot.querySelector("#add-board")?.addEventListener("click",()=>this._addBoard());
    this.shadowRoot.querySelector("#save")?.addEventListener("click",()=>this._save());
    this.shadowRoot.querySelectorAll("[data-detected-load]").forEach(select=>select.addEventListener("change",()=>this._assignDetectedLoad(select.dataset.detectedLoad,select.value)));

    this.shadowRoot.querySelector("#back-dashboard")?.addEventListener("click",()=>{
      this._syncDraft();
      this._mode="dashboard";
      this._render();
      this._propagate();
    });

    this.shadowRoot.querySelectorAll("[data-remove-source]").forEach(btn=>
      btn.addEventListener("click",()=>this._removeSource(Number(btn.dataset.removeSource)))
    );

    this.shadowRoot.querySelectorAll("[data-remove-board]").forEach(btn=>
      btn.addEventListener("click",()=>this._removeBoard(Number(btn.dataset.removeBoard)))
    );

    this.shadowRoot.querySelectorAll("[data-add-load]").forEach(btn=>
      btn.addEventListener("click",()=>this._addLoad(Number(btn.dataset.addLoad)))
    );

    this.shadowRoot.querySelectorAll("[data-remove-load]").forEach(btn=>
      btn.addEventListener("click",()=>{
        const [i,j]=btn.dataset.removeLoad.split(":").map(Number);
        this._removeLoad(i,j);
      })
    );
  }

  _renderLocked(){
    const license=this._status?.license||{};
    const reason=license.reason||license.status||"module_not_licensed";

    this.shadowRoot.innerHTML=`
      ${this._css()}
      <main class="message">
        <div class="message-card lock-card">
          <ha-icon icon="mdi:lock-outline"></ha-icon>
          <h2>CP-ENERGY bloqueado</h2>
          <p>O módulo está instalado, mas a licença desta instalação não permite o acesso.</p>
          <small>${this._esc(reason)}</small>
        </div>
      </main>
    `;
  }

  _renderMessage(title,text){
    this.shadowRoot.innerHTML=`
      ${this._css()}
      <main class="message">
        <div class="message-card">
          <div class="spinner"></div>
          <h2>${this._esc(title)}</h2>
          <p>${this._esc(text)}</p>
        </div>
      </main>
    `;
  }

  _render(){
    if(!this.shadowRoot)return;

    if(this._loading){
      this._renderMessage("CloudPelizzon Energia","Carregando configuração e telemetria...");
      return;
    }

    if(this._error&&!this._loaded){
      this.shadowRoot.innerHTML=`
        ${this._css()}
        <main class="message">
          <div class="message-card error-card">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            <h2>CP-ENERGY indisponível</h2>
            <p>${this._esc(this._error)}</p>
          </div>
        </main>
      `;
      return;
    }

    if(!this._loaded){
      this._renderMessage("CloudPelizzon Energia","Inicializando módulo...");
      return;
    }

    if(this._status?.license?.allowed===false){
      this._renderLocked();
      return;
    }

    if(!this._cfg?.configured&&!this._isAdmin()){
      this._renderMessage(
        "Configuração necessária",
        "Um administrador do Home Assistant precisa concluir o assistente inicial do CP-ENERGY."
      );
      return;
    }

    if(this._mode==="config"||!this._cfg?.configured){
      this._renderConfig();
      return;
    }

    this._renderDashboard();
  }

  _propagate(){
    const card=this.shadowRoot?.querySelector("#energy-card");
    if(card&&this._hass){
      const config=this._cardConfig(),signature=JSON.stringify(config);
      if(typeof card.setConfig==="function"&&card.__cpConfig!==signature){card.setConfig(config);card.__cpConfig=signature;}
      const original=this._hass;
      card.hass=original.states?.['sensor.cloudpelizzon_homolog_mirror']?{...original,callWS:query=>query.type==='history/history_during_period'?original.callWS({type:'cloudpelizzon/energy/production_history',query}):original.callWS(query)}:original;
    }
  }

  _css(){
    return `
      <style>
        :host{
          display:block;
          min-height:0;
          background:#020914;
          color:#eefaff;
          font-family:Inter,Segoe UI,Arial,sans-serif;
          --cyan:#35c8ff;
          --green:#50e88d;
          --amber:#ffc55c;
          --line:rgba(93,184,228,.16);
          --panel:rgba(5,19,31,.94);
          --muted:#7896a9;
        }

        *{box-sizing:border-box}
        button,input,select{font:inherit}
        button{cursor:pointer}

        .energy-shell,.config-shell{
          max-width:none;
          margin:0 auto;
          padding:14px;
        }

        .energy-shell{width:100%;min-width:0;padding:4px!important;display:grid;grid-template-rows:28px minmax(0,1fr);gap:4px;overflow:hidden}
        .energy-shell .modulebar{min-height:0;padding:3px 8px;border-radius:8px;gap:8px}
        .energy-shell .modulebar>div>span,.energy-shell .modulebar>div>small{display:none}
        .energy-shell .modulebar>div>b{font-size:12px;margin:0}
        .energy-shell .module-actions{gap:6px}
        .energy-shell .module-actions button{padding:3px 8px;font-size:10px;min-height:0}
        .energy-shell .legacy-wrap{min-height:0;min-width:0;height:100%;padding:0;margin:0;overflow:hidden}
        .energy-shell .compat{display:none}
        .energy-shell #energy-card{height:100%;min-height:0;width:100%;display:block}
        .modulebar,.config-hero{
          display:flex;
          justify-content:space-between;
          gap:20px;
          align-items:center;
          padding:18px 20px;
          border:1px solid var(--line);
          border-radius:18px;
          background:
            radial-gradient(circle at 5% 0%,rgba(53,200,255,.12),transparent 32%),
            linear-gradient(135deg,#061522,#03101a);
          box-shadow:0 14px 40px rgba(0,0,0,.22);
        }

        .modulebar span,.config-hero span,.topo-title span{
          color:var(--cyan);
          font-size:10px;
          font-weight:800;
          letter-spacing:1.5px;
        }

        .modulebar b{display:block;font-size:24px;margin-top:2px}
        .modulebar small,.config-hero p{color:var(--muted)}
        .module-actions{display:flex;align-items:center;gap:10px}

        .module-actions button,.config-hero button,.form-card header button,.loads-head button,.wizard-actions button,.savebar button{
          border:1px solid rgba(53,200,255,.28);
          border-radius:10px;
          padding:10px 13px;
          background:rgba(53,200,255,.07);
          color:#eaf9ff;
        }

        .primary{
          background:linear-gradient(135deg,#137bad,#0c527a)!important;
          border-color:#35c8ff!important;
          color:white!important;
        }

        .health{
          display:flex;
          align-items:center;
          gap:7px;
          padding:8px 11px;
          border-radius:999px;
          background:rgba(255,255,255,.03);
          font-size:11px;
        }

        .health i{width:8px;height:8px;border-radius:50%}
        .health.ok i{background:var(--green);box-shadow:0 0 9px var(--green)}
        .health.warn i{background:var(--amber);box-shadow:0 0 9px var(--amber)}

        .topology{
          margin-top:12px;
          border:1px solid var(--line);
          border-radius:18px;
          padding:14px;
          background:#04101b;
        }

        .topo-title{
          display:flex;
          justify-content:space-between;
          gap:10px;
          align-items:end;
          margin-bottom:10px;
        }

        .topo-title b{display:block;font-size:18px;margin-top:2px}
        .topo-title small{color:var(--muted)}

        .topo-grid{
          display:grid;
          grid-template-columns:minmax(0,1fr) 38px minmax(0,1fr) 38px minmax(0,.8fr);
          align-items:stretch;
          gap:8px;
        }

        .topo-arrow{
          display:grid;
          place-items:center;
          color:var(--cyan);
          font-size:25px;
          text-shadow:0 0 15px rgba(53,200,255,.5);
        }

        .topo-zone{
          min-width:0;
          padding:10px;
          border:1px solid rgba(255,255,255,.06);
          border-radius:14px;
          background:rgba(255,255,255,.018);
        }

        .topo-zone header{
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:8px;
          color:#dff7ff;
        }

        .solar-zone header{color:#73f1a9}
        .grid-zone header{color:#ffd076}

        .topo-row{
          display:grid;
          grid-template-columns:26px minmax(100px,1fr) minmax(90px,.7fr);
          gap:8px;
          align-items:center;
          padding:8px;
          margin-top:5px;
          border-radius:9px;
          background:rgba(255,255,255,.025);
        }

        .topo-row>i{
          width:24px;height:24px;display:grid;place-items:center;
          border-radius:50%;border:1px solid rgba(53,200,255,.28);
          color:var(--cyan);font-style:normal;font-size:9px;
        }

        .topo-row div b{display:block;font-size:12px}
        .topo-row div small,.topo-row>span{
          display:block;color:var(--muted);font-size:9px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        }

        .legacy-wrap{
          margin-top:12px;
          border:1px solid var(--line);
          border-radius:18px;
          overflow:hidden;
          background:#020914;
        }

        .compat{
          display:flex;
          justify-content:space-between;
          padding:9px 13px;
          border-bottom:1px solid var(--line);
          background:rgba(53,200,255,.025);
        }

        .compat b{font-size:11px}
        .compat span{display:block;margin-top:2px;color:var(--muted);font-size:9px}

        .config-hero h1{margin:4px 0 6px;font-size:28px}
        .config-hero p{max-width:850px;margin:0}

        .wizard-actions,.savebar{
          margin-top:12px;
          padding:12px 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          border:1px solid var(--line);
          border-radius:14px;
          background:#04101a;
        }

        .wizard-actions span,.savebar span{color:var(--muted);font-size:11px}

        .form-card{
          margin-top:12px;
          padding:14px;
          border:1px solid var(--line);
          border-radius:16px;
          background:var(--panel);
        }

        .form-card>header{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:12px;
        }

        .form-card header b{font-size:15px}
        .form-card header span{display:block;color:var(--muted);font-size:10px;margin-top:2px}

        .form-grid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:9px;
        }

        label{
          display:flex;
          flex-direction:column;
          gap:5px;
          color:#91acba;
          font-size:10px;
          font-weight:700;
        }

        input,select{
          width:100%;
          min-height:38px;
          border:1px solid rgba(89,169,207,.19);
          border-radius:9px;
          padding:8px 9px;
          background:#061522;
          color:#eaf7fc;
          outline:none;
        }

        input:focus,select:focus{border-color:#35c8ff}

        .rows{display:grid;gap:10px}
        .config-row{
          padding:12px;
          border:1px solid rgba(255,255,255,.06);
          border-radius:12px;
          background:rgba(255,255,255,.015);
        }

        .row-head,.loads-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          margin-bottom:10px;
        }

        .row-head button,[data-remove-load]{
          border:0;background:transparent;color:#e98995;
        }

        .loads-head{margin-top:12px;padding-top:10px;border-top:1px dashed var(--line)}
        .loads{display:grid;gap:6px}
        .load-row{
          display:grid;
          grid-template-columns:minmax(120px,.7fr) minmax(170px,1fr) minmax(170px,1fr) minmax(90px,.45fr) 30px;
          gap:6px;
        }

        .hint,.empty-config,.empty-mini{
          color:var(--muted);
          font-size:10px;
        }

        .error{
          margin-top:12px;
          padding:12px;
          border:1px solid rgba(239,93,107,.42);
          border-radius:12px;
          background:rgba(239,93,107,.08);
          color:#ffb2bb;
        }

        .message{
          min-height:72vh;
          display:grid;
          place-items:center;
          background:#020914;
        }

        .message-card{
          width:min(540px,90vw);
          text-align:center;
          padding:32px;
          border:1px solid var(--line);
          border-radius:20px;
          background:#05131f;
        }

        .message-card p{color:var(--muted)}
        .spinner{
          width:38px;height:38px;margin:0 auto 12px;
          border-radius:50%;
          border:3px solid #183b50;
          border-top-color:var(--cyan);
          animation:spin .8s linear infinite;
        }

        .error-card ha-icon{--mdc-icon-size:44px;color:#ff7a89}
        .lock-card ha-icon{--mdc-icon-size:44px;color:#ffd267}
        .lock-card small{color:#9eb3bf}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media(max-width:1000px){
          .topo-grid{grid-template-columns:1fr}
          .topo-arrow{transform:rotate(90deg)}
          .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          .modulebar,.config-hero{align-items:flex-start;flex-direction:column}
          .module-actions{width:100%;justify-content:space-between}
        }

        @media(max-width:700px){
          .energy-shell,.config-shell{padding:7px}
          .form-grid{grid-template-columns:1fr}
          .load-row{grid-template-columns:1fr}
          .wizard-actions,.savebar,.topo-title{align-items:flex-start;flex-direction:column}
          .module-actions{align-items:flex-start;flex-direction:column}
        }
      </style>
    `;
  }
}

if(!customElements.get("cloudpelizzon-energy-panel")){
  customElements.define("cloudpelizzon-energy-panel",CloudPelizzonEnergyPanel);
}
