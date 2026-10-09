const CP_BASE = "/cloudpelizzon-core/frontend";

const CP_MODULES = {
  "CP-MAINTENANCE": {
    kicker: "GESTÃO PREVENTIVA",
    tagline: "Antecipe falhas, organize custos e transforme manutenção em rotina inteligente.",
    metrics: [["Saúde geral","92%"],["Vencidas","4"],["Próximas","3"],["Economia","R$ 449"]],
    features: [
      ["mdi:wrench-clock","Manutenções preventivas","Ciclos, prioridades, vencimentos, execução e recorrência."],
      ["mdi:chart-donut","Saúde e planejamento","Saúde geral, situação por categoria e planejamento consolidado."],
      ["mdi:cash-multiple","Financeiro completo","Gastos, materiais, mão de obra, economia, provisões, Excel e PDF."],
      ["mdi:history","Histórico operacional","Execuções, responsáveis, custos e evolução da manutenção."],
      ["mdi:brain","IA preventiva","Recomendações e visão inteligente para antecipar riscos."],
      ["mdi:account-voice","Consulta por voz","Pergunte à Alexa o que está vencido ou prestes a vencer."],
    ],
    boards: ["Visão Geral","Financeiro","Cadastro","Histórico"],
    alerts: ["Lavagem das calhas • vencida","Lavagem do portão • vencida","Corte da grama • vencida","Ar condicionado • atenção"],
    rows: [["Casa","8","50%"],["Energia","3","67%"],["Gás","3","100%"],["Veículos","10","90%"],["Tecnologia","3","100%"]],
  },
  "CP-NOC": {
    kicker: "OBSERVABILIDADE RESIDENCIAL",
    tagline: "Acompanhe a infraestrutura da casa como um verdadeiro centro de operações.",
    metrics: [["CPU","12%"],["RAM","41%"],["Disco","68%"],["Serviços","24/24"]],
    features: [
      ["mdi:server-network","Infraestrutura em tempo real","CPU, memória, disco, rede, uptime e disponibilidade."],
      ["mdi:heart-pulse","Saúde consolidada","Indicadores de saúde da plataforma e serviços críticos."],
      ["mdi:alert-decagram-outline","Incidentes e anomalias","Falhas, degradação e eventos que precisam de atenção."],
      ["mdi:chart-timeline-variant","Histórico e tendência","Evolução operacional para perceber padrões."],
      ["mdi:database-check-outline","Capacidade","Uso de armazenamento, crescimento e planejamento."],
      ["mdi:robot-outline","Diagnóstico inteligente","Verificações automáticas e contexto do incidente."],
    ],
    boards: ["NOC Principal","Infraestrutura","Diagnóstico","Operação"],
    alerts: ["Home Assistant • OK","Proxmox • OK","PBS • OK","Zigbee2MQTT • atenção"],
    rows: [["Home Assistant","99,9%","OK"],["Proxmox","99,8%","OK"],["TrueNAS","100%","OK"],["PBS","99,7%","OK"],["Zigbee","97,4%","Atenção"]],
  },
  "CP-ALEXA": {
    kicker: "ORQUESTRAÇÃO POR VOZ",
    tagline: "Transforme a Alexa em uma interface inteligente para a residência e os módulos CloudPelizzon.",
    metrics: [["Dispositivos","12"],["Avisos","8"],["Rotinas","4"],["Voz","Ativa"]],
    features: [
      ["mdi:account-voice","Consultas contextuais","Pergunte por manutenção, status da casa, alertas e módulos."],
      ["mdi:bullhorn-outline","Avisos inteligentes","Notificações condicionadas por horário, modo e prioridade."],
      ["mdi:home-account","Personalização","Respostas e saudações adequadas aos moradores."],
      ["mdi:link-variant","Integração com módulos","Consulta Manutenção, Segurança, Energia e outros módulos."],
      ["mdi:message-processing-outline","Respostas dinâmicas","Dados montados a partir do estado real da residência."],
      ["mdi:shield-check-outline","Contexto","Regras para evitar anúncios em períodos silenciosos."],
    ],
    boards: ["Central de Voz","Avisos","Consultas","Contexto Residencial"],
    alerts: ["Sala • online","Escritório • online","Quarto • online","Cozinha • online"],
    rows: [["Bom dia","Ativa","06:10"],["Dormir","Ativa","23:00"],["Lixo orgânico","Ativa","Rotina"],["Manutenção","Consulta","Voz"],["Segurança","Consulta","Voz"]],
  },
  "CP-ENERGY": {
    kicker: "ENERGIA INTELIGENTE",
    tagline: "Visualize geração, consumo e relação com a concessionária em uma malha energética completa.",
    metrics: [["Solar","6,2 kW"],["Casa","2,4 kW"],["Importação","0,4 kW"],["Exportação","3,4 kW"]],
    features: [
      ["mdi:solar-power","Geração solar","Inversor, microinversor, geração total e acumulada."],
      ["mdi:home-lightning-bolt-outline","Consumo residencial","Consumo consolidado e por quadro/equipamento."],
      ["mdi:transmission-tower","Importação e exportação","Fluxo com concessionária e saldo operacional."],
      ["mdi:vector-polyline","Malha energética","Representação visual animada entre geração, casa e rede."],
      ["mdi:chart-areaspline","Histórico e tendências","Geração, consumo, picos e comparativos."],
      ["mdi:trophy-outline","Indicadores e conquistas","Recordes de geração e eficiência."],
    ],
    boards: ["Fluxo de Energia","Geração Solar","Consumo","Histórico"],
    alerts: ["Inversor • 3,8 kW","Microinversor • 2,4 kW","QD1 • 1,4 kW","QD2 • 1,0 kW"],
    rows: [["Geração hoje","22,5 kWh","↑ 8%"],["Consumo hoje","15,7 kWh","↓ 3%"],["Exportado","9,8 kWh","OK"],["Importado","3,0 kWh","OK"],["Saldo","+6,8 kWh","Crédito"]],
  },
  "CP-BACKUP": {
    kicker: "PROTEÇÃO DE DADOS",
    tagline: "Saiba se seus backups realmente estão protegendo a residência digital.",
    metrics: [["Cobertura","100%"],["Último","OK"],["Destinos","3"],["Risco","Baixo"]],
    features: [
      ["mdi:backup-restore","Cobertura","Sistemas protegidos e sem proteção."],
      ["mdi:check-decagram-outline","Saúde das rotinas","Sucesso, falha e última execução."],
      ["mdi:harddisk","Armazenamento","Capacidade, crescimento e uso dos destinos."],
      ["mdi:calendar-clock","Retenção","Histórico e política de retenção."],
      ["mdi:alert-outline","Risco","Backups antigos, ausentes ou destinos com problema."],
      ["mdi:server-security","Multi-destino","PBS, NAS, snapshots e demais destinos."],
    ],
    boards: ["Backup Center","Cobertura","Armazenamento","Histórico"],
    alerts: ["PBS • concluído","TrueNAS • concluído","Google Drive • concluído","HA Snapshot • concluído"],
    rows: [["Home Assistant","Hoje 03:00","OK"],["VMs Proxmox","Hoje 02:00","OK"],["TrueNAS","Ontem 23:00","OK"],["NetBox","Hoje 01:00","OK"],["Configuração","Hoje 03:05","OK"]],
  },
  "CP-SECURITY": {
    kicker: "SEGURANÇA INTEGRADA",
    tagline: "Consolide alarmes, sensores críticos e resposta a incidentes em uma única central.",
    metrics: [["Protegido","Ativo"],["Alertas","0"],["Sensores","24"],["Incidentes","0"]],
    features: [
      ["mdi:shield-home-outline","Estado de proteção","Alarmes, modos da casa e cobertura."],
      ["mdi:fire-alert","Sensores críticos","Gás, fumaça, água, cerca e demais sensores."],
      ["mdi:alert-octagon-outline","Incidentes","Detecção, persistência, recuperação e encerramento."],
      ["mdi:timeline-alert-outline","Histórico","Eventos de segurança e linha do tempo."],
      ["mdi:cctv","Câmeras","Atalhos e contexto visual para incidentes."],
      ["mdi:robot-outline","Resposta inteligente","Notificações e ações automáticas."],
    ],
    boards: ["Segurança","Sensores","Incidentes","Histórico"],
    alerts: ["Gás • normal","Cerca • ativa","Portão • fechado","Câmeras • online"],
    rows: [["Gás","Normal","OK"],["Cerca elétrica","Armada","OK"],["Portão","Fechado","OK"],["Câmeras","4 online","OK"],["NVR","Online","OK"]],
  },
  "CP-AUTOMATION": {
    kicker: "AUTOMAÇÃO INTELIGENTE",
    tagline: "Veja se suas automações estão funcionando e onde existem oportunidades de melhoria.",
    metrics: [["Fluxos","225"],["Eficiência","98,7%"],["Falhas","3"],["Insights","7"]],
    features: [
      ["mdi:robot-outline","Saúde das automações","Visão consolidada das rotinas."],
      ["mdi:chart-timeline-variant-shimmer","Eficiência","Indicadores de execução e aderência."],
      ["mdi:alert-circle-outline","Falhas e sintomas","Erros, timeouts e dependências."],
      ["mdi:lightbulb-on-outline","Insights","Recomendações para melhorar confiabilidade."],
      ["mdi:history","Histórico","Execuções e mudanças ao longo do tempo."],
      ["mdi:sitemap-outline","Dependências","Entidades e serviços críticos."],
    ],
    boards: ["Automation Center","Falhas","Eficiência","Insights"],
    alerts: ["CAS • saudável","ALR • saudável","GAS • saudável","DIA • 3 atenções"],
    rows: [["CAS-005","100%","OK"],["CAS-006","100%","OK"],["ALR-004","96%","Atenção"],["GAS-005","100%","OK"],["DIA-017","94%","Atenção"]],
  },
  "CP-AMBIENTE": {
    kicker: "CONFORTO E QUALIDADE AMBIENTAL",
    tagline: "Entenda o conforto da residência por ambiente e acompanhe a qualidade do ar.",
    metrics: [["Temperatura","23,4°C"],["Umidade","51%"],["Ar","Ótimo"],["Conforto","92%"]],
    features: [
      ["mdi:thermometer","Temperatura","Leitura e tendência térmica por ambiente."],
      ["mdi:water-percent","Umidade","Faixas de conforto e evolução."],
      ["mdi:air-filter","Qualidade do ar","Sensores ambientais e indicadores."],
      ["mdi:home-thermometer-outline","Conforto por cômodo","Condição consolidada de cada ambiente."],
      ["mdi:chart-line","Tendências","Histórico e comportamento ambiental."],
      ["mdi:fan-auto","Ações inteligentes","Climatização, ventilação e conforto."],
    ],
    boards: ["Ambiente Geral","Cômodos","Qualidade do Ar","Histórico"],
    alerts: ["Sala • 23,5°C","Quarto • 22,9°C","Escritório • 24,1°C","Externo • 18,7°C"],
    rows: [["Sala","23,5°C","52%"],["Cozinha","23,9°C","50%"],["Escritório","24,1°C","48%"],["Quarto","22,9°C","54%"],["Externo","18,7°C","61%"]],
  },
  "CP-FITOS": {
    kicker: "FITNESS CONECTADO",
    tagline: "Leve metas, rotina e evolução fitness para dentro da experiência CloudPelizzon.",
    metrics: [["Meta","82%"],["Sequência","7 dias"],["Rotinas","5"],["Conquistas","3"]],
    features: [
      ["mdi:target","Metas","Objetivos pessoais e acompanhamento."],
      ["mdi:calendar-check-outline","Rotina","Planejamento de hábitos e sessões."],
      ["mdi:chart-line","Evolução","Progresso, consistência e tendência."],
      ["mdi:fire","Sequências","Dias consecutivos e motivadores."],
      ["mdi:dumbbell","Atividades","Atividades e status de execução."],
      ["mdi:home-heart","Integração residencial","Fitness conectado à rotina da casa."],
    ],
    boards: ["FIT OS","Metas","Rotina","Evolução"],
    alerts: ["Meta semanal • 82%","Treinos • 4/5","Água • 78%","Sono • 7h18"],
    rows: [["Treino A","Concluído","100%"],["Treino B","Concluído","100%"],["Cardio","Hoje","70%"],["Mobilidade","Amanhã","0%"],["Meta semanal","4/5","82%"]],
  },
};

const CP_MAINT_PREVIEWS = [
  {file:"manutencao-casa.png", title:"Visão Geral / Operação", desc:"Saúde, vencimentos, planejamento, categorias e execução."},
  {file:"manutencao-financeiro.png", title:"Financeiro", desc:"Gastos, economia, materiais, mão de obra e provisões."},
  {file:"manutencao-cadastro.png", title:"Cadastro e gestão", desc:"Cadastro, edição, imagens, ciclos, prioridades e categorias."},
  {file:"manutencao-historico.png", title:"Histórico", desc:"Filtros, prazos, prioridades, status e histórico operacional."},
];

const CP_ENERGY_PREVIEWS = [
  {
    file:"energy-preview-01-visao-geral.png",
    title:"Visão Geral",
    desc:"Malha energética em tempo real, indicadores do dia, fluxo entre geração, residência e rede, consumidores e equipamentos."
  },
  {
    file:"energy-preview-02-geracao.png",
    title:"Geração",
    desc:"Produção e desempenho dos geradores, participação das fontes e curva de potência do período."
  },
  {
    file:"energy-preview-03-consumo.png",
    title:"Consumo",
    desc:"Demanda da residência, consumo por quadro e ranking individual das cargas monitoradas."
  },
  {
    file:"energy-preview-04-rede.png",
    title:"Rede elétrica",
    desc:"Importação, exportação, saldo e histórico de intercâmbio energético com a concessionária."
  },
  {
    file:"energy-preview-05-analises.png",
    title:"Análises",
    desc:"Autoconsumo, autossuficiência, dependência da rede, balanço energético e indicadores consolidados."
  }
];

class CloudPelizzonCorePanel extends HTMLElement {
  constructor(){
    super(); this.attachShadow({mode:"open"}); this._hass=null; this.data=null; this.loading=false; this.error=null; this.selectedSku=null; this.toastTimer=null; this.requestSku=null; this.requestResult=null; this.previewIndex=0; this.carouselTimer=null; this._focusHandler=()=>{if(document.visibilityState==="visible"&&!this.loading)this.load()};
  }
  set panel(v){this._panel=v}
  set hass(h){this._hass=h;if(!this.data&&!this.loading)this.load()}
  connectedCallback(){document.addEventListener("visibilitychange",this._focusHandler);window.addEventListener("focus",this._focusHandler);if(this._hass&&!this.data&&!this.loading)this.load()}
  disconnectedCallback(){document.removeEventListener("visibilitychange",this._focusHandler);window.removeEventListener("focus",this._focusHandler);clearInterval(this.carouselTimer);this.carouselTimer=null}
  esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  async load(){if(!this._hass||this.loading)return;this.loading=true;this.render();try{this.data=await this._hass.callWS({type:"cloudpelizzon/core/status"});

this.error=null}catch(e){this.error=e?.message||String(e)}finally{this.loading=false;this.render()}}
  moduleBySku(s){return (this.data?.modules||[]).find(x=>x.sku===s)}
  statusLabel(l){const s=l?.status;if(s==="licensed")return"Licenciado • online";if(s==="activation_required")return"Ativação online necessária";if(s==="lease_expired")return"Tolerância offline encerrada";if(s==="revoked")return"Licença revogada";if(s==="expired")return"Licença expirada";if(s==="not_entitled")return"Não contratado";if(s==="invalid")return"Licença inválida";if(s==="locked")return"Sem licença";return"Não contratado"}
  licenseSummary(){const mods=this.data?.modules||[];const active=mods.filter(x=>x.license?.allowed).length;const l=this.data?.license||{};let label="Não ativada",tone="off";if(l.online_status==="active"&&active>0){label="Ativa • online";tone="on"}else if(l.present&&l.activation_id){label=l.online_status==="revoked"?"Revogada":l.online_status==="expired"?"Expirada":"Aguardando validação";tone="trial"}else if(l.present){label="Ativação pendente";tone="trial"}return{active,label,tone,total:mods.length}}
  openModule(path){if(!path)return;this.dispatchEvent(new CustomEvent("cloudpelizzon-open-module",{detail:{path:path},bubbles:true,composed:true}))}
  showLicense(){this.shadowRoot.querySelector("#license-modal")?.classList.add("show")}
  hideLicense(){this.shadowRoot.querySelector("#license-modal")?.classList.remove("show")}
  async activateLicense(){const token=this.shadowRoot.querySelector("#license-token")?.value?.trim();if(!token)return this.toast("Cole a chave CP1 emitida pela Central de Licenciamento.","error");try{await this._hass.callWS({type:"cloudpelizzon/core/license/activate",token});this.hideLicense();await this.load();this.toast("Licença ativada e validada online com sucesso.")}catch(e){this.toast(e?.message||String(e),"error")}}
  async checkinNow(){try{const r=await this._hass.callWS({type:"cloudpelizzon/core/license/checkin"});await this.load();this.showLicense();this.toast(r?.status==="active"?"Check-in online concluído.":`Check-in: ${r?.status||'falhou'}`,r?.status==="active"?"success":"error")}catch(e){this.toast(e?.message||String(e),"error")}}
  async diagnoseLicense(){try{const d=await this._hass.callWS({type:"cloudpelizzon/core/license/diagnostics"});const box=this.shadowRoot.querySelector("#license-diagnostics");if(box){box.innerHTML=this.diagnosticsHtml(d);box.classList.add("show")}}catch(e){this.toast(e?.message||String(e),"error")}}
  diagnosticsHtml(d){const yes=v=>v?"✓ OK":"✕ Falha";const online=d.online_status==="active";return `<div class="diag-grid"><div><span>CP1</span><b class="${d.token_present?'good':'bad'}">${d.token_present?'Presente':'Ausente'}</b></div><div><span>Assinatura CP1</span><b class="${d.valid?'good':'bad'}">${d.valid?'Válida':'Inválida'}</b></div><div><span>ID da instalação</span><b class="${d.installation_match?'good':'bad'}">${yes(d.installation_match)}</b></div><div><span>Prazo da licença</span><b class="${d.time_valid?'good':'bad'}">${yes(d.time_valid)}</b></div><div><span>Ativação online</span><b class="${online?'good':'bad'}">${this.esc(d.online_status||'não ativada')}</b></div><div><span>Lease CP2</span><b class="${d.lease_valid?'good':'bad'}">${d.lease_valid?'Válida':'Ausente/expirada'}</b></div><div><span>Activation ID</span><b>${this.esc(d.activation_id||'-')}</b></div><div><span>Revisão</span><b>${this.esc(d.license_revision||'-')}</b></div><div><span>Último check-in</span><b>${this.esc(d.last_checkin_at||'-')}</b></div><div><span>Lease válida até</span><b>${this.esc(d.lease_valid_until||'-')}</b></div><div class="wide"><span>Servidor</span><b>${this.esc(d.server_url||'-')}</b></div><div class="wide"><span>Módulos</span><b>${this.esc((d.modules||[]).join(', ')||'-')}</b></div>${d.last_checkin_error?`<div class="wide"><span>Último erro de comunicação</span><b class="bad">${this.esc(d.last_checkin_error)}</b></div>`:''}${d.error?`<div class="wide"><span>Diagnóstico</span><b class="bad">${this.esc(d.error)}</b></div>`:''}</div>`}
  async clearLicense(){if(!confirm("Remover a licença atual desta instalação?"))return;try{await this._hass.callWS({type:"cloudpelizzon/core/license/clear"});this.hideLicense();await this.load();this.toast("Licença removida.")}catch(e){this.toast(e?.message||String(e),"error")}}
  showRequest(sku){this.requestSku=sku;this.requestResult=null;this.render();queueMicrotask(()=>this.shadowRoot.querySelector("#request-name")?.focus())}
  hideRequest(){this.requestSku=null;this.requestResult=null;this.render()}
  async submitRequest(){const sku=this.requestSku;if(!sku)return;const q=id=>this.shadowRoot.querySelector(id);const payload={type:"cloudpelizzon/core/commercial/request",sku,name:q("#request-name")?.value?.trim()||"",phone:q("#request-phone")?.value?.trim()||"",email:q("#request-email")?.value?.trim()||"",subject:q("#request-subject")?.value?.trim()||"",message:q("#request-message")?.value?.trim()||""};if(!payload.name||!payload.phone||!payload.email||!payload.subject||!payload.message)return this.toast("Preencha todos os campos da solicitação.","error");if(!/^\S+@\S+\.\S+$/.test(payload.email))return this.toast("Informe um e-mail válido.","error");const btn=q("[data-send-request]");if(btn){btn.disabled=true;btn.innerHTML='<ha-icon icon="mdi:loading" class="rot"></ha-icon> Enviando...'}try{const r=await this._hass.callWS(payload);this.requestResult=r;this.render();this.toast("Solicitação registrada com sucesso.")}catch(e){this.toast(e?.message||String(e),"error");if(btn){btn.disabled=false;btn.textContent="Enviar solicitação"}}}
  openWhatsapp(){const url=this.requestResult?.whatsapp_url;if(url)window.open(url,"_blank","noopener,noreferrer")}
  toast(msg,type="success"){const el=this.shadowRoot.querySelector("#toast");if(!el)return;clearTimeout(this.toastTimer);el.textContent=msg;el.className=`toast show ${type}`;this.toastTimer=setTimeout(()=>el.className="toast",3500)}
  render(){if(this.loading){this.shadowRoot.innerHTML=`${this.css()}<div class="center"><div class="spin"></div><div><b>CloudPelizzon Control Center</b><small>Carregando...</small></div></div>`;return}if(this.error){this.shadowRoot.innerHTML=`${this.css()}<div class="center error"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><b>Falha ao carregar</b><small>${this.esc(this.error)}</small></div></div>`;return}if(!this.data)return;this.shadowRoot.innerHTML=`${this.css()}${this.selectedSku?this.renderDetail(this.selectedSku):this.renderHome()}${this.renderLicenseModal()}${this.renderRequestModal()}${this.renderMaintenancePreviewModal()}<div id="toast" class="toast"></div>`;this.installGlobalLayoutFix();this.injectEnergyDetails();this.bind();this.openLicenseFromUrl()}
  openLicenseFromUrl(){
    const url=new URL(window.location.href);
    if(url.searchParams.get("cp_open_license")!=="1")return;
    url.searchParams.delete("cp_open_license");
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
    this.showLicense();
  }
  renderHome(){const mods=this.data.modules||[],active=mods.filter(x=>x.license?.allowed),locked=mods.filter(x=>!x.license?.allowed),s=this.licenseSummary();return `<main class="cc">
    <section class="hero"><div class="brand"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">CLOUDPELIZZON CONTROL CENTER</span><h1>Sua automação. Seus módulos. <em>Uma única plataforma.</em></h1><p>Gerencie experiências ativas, licenciamento e descubra novas capacidades para a residência.</p></div></div><div class="hero-state"><span class="pulse"></span><div><small>SISTEMA</small><b>Conectado</b></div><div><small>CORE</small><b>${this.esc(this.data.core_version)}</b></div></div></section>
    <section class="summary"><article><ha-icon icon="mdi:key-variant"></ha-icon><span>LICENÇA</span><b>${this.esc(s.label)}</b></article><article><ha-icon icon="mdi:view-grid-plus-outline"></ha-icon><span>MÓDULOS ATIVOS</span><b>${s.active} de ${s.total}</b></article><article><ha-icon icon="mdi:cloud-check-outline"></ha-icon><span>VALIDAÇÃO ONLINE</span><b>${this.data?.license?.online_status==='active'?'Conectada':'Pendente'}</b></article><article class="installation"><div><span>ID DA INSTALAÇÃO • copie para emitir a licença</span><code>${this.esc(this.data.installation_id)}</code></div><button data-license><ha-icon icon="mdi:key-chain-variant"></ha-icon>Gerenciar licença</button></article></section>
    ${active.length?`<section class="block"><header><div><span class="eyebrow">SEUS MÓDULOS</span><h2>Experiências ativas</h2><p>Os módulos licenciados abrem diretamente o dashboard real. “Detalhes” mostra a vitrine completa.</p></div></header><div class="active-grid cp-compact">${active.map(m=>this.activeCard(m)).join("")}</div></section>`:""}
    <section class="block"><header><div><span class="eyebrow">EXPANDA SUA EXPERIÊNCIA</span><h2>Descubra o ecossistema CloudPelizzon</h2><p>Cada módulo abaixo possui uma demonstração rica com indicadores, funcionalidades e dashboards antes da contratação.</p></div></header><div class="catalog">${locked.map(m=>this.lockedCard(m)).join("")}</div></section>
  </main>`}
  activeCard(m){
    const d=CP_MODULES[m.sku]||{};
    const hasRealPreview=m.sku==="CP-MAINTENANCE"||m.sku==="CP-ENERGY"||m.sku==="CP-SECURITY";
    const preview=hasRealPreview?this.renderFixedHomePreview(m.sku):`<div class="mini-demo">${this.metricTiles(d.metrics||[])}</div>`;
    return `<article class="locked-card active-compact-card" data-open-card="${this.esc(m.path||'')}">
      <div class="locked-head"><span class="sku">${this.esc(m.sku)}</span><span class="licensed">✓ ${this.esc(this.statusLabel(m.license))}</span></div>
      <div class="locked-demo">${preview}</div>
      <div class="locked-copy">
        <span class="eyebrow">${this.esc(d.kicker||'MÓDULO ATIVO')}</span>
        <h3>${this.esc(m.name)}</h3>
        <p>${this.esc(d.tagline||m.description)}</p>
        <div class="see">Clique na imagem para ver a vitrine completa <ha-icon icon="mdi:arrow-top-right"></ha-icon></div>
        <div class="actions">
          <button class="secondary" data-detail="${this.esc(m.sku)}">Ver detalhes</button>
          <button class="primary" data-open="${this.esc(m.path||'')}">Abrir módulo <ha-icon icon="mdi:arrow-right"></ha-icon></button>
        </div>
      </div>
    </article>`;
  }

  lockedCard(m){const d=CP_MODULES[m.sku]||{};const preview=(m.sku==="CP-MAINTENANCE"||m.sku==="CP-ENERGY")?this.renderFixedHomePreview(m.sku):this.renderHomeCarousel(m.sku);return `<article class="locked-card" data-detail="${this.esc(m.sku)}"><div class="locked-head"><span class="sku">${this.esc(m.sku)}</span><span class="locked-state">🔒 ${this.esc(this.statusLabel(m.license))}</span></div><div class="locked-demo">${preview}</div><div class="locked-copy"><span class="eyebrow">${this.esc(d.kicker||'MÓDULO CLOUDPELIZZON')}</span><h3>${this.esc(m.name)}</h3><p>${this.esc(d.tagline||m.description)}</p><div class="see">Explorar funcionalidades e dashboards <ha-icon icon="mdi:arrow-top-right"></ha-icon></div></div></article>`}
  renderFixedHomePreview(sku){

    if(sku==="CP-SECURITY"){

      return `
        <div
          class="home-static-preview security-fixed"
          data-detail="CP-SECURITY">

          <div class="home-real-shot">

            <img
              src="${CP_BASE}/showcase/security-preview-01-visao-geral.png?v=033"
              alt="CloudPelizzon Segurança - Visão Geral">

          </div>

          <div class="home-slide-caption">

            <b>
              Visão Geral de Segurança
            </b>

            <span>
              Proteção, presença, perímetro,
              sensores e estado da residência.
            </span>

          </div>

        </div>
      `;

    }

    if(sku==="CP-ENERGY"){
      return `<div class="home-static-preview energy-flow-fixed" data-detail="CP-ENERGY">
        <div class="home-real-shot">
          <img src="${CP_BASE}/showcase/energy-flow-tempo-real.png?v=540" alt="Fluxo de Energia em Tempo Real">
        </div>
        <div class="home-slide-caption">
          <b>Fluxo de Energia em Tempo Real</b>
          <span>Geração, casa, importação e exportação em uma única malha.</span>
        </div>
      </div>`;
    }
    const previews=sku==="CP-MAINTENANCE"?CP_MAINT_PREVIEWS:[];
    if(!previews.length)return this.renderHomeCarousel(sku);
    const x=previews[0];
    return `<div class="home-static-preview" data-detail="${this.esc(sku)}">
      <div class="home-real-shot"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"></div>
      <div class="home-slide-caption"><b>${this.esc(x.title)}</b><span>${this.esc(x.desc)}</span></div>
    </div>`;
  }

  renderHomeCarousel(sku){
    const d=CP_MODULES[sku]||{};
    const boards=(d.boards||[
      "Dashboard 1",
      "Dashboard 2",
      "Dashboard 3",
      "Dashboard 4"
    ]).slice(0,4);

    const securityPreviews=[
      {
        file:"security-preview-01-visao-geral.png",
        title:"Visão Geral",
        desc:"Estado da proteção, modos, sensores, perímetro e visão consolidada da residência."
      },
      {
        file:"security-preview-02-central-alarme.png",
        title:"Central de Alarme",
        desc:"Armamento, desarmamento, pânico, atrasos, presença e status operacional."
      },
      {
        file:"security-preview-03-perimetro.png",
        title:"Perímetro",
        desc:"Portas, janelas, cerca, portões, áreas externas e zonas monitoradas."
      },
      {
        file:"security-preview-04-cameras-eventos.png",
        title:"Câmeras e Eventos",
        desc:"Câmeras, eventos recentes, incidentes, dispositivos e ações rápidas."
      }
    ];

    let real=null;

    if(sku==="CP-MAINTENANCE"){
      real=CP_MAINT_PREVIEWS;
    }

    if(sku==="CP-SECURITY"){
      real=securityPreviews;
    }

    const slides=real
      ? real.map(
          (x,i)=>`
            <div
              class="home-slide ${i===0?'on':''}"
              data-home-slide="${i}">

              <div class="home-real-shot">
                <img
                  src="${CP_BASE}/showcase/${x.file}"
                  alt="${this.esc(x.title)}">
              </div>

              <div class="home-slide-caption">
                <b>${this.esc(x.title)}</b>
                <span>${this.esc(x.desc)}</span>
              </div>

            </div>
          `
        )
      : boards.map(
          (b,i)=>`
            <div
              class="home-slide synthetic ${i===0?'on':''}"
              data-home-slide="${i}">
              ${this.renderSyntheticHomeSlide(sku,i,b)}
            </div>
          `
        );

    return `
      <div
        class="home-carousel"
        data-home-carousel="${this.esc(sku)}"
        data-current="0">

        <div class="home-carousel-stage">
          ${slides.join("")}
        </div>

        <div class="home-carousel-footer">

          <div class="home-dots">
            ${slides.map(
              (_,i)=>`
                <button
                  type="button"
                  class="${i===0?'on':''}"
                  data-home-dot="${i}"
                  aria-label="Mostrar dashboard ${i+1}">
                </button>
              `
            ).join("")}
          </div>

          <span>
            ${
              sku==="CP-SECURITY"
                ? "Screenshots do módulo • passe o mouse para pausar"
                : "Prévia automática • passe o mouse para pausar"
            }
          </span>

        </div>

      </div>
    `;
  }
  renderSyntheticHomeSlide(sku,index,title){const d=CP_MODULES[sku]||{};const metrics=d.metrics||[],rows=d.rows||[],alerts=d.alerts||[],features=d.features||[];if(index===0)return `<div class="synthetic-slide overview"><div class="synthetic-head"><span>${this.esc(title)}</span><i></i></div><div class="synthetic-kpis">${metrics.slice(0,4).map(x=>`<div><span>${this.esc(x[0])}</span><b>${this.esc(x[1])}</b></div>`).join("")}</div><div class="synthetic-chart"><svg viewBox="0 0 500 120" preserveAspectRatio="none"><path d="M5 92 C70 88,92 38,150 61 S248 105,302 48 S401 30,495 17" fill="none" stroke="#27b8ff" stroke-width="4"/><path d="M5 92 C70 88,92 38,150 61 S248 105,302 48 S401 30,495 17 L495 118 L5 118 Z" fill="rgba(39,184,255,.10)"/></svg></div></div>`;if(index===1)return `<div class="synthetic-slide operation"><div class="synthetic-head"><span>${this.esc(title)}</span><i></i></div><div class="synthetic-rows">${rows.slice(0,5).map((r,i)=>`<div><b>${this.esc(r[0])}</b><span>${this.esc(r[1]||'')}</span><em style="--p:${Math.max(18,92-i*14)}%"></em><strong>${this.esc(r[2]||'OK')}</strong></div>`).join("")}</div></div>`;if(index===2)return `<div class="synthetic-slide status"><div class="synthetic-head"><span>${this.esc(title)}</span><i></i></div><div class="synthetic-status-grid"><div class="synthetic-ring"><b>${this.esc(metrics[0]?.[1]||'92%')}</b><span>indicador</span></div><div class="synthetic-alerts">${alerts.slice(0,4).map((a,i)=>`<div><i class="s${i}"></i><b>${this.esc(a)}</b><span>${i<2?'Agora':'Monitorado'}</span></div>`).join("")}</div></div></div>`;return `<div class="synthetic-slide intelligence"><div class="synthetic-head"><span>${this.esc(title)}</span><i></i></div><div class="synthetic-feature-grid">${features.slice(0,4).map(x=>`<div><ha-icon icon="${this.esc(x[0])}"></ha-icon><span>${this.esc(x[1])}</span></div>`).join("")}</div><div class="synthetic-insight"><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon><div><b>Inteligência operacional</b><span>Contexto, histórico e recomendações reunidos em uma única visão.</span></div></div></div>`}
  setHomeCarousel(carousel,index){if(!carousel)return;const slides=[...carousel.querySelectorAll('[data-home-slide]')],dots=[...carousel.querySelectorAll('[data-home-dot]')];if(!slides.length)return;const next=((Number(index)||0)+slides.length)%slides.length;carousel.dataset.current=String(next);slides.forEach((x,i)=>x.classList.toggle('on',i===next));dots.forEach((x,i)=>x.classList.toggle('on',i===next))}
  startHomeCarousels(){clearInterval(this.carouselTimer);this.carouselTimer=null;const carousels=[...this.shadowRoot.querySelectorAll('[data-home-carousel]')];if(!carousels.length)return;carousels.forEach((c,i)=>{c.dataset.paused='0';c.addEventListener('mouseenter',()=>c.dataset.paused='1');c.addEventListener('mouseleave',()=>c.dataset.paused='0');if(i)c.dataset.current=String(i%Math.max(1,c.querySelectorAll('[data-home-slide]').length))});this.carouselTimer=setInterval(()=>{carousels.forEach(c=>{if(c.dataset.paused==='1')return;this.setHomeCarousel(c,(Number(c.dataset.current)||0)+1)})},5200)}
  renderDetail(sku){const m=this.moduleBySku(sku);if(!m){this.selectedSku=null;return this.renderHome()}const d=CP_MODULES[sku]||{},allowed=!!m.license?.allowed;return `<main class="detail"><div class="topbar"><button data-back><ha-icon icon="mdi:arrow-left"></ha-icon>Voltar ao Control Center</button><div><span class="${allowed?'licensed':'locked-state cp-unlicensed-pill'}">${allowed?'✓':'🔒'} ${this.esc(this.statusLabel(m.license))}</span><button class="secondary" data-license><ha-icon icon="mdi:key-variant"></ha-icon>Licença</button></div></div>
    <section class="product-hero"><div class="product-title"><div><span class="eyebrow">${this.esc(d.kicker||'CLOUDPELIZZON')}</span><span class="sku">${this.esc(m.sku)}</span><h1>${this.esc(m.name)}</h1><p>${this.esc(d.tagline||m.description)}</p></div><div class="cta">${allowed&&m.path?`<button class="primary big" data-open="${this.esc(m.path)}">Abrir módulo <ha-icon icon="mdi:arrow-right"></ha-icon></button>`:`<button class="primary big" data-request="${this.esc(m.sku)}">Solicitar este módulo</button><button class="secondary big" data-license>Já tenho licença</button>`}</div></div>${this.renderProductPreview(sku)}</section>
    <section class="block"><header><div><span class="eyebrow">O QUE ESTE MÓDULO ENTREGA</span><h2>Funcionalidades incluídas</h2><p>Recursos que fazem parte desta experiência CloudPelizzon.</p></div></header><div class="features">${(d.features||[]).map(x=>`<article><div class="ficon"><ha-icon icon="${this.esc(x[0])}"></ha-icon></div><div><h3>${this.esc(x[1])}</h3><p>${this.esc(x[2])}</p></div></article>`).join("")}</div></section>
    <section class="block"><header><div><span class="eyebrow">DASHBOARDS INCLUÍDOS</span><h2>Uma experiência completa, não apenas um card</h2><p>Veja os painéis que compõem o módulo e como a informação é organizada.</p></div></header><div class="board-grid">${(d.boards||[]).map((b,i)=>this.boardPreview(sku,b,i)).join("")}</div></section>
    <section class="buy"><div><span class="eyebrow">CLOUDPELIZZON • ${this.esc(m.sku)}</span><h2>${allowed?'Este módulo já está ativo nesta residência.':`Desbloqueie ${this.esc(m.name)}.`}</h2><p>${allowed?'Abra o dashboard real ou conheça todos os recursos acima.':'A licença é vinculada ao Installation ID e libera o módulo operacional sem expor código de outros produtos.'}</p></div><div>${allowed&&m.path?`<button class="primary big" data-open="${this.esc(m.path)}">Abrir módulo</button>`:`<button class="primary big" data-request="${this.esc(m.sku)}">Quero contratar</button><button class="secondary big" data-license>Ativar licença</button>`}</div></section>
  </main>`}
  metricTiles(metrics){return metrics.slice(0,4).map(x=>`<div><span>${this.esc(x[0])}</span><b>${this.esc(x[1])}</b></div>`).join("")}
  renderProductPreview(sku){
    if(sku==="CP-ENERGY"){
      return `
        <div class="real-module-preview energy-product-preview">
          <div class="real-preview-head">
            <div>
              <span class="eyebrow">DASHBOARDS REAIS DO MÓDULO</span>
              <b>Prévia comercial com as telas reais do CP-ENERGY</b>
            </div>
            <span class="real-chip">5 TELAS REAIS</span>
          </div>
          ${this.renderHomeCarousel("CP-ENERGY")}
          <div class="real-preview-note">
            <ha-icon icon="mdi:shield-lock-outline"></ha-icon>
            <div>
              <b>Visualização comercial</b>
              <span>A operação e os dados reais ficam liberados somente após o licenciamento desta instalação.</span>
            </div>
          </div>
        </div>`;
    }

    if(sku==="CP-SECURITY"){
      const shots=[
        {
          file:"security-preview-01-visao-geral.png",
          title:"Visão Geral",
          desc:"Central consolidada de proteção e presença."
        },
        {
          file:"security-preview-02-central-alarme.png",
          title:"Central de Alarme",
          desc:"Modos, armamento, status e comandos."
        },
        {
          file:"security-preview-03-perimetro.png",
          title:"Perímetro",
          desc:"Sensores, zonas, cerca e acessos."
        },
        {
          file:"security-preview-04-cameras-eventos.png",
          title:"Câmeras e Eventos",
          desc:"Monitoramento visual, eventos e incidentes."
        }
      ];

      return `
        <div class="real-module-preview">

          <div class="real-preview-head">

            <div>
              <span class="eyebrow">
                TELAS DO CLOUDPELIZZON SEGURANÇA
              </span>

              <b>
                Conheça a experiência antes de contratar
              </b>
            </div>

            <span class="real-chip">
              PRÉVIA COMERCIAL
            </span>

          </div>

          <div class="real-preview-grid">

            ${shots.map(
              x=>`
                <figure class="real-preview-card">

                  <div class="real-preview-image">
                    <img
                      src="${CP_BASE}/showcase/${x.file}"
                      alt="${this.esc(x.title)}">
                  </div>

                  <figcaption>
                    <b>${this.esc(x.title)}</b>
                    <span>${this.esc(x.desc)}</span>
                  </figcaption>

                </figure>
              `
            ).join("")}

          </div>

          <div class="real-preview-note">

            <ha-icon
              icon="mdi:shield-lock-outline">
            </ha-icon>

            <div>
              <b>Visualização comercial</b>
              <span>
                Os dashboards podem ser explorados antes
                da contratação. Operação e comandos são
                liberados somente após o licenciamento.
              </span>
            </div>

          </div>

        </div>
      `;
    }

    if(sku!=="CP-MAINTENANCE")return this.renderDemo(sku,"full");

    return `<div class="real-module-preview"><div class="real-preview-head"><div><span class="eyebrow">DASHBOARDS REAIS DO MÓDULO</span><b>Clique em qualquer tela para abrir em tamanho completo</b></div><span class="real-chip">PRÉVIA BLOQUEADA</span></div><div class="real-preview-grid">${CP_MAINT_PREVIEWS.map((x,i)=>`<figure class="real-preview-card" data-maint-preview="${i}"><div class="real-preview-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div><figcaption><b>${this.esc(x.title)}</b><span>${this.esc(x.desc)}</span></figcaption></figure>`).join("")}</div><div class="real-preview-note"><ha-icon icon="mdi:shield-lock-outline"></ha-icon><div><b>Visualização comercial</b><span>As telas são prévias reais do módulo. A operação, os dados e as ações ficam liberados somente após o licenciamento desta instalação.</span></div></div></div>`
  }

  installGlobalLayoutFix(){
    if(!this.shadowRoot.querySelector("#cp-r5-global-layout")){
      const style=document.createElement("style");
      style.id="cp-r5-global-layout";
      style.textContent=`
        :host{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;overflow-x:hidden!important}
        main{width:100%!important;max-width:none!important;margin:0!important;padding:clamp(12px,1.25vw,24px)!important;box-sizing:border-box!important}
        .hero,.module-detail,.detail,.detail-hero,.section,.active-section,.discover-section{max-width:none!important;width:100%!important;box-sizing:border-box!important}
        .active-grid,.catalog-grid,.boards,.feature-grid,.features,.detail-grid{grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))!important;width:100%!important}
        img{max-width:100%;height:auto}
        .cp-unlicensed-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:max-content!important;min-width:0!important;max-width:none!important;height:34px!important;min-height:34px!important;padding:0 12px!important;margin:0!important;border-radius:999px!important;white-space:nowrap!important;line-height:1!important;position:relative!important;inset:auto!important;box-sizing:border-box!important;vertical-align:middle!important;flex:0 0 auto!important}
        .cp-unlicensed-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:10px!important;flex-wrap:wrap!important;min-width:0!important}
        @media(max-width:900px){
          main{padding:10px!important}
          .hero{padding:18px!important}
          .active-grid,.catalog-grid,.boards,.feature-grid,.features,.detail-grid{grid-template-columns:1fr!important}
        }
      `;
      this.shadowRoot.appendChild(style);
    }
    const candidates=[...this.shadowRoot.querySelectorAll("span,button,div")];
    const pill=candidates.find(el=>el.textContent?.trim()==="Não contratado");
    if(pill){
      pill.classList.add("cp-unlicensed-pill");
      pill.parentElement?.classList.add("cp-unlicensed-actions");
    }
  }

  injectEnergyDetails(){
    if(this.selectedSku!=="CP-ENERGY")return;
    if(this.shadowRoot.querySelector("#cp-energy-real-gallery"))return;

    const first=CP_ENERGY_PREVIEWS[0];
    const toast=this.shadowRoot.querySelector("#toast");
    const wrap=document.createElement("section");
    wrap.id="cp-energy-real-gallery";
    wrap.className="energy-real-gallery";
    wrap.innerHTML=`
      <style>
        .energy-real-gallery{width:100%;max-width:none;margin:18px 0 28px;padding:18px;border:1px solid #174461;border-radius:18px;background:linear-gradient(150deg,#071d2b,#04131d);box-sizing:border-box}
        .erg-head{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;margin-bottom:14px}
        .erg-head span{display:block;color:#35c8ff;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .erg-head h2{margin:5px 0 3px;color:#f2fbff;font-size:22px}
        .erg-head p{margin:0;color:#86a9ba;font-size:11px}
        .erg-badge{white-space:nowrap;padding:7px 10px;border:1px solid #225875;border-radius:999px;color:#8edfff;background:#061923;font-size:9px;font-weight:900}
        .erg-carousel{display:grid;grid-template-columns:48px minmax(0,1fr) 48px;gap:10px;align-items:center}
        .erg-stage{overflow:hidden;border:1px solid #164861;border-radius:14px;background:#020b12;min-width:0}
        .erg-stage button{display:block;width:100%;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;text-align:left}
        .erg-stage img{display:block;width:100%;max-height:min(68vh,820px);object-fit:contain;object-position:center top;background:#020914}
        .erg-copy{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:12px 14px;border-top:1px solid #10394d;background:linear-gradient(180deg,#071923,#04121b)}
        .erg-copy b{display:block;color:#e9f8ff;font-size:13px}
        .erg-copy span{display:block;margin-top:3px;color:#789bad;font-size:9px;line-height:1.4}
        .erg-nav{height:74px;border:1px solid #1d5877;border-radius:12px;background:#072035;color:#d8f4ff;cursor:pointer;font-size:28px}
        .erg-dots{display:flex;justify-content:center;gap:8px;margin-top:12px}
        .erg-dots button{width:10px;height:10px;padding:0;border-radius:999px;border:1px solid #26769c;background:#082334;cursor:pointer}
        .erg-dots button.on{background:#35c8ff;box-shadow:0 0 15px rgba(53,200,255,.7)}
        .energy-shot-modal{position:fixed;inset:0;z-index:99999;display:none;place-items:center;padding:24px;background:rgba(0,6,11,.92);backdrop-filter:blur(10px)}
        .energy-shot-modal.show{display:grid}
        .esm-card{width:min(1760px,96vw);max-height:94vh;border:1px solid #1a668e;border-radius:16px;background:#020914;overflow:hidden}
        .esm-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 14px;border-bottom:1px solid #153f54;background:#061823}
        .esm-head b{color:#f0fbff;font-size:14px}
        .esm-head span{display:block;color:#789bac;font-size:9px;margin-top:2px}
        .esm-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid #225873;border-radius:10px;background:#082033;color:#cceeff;cursor:pointer}
        .esm-stage{display:grid;grid-template-columns:50px minmax(0,1fr) 50px;align-items:center;gap:8px;padding:10px;max-height:calc(94vh - 64px);overflow:auto}
        .esm-stage img{display:block;width:100%;height:auto;max-height:calc(94vh - 90px);object-fit:contain;margin:auto}
        .esm-nav{height:64px;border:1px solid #1d5877;border-radius:12px;background:#072035;color:#d8f4ff;cursor:pointer;font-size:28px}
        @media(max-width:800px){
          .erg-head{align-items:flex-start;flex-direction:column}
          .erg-carousel{grid-template-columns:38px minmax(0,1fr) 38px;gap:5px}
          .erg-nav{height:54px}
          .energy-shot-modal{padding:6px}
          .esm-stage{grid-template-columns:38px minmax(0,1fr) 38px;padding:5px}
        }
      </style>
      <div class="erg-head">
        <div>
          <span>CP-ENERGY • DASHBOARDS REAIS</span>
          <h2>Conheça a experiência Energia</h2>
          <p>As telas abaixo são imagens reais do módulo em operação.</p>
        </div>
        <div class="erg-badge">${CP_ENERGY_PREVIEWS.length} telas</div>
      </div>

      <div class="erg-carousel" data-energy-inline-carousel>
        <button type="button" class="erg-nav" data-energy-carousel-prev>‹</button>
        <div class="erg-stage">
          <button type="button" data-energy-shot="0">
            <img id="energy-inline-image" src="${CP_BASE}/showcase/${first.file}" alt="${this.esc(first.title)}">
            <span class="erg-copy">
              <span>
                <b id="energy-inline-title">${this.esc(first.title)}</b>
                <span id="energy-inline-desc">${this.esc(first.desc)}</span>
              </span>
              <ha-icon icon="mdi:magnify-plus-outline"></ha-icon>
            </span>
          </button>
        </div>
        <button type="button" class="erg-nav" data-energy-carousel-next>›</button>
      </div>

      <div class="erg-dots">
        ${CP_ENERGY_PREVIEWS.map((_,i)=>`<button type="button" class="${i===0?'on':''}" data-energy-carousel-dot="${i}" aria-label="Tela ${i+1}"></button>`).join("")}
      </div>

      <div id="energy-shot-modal" class="energy-shot-modal">
        <div class="esm-card">
          <div class="esm-head">
            <div><b id="energy-shot-title"></b><span id="energy-shot-desc"></span></div>
            <button type="button" class="esm-close" data-energy-close><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="esm-stage">
            <button type="button" class="esm-nav" data-energy-prev>‹</button>
            <img id="energy-shot-image" alt="">
            <button type="button" class="esm-nav" data-energy-next>›</button>
          </div>
        </div>
      </div>`;

    if(toast)toast.before(wrap);else this.shadowRoot.appendChild(wrap);
    this.energyCarouselIndex=0;
    this.startEnergyCarousel();
  }
  setEnergyCarousel(index){
    this.energyCarouselIndex=((Number(index)||0)+CP_ENERGY_PREVIEWS.length)%CP_ENERGY_PREVIEWS.length;
    const x=CP_ENERGY_PREVIEWS[this.energyCarouselIndex];
    const img=this.shadowRoot.querySelector("#energy-inline-image");
    if(img){img.src=`${CP_BASE}/showcase/${x.file}`;img.alt=x.title}
    const title=this.shadowRoot.querySelector("#energy-inline-title");
    if(title)title.textContent=x.title;
    const desc=this.shadowRoot.querySelector("#energy-inline-desc");
    if(desc)desc.textContent=x.desc;
    const shot=this.shadowRoot.querySelector(".erg-stage [data-energy-shot]");
    if(shot)shot.dataset.energyShot=String(this.energyCarouselIndex);
    this.shadowRoot.querySelectorAll("[data-energy-carousel-dot]").forEach((b,i)=>b.classList.toggle("on",i===this.energyCarouselIndex));
  }
  stepEnergyCarousel(delta){
    this.setEnergyCarousel((this.energyCarouselIndex||0)+delta);
    this.startEnergyCarousel();
  }
  startEnergyCarousel(){
    if(this._energyCarouselTimer)clearInterval(this._energyCarouselTimer);
    if(this.selectedSku!=="CP-ENERGY"||CP_ENERGY_PREVIEWS.length<2)return;
    this._energyCarouselTimer=setInterval(()=>{
      if(this.selectedSku==="CP-ENERGY")this.setEnergyCarousel((this.energyCarouselIndex||0)+1);
    },5500);
  }

  openEnergyPreview(index=0){
    this.energyPreviewIndex=((Number(index)||0)+CP_ENERGY_PREVIEWS.length)%CP_ENERGY_PREVIEWS.length;
    this.updateEnergyPreview();
    this.shadowRoot.querySelector("#energy-shot-modal")?.classList.add("show")
  }
  closeEnergyPreview(){
    this.shadowRoot.querySelector("#energy-shot-modal")?.classList.remove("show")
  }
  stepEnergyPreview(delta){
    this.energyPreviewIndex=(Number(this.energyPreviewIndex||0)+delta+CP_ENERGY_PREVIEWS.length)%CP_ENERGY_PREVIEWS.length;
    this.updateEnergyPreview()
  }
  updateEnergyPreview(){
    const x=CP_ENERGY_PREVIEWS[Number(this.energyPreviewIndex||0)]||CP_ENERGY_PREVIEWS[0];
    const img=this.shadowRoot.querySelector("#energy-shot-image");
    if(img){img.src=`${CP_BASE}/showcase/${x.file}`;img.alt=x.title}
    const t=this.shadowRoot.querySelector("#energy-shot-title");
    if(t)t.textContent=x.title;
    const d=this.shadowRoot.querySelector("#energy-shot-desc");
    if(d)d.textContent=x.desc
  }

  renderMaintenancePreviewModal(){const item=CP_MAINT_PREVIEWS[this.previewIndex]||CP_MAINT_PREVIEWS[0];return `<div id="maint-preview-modal" class="preview-modal"><div class="preview-modal-head"><div><span class="eyebrow">CLOUDPELIZZON MANUTENÇÃO • PRÉVIA</span><b id="maint-preview-title">${this.esc(item.title)}</b><span id="maint-preview-desc">${this.esc(item.desc)}</span></div><button data-close-maint-preview><ha-icon icon="mdi:close"></ha-icon></button></div><div class="preview-modal-stage"><button class="preview-nav prev" data-preview-prev><ha-icon icon="mdi:chevron-left"></ha-icon></button><img id="maint-preview-image" src="${CP_BASE}/showcase/${item.file}" alt="${this.esc(item.title)}"><button class="preview-nav next" data-preview-next><ha-icon icon="mdi:chevron-right"></ha-icon></button></div><div class="preview-modal-thumbs">${CP_MAINT_PREVIEWS.map((x,i)=>`<button data-preview-thumb="${i}" class="${i===this.previewIndex?'on':''}">${i+1}. ${this.esc(x.title)}</button>`).join("")}</div></div>`}
  openMaintenancePreview(index=0){this.previewIndex=((Number(index)||0)+CP_MAINT_PREVIEWS.length)%CP_MAINT_PREVIEWS.length;this.updateMaintenancePreview();this.shadowRoot.querySelector("#maint-preview-modal")?.classList.add("show")}
  closeMaintenancePreview(){this.shadowRoot.querySelector("#maint-preview-modal")?.classList.remove("show")}
  stepMaintenancePreview(delta){this.previewIndex=(this.previewIndex+delta+CP_MAINT_PREVIEWS.length)%CP_MAINT_PREVIEWS.length;this.updateMaintenancePreview()}
  updateMaintenancePreview(){const item=CP_MAINT_PREVIEWS[this.previewIndex];const img=this.shadowRoot.querySelector("#maint-preview-image");if(img){img.src=`${CP_BASE}/showcase/${item.file}`;img.alt=item.title}const t=this.shadowRoot.querySelector("#maint-preview-title");if(t)t.textContent=item.title;const d=this.shadowRoot.querySelector("#maint-preview-desc");if(d)d.textContent=item.desc;this.shadowRoot.querySelectorAll("[data-preview-thumb]").forEach((b,i)=>b.classList.toggle("on",i===this.previewIndex))}
  renderDemo(sku,size="full"){const d=CP_MODULES[sku]||{};const metrics=d.metrics||[],rows=d.rows||[],alerts=d.alerts||[];return `<div class="demo ${size}"><div class="demo-top"><div class="demo-brand"><span>DEMONSTRAÇÃO</span><b>${this.esc((d.kicker||sku).replaceAll('_',' '))}</b></div><div class="demo-live"><i></i> dados ilustrativos</div></div><div class="demo-metrics">${this.metricTiles(metrics)}</div><div class="demo-main"><div class="chart"><div class="chart-title"><b>Evolução e indicadores</b><span>últimos períodos</span></div><svg viewBox="0 0 700 210" preserveAspectRatio="none"><defs><linearGradient id="g${sku.replaceAll('-','')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1ca9ff" stop-opacity=".32"/><stop offset="100%" stop-color="#1ca9ff" stop-opacity="0"/></linearGradient></defs><path d="M10 170 C90 160,120 90,190 120 S310 175,370 95 S490 45,550 115 S640 125,690 55 L690 205 L10 205 Z" fill="url(#g${sku.replaceAll('-','')})"/><path d="M10 170 C90 160,120 90,190 120 S310 175,370 95 S490 45,550 115 S640 125,690 55" fill="none" stroke="#1ca9ff" stroke-width="4"/><g fill="#62caff">${[10,190,370,550,690].map((x,i)=>`<circle cx="${x}" cy="${[170,120,95,115,55][i]}" r="6"/>`).join('')}</g></svg></div><div class="alerts"><div class="chart-title"><b>Status operacional</b><span>visão rápida</span></div>${alerts.slice(0,4).map((a,i)=>`<div><span class="dot d${i}"></span><b>${this.esc(a)}</b><em>${i===0?'Agora':i===1?'Hoje':'Monitorado'}</em></div>`).join('')}</div></div>${size!=="mini"?`<div class="demo-bottom"><div class="table"><div class="chart-title"><b>Visão consolidada</b><span>dados de exemplo</span></div>${rows.slice(0,5).map(r=>`<div>${r.map((c,j)=>`<${j===0?'b':'span'}>${this.esc(c)}</${j===0?'b':'span'}>`).join('')}</div>`).join('')}</div><div class="gauge"><div class="ring"><b>${this.esc(metrics[0]?.[1]||'92%')}</b><span>indicador</span></div><div><b>Inteligência CloudPelizzon</b><p>Indicadores, histórico, contexto e ações reunidos em uma única experiência.</p></div></div></div>`:''}</div>`}
  boardPreview(sku,name,i){
    const d=CP_MODULES[sku]||{};
    const labels=["Indicadores executivos","Operação e acompanhamento","Histórico e análise","Inteligência e recomendações"];

    if(sku==="CP-MAINTENANCE"&&i<CP_MAINT_PREVIEWS.length){
      const x=CP_MAINT_PREVIEWS[i];
      return `<article class="board real-board" data-maint-preview="${i}"><div class="board-real-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div><div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(name)}</h3><p>${this.esc(x.title)} • ${this.esc(x.desc)}</p></div></div></article>`;
    }

    if(sku==="CP-ENERGY"&&CP_ENERGY_PREVIEWS.length){
      const idx=i%CP_ENERGY_PREVIEWS.length;
      const x=CP_ENERGY_PREVIEWS[idx];
      return `<article class="board real-board" data-energy-shot="${idx}"><div class="board-real-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div><div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(name)}</h3><p>${this.esc(x.title)} • ${this.esc(x.desc)}</p></div></div></article>`;
    }

    if(sku==="CP-SECURITY"){
      const shots=[
        {
          file:"security-preview-01-visao-geral.png",
          title:"Visão Geral",
          desc:"Proteção consolidada."
        },
        {
          file:"security-preview-02-central-alarme.png",
          title:"Central de Alarme",
          desc:"Estados e comandos."
        },
        {
          file:"security-preview-03-perimetro.png",
          title:"Perímetro",
          desc:"Zonas e acessos."
        },
        {
          file:"security-preview-04-cameras-eventos.png",
          title:"Câmeras e Eventos",
          desc:"Monitoramento e incidentes."
        }
      ];

      const x=
        shots[
          i % shots.length
        ];

      return `
        <article class="board real-board">

          <div class="board-real-image">

            <img
              src="${CP_BASE}/showcase/${x.file}"
              alt="${this.esc(x.title)}">

          </div>

          <div class="board-copy">

            <span>
              ${String(i+1).padStart(2,'0')}
            </span>

            <div>
              <h3>${this.esc(name)}</h3>
              <p>
                ${this.esc(x.title)}
                •
                ${this.esc(x.desc)}
              </p>
            </div>

          </div>

        </article>
      `;
    }

    return `<article class="board"><div class="board-demo">${this.renderDemo(sku,"mini")}</div><div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(name)}</h3><p>${this.esc(labels[i%labels.length])}</p></div></div></article>`;
  }
  renderLicenseModal(){const l=this.data?.license||{};return `<div id="license-modal" class="modal"><div class="backdrop" data-close-license></div><section class="modal-card"><button class="x" data-close-license><ha-icon icon="mdi:close"></ha-icon></button><div class="modal-head"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">LICENCIAMENTO CLOUDPELIZZON • CORE R5</span><h2>Licença, ativação online e diagnóstico</h2><p>O módulo comercial só é liberado após validar a chave CP1 e receber uma lease CP2 do servidor CloudPelizzon.</p></div></div><div class="license-cards"><div><span>ID da instalação</span><code>${this.esc(this.data?.installation_id)}</code></div><div><span>Status online</span><b>${this.esc(l.online_status||'not_activated')}</b></div><div><span>Cliente</span><b>${this.esc(l.customer||'-')}</b></div><div><span>Validade CP1</span><b>${this.esc(l.expires_at||'Sem licença')}</b></div><div><span>Activation ID</span><code>${this.esc(l.activation_id||'-')}</code></div><div><span>Lease CP2 válida até</span><b>${this.esc(l.lease_valid_until||'-')}</b></div><div class="wide"><span>Servidor de licenciamento</span><code>${this.esc(l.server_url||'-')}</code></div></div><div id="license-diagnostics" class="diagnostics"></div><div class="license-tools"><button class="secondary" data-diagnose><ha-icon icon="mdi:stethoscope"></ha-icon>Diagnosticar</button>${l.activation_id?`<button class="secondary" data-checkin><ha-icon icon="mdi:cloud-sync-outline"></ha-icon>Validar agora</button>`:''}</div><label>Chave CP1<textarea id="license-token" rows="5" placeholder="CP1..."></textarea></label><div class="modal-actions">${l.present?`<button class="danger" data-clear-license>Remover licença</button>`:''}<button class="secondary" data-close-license>Cancelar</button><button class="primary" data-activate>Ativar e validar online</button></div><small class="security-note">Para emitir uma licença, copie o ID da instalação acima e informe-o na Central de Licenciamento CloudPelizzon. Após a ativação, o Core faz check-ins automáticos e mantém tolerância offline por lease assinada.</small></section></div>`}
  renderRequestModal(){if(!this.requestSku)return"";const m=this.moduleBySku(this.requestSku)||{sku:this.requestSku,name:this.requestSku};const customer=this.data?.license?.customer||"";if(this.requestResult){const emailOk=this.requestResult.email_status==="sent";const crm=this.requestResult.dolibarr_status||"registrado";return `<div id="request-modal" class="modal show"><div class="backdrop" data-close-request></div><section class="modal-card request-card"><button class="x" data-close-request><ha-icon icon="mdi:close"></ha-icon></button><div class="request-success"><div class="success-orb"><ha-icon icon="mdi:check-decagram-outline"></ha-icon></div><span class="eyebrow">SOLICITAÇÃO CLOUDPELIZZON</span><h2>Recebemos seu interesse em ${this.esc(m.name)}.</h2><p>A solicitação <b>${this.esc(this.requestResult.request_id||"")}</b> foi registrada. ${emailOk?"Uma notificação também foi encaminhada por e-mail.":"O registro está salvo no servidor; use o WhatsApp abaixo como canal complementar."}</p><div class="request-statuses"><span>✓ Registro comercial</span><span>${emailOk?"✓":"!"} E-mail: ${this.esc(this.requestResult.email_status||"pendente")}</span><span>CRM: ${this.esc(crm)}</span></div><div class="request-success-actions"><button class="secondary" data-close-request>Fechar</button>${this.requestResult.whatsapp_url?`<button class="whatsapp" data-whatsapp><ha-icon icon="mdi:whatsapp"></ha-icon>Enviar também pelo WhatsApp</button>`:""}</div></div></section></div>`}const subject=`Interesse no módulo ${m.name}`;const message=`Olá, gostaria de receber informações sobre contratação do módulo ${m.name}.`;return `<div id="request-modal" class="modal show"><div class="backdrop" data-close-request></div><section class="modal-card request-card"><button class="x" data-close-request><ha-icon icon="mdi:close"></ha-icon></button><div class="modal-head"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">SOLICITAR MÓDULO • ${this.esc(m.sku)}</span><h2>Fale com a CloudPelizzon</h2><p>Preencha os dados abaixo. A solicitação será vinculada automaticamente a esta instalação.</p></div></div><div class="request-context"><div><span>Módulo</span><b>${this.esc(m.name)}</b></div><div><span>SKU</span><code>${this.esc(m.sku)}</code></div><div class="wide"><span>ID da instalação</span><code>${this.esc(this.data?.installation_id||"-")}</code></div></div><div class="request-grid"><label>Nome *<input id="request-name" value="${this.esc(customer)}" autocomplete="name" placeholder="Seu nome"></label><label>Telefone / WhatsApp *<input id="request-phone" autocomplete="tel" placeholder="(00) 00000-0000"></label><label>E-mail *<input id="request-email" type="email" autocomplete="email" placeholder="voce@email.com"></label><label>Assunto *<input id="request-subject" value="${this.esc(subject)}"></label><label class="wide">Mensagem *<textarea id="request-message" rows="5">${this.esc(message)}</textarea></label></div><div class="modal-actions"><button class="secondary" data-close-request>Cancelar</button><button class="primary" data-send-request><ha-icon icon="mdi:send-outline"></ha-icon>Enviar solicitação</button></div><small class="security-note">Os dados serão enviados ao servidor comercial CloudPelizzon junto com o módulo, SKU, versão do Core e ID desta instalação. Após o registro, você também poderá abrir uma mensagem pré-preenchida no WhatsApp.</small></section></div>`}
  bind(){this.shadowRoot.querySelectorAll('[data-open]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openModule(x.dataset.open)}));this.shadowRoot.querySelectorAll('[data-open-card]').forEach(x=>x.addEventListener('click',e=>{if(e.target.closest('[data-detail],[data-open]'))return;this.openModule(x.dataset.openCard)}));this.shadowRoot.querySelectorAll('[data-detail]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.selectedSku=x.dataset.detail;this.render();scrollTo(0,0)}));this.shadowRoot.querySelector('[data-back]')?.addEventListener('click',()=>{this.selectedSku=null;this.render();scrollTo(0,0)});this.shadowRoot.querySelectorAll('[data-license]').forEach(x=>x.addEventListener('click',()=>this.showLicense()));this.shadowRoot.querySelectorAll('[data-close-license]').forEach(x=>x.addEventListener('click',()=>this.hideLicense()));this.shadowRoot.querySelector('[data-activate]')?.addEventListener('click',()=>this.activateLicense());this.shadowRoot.querySelector('[data-clear-license]')?.addEventListener('click',()=>this.clearLicense());this.shadowRoot.querySelector('[data-diagnose]')?.addEventListener('click',()=>this.diagnoseLicense());this.shadowRoot.querySelector('[data-checkin]')?.addEventListener('click',()=>this.checkinNow());this.shadowRoot.querySelectorAll('[data-request]').forEach(x=>x.addEventListener('click',()=>this.showRequest(x.dataset.request)));this.shadowRoot.querySelectorAll('[data-close-request]').forEach(x=>x.addEventListener('click',()=>this.hideRequest()));this.shadowRoot.querySelector('[data-send-request]')?.addEventListener('click',()=>this.submitRequest());this.shadowRoot.querySelector('[data-whatsapp]')?.addEventListener('click',()=>this.openWhatsapp());this.shadowRoot.querySelectorAll('[data-maint-preview]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openMaintenancePreview(Number(x.dataset.maintPreview))}));this.shadowRoot.querySelectorAll('[data-close-maint-preview]').forEach(x=>x.addEventListener('click',()=>this.closeMaintenancePreview()));this.shadowRoot.querySelector('[data-preview-prev]')?.addEventListener('click',()=>this.stepMaintenancePreview(-1));this.shadowRoot.querySelector('[data-preview-next]')?.addEventListener('click',()=>this.stepMaintenancePreview(1));this.shadowRoot.querySelectorAll('[data-preview-thumb]').forEach(x=>x.addEventListener('click',()=>{this.previewIndex=Number(x.dataset.previewThumb)||0;this.updateMaintenancePreview()}));this.shadowRoot.querySelectorAll('[data-home-dot]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.setHomeCarousel(x.closest('[data-home-carousel]'),Number(x.dataset.homeDot)||0)}));this.shadowRoot.querySelectorAll('[data-energy-shot]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openEnergyPreview(Number(x.dataset.energyShot)||0)}));this.shadowRoot.querySelectorAll('[data-energy-close]').forEach(x=>x.addEventListener('click',()=>this.closeEnergyPreview()));this.shadowRoot.querySelector('[data-energy-prev]')?.addEventListener('click',()=>this.stepEnergyPreview(-1));this.shadowRoot.querySelector('[data-energy-next]')?.addEventListener('click',()=>this.stepEnergyPreview(1));this.shadowRoot.querySelector('#energy-shot-modal')?.addEventListener('click',e=>{if(e.target?.id==='energy-shot-modal')this.closeEnergyPreview()});this.shadowRoot.querySelector('[data-energy-carousel-prev]')?.addEventListener('click',()=>this.stepEnergyCarousel(-1));this.shadowRoot.querySelector('[data-energy-carousel-next]')?.addEventListener('click',()=>this.stepEnergyCarousel(1));this.shadowRoot.querySelectorAll('[data-energy-carousel-dot]').forEach(x=>x.addEventListener('click',()=>{this.setEnergyCarousel(Number(x.dataset.energyCarouselDot)||0);this.startEnergyCarousel()}));this.startHomeCarousels()}
  css(){return `<style>
    :host{display:block;min-height:100vh;background:#020a12;color:#edf8ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}button{font:inherit;cursor:pointer}.cc,.detail{width:min(1740px,calc(100vw - 28px));margin:auto;padding:20px 0 36px}.eyebrow{display:block;color:#2db6ff;font-size:9px;font-weight:900;letter-spacing:.18em}.hero{position:relative;display:flex;justify-content:space-between;align-items:center;gap:24px;min-height:190px;padding:25px 28px;border:1px solid rgba(47,170,235,.35);border-radius:24px;background:radial-gradient(circle at 17% 10%,rgba(31,142,231,.18),transparent 28%),linear-gradient(135deg,#061a29,#031019);overflow:hidden}.hero:after{content:"";position:absolute;width:520px;height:520px;border:1px solid rgba(34,160,229,.15);border-radius:50%;right:-170px;top:-270px;box-shadow:0 0 0 48px rgba(35,150,220,.03),0 0 0 100px rgba(35,150,220,.02)}.brand{display:flex;gap:25px;align-items:center;position:relative;z-index:1}.brand img{width:300px;max-height:94px;object-fit:contain}.brand h1{font-size:34px;line-height:1.08;margin:6px 0 8px;max-width:700px}.brand h1 em{font-style:normal;color:#54c8ff}.brand p{max-width:720px;color:#88a7b7;font-size:12px;line-height:1.55}.hero-state{position:relative;z-index:1;display:flex;gap:18px;align-items:center;padding:12px 15px;border:1px solid rgba(49,154,205,.22);border-radius:15px;background:rgba(4,18,28,.72)}.hero-state>div{display:flex;flex-direction:column}.hero-state small{color:#5f8497;font-size:8px;font-weight:900}.hero-state b{font-size:11px}.pulse{width:8px;height:8px;border-radius:50%;background:#2db6ff;box-shadow:0 0 18px #2db6ff}.summary{display:grid;grid-template-columns:220px 220px 220px minmax(420px,1fr);gap:10px;margin:12px 0 26px}.summary>article{min-height:76px;display:flex;gap:11px;align-items:center;padding:13px;border-radius:15px;background:#061722;border:1px solid rgba(48,139,184,.25)}.summary ha-icon{color:#38bfff}.summary span{display:block;color:#62879a;font-size:8px;font-weight:900}.summary b{font-size:15px}.installation{justify-content:space-between!important}.installation code{display:block;margin-top:4px;color:#a6ddf7;font-size:9px;word-break:break-all}.installation button,.primary,.secondary,.danger{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:10px;padding:9px 13px;font-weight:900;font-size:10px}.installation button,.primary{border:1px solid #42bfff;background:linear-gradient(135deg,#0665ad,#119cf4);color:white;box-shadow:0 0 28px rgba(24,153,255,.13)}.secondary{border:1px solid rgba(89,157,190,.35);background:#0a2230;color:#c8e8f7}.danger{border:1px solid #d85b67;background:#4b1f27;color:#ffe8eb}.big{padding:12px 18px;font-size:11px}.block{margin:28px 0}.block>header{display:flex;justify-content:space-between;align-items:end;margin-bottom:12px}.block h2{font-size:25px;margin:4px 0}.block p{color:#7293a3;font-size:11px}.active-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.active-card{position:relative;min-height:350px;overflow:hidden;border:1px solid rgba(41,171,237,.42);border-radius:22px;background:#04131e;cursor:pointer}.active-back{position:absolute;inset:0;background-image:var(--bg);background-size:cover;background-position:center;filter:saturate(1.1) brightness(.8);transform:scale(1.02)}.active-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,10,17,.98) 0%,rgba(2,10,17,.78) 58%,rgba(2,10,17,.18) 100%)}.active-content{position:absolute;inset:0;padding:18px;display:flex;flex-direction:column;justify-content:space-between}.badges,.locked-head{display:flex;justify-content:space-between;align-items:center}.badges span,.sku,.licensed,.locked-state{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;border:1px solid rgba(74,157,191,.35);background:rgba(4,25,37,.84)}.licensed{color:#90d9ff;border-color:#168fdd!important;background:#062d49!important}.locked-state{color:#ffd47b;border-color:#88661a!important;background:#35270b!important}.active-copy{max-width:68%}.active-copy h3{font-size:28px;margin:5px 0}.active-copy p{color:#90a9b6;font-size:11px;line-height:1.5}.mini-demo,.demo-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.mini-demo{max-width:70%}.mini-demo>div,.demo-metrics>div{padding:10px;border-radius:10px;background:rgba(3,21,31,.84);border:1px solid rgba(46,154,206,.25)}.mini-demo span,.demo-metrics span{display:block;color:#5e8091;font-size:8px;font-weight:800}.mini-demo b,.demo-metrics b{display:block;margin-top:4px;font-size:15px}.actions{display:flex;gap:8px}.catalog{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.locked-card{position:relative;min-height:370px;border-radius:20px;border:1px solid rgba(49,141,185,.25);background:#061722;padding:13px;cursor:pointer;transition:.25s}.locked-card:hover{transform:translateY(-4px);border-color:rgba(55,188,255,.5);box-shadow:0 20px 60px rgba(0,0,0,.25)}.locked-demo{margin-top:10px}.home-carousel{position:relative}.home-carousel-stage{position:relative;min-height:214px;border-radius:14px;overflow:hidden;background:#020d15;border:1px solid rgba(47,151,200,.26)}.home-slide{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .7s ease,transform .7s ease;transform:scale(1.012);background:#020d15}.home-slide.on{opacity:1;pointer-events:auto;transform:scale(1)}.home-real-shot{height:174px;padding:6px;background:#01080d}.home-real-shot img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#01070c;border-radius:9px}.home-slide-caption{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;background:linear-gradient(180deg,rgba(4,20,30,.78),#061722);border-top:1px solid rgba(57,174,226,.18)}.home-slide-caption b{font-size:9px}.home-slide-caption span{max-width:68%;text-align:right;color:#7695a4;font-size:7px}.home-carousel-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 3px 0}.home-carousel-footer>span{color:#557887;font-size:7px}.home-dots{display:flex;gap:5px}.home-dots button{width:18px;height:4px;padding:0;border:0;border-radius:999px;background:#173747;transition:.25s}.home-dots button.on{width:28px;background:#32bfff;box-shadow:0 0 12px rgba(50,191,255,.38)}.synthetic-slide{padding:10px}.synthetic-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.synthetic-head span{font-size:8px;font-weight:900;color:#d6f2ff;letter-spacing:.04em}.synthetic-head i{width:6px;height:6px;border-radius:50%;background:#2db6ff;box-shadow:0 0 10px #2db6ff}.synthetic-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.synthetic-kpis>div{padding:7px;border-radius:8px;border:1px solid rgba(47,146,192,.25);background:#051a26}.synthetic-kpis span{display:block;color:#648695;font-size:6px}.synthetic-kpis b{display:block;margin-top:3px;font-size:10px}.synthetic-chart{margin-top:8px;padding:6px;border-radius:10px;background:#051722;border:1px solid rgba(47,146,192,.16)}.synthetic-chart svg{display:block;width:100%;height:88px}.synthetic-rows{display:grid;gap:7px}.synthetic-rows>div{display:grid;grid-template-columns:1.2fr .6fr 1fr .55fr;align-items:center;gap:7px;padding:8px 7px;border-radius:8px;background:#051722;border:1px solid rgba(47,146,192,.13)}.synthetic-rows b,.synthetic-rows span,.synthetic-rows strong{font-size:7px}.synthetic-rows span{color:#7f9aa8}.synthetic-rows strong{color:#72d9ff;text-align:right}.synthetic-rows em{height:4px;border-radius:999px;background:linear-gradient(90deg,#22b7ff var(--p),#163747 var(--p));font-style:normal}.synthetic-status-grid{display:grid;grid-template-columns:.7fr 1.5fr;gap:9px;align-items:center}.synthetic-ring{width:100px;height:100px;margin:auto;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#04151f 55%,transparent 57%),conic-gradient(#32bfff 0 82%,#173847 82%);box-shadow:0 0 28px rgba(36,177,239,.1)}.synthetic-ring b{font-size:19px}.synthetic-ring span{font-size:6px;color:#638594}.synthetic-alerts{display:grid;gap:6px}.synthetic-alerts>div{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;padding:8px;border-radius:8px;background:#051722;border:1px solid rgba(47,146,192,.12)}.synthetic-alerts i{width:6px;height:6px;border-radius:50%;background:#38c2ff}.synthetic-alerts i.s1{background:#ffcb45}.synthetic-alerts i.s2{background:#7f8eff}.synthetic-alerts i.s3{background:#56d2af}.synthetic-alerts b{font-size:7px}.synthetic-alerts span{font-size:6px;color:#638594}.synthetic-feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.synthetic-feature-grid>div{display:flex;align-items:center;gap:7px;padding:9px;border-radius:9px;background:#051722;border:1px solid rgba(47,146,192,.14)}.synthetic-feature-grid ha-icon{--mdc-icon-size:18px;color:#32bfff}.synthetic-feature-grid span{font-size:7px;font-weight:800}.synthetic-insight{display:flex;align-items:center;gap:8px;margin-top:8px;padding:9px;border-radius:9px;background:linear-gradient(135deg,#052032,#061722);border:1px solid rgba(50,184,244,.22)}.synthetic-insight ha-icon{--mdc-icon-size:22px;color:#ffd05e}.synthetic-insight b{display:block;font-size:8px}.synthetic-insight span{display:block;margin-top:2px;color:#6f8e9d;font-size:6px}.locked-copy{padding:13px 4px 3px}.locked-copy h3{font-size:20px;margin:4px 0}.locked-copy p{min-height:48px;color:#7896a5;font-size:10px;line-height:1.5}.see{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);color:#b3d5e4;font-size:9px;font-weight:900}.see ha-icon{color:#36bfff}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.topbar>button{border:0;background:transparent;color:#a7c2cf;font-weight:900}.topbar>div{display:flex;gap:8px}.product-hero{padding:18px;border-radius:24px;border:1px solid rgba(49,166,221,.34);background:radial-gradient(circle at 0% 0%,rgba(27,127,214,.12),transparent 30%),#04131e}.product-title{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:15px}.product-title h1{font-size:40px;margin:6px 0}.product-title p{max-width:900px;color:#8faab7;font-size:13px}.cta{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.demo{border-radius:18px;border:1px solid rgba(50,162,213,.3);background:#020d15;padding:12px;overflow:hidden}.demo.mini{padding:9px}.demo-top,.chart-title{display:flex;justify-content:space-between;align-items:center}.demo-brand{display:flex;gap:9px;align-items:center}.demo-brand span{padding:4px 6px;border-radius:999px;background:#073554;color:#91ddff;font-size:7px;font-weight:900}.demo-brand b{font-size:9px}.demo-live{font-size:7px;color:#688b9c}.demo-live i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#2db6ff;box-shadow:0 0 10px #2db6ff;margin-right:4px}.demo-metrics{margin:9px 0}.demo.mini .demo-metrics>div{padding:7px}.demo.mini .demo-metrics b{font-size:12px}.demo-main{display:grid;grid-template-columns:1.7fr .8fr;gap:8px}.chart,.alerts,.table,.gauge{border-radius:12px;background:#051722;border:1px solid rgba(38,114,150,.2);padding:9px}.chart-title b{font-size:9px}.chart-title span{font-size:7px;color:#5e8090}.chart svg{width:100%;height:150px;display:block}.demo.mini .chart svg{height:85px}.alerts>div:not(.chart-title){display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}.alerts b{font-size:8px}.alerts em{font-style:normal;font-size:7px;color:#607f8f}.dot{width:6px;height:6px;border-radius:50%;background:#36bfff}.d1{background:#ffcb45}.d2{background:#7b8eff}.d3{background:#5ad2b0}.demo-bottom{display:grid;grid-template-columns:1.5fr .7fr;gap:8px;margin-top:8px}.table>div:not(.chart-title){display:grid;grid-template-columns:1.4fr .7fr .7fr;gap:8px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.05)}.table b,.table span{font-size:8px}.table span{color:#8aa5b2}.gauge{display:flex;align-items:center;gap:13px}.ring{width:95px;height:95px;flex:none;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#061722 56%,transparent 58%),conic-gradient(#2db6ff 0 78%,#17303d 78%)}.ring b{font-size:18px}.ring span{font-size:7px;color:#6f91a1}.gauge>div:last-child b{font-size:10px}.gauge p{font-size:8px;color:#6e8e9d;line-height:1.45}.real-module-preview{margin-top:14px;padding:12px;border-radius:18px;border:1px solid rgba(49,177,231,.34);background:#020d15;box-shadow:inset 0 0 55px rgba(13,135,202,.035)}.real-preview-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:4px 4px 11px}.real-preview-head b{display:block;margin-top:4px;font-size:13px}.real-chip{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,200,84,.34);background:rgba(74,51,7,.38);color:#ffd66d;font-size:7px;font-weight:900;letter-spacing:.08em}.real-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.real-preview-card{margin:0;overflow:hidden;border-radius:14px;border:1px solid rgba(54,151,197,.28);background:#03111a;cursor:zoom-in;transition:transform .16s,border-color .16s,box-shadow .16s}.real-preview-card:hover{transform:translateY(-2px);border-color:#36bfff;box-shadow:0 13px 34px rgba(0,0,0,.24)}.real-preview-image,.board-real-image{position:relative;padding:8px;background:#020d15}.real-preview-image img,.board-real-image img{display:block;width:100%;height:260px;object-fit:contain;object-position:center;background:#01070d;border-radius:11px;border:1px solid rgba(45,150,197,.18)}.real-preview-card figcaption{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#061722}.real-preview-card figcaption b{font-size:10px}.real-preview-card figcaption span{color:#7896a4;font-size:8px;line-height:1.45}.preview-zoom{position:absolute;right:15px;bottom:15px;display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:rgba(4,25,38,.88);border:1px solid rgba(55,187,239,.42);color:#dff6ff;font-size:8px;font-weight:900}.preview-zoom ha-icon{--mdc-icon-size:14px}.real-preview-note{display:flex;align-items:center;gap:12px;margin-top:10px;padding:14px 16px;border-radius:14px;border:1px solid rgba(43,155,207,.22);background:linear-gradient(145deg,#061a27,#04131d)}.real-preview-note ha-icon{--mdc-icon-size:34px;color:#37bfff}.real-preview-note b{display:block;font-size:11px}.real-preview-note span{display:block;margin-top:5px;color:#7896a4;font-size:8px;line-height:1.5}.real-board{cursor:zoom-in}.board-real-image img{height:240px}.preview-modal{position:fixed;inset:0;z-index:12000;display:none;grid-template-rows:auto 1fr auto;gap:12px;padding:18px;background:rgba(0,5,9,.97)}.preview-modal.show{display:grid}.preview-modal-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.preview-modal-head>div{min-width:0}.preview-modal-head b{display:block;margin-top:4px;font-size:17px}.preview-modal-head span:not(.eyebrow){display:block;margin-top:3px;color:#88a7b6;font-size:10px}.preview-modal-head>button{width:42px;height:42px;border-radius:11px;border:1px solid #2b5a72;background:#08202e;color:white}.preview-modal-stage{position:relative;min-height:0;display:grid;place-items:center}.preview-modal-stage img{max-width:96vw;max-height:77vh;width:auto;height:auto;object-fit:contain;border-radius:12px;border:1px solid rgba(61,184,235,.35);box-shadow:0 28px 100px rgba(0,0,0,.55)}.preview-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:60px;border-radius:12px;border:1px solid rgba(73,182,227,.42);background:rgba(4,25,38,.88);color:white}.preview-nav ha-icon{--mdc-icon-size:30px}.preview-nav.prev{left:8px}.preview-nav.next{right:8px}.preview-modal-thumbs{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.preview-modal-thumbs button{padding:8px 11px;border-radius:9px;border:1px solid #254f65;background:#071d2a;color:#a9cbd9;font-size:9px;font-weight:800}.preview-modal-thumbs button.on{border-color:#43c5ff;background:#0a3550;color:white}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.features article{display:flex;gap:12px;min-height:120px;padding:14px;border-radius:15px;background:#061722;border:1px solid rgba(48,136,179,.23)}.ficon{width:40px;height:40px;display:grid;place-items:center;flex:none;border-radius:11px;color:#35bfff;background:#062c45;border:1px solid rgba(53,191,255,.3)}.features h3{font-size:13px}.features p{margin-top:4px;color:#7896a4;font-size:9px;line-height:1.5}.board-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.board{overflow:hidden;border-radius:18px;border:1px solid rgba(48,140,184,.25);background:#061722}.board-demo{padding:8px}.board-copy{display:flex;gap:12px;align-items:center;padding:12px;border-top:1px solid rgba(255,255,255,.05)}.board-copy>span{font-size:22px;font-weight:900;color:#1d6a93}.board-copy h3{font-size:14px}.board-copy p{font-size:8px;color:#6f8f9f}.buy{margin-top:26px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px;border-radius:20px;border:1px solid rgba(45,174,237,.35);background:linear-gradient(135deg,#071d2b,#04131d)}.buy h2{font-size:23px;margin:4px 0}.buy p{color:#7997a6;font-size:10px}.buy>div:last-child{display:flex;gap:8px}.modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:18px}.modal.show{display:flex}.backdrop{position:absolute;inset:0;background:rgba(0,5,9,.82);backdrop-filter:blur(8px)}.modal-card{position:relative;z-index:1;width:min(900px,96vw);max-height:94vh;overflow:auto;padding:20px;border-radius:22px;background:#061722;border:1px solid rgba(52,168,220,.38);box-shadow:0 40px 140px #000}.x{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:#0b2230;color:white}.modal-head{display:flex;gap:18px;align-items:center;padding-right:45px}.modal-head img{width:210px;max-height:70px;object-fit:contain}.modal-head h2{font-size:24px;margin:4px 0}.modal-head p{font-size:10px;color:#7594a3}.license-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:18px 0}.license-cards>div{padding:11px;border-radius:10px;background:#04121b;border:1px solid rgba(255,255,255,.07)}.license-cards span,.diag-grid span{display:block;color:#607f8f;font-size:8px;font-weight:900}.license-cards b,.license-cards code,.diag-grid b{display:block;margin-top:3px;font-size:10px;word-break:break-all}.license-tools{margin-bottom:10px}.diagnostics{display:none;margin:10px 0}.diagnostics.show{display:block}.diag-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.diag-grid>div{padding:9px;border-radius:9px;background:#04131d;border:1px solid rgba(255,255,255,.06)}.diag-grid .wide{grid-column:1/-1}.good{color:#6acbff}.bad{color:#ff7e87}.modal-card label{display:block;color:#87a4b2;font-size:9px;font-weight:900}.modal-card textarea{width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#020f17;color:white;border:1px solid #29546a;resize:vertical}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.security-note{display:block;margin-top:12px;color:#5f8192;font-size:8px;line-height:1.45}.toast{position:fixed;right:22px;bottom:22px;z-index:10000;opacity:0;transform:translateY(20px);max-width:470px;padding:12px 15px;border-radius:10px;background:#07395f;border:1px solid #249fff;color:white;font-size:10px;font-weight:900;transition:.2s}.toast.show{opacity:1;transform:translateY(0)}.toast.error{background:#4c2026;border-color:#f0606c}.center{min-height:85vh;display:flex;align-items:center;justify-content:center;gap:12px}.center>div{display:flex;flex-direction:column}.center small{color:#6b8a99}.spin{width:28px;height:28px;border-radius:50%;border:3px solid #163847;border-top-color:#2db6ff;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}.error{color:#ff7b84}.energy-flow-fixed .home-real-shot{height:230px!important;padding:4px!important}.energy-flow-fixed .home-real-shot img{object-fit:contain!important;object-position:center!important}.active-compact-card[data-open-card]{cursor:pointer!important}.active-compact-card .home-static-preview{cursor:zoom-in!important} .active-grid.cp-compact{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(340px,420px))!important;justify-content:start!important;align-items:start!important}.active-compact-card{min-height:370px!important}.active-compact-card .locked-copy .actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}.active-compact-card .locked-copy .see{margin-top:10px}.home-static-preview{position:relative;border-radius:14px;overflow:hidden;background:#020d15;border:1px solid rgba(47,151,200,.26)}.home-static-preview .home-real-shot{height:214px;padding:6px;background:#01080d}.home-static-preview .home-real-shot img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#01070c;border-radius:9px}.home-static-preview .home-slide-caption{position:relative;left:auto;right:auto;bottom:auto}.active-compact-card .locked-head .licensed{margin-left:auto}.active-compact-card:hover{transform:translateY(-4px);border-color:rgba(55,188,255,.5);box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .request-card{width:min(820px,96vw)}.request-context{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.request-context>div{padding:11px;border-radius:11px;background:#04121b;border:1px solid rgba(255,255,255,.07)}.request-context span{display:block;color:#607f8f;font-size:8px;font-weight:900}.request-context b,.request-context code{display:block;margin-top:4px;font-size:10px;word-break:break-all}.request-context .wide{grid-column:1/-1}.request-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.request-grid label{font-size:9px;color:#91adba}.request-grid input,.request-grid textarea{width:100%;margin-top:6px;padding:12px;border-radius:11px;background:#020f17;color:#fff;border:1px solid #29546a;outline:none}.request-grid input:focus,.request-grid textarea:focus{border-color:#2db6ff;box-shadow:0 0 0 3px rgba(45,182,255,.1)}.request-grid .wide{grid-column:1/-1}.request-success{text-align:center;padding:18px 12px}.success-orb{width:76px;height:76px;margin:4px auto 16px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,#0f4e68,#062536);border:1px solid #32b8ec;box-shadow:0 0 50px rgba(45,182,255,.18)}.success-orb ha-icon{--mdc-icon-size:38px;color:#64d8ff}.request-success h2{font-size:25px;margin:7px 0}.request-success p{max-width:620px;margin:0 auto;color:#87a6b5;line-height:1.55}.request-statuses{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:18px 0}.request-statuses span{padding:7px 10px;border-radius:999px;background:#062536;border:1px solid rgba(61,175,226,.28);font-size:8px;font-weight:900}.request-success-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.whatsapp{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border-radius:10px;border:1px solid #35cf79;background:#0d6b3d;color:white;font-weight:900}.rot{animation:r .8s linear infinite}button:disabled{opacity:.6;cursor:wait}
    @media(max-width:1200px){.summary{grid-template-columns:repeat(2,1fr)}.installation{grid-column:1/-1}.catalog,.features{grid-template-columns:repeat(2,1fr)}.active-grid{grid-template-columns:1fr}.product-title{align-items:flex-start;flex-direction:column}.cta{justify-content:flex-start}}
    @media(max-width:760px){.home-carousel-stage{min-height:200px}.home-real-shot{height:160px}.synthetic-kpis{grid-template-columns:repeat(2,1fr)}.synthetic-status-grid{grid-template-columns:1fr}.synthetic-ring{width:72px;height:72px}.cc,.detail{width:calc(100vw - 16px);padding-top:8px}.hero,.brand,.product-title,.buy{align-items:flex-start;flex-direction:column}.brand img{width:220px}.brand h1{font-size:26px}.hero-state{width:100%}.summary,.catalog,.features,.board-grid{grid-template-columns:1fr}.installation{align-items:flex-start;flex-direction:column}.active-copy{max-width:100%}.mini-demo,.demo-metrics{max-width:100%;grid-template-columns:repeat(2,1fr)}.demo-main,.demo-bottom{grid-template-columns:1fr}.product-title h1{font-size:32px}.buy>div:last-child{flex-wrap:wrap}.license-cards,.diag-grid,.request-grid,.request-context{grid-template-columns:1fr}.request-grid .wide,.request-context .wide{grid-column:auto}.modal-head{align-items:flex-start;flex-direction:column}.modal-head img{width:160px}.real-preview-head{align-items:flex-start;flex-direction:column}.real-preview-grid{grid-template-columns:1fr}.real-preview-image img,.board-real-image img{height:auto}.preview-nav{width:40px;height:50px}.preview-modal-stage img{max-height:70vh}}
  </style>`}
}
if(!customElements.get("cloudpelizzon-core-panel"))customElements.define("cloudpelizzon-core-panel",CloudPelizzonCorePanel);
