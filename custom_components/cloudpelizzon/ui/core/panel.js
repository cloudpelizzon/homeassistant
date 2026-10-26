import "/cloudpelizzon-core/frontend/fleet-registration.js?v=20261011-rc10";
const CP_BASE = "/cloudpelizzon-core/frontend";

const CP_MODULES = {
  "CP-LIGHTING": {
    kicker: "ILUMINAÇÃO INTELIGENTE",
    tagline: "GRAFITE, FLUX e NEO SOFT: três visões premium com um cadastro compartilhado.",
    metrics: [["Ambientes","—"],["Luzes","—"],["Ligadas","—"],["Disponibilidade","—"]],
    features: [
      ["mdi:lightbulb-multiple-outline","Iluminação individual","Controles por entidade sem efeito cascata."],
      ["mdi:view-dashboard-outline","Três dashboards","GRAFITE, FLUX e NEO SOFT no mesmo cadastro."],
      ["mdi:cog-outline","Configuração compartilhada","Ambientes, relés aprovados, ordem e visibilidade."],
      ["mdi:shield-lock-outline","Trial assinado","Sete dias exatos após confirmação privada de ativação."],
    ],
    boards: ["Visão Geral","GRAFITE","FLUX","NEO SOFT","Configurações"],
    alerts: [], rows: [],
  },

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
  "CP-SOLAR": {
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
    boards: ["Visão Geral","Sensores","Portas e janelas","Perímetro","Baterias","Visão Sensores"],
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
    boards: ["Visão Geral","Categorias","Automações","Execuções","Auditoria","Entidades do sistema","Saúde operacional","Insights de governança"],
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

// CP_AUTOMATION_GALLERY_V022: capturas originais autorizadas pelo proprietário para publicação na galeria pública.
const CP_AUTOMATION_PREVIEWS = [
  {file:"cpauto-01-visao-geral.png",title:"Visão Geral",desc:"Painel operacional, categorias, eventos e indicadores."},
  {file:"cpauto-02-categorias.png",title:"Categorias",desc:"Inventário das categorias monitoradas."},
  {file:"cpauto-03-automacoes.png",title:"Automações",desc:"Consulta das automações, status e última execução."},
  {file:"cpauto-04-execucoes.png",title:"Execuções",desc:"Histórico e frequência de execuções."},
  {file:"cpauto-05-auditoria.png",title:"Auditoria",desc:"Integridade do inventário e diagnósticos."},
  {file:"cpauto-06-entidades.png",title:"Entidades do sistema",desc:"Consulta das entidades integradas ao Home Assistant."},
  {file:"cpauto-07-saude.png",title:"Saúde operacional",desc:"Indicadores de saúde e alertas de consistência."},
  {file:"cpauto-08-insights.png",title:"Insights de governança",desc:"Análise preventiva e recomendações."}
];

// CP_CATALOG_SECURITY_V023 - previas reais apenas no ambiente privado
const CP_SECURITY_PREVIEWS = [
  {file:"cpsec-real-01-visao-geral.png",title:"Visão Geral",desc:"Núcleo de segurança, casa, alarmes, câmeras, presença e eventos."},
  {file:"cpsec-real-02-sensores.png",title:"Sensores",desc:"Sensores monitorados, estados e níveis de bateria."},
  {file:"cpsec-real-03-portas-janelas.png",title:"Portas e janelas",desc:"Estado dos acessos, portas e janelas."},
  {file:"cpsec-real-04-perimetro.png",title:"Perímetro",desc:"Integridade do perímetro e controles de portão e cerca."},
  {file:"cpsec-real-05-baterias.png",title:"Baterias",desc:"Saúde das baterias e dispositivos que exigem atenção."},
  {file:"cpsec-real-06-visao-sensores.png",title:"Visão Sensores",desc:"Câmeras, sensores físicos, presença e eventos."},
];

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
  connectedCallback(){if(this.requestOnly161)return;document.addEventListener("visibilitychange",this._focusHandler);window.addEventListener("focus",this._focusHandler);if(this._hass&&!this.data&&!this.loading)this.load();this.cpTrialTimer=setInterval(()=>{if(!document.hidden&&this._hass&&!this.loading&&(this.data?.modules||[]).some(m=>m?.trial?.verified===true))this.load()},20000);this.cpV2Display=setInterval(()=>this.updateTrialClocks(),1000)}
  disconnectedCallback(){document.removeEventListener("visibilitychange",this._focusHandler);window.removeEventListener("focus",this._focusHandler);clearInterval(this.cpTrialTimer);this.cpTrialTimer=null;clearInterval(this.cpV2Display);this.cpV2Display=null;clearInterval(this.carouselTimer);this.carouselTimer=null;if(this._showcaseKeyHandler){document.removeEventListener("keydown",this._showcaseKeyHandler);this._showcaseKeyHandler=null}}
  esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  async load(){if(!this._hass||this.loading)return;this.loading=true;if(!this.data)this.render();let changed=!this.data;try{const next=await this._hass.callWS({type:"cloudpelizzon/core/status"});changed=JSON.stringify(this.data)!==JSON.stringify(next);this.data=next;
if(changed)this.dispatchEvent(new CustomEvent("cloudpelizzon-module-rights-changed",{detail:{modules:next?.modules||[]},bubbles:true,composed:true}));
this.error=null}catch(e){this.error=e?.message||String(e)}finally{this.loading=false;if(changed||this.error)this.render()}}
  moduleBySku(s){return (this.data?.modules||[]).find(x=>x.sku===s)}
  // CP-TRIAL-CATALOG-BRIDGE-V1: signed server state, display only.
  cpTrialActive(m){return m?.trial?.verified===true&&m?.trial?.phase==="trial_active"&&m?.trial?.paid_confirmed===false}
  cpAllowed(m){return !!m?.license?.allowed||this.cpTrialActive(m)}
  cpHomolog(m){const b=Date.parse(m?.trial?.blocks_at||""),r=Date.parse(m?.trial?.removal_due_at||"");return Number.isFinite(b)&&Number.isFinite(r)&&r>b&&r-b<=32*60*1000}
  v2TrialButton(m){
    const t=m?.trial;
    if(!t||t.verified!==true||t.phase!=="not_started"||m?.license?.allowed)return "";
    if(!["CP-MAINTENANCE","CP-SOLAR","CP-AUTOMATION","CP-SECURITY"].includes(m.sku))return `<p role="status">Teste ainda indisponível nesta versão.</p>`;
    return `<button type="button" class="cp-v2-trial-button" data-start-trial="${this.esc(m.sku)}">Teste grátis por 7 dias</button>`;
  }
  v2Remaining(m){
    if(!this.cpTrialActive(m))return "";
    const stop=Date.parse(m?.trial?.blocks_at||"");
    if(!Number.isFinite(stop))return "";
    const seconds=Math.max(0,Math.floor((stop-Date.now())/1000));
    return `<span class="cp-v2-remaining" data-deadline="${this.esc(m.trial.blocks_at)}" title="O servidor determina a autorização">Restam ${Math.floor(seconds/60)}min ${String(seconds%60).padStart(2,"0")}s</span>`;
  }
  updateTrialClocks(){
    this.shadowRoot.querySelectorAll('.cp-v2-remaining[data-deadline]').forEach(node=>{
      const deadline=Date.parse(node.dataset.deadline||'');
      if(!Number.isFinite(deadline))return;
      const sec=Math.max(0,Math.floor((deadline-Date.now())/1000));
      node.textContent=`Restam ${Math.floor(sec/60)}min ${String(sec%60).padStart(2,'0')}s`;
    });
  }
  async v2StartTrial(sku){
    if(!["CP-MAINTENANCE","CP-SOLAR","CP-AUTOMATION","CP-SECURITY"].includes(sku)){this.toast("O teste deste módulo ainda não está disponível nesta versão.","error");return;}
    if(!confirm("Iniciar o teste grátis de "+sku+" agora? O relógio começa neste clique e não pode ser reiniciado."))return;
    try{
      const result=await this._hass.callWS({type:"cloudpelizzon/core/trial/v2/start",sku});
      await this.load();
      setTimeout(()=>this.load(),5000);
      this.toast(result?.first_activation?"Teste iniciado! Recarregando o módulo...":"Prazo original mantido; não reiniciado.");
    }catch(e){this.toast(e?.message||"Não foi possível iniciar o teste.","error")}
  }
  cpModuleStatus(m){
    if(m?.license?.status==="unverified")return "Validação pendente";
    if(m?.license?.allowed)return this.statusLabel(m.license);
    if(this.cpTrialActive(m))return "Teste grátis por 7 dias"+(this.cpHomolog(m)?" • Homologação 60 min":"");
    if(m?.trial?.verified===true){
      if(m.trial.phase==="not_started")return ["CP-MAINTENANCE","CP-SOLAR","CP-AUTOMATION","CP-SECURITY"].includes(m.sku)?"Teste disponível • Ative quando desejar":"Teste ainda indisponível";
      if(m.trial.phase==="trial_blocked")return "Teste encerrado • Acesso bloqueado";
      if(m.trial.phase==="trial_removal_due")return "Teste encerrado • Solicitar contratação";
    }
    return this.statusLabel(m?.license);
  }
  statusLabel(l){const s=l?.status;if(s==="unverified")return"Validação pendente";if(s==="licensed")return"Licenciado • online";if(s==="activation_required")return"Ativação online necessária";if(s==="lease_expired")return"Tolerância offline encerrada";if(s==="revoked")return"Licença revogada";if(s==="expired")return"Licença expirada";if(s==="not_entitled")return"Não contratado";if(s==="invalid")return"Licença inválida";if(s==="locked")return"Sem licença";return"Não contratado"}
  licenseSummary(){const mods=this.data?.modules||[];const licensed=mods.filter(x=>this.cpAllowed(x)).length;const active=mods.filter(x=>this.cpAllowed(x)&&x.installed&&(x.lifecycle!=="planned"||this.cpTrialActive(x))).length;const l=this.data?.license||{};let label="Não ativada",tone="off";if(l.online_status==="unavailable"){label="Validação pendente";tone="trial"}else if(mods.some(m=>this.cpTrialActive(m))){label="Teste grátis ativo";tone="on"}else if(l.online_status==="active"&&licensed>0){label="Ativa • online";tone="on"}else if(l.present&&l.activation_id){label=l.online_status==="revoked"?"Revogada":l.online_status==="expired"?"Expirada":"Aguardando validação";tone="trial"}else if(l.present){label="Ativação pendente";tone="trial"}return{active,label,tone,total:mods.length}}
  openModule(path){if(!path)return;this.dispatchEvent(new CustomEvent("cloudpelizzon-open-module",{detail:{path:path},bubbles:true,composed:true}))}
  showLicense(){this.shadowRoot.querySelector("#license-modal")?.classList.add("show")}
  hideLicense(){this.shadowRoot.querySelector("#license-modal")?.classList.remove("show")}
  async activateLicense(){const token=this.shadowRoot.querySelector("#license-token")?.value?.trim();if(!token)return this.toast("Cole a chave CP1 emitida pela Central de Licenciamento.","error");try{await this._hass.callWS({type:"cloudpelizzon/core/license/activate",token});this.hideLicense();await this.load();this.toast("Licença ativada e validada online com sucesso.")}catch(e){this.toast(e?.message||String(e),"error")}}
  async checkinNow(){try{const r=await this._hass.callWS({type:"cloudpelizzon/core/license/checkin"});await this.load();this.showLicense();this.toast(r?.status==="active"?"Check-in online concluído.":`Check-in: ${r?.status||'falhou'}`,r?.status==="active"?"success":"error")}catch(e){this.toast(e?.message||String(e),"error")}}
  async diagnoseLicense(){try{const d=await this._hass.callWS({type:"cloudpelizzon/core/license/diagnostics"});const box=this.shadowRoot.querySelector("#license-diagnostics");if(box){box.innerHTML=this.diagnosticsHtml(d);box.classList.add("show")}}catch(e){this.toast(e?.message||String(e),"error")}}
  diagnosticsHtml(d){const yes=v=>v?"✓ OK":"✕ Falha";const online=d.online_status==="active";return `<div class="diag-grid"><div><span>CP1</span><b class="${d.token_present?'good':'bad'}">${d.token_present?'Presente':'Ausente'}</b></div><div><span>Assinatura CP1</span><b class="${d.valid?'good':'bad'}">${d.valid?'Válida':'Inválida'}</b></div><div><span>ID da instalação</span><b class="${d.installation_match?'good':'bad'}">${yes(d.installation_match)}</b></div><div><span>Prazo da licença</span><b class="${d.time_valid?'good':'bad'}">${yes(d.time_valid)}</b></div><div><span>Ativação online</span><b class="${online?'good':'bad'}">${this.esc(d.online_status||'não ativada')}</b></div><div><span>Lease CP2</span><b class="${d.lease_valid?'good':'bad'}">${d.lease_valid?'Válida':'Ausente/expirada'}</b></div><div><span>Activation ID</span><b>${this.esc(d.activation_id||'-')}</b></div><div><span>Revisão</span><b>${this.esc(d.license_revision||'-')}</b></div><div><span>Último check-in</span><b>${this.esc(d.last_checkin_at||'-')}</b></div><div><span>Lease válida até</span><b>${this.esc(d.lease_valid_until||'-')}</b></div><div class="wide"><span>Servidor</span><b>${this.esc(d.server_url||'-')}</b></div><div class="wide"><span>Módulos</span><b>${this.esc((d.modules||[]).join(', ')||'-')}</b></div>${d.last_checkin_error?`<div class="wide"><span>Último erro de comunicação</span><b class="bad">${this.esc(d.last_checkin_error)}</b></div>`:''}${d.error?`<div class="wide"><span>Diagnóstico</span><b class="bad">${this.esc(d.error)}</b></div>`:''}</div>`}
  async clearLicense(){if(!confirm("Remover a licença atual desta instalação?"))return;try{await this._hass.callWS({type:"cloudpelizzon/core/license/clear"});this.hideLicense();await this.load();this.toast("Licença removida.")}catch(e){this.toast(e?.message||String(e),"error")}}
  showRequest(sku){this.requestSku=sku;this.requestResult=null;this.render();queueMicrotask(()=>this.shadowRoot.querySelector("#request-name")?.focus())}
  hideRequest(){this.requestSku=null;this.requestResult=null;this.render();if(this.requestOnly161)this.dispatchEvent(new CustomEvent("cloudpelizzon-request-close161",{bubbles:true,composed:true}))}
  async submitRequest(){if(this._commercialSending157)return;const selected=this.requestSku;const sku=this.moduleBySku(selected)?.request_sku483||selected;if(!sku)return;const q=id=>this.shadowRoot.querySelector(id);const payload={type:"cloudpelizzon/core/commercial/request",sku,name:q("#request-name")?.value?.trim()||"",phone:q("#request-phone")?.value?.trim()||"",email:q("#request-email")?.value?.trim()||"",subject:q("#request-subject")?.value?.trim()||"",message:q("#request-message")?.value?.trim()||""};if(!payload.name||!payload.phone||!payload.email||!payload.subject||!payload.message)return this.toast("Preencha todos os campos da solicitação.","error");if(!/^\S+@\S+\.\S+$/.test(payload.email))return this.toast("Informe um e-mail válido.","error");const btn=q("[data-send-request]");if(btn){btn.disabled=true;btn.innerHTML='<ha-icon icon="mdi:loading" class="rot"></ha-icon> Enviando...'}this._commercialSending157=true;try{const r=await this._hass.callWS(payload);if(r?.ok!==true||r.status!=="registered"||r.sku!==sku||!/^REQ-[A-F0-9]{12}$/.test(r.request_id||""))throw Error("O servidor não confirmou o protocolo da solicitação.");if(this.requestSku!==selected)return;this.requestResult=r;this.render();this.toast("Solicitação registrada com sucesso.")}catch(e){this.toast(e?.message||String(e),"error");if(btn){btn.disabled=false;btn.textContent="Enviar solicitação"}}finally{this._commercialSending157=false}}
  openWhatsapp(){const url=this.requestResult?.whatsapp_url;if(url)window.open(url,"_blank","noopener,noreferrer")}
  toast(msg,type="success"){const el=this.shadowRoot.querySelector("#toast");if(!el)return;clearTimeout(this.toastTimer);el.textContent=msg;el.className=`toast show ${type}`;this.toastTimer=setTimeout(()=>el.className="toast",3500)}
  render(){if(this.requestOnly161){this.shadowRoot.innerHTML=`${this.css()}${this.renderRequestModal()}<div id="toast" class="toast"></div>`;this.bind();return;}if(this.requestSku&&!this.requestResult&&this.shadowRoot.querySelector("#request-modal"))return;if(this._showcaseKeyHandler){document.removeEventListener("keydown",this._showcaseKeyHandler);this._showcaseKeyHandler=null;}if(this.loading&&!this.data){this.shadowRoot.innerHTML=`${this.css()}<div class="center"><div class="spin"></div><div><b>CloudPelizzon Control Center</b><small>Carregando...</small></div></div>`;return}if(this.error){this.shadowRoot.innerHTML=`${this.css()}<div class="center error"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><b>Falha ao carregar</b><small>${this.esc(this.error)}</small></div></div>`;return}if(!this.data)return;this.shadowRoot.innerHTML=`${this.css()}${this.selectedSku?this.renderDetail(this.selectedSku):this.renderHome()}${this.renderLicenseModal()}${this.renderRequestModal()}${this.renderMaintenancePreviewModal()}${this.renderShowcasePreviewModal()}<div id="toast" class="toast"></div>`;this.installGlobalLayoutFix();this.injectEnergyDetails();this.bind();this.bindShowcasePreview();const fleet=this.shadowRoot.querySelector("cloudpelizzon-fleet-registration");if(fleet)fleet.hass=this._hass;this.openLicenseFromUrl()}
  openLicenseFromUrl(){
    const url=new URL(window.location.href);
    if(url.searchParams.get("cp_open_license")!=="1")return;
    url.searchParams.delete("cp_open_license");
    window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
    this.showLicense();
  }
  // CP-CATALOG V023: stable explicit order for the catalog, irrespective of lifecycle.
  sortCatalogCards(items){
    const order=["CP-MAINTENANCE","CP-SOLAR","CP-SECURITY","CP-AUTOMATION"];
    return [...items].sort((a,b)=>{
      const ai=order.indexOf(a.sku),bi=order.indexOf(b.sku);
      return (ai<0?order.length:ai)-(bi<0?order.length:bi);
    });
  }
  // CP_CLIENT_EXPERIENCE_V025: CP-AUTOMATION remains in 4th catalog slot.
  renderHome(){const mods=this.data.modules||[],priority=["CP-MAINTENANCE","CP-SOLAR","CP-SECURITY","CP-AUTOMATION"],ordered=[...mods].sort((a,b)=>{const specialA=priority.indexOf(a.sku),specialB=priority.indexOf(b.sku);if(specialA!==-1||specialB!==-1)return (specialA===-1?priority.length:specialA)-(specialB===-1?priority.length:specialB);const phaseA=a.lifecycle==="developed"?0:1,phaseB=b.lifecycle==="developed"?0:1;if(phaseA!==phaseB)return phaseA-phaseB;if(phaseA===0){const indexA=priority.indexOf(a.sku),indexB=priority.indexOf(b.sku);return (indexA<0?priority.length:indexA)-(indexB<0?priority.length:indexB)}return 0}),active=ordered.filter(x=>this.cpAllowed(x)&&x.installed&&(x.lifecycle!=="planned"||this.cpTrialActive(x))),locked=ordered.filter(x=>!this.cpAllowed(x)||!x.installed||(x.lifecycle==="planned"&&!this.cpTrialActive(x))||(x.sku==="CP-AUTOMATION"&&!this.cpTrialActive(x))),s=this.licenseSummary();return `<main class="cc">${this.data?.status_verified===false?`<section class="summary" role="status"><article style="grid-column:1/-1"><span>VALIDAÇÃO DO ACESSO PENDENTE</span><b>Catálogo público disponível. Acesso aos módulos ainda não confirmado.</b><small>${this.data.access_error==='request_denied_http_429'?'Muitas consultas simultâneas. Aguarde a próxima verificação.':'Verificação temporariamente indisponível.'} Os prazos dos testes não são alterados por esta consulta.</small></article></section>`:''}
    <section class="hero"><div class="brand"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">CLOUDPELIZZON CONTROL CENTER</span><h1>Sua automação. Seus módulos. <em>Uma única Plataforma.</em></h1><p>Gerencie experiências ativas, licenciamento e descubra novas capacidades para a residência.</p></div></div><div class="cp-v2-hero-rail"><nav class="cp-v2-quicklinks" aria-label="Acessos CloudPelizzon"><a target="_blank" rel="noopener noreferrer" href="https://cliente.cloudpelizzon.com.br/login" data-portal-pair="1"><ha-icon icon="mdi:account-circle-outline"></ha-icon>Portal do Cliente</a><a target="_blank" rel="noopener noreferrer" href="https://documentacao.cloudpelizzon.com.br/"><ha-icon icon="mdi:book-open-variant-outline"></ha-icon>Documentações</a><a target="_blank" rel="noopener noreferrer" href="https://cloudpelizzon.com.br/comercial/"><ha-icon icon="mdi:web"></ha-icon>Site</a><a target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/cloudpelizzon/"><ha-icon icon="mdi:instagram"></ha-icon>Instagram</a><a target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/@cloudpelizzon"><ha-icon icon="mdi:youtube"></ha-icon>YouTube</a></nav><div class="hero-state"><span class="pulse"></span><div><small>SISTEMA</small><b>Conectado</b></div><div><small>CORE</small><b>${this.esc(this.data.core_version)}</b></div></div></div></section>
    <section class="summary"><article><ha-icon icon="mdi:key-variant"></ha-icon><span>LICENÇA</span><b>${this.esc(s.label)}</b></article><article><ha-icon icon="mdi:view-grid-plus-outline"></ha-icon><span>MÓDULOS OPERACIONAIS</span><b>${s.active} de ${s.total}</b></article><article><ha-icon icon="mdi:cloud-check-outline"></ha-icon><span>VALIDAÇÃO ONLINE</span><b>${this.data?.license?.online_status==='active'?'Conectada':'Pendente'}</b></article><article class="installation"><div><span>ID DA INSTALAÇÃO • copie para emitir a licença</span><code>${this.esc(this.data.installation_id)}</code></div><button data-license><ha-icon icon="mdi:key-chain-variant"></ha-icon>Gerenciar licença</button></article></section>
    ${active.length?`<section class="block"><header><div><span class="eyebrow">SEUS MÓDULOS</span><h2>Experiências ativas</h2><p>Os módulos licenciados abrem diretamente o dashboard real. “Detalhes” mostra a vitrine completa.</p></div></header><div class="active-grid cp-compact">${this.sortCatalogCards(active).map(m=>this.activeCard(m)).join("")}</div></section>`:""}
    <section class="block"><header><div><span class="eyebrow">EXPANDA SUA EXPERIÊNCIA</span><h2>Descubra o ecossistema CloudPelizzon</h2><p>Conheça os módulos disponíveis e os futuros produtos. Os módulos em desenvolvimento exibem prévias conceituais, não funcionalidades já entregues.</p></div></header><div class="catalog">${this.sortCatalogCards(locked).map(m=>this.lockedCard(m)).join("")}</div></section>
  </main>`}
  requestButton161(m){if(m?.license?.allowed===true)return "";const sku=m.sku;return `<button class="primary cp-request161" data-request="${this.esc(sku)}"><ha-icon icon="mdi:cart-plus"></ha-icon>Solicitar este módulo</button>`}
  activeCard(m){
    const d=CP_MODULES[m.sku]||{};
    const preview=this.renderHomeCarousel(m.sku);
    return `<article class="locked-card active-compact-card" data-open-card="${this.esc(m.path||'')}">
      <div class="locked-head"><span class="sku">${this.esc(m.sku)}</span><span class="${this.cpTrialActive(m)?'cp-trial-active':'licensed'}">${this.cpTrialActive(m)?'★':'✓'} ${this.esc(this.cpModuleStatus(m))}</span></div>
      <div class="locked-demo">${preview}</div>
      <div class="locked-copy">
        <span class="eyebrow">${this.esc(d.kicker||'MÓDULO ATIVO')}</span>
        <h3>${this.esc(m.name)}</h3>
        <p>${this.esc(d.tagline||m.description)}</p>
        <div class="see">Clique na imagem para ver a vitrine completa <ha-icon icon="mdi:arrow-top-right"></ha-icon></div>
        ${this.v2Remaining(m)}
        <div class="actions">
          <button class="secondary" data-detail="${this.esc(m.sku)}">Ver detalhes</button>
          <button class="primary" data-open="${this.esc(m.path||'')}">Abrir módulo <ha-icon icon="mdi:arrow-right"></ha-icon></button>
          ${this.requestButton161(m)}
        </div>
      </div>
    </article>`;
  }

  expiredCardActions163(m){
    const ended=m?.trial?.verified===true&&["trial_blocked","trial_removal_due"].includes(m.trial.phase)&&m?.license?.allowed!==true;
    if(!ended)return this.requestButton161(m);
    return `<div class="actions"><button class="secondary" data-detail="${this.esc(m.sku)}">Ver detalhes</button>${this.requestButton161(m)}</div>`;
  }
  lockedCard(m){const d=CP_MODULES[m.sku]||{};const preview=this.renderHomeCarousel(m.sku);const planned=m.lifecycle==="planned"&&m.sku!=="CP-AUTOMATION"&&!m?.trial?.verified;const licensed=this.cpAllowed(m);const label=this.cpModuleStatus(m);const icon=planned?"◷":licensed?"✓":m.trial?.phase?.startsWith("trial_")?"◴":"🔒";return `<article class="locked-card" data-detail="${this.esc(m.sku)}"><div class="locked-head"><span class="sku">${this.esc(m.sku)}</span><span class="${this.cpTrialActive(m)?'cp-trial-active':m?.trial?.verified===true&&m?.trial?.phase==='not_started'?'cp-trial-available':m?.trial?.phase==='trial_blocked'||m?.trial?.phase==='trial_removal_due'?'cp-trial-expired':'locked-state'}">${icon} ${this.esc(label)}</span></div><div class="locked-demo">${preview}</div><div class="locked-copy"><span class="eyebrow">${this.esc(d.kicker||'MÓDULO CLOUDPELIZZON')}</span><h3>${this.esc(m.name)}</h3><p>${this.esc(d.tagline||m.description)}</p><div class="see">${planned?'Prévia conceitual • lançamento futuro':'Explorar funcionalidades e dashboards'} <ha-icon icon="mdi:arrow-top-right"></ha-icon></div>${this.v2TrialButton(m)}${this.v2Remaining(m)}${this.expiredCardActions163(m)}</div></article>`}

  renderFixedHomePreview(sku){return this.renderHomeCarousel(sku)}

  renderHomeCarousel(sku, fullGallery=false){
    const d=CP_MODULES[sku]||{};
    const boards=(d.boards||[
      "Dashboard 1",
      "Dashboard 2",
      "Dashboard 3",
      "Dashboard 4"
    ]).slice(0,4);


    let real=null;

    if(sku==="CP-MAINTENANCE") real=CP_MAINT_PREVIEWS;
    if(sku==="CP-SOLAR") real=CP_ENERGY_PREVIEWS;
    if(sku==="CP-SECURITY") real=CP_SECURITY_PREVIEWS;
    if(sku==="CP-AUTOMATION") real=fullGallery ? CP_AUTOMATION_PREVIEWS : CP_AUTOMATION_PREVIEWS.slice(0,1);

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
              sku==="CP-AUTOMATION"
                ? (fullGallery ? "8 telas • use os pontos ou as setas para navegar" : "Capa oficial • abra para conhecer as 8 telas")
                : sku==="CP-SECURITY"
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
  startHomeCarousels(){clearInterval(this.carouselTimer);this.carouselTimer=null;const carousels=[...this.shadowRoot.querySelectorAll('[data-home-carousel]')];if(!carousels.length)return;carousels.forEach((c,i)=>{c.dataset.paused='0';c.addEventListener('mouseenter',()=>c.dataset.paused='1');c.addEventListener('mouseleave',()=>c.dataset.paused='0');this.setHomeCarousel(c,(c.dataset.homeCarousel==='CP-SECURITY'||c.dataset.homeCarousel==='CP-AUTOMATION')?0:i%Math.max(1,c.querySelectorAll('[data-home-slide]').length))});this.carouselTimer=setInterval(()=>{if(document.hidden)return;carousels.forEach(c=>{if(!c.isConnected||c.dataset.paused==='1')return;this.setHomeCarousel(c,(Number(c.dataset.current)||0)+1)})},4400)}
  renderDetail(sku){const m=this.moduleBySku(sku);if(!m){this.selectedSku=null;return this.renderHome()}const d=CP_MODULES[sku]||{},allowed=this.cpAllowed(m),planned=m.lifecycle==="planned"&&sku!=="CP-AUTOMATION"&&!this.cpTrialActive(m),installed=!!m.installed;return `<main class="detail"><div class="topbar"><button data-back><ha-icon icon="mdi:arrow-left"></ha-icon>Voltar ao Control Center</button><div><span class="${this.cpTrialActive(m)?'cp-trial-active':allowed?'licensed':'locked-state cp-unlicensed-pill'}">${planned?'◷':allowed?'✓':'🔒'} ${this.esc(this.cpModuleStatus(m))}</span><button class="secondary" data-license><ha-icon icon="mdi:key-variant"></ha-icon>Licença</button></div></div>
    <section class="product-hero"><div class="product-title"><div><span class="eyebrow">${this.esc(d.kicker||'CLOUDPELIZZON')}</span><span class="sku">${this.esc(m.sku)}</span><h1>${this.esc(m.name)}</h1><p>${this.esc(d.tagline||m.description)}</p></div><div class="cta">${this.requestButton161(m)}${this.v2Remaining(m)}${this.v2TrialButton(m)}${planned?'<span class="locked-state">Em desenvolvimento • indisponível para instalação</span>':allowed&&installed&&m.path?`<button class="primary big" data-open="${this.esc(m.path)}">Abrir módulo <ha-icon icon="mdi:arrow-right"></ha-icon></button>`:allowed?`<button class="primary big" data-updates>Ver instalação no Update Center</button>`:`<button class="secondary big" data-license>Já tenho licença</button>`}</div></div>${this.renderProductPreview(sku)}</section>
    <section class="block"><header><div><span class="eyebrow">O QUE ESTE MÓDULO ENTREGA</span><h2>Funcionalidades incluídas</h2><p>Recursos que fazem parte desta experiência CloudPelizzon.</p></div></header><div class="features">${(d.features||[]).map(x=>`<article><div class="ficon"><ha-icon icon="${this.esc(x[0])}"></ha-icon></div><div><h3>${this.esc(x[1])}</h3><p>${this.esc(x[2])}</p></div></article>`).join("")}</div></section>
    <section class="block"><header><div><span class="eyebrow">DASHBOARDS INCLUÍDOS</span><h2>Uma experiência completa, não apenas um card</h2><p>Veja os painéis que compõem o módulo e como a informação é organizada.</p></div></header><div class="board-grid">${(d.boards||[]).map((b,i)=>this.boardPreview(sku,b,i)).join("")}</div></section>
    <section class="buy"><div><span class="eyebrow">CLOUDPELIZZON • ${this.esc(m.sku)}</span><h2>${planned?'Este módulo está em desenvolvimento.':allowed&&installed?'Este módulo já está instalado nesta residência.':allowed?'Licenciado • instalação pendente':`Conheça ${this.esc(m.name)}.`}</h2><p>${planned?'Esta é uma prévia conceitual. A instalação ficará disponível após o desenvolvimento e a publicação segura.':allowed&&installed?'Abra o dashboard real ou conheça os recursos acima.':allowed?'Sua licença está ativa. Aguarde uma versão comercial publicada no Update Center.':'A licença é vinculada ao Installation ID e requer uma versão publicada para instalar.'}</p></div><div>${planned?'<span class="locked-state">Lançamento futuro</span>':allowed&&installed&&m.path?`<button class="primary big" data-open="${this.esc(m.path)}">Abrir módulo</button>`:allowed?'<button class="primary big" data-updates>Ver atualizações e instalação</button>':`<button class="primary big" data-request="${this.esc(m.sku)}">Tenho interesse</button><button class="secondary big" data-license>Ativar licença</button>`}</div></section>
  </main>`}
  metricTiles(metrics){return metrics.slice(0,4).map(x=>`<div><span>${this.esc(x[0])}</span><b>${this.esc(x[1])}</b></div>`).join("")}
  renderProductPreview(sku){
    if(sku==="CP-AUTOMATION"){
      return `<div class="real-module-preview cpauto-gallery" id="cpauto-visao-geral">
        <div class="real-preview-head"><div>
          <span class="eyebrow">CENTRAL INTELIGENTE DE AUTOMAÇÕES • VISÃO GERAL</span>
          <b>Conheça as 8 telas da Automation Intelligence Center V10.4.4</b>
        </div><span class="real-chip">8 CAPTURAS REAIS</span></div>
        ${this.renderHomeCarousel("CP-AUTOMATION",true)}
        <div class="cpauto-gallery-controls" aria-label="Navegação pelas telas">
          <button type="button" data-cpauto-gallery-step="-1" aria-label="Tela anterior"><ha-icon icon="mdi:chevron-left"></ha-icon>Anterior</button>
          <span>Selecione os pontos para trocar de tela • clique na imagem para ampliar</span>
          <button type="button" data-cpauto-gallery-step="1" aria-label="Próxima tela">Próxima<ha-icon icon="mdi:chevron-right"></ha-icon></button>
        </div>
        <div class="real-preview-note"><ha-icon icon="mdi:information-outline"></ha-icon><div>
          <b>Capturas da instalação de referência</b>
          <span>As imagens demonstram uma configuração de referência; quantidades, entidades e resultados variam conforme cada cliente. Não concedem acesso à operação.</span>
        </div></div>
      </div>`;
    }
    if(sku==="CP-SOLAR"){
      return `
        <div class="real-module-preview energy-product-preview">
          <div class="real-preview-head">
            <div>
              <span class="eyebrow">DASHBOARDS REAIS DO MÓDULO</span>
              <b>Prévia comercial com as telas reais do CP-SOLAR</b>
            </div>
            <span class="real-chip">5 TELAS REAIS</span>
          </div>
          ${this.renderHomeCarousel("CP-SOLAR")}
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
      const shots=CP_SECURITY_PREVIEWS;

      return `
        <div class="real-module-preview">

          <div class="real-preview-head">

            <div>
              <span class="eyebrow">
                PRÉVIAS DA CENTRAL DE SEGURANÇA PRO
              </span>

              <b>
                Conheça a experiência antes de contratar
              </b>
            </div>

            <span class="real-chip">
              ILUSTRAÇÕES SEM DADOS REAIS
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
        main{width:100%!important;max-width:none!important;margin:0!important;padding:16px!important;box-sizing:border-box!important}
        .summary[role="status"]>article{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-height:0;padding:12px 16px}
        .summary[role="status"] small{font-size:12px;overflow-wrap:anywhere}
        .brand h1 em{display:block}
        .cp-v2-quicklinks{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .cp-v2-quicklinks a{box-sizing:border-box;min-width:0;padding:10px 8px;line-height:1.25;white-space:nowrap;overflow-wrap:normal;word-break:normal;font-size:11px}
        @media(max-width:1099px){.cp-v2-hero-rail{width:100%;max-width:none}.hero{flex-wrap:wrap!important}}
        @media(max-width:600px){.cp-v2-quicklinks{grid-template-columns:repeat(2,minmax(0,1fr))}}

        @media(min-width:1100px){
          .hero{flex-wrap:nowrap!important;gap:18px!important}
          .brand{gap:18px;min-width:0;flex:1}
          .brand img{width:clamp(140px,14vw,220px);flex-shrink:0}
          .brand h1{max-width:650px}
          .cp-v2-hero-rail{width:540px;max-width:540px;flex-shrink:0;align-items:flex-end}
          .cp-v2-quicklinks a{min-height:64px}
        }
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
    if(this.selectedSku!=="CP-SOLAR")return;
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
          <span>CP-SOLAR • DASHBOARDS REAIS</span>
          <h2>Conheça a experiência Energia Solar</h2>
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
    if(this.selectedSku!=="CP-SOLAR"||CP_ENERGY_PREVIEWS.length<2)return;
    this._energyCarouselTimer=setInterval(()=>{
      if(this.selectedSku==="CP-SOLAR")this.setEnergyCarousel((this.energyCarouselIndex||0)+1);
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


  showcasePreviewItems(){
    const bySku={
      "CP-MAINTENANCE":CP_MAINT_PREVIEWS,
      "CP-SOLAR":CP_ENERGY_PREVIEWS,
      "CP-SECURITY":CP_SECURITY_PREVIEWS,
      "CP-AUTOMATION":CP_AUTOMATION_PREVIEWS
    };
    return bySku[this.selectedSku]||[];
  }
  renderShowcasePreviewModal(){
    return '<div id="cp-showcase-modal" class="cp-showcase-modal" hidden role="dialog" aria-modal="true" aria-label="Prévia ampliada do módulo">'+
      '<div class="cp-showcase-header"><div><span class="eyebrow">CLOUDPELIZZON • TELA AMPLIADA</span>'+
      '<b id="cp-showcase-title"></b><small id="cp-showcase-description"></small></div>'+
      '<button type="button" class="cp-showcase-close" data-showcase-close aria-label="Fechar imagem"><ha-icon icon="mdi:close"></ha-icon></button></div>'+
      '<div class="cp-showcase-stage">'+
      '<button type="button" class="cp-showcase-arrow" data-showcase-prev aria-label="Imagem anterior"><ha-icon icon="mdi:chevron-left"></ha-icon></button>'+
      '<img id="cp-showcase-image" alt="">'+
      '<button type="button" class="cp-showcase-arrow" data-showcase-next aria-label="Próxima imagem"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>'+
      '<div class="cp-showcase-footer"><span id="cp-showcase-counter"></span>'+
      '<span>Setas do teclado para navegar • Esc para fechar</span></div></div>';
  }
  openShowcasePreview(file,origin=null){
    const items=this.showcasePreviewItems();
    if(!items.length)return;
    const name=String(file||"").split("?")[0].split("/").pop();
    const selected=items.findIndex(x=>x.file===name);
    this._showcaseItems=items;
    this._showcaseIndex=selected>=0?selected:0;
    this._showcaseOrigin=origin;
    const modal=this.shadowRoot.getElementById("cp-showcase-modal");
    if(!modal)return;
    modal.hidden=false;
    this.refreshShowcasePreview();
    if(this._showcaseKeyHandler)document.removeEventListener("keydown",this._showcaseKeyHandler);
    this._showcaseKeyHandler=e=>{
      if(e.key==="Escape"){e.preventDefault();this.closeShowcasePreview();}
      else if(e.key==="ArrowLeft"){e.preventDefault();this.stepShowcasePreview(-1);}
      else if(e.key==="ArrowRight"){e.preventDefault();this.stepShowcasePreview(1);}
    };
    document.addEventListener("keydown",this._showcaseKeyHandler);
    modal.querySelector("[data-showcase-close]")?.focus();
  }
  refreshShowcasePreview(){
    const items=this._showcaseItems||[];
    if(!items.length)return;
    const i=((this._showcaseIndex||0)%items.length+items.length)%items.length;
    this._showcaseIndex=i;
    const item=items[i];
    const img=this.shadowRoot.getElementById("cp-showcase-image");
    if(img){img.src=CP_BASE+"/showcase/"+encodeURIComponent(item.file);img.alt=item.title||"";}
    const title=this.shadowRoot.getElementById("cp-showcase-title");
    if(title)title.textContent=item.title||"Dashboard";
    const desc=this.shadowRoot.getElementById("cp-showcase-description");
    if(desc)desc.textContent=item.desc||"";
    const counter=this.shadowRoot.getElementById("cp-showcase-counter");
    if(counter)counter.textContent=(i+1)+" de "+items.length;
  }
  stepShowcasePreview(delta){
    if(!this._showcaseItems?.length)return;
    this._showcaseIndex=((this._showcaseIndex||0)+delta+this._showcaseItems.length)%this._showcaseItems.length;
    this.refreshShowcasePreview();
  }
  closeShowcasePreview(){
    const modal=this.shadowRoot.getElementById("cp-showcase-modal");
    if(modal)modal.hidden=true;
    if(this._showcaseKeyHandler){document.removeEventListener("keydown",this._showcaseKeyHandler);this._showcaseKeyHandler=null;}
    this._showcaseOrigin?.focus?.();
    this._showcaseOrigin=null;
  }
  bindShowcasePreview(){
    if(!this.selectedSku)return;
    const nodes=this.shadowRoot.querySelectorAll(".detail .real-preview-card, .detail .real-board, .detail .home-carousel .home-real-shot, #cp-energy-real-gallery .erg-stage button");
    nodes.forEach(el=>{
      const img=el.querySelector('img[src*="/showcase/"]');
      if(!img)return;
      if(el.tagName!=="BUTTON"){
        el.tabIndex=0;
        el.setAttribute("role","button");
        el.setAttribute("aria-label","Ampliar "+(img.alt||"captura do módulo"));
      }
      const show=e=>{e.preventDefault();e.stopImmediatePropagation();this.openShowcasePreview(img.getAttribute("src"),el);};
      el.addEventListener("click",show,true);
      if(el.tagName!=="BUTTON")el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){show(e);}});
    });
    const modal=this.shadowRoot.getElementById("cp-showcase-modal");
    if(!modal)return;
    modal.querySelector("[data-showcase-close]")?.addEventListener("click",()=>this.closeShowcasePreview());
    modal.querySelector("[data-showcase-prev]")?.addEventListener("click",()=>this.stepShowcasePreview(-1));
    modal.querySelector("[data-showcase-next]")?.addEventListener("click",()=>this.stepShowcasePreview(1));
    modal.addEventListener("click",e=>{if(e.target===modal)this.closeShowcasePreview();});
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

    if(sku==="CP-AUTOMATION"&&CP_AUTOMATION_PREVIEWS.length){
      const x=CP_AUTOMATION_PREVIEWS[i%CP_AUTOMATION_PREVIEWS.length];
      return `<article class="board real-board">
        <div class="board-real-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}" loading="lazy"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div>
        <div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(x.title)}</h3><p>${this.esc(x.desc)}</p></div></div>
      </article>`;
    }
    if(sku==="CP-MAINTENANCE"&&i<CP_MAINT_PREVIEWS.length){
      const x=CP_MAINT_PREVIEWS[i];
      return `<article class="board real-board" data-maint-preview="${i}"><div class="board-real-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div><div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(name)}</h3><p>${this.esc(x.title)} • ${this.esc(x.desc)}</p></div></div></article>`;
    }

    if(sku==="CP-SOLAR"&&CP_ENERGY_PREVIEWS.length){
      const idx=i%CP_ENERGY_PREVIEWS.length;
      const x=CP_ENERGY_PREVIEWS[idx];
      return `<article class="board real-board" data-energy-shot="${idx}"><div class="board-real-image"><img src="${CP_BASE}/showcase/${x.file}" alt="${this.esc(x.title)}"><span class="preview-zoom"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon> Ampliar</span></div><div class="board-copy"><span>${String(i+1).padStart(2,'0')}</span><div><h3>${this.esc(name)}</h3><p>${this.esc(x.title)} • ${this.esc(x.desc)}</p></div></div></article>`;
    }

    if(sku==="CP-SECURITY"){
      const shots=CP_SECURITY_PREVIEWS;

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
  renderLicenseModal(){const l=this.data?.license||{};return `<div id="license-modal" class="modal"><div class="backdrop" data-close-license></div><section class="modal-card"><button class="x" data-close-license><ha-icon icon="mdi:close"></ha-icon></button><div class="modal-head"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">LICENCIAMENTO CLOUDPELIZZON • CORE R5</span><h2>Licença, ativação online e diagnóstico</h2><p>O módulo comercial só é liberado após validar a chave CP1 e receber uma lease CP2 do servidor CloudPelizzon.</p></div></div><div class="license-cards"><div><span>ID da instalação</span><code>${this.esc(this.data?.installation_id)}</code></div><div><span>Status online</span><b>${this.esc(l.online_status||'not_activated')}</b></div><div><span>Cliente</span><b>${this.esc(l.customer||'-')}</b></div><div><span>Validade CP1</span><b>${this.esc(l.expires_at||'Sem licença')}</b></div><div><span>Activation ID</span><code>${this.esc(l.activation_id||'-')}</code></div><div><span>Lease CP2 válida até</span><b>${this.esc(l.lease_valid_until||'-')}</b></div><div class="wide"><span>Servidor de licenciamento</span><code>${this.esc(l.server_url||'-')}</code></div></div><div id="license-diagnostics" class="diagnostics"></div><div class="license-tools"><button class="secondary" data-diagnose><ha-icon icon="mdi:stethoscope"></ha-icon>Diagnosticar</button>${l.activation_id?`<button class="secondary" data-checkin><ha-icon icon="mdi:cloud-sync-outline"></ha-icon>Validar agora</button>`:''}</div><label>Chave CP1<textarea id="license-token" rows="5" placeholder="CP1..."></textarea></label><div class="modal-actions">${l.present?`<button class="danger" data-clear-license>Remover licença</button>`:''}<button class="secondary" data-close-license>Cancelar</button><button class="primary" data-activate>Ativar e validar online</button></div><small class="security-note">Para emitir uma licença, copie o ID da instalação acima e informe-o na Central de Licenciamento CloudPelizzon. Após a ativação, o Core faz check-ins automáticos e mantém tolerância offline por lease assinada.</small><cloudpelizzon-fleet-registration></cloudpelizzon-fleet-registration></section></div>`}
  renderRequestModal(){if(!this.requestSku)return"";const m=this.moduleBySku(this.requestSku)||{sku:this.requestSku,name:this.requestSku};const customer=this.data?.license?.customer||"";if(this.requestResult){const emailOk=this.requestResult.email_status==="sent";const crm=this.requestResult.dolibarr_status||"registrado";return `<div id="request-modal" class="modal show"><div class="backdrop" data-close-request></div><section class="modal-card request-card"><button class="x" data-close-request><ha-icon icon="mdi:close"></ha-icon></button><div class="request-success"><div class="success-orb"><ha-icon icon="mdi:check-decagram-outline"></ha-icon></div><span class="eyebrow">SOLICITAÇÃO CLOUDPELIZZON</span><h2>Recebemos seu interesse em ${this.esc(m.name)}.</h2><p>A solicitação <b>${this.esc(this.requestResult.request_id||"")}</b> foi registrada.</p><style>#request-modal .request-success{padding:10px 8px}#request-modal .success-orb{width:58px;height:58px;margin-bottom:12px}#request-modal .success-orb ha-icon{--mdc-icon-size:30px}#request-modal .request-success>p{font-size:14px;line-height:1.5}#request-modal .cp-request-email259{max-width:680px;margin:22px auto 14px;padding:22px 24px;text-align:left;border:1px solid #38bdf8;border-left:5px solid #38bdf8;border-radius:16px;background:linear-gradient(125deg,#10394e,#082536);box-shadow:0 8px 30px #0003}#request-modal .cp-request-email259 .cp-next259{display:flex;align-items:center;gap:8px;color:#80dcff;font-size:12px;letter-spacing:1.2px;font-weight:800;text-transform:uppercase}#request-modal .cp-request-email259 h3{color:#fff;font-size:25px;line-height:1.25;margin:10px 0 14px}#request-modal .cp-request-email259 ol{margin:0;padding-left:23px;color:#e0f2fe;font-size:16px;line-height:1.6}#request-modal .cp-request-email259 li+li{margin-top:8px}#request-modal .cp-request-email259 strong{color:#fff;font-weight:800}#request-modal .cp-request-email259 p{font-size:16px;color:#e0f2fe;line-height:1.6;margin:0;max-width:none}#request-modal .request-success>p.cp-request-note259{font-size:12px;color:#9bb8c7;max-width:640px;margin:12px auto 20px}#request-modal .request-statuses{display:none}#request-modal .request-success-actions{gap:12px}#request-modal .request-success-actions .whatsapp{background:transparent!important;border:1px solid #365767!important;color:#a9c1cb!important;font-size:12px!important;font-weight:600!important;padding:10px 14px!important;box-shadow:none!important}#request-modal .request-success-actions .whatsapp:hover{background:#102c3b!important;color:#e0f2fe!important}#request-modal .request-success-actions .whatsapp ha-icon{--mdc-icon-size:18px}#request-modal .request-success-actions .primary{padding:12px 20px;font-weight:800}@media(max-width:600px){#request-modal .cp-request-email259{padding:18px 16px;margin-top:18px}#request-modal .cp-request-email259 h3{font-size:21px}#request-modal .cp-request-email259 ol{font-size:14px}#request-modal .request-success-actions{flex-direction:column}#request-modal .request-success-actions button{justify-content:center}}</style><div class="cp-request-email259" role="note"><span class="cp-next259"><ha-icon icon="mdi:email-outline"></ha-icon>Próxima etapa</span>${m.lifecycle==="planned"?`<h3>Acompanhe seu e-mail</h3><p>Nossa equipe dará sequência ao atendimento deste módulo pelo e-mail informado na solicitação.</p>`:`<h3>Acesse seu e-mail para continuar</h3><ol><li>Você receberá a <strong>proposta do módulo solicitado</strong> no e-mail informado na solicitação.</li><li>Abra esse e-mail, consulte a proposta e <strong>escolha a condição de pagamento</strong>.</li><li>Siga as instruções para <strong>registrar o aceite</strong> e continuar a contratação.</li></ol>`}</div><p class="cp-request-note259">Confira também as pastas de spam e lixo eletrônico. ${m.lifecycle==="planned"?"":"A cobrança será disponibilizada após o aceite. A liberação do módulo depende da confirmação do pagamento."}</p><div class="request-statuses"><span>✓ Registro comercial</span><span>Próxima etapa: acesse seu e-mail para continuar a contratação</span><span>CRM: ${this.esc(crm)}</span></div><div class="request-success-actions"><button class="primary" data-close-request>${m.lifecycle==="planned"?"Entendi":"Entendi, vou acessar meu e-mail"}</button>${this.requestResult.whatsapp_url?`<button class="whatsapp" data-whatsapp><ha-icon icon="mdi:whatsapp"></ha-icon>Enviar também pelo WhatsApp</button>`:""}</div></div></section></div>`}const subject=`Interesse no módulo ${m.name}`;const message=`Olá, gostaria de receber informações sobre contratação do módulo ${m.name}.`;return `<div id="request-modal" class="modal show"><div class="backdrop" data-close-request></div><section class="modal-card request-card"><button class="x" data-close-request><ha-icon icon="mdi:close"></ha-icon></button><div class="modal-head"><img src="${CP_BASE}/cloudpelizzon-logo.png"><div><span class="eyebrow">SOLICITAR MÓDULO • ${this.esc(m.sku)}</span><h2>Fale com a CloudPelizzon</h2><p>Preencha os dados abaixo. A solicitação será vinculada automaticamente a esta instalação.</p></div></div><div class="request-context"><div><span>Módulo</span><b>${this.esc(m.name)}</b></div><div><span>SKU</span><code>${this.esc(m.sku)}</code></div><div class="wide"><span>ID da instalação</span><code>${this.esc(this.data?.installation_id||"-")}</code></div></div><div class="request-grid"><label>Nome *<input id="request-name" value="${this.esc(customer)}" autocomplete="name" placeholder="Seu nome"></label><label>Telefone / WhatsApp *<input id="request-phone" autocomplete="tel" placeholder="(00) 00000-0000"></label><label>E-mail *<input id="request-email" type="email" autocomplete="email" placeholder="voce@email.com"></label><label>Assunto *<input id="request-subject" value="${this.esc(subject)}"></label><label class="wide">Mensagem *<textarea id="request-message" rows="5">${this.esc(message)}</textarea></label></div><div class="modal-actions"><button class="secondary" data-close-request>Cancelar</button><button class="primary" data-send-request><ha-icon icon="mdi:send-outline"></ha-icon>Enviar solicitação</button></div><small class="security-note">Os dados serão enviados ao servidor comercial CloudPelizzon junto com o módulo, SKU, versão do Core e ID desta instalação. Após o registro, você também poderá abrir uma mensagem pré-preenchida no WhatsApp.</small></section></div>`}
  async cpOpenSecurePortal(ev){
    ev.preventDefault();ev.stopPropagation();
    const view=this.ownerDocument?.defaultView||window;
    const win=view.open('about:blank','_blank');
    if(!win){this.toast('Permita janelas pop-up para abrir o Portal do Cliente.','error');return;}
    let timer;
    try{
      win.opener=null;
      win.document.title='Portal do Cliente · CloudPelizzon';
      const box=win.document.createElement('main');
      box.style.cssText='font:16px system-ui;color:#eaf6ff;background:#0d2434;max-width:480px;margin:12vh auto;padding:32px;border:1px solid #285269;border-radius:18px';
      const title=win.document.createElement('h1');title.textContent='Abrindo seu portal';title.style.fontSize='24px';
      const text=win.document.createElement('p');text.textContent='Estamos confirmando sua instalação. Se preferir, você já pode acessar com seu e-mail e senha.';
      const link=win.document.createElement('a');link.href='https://cliente.cloudpelizzon.com.br/login';link.textContent='Ir para o login';link.style.color='#65dcff';
      box.append(title,text,link);win.document.body.style.background='#07131d';win.document.body.replaceChildren(box);
      const response=await Promise.race([
        this._hass.callWS({type:'cloudpelizzon/core/portal/pair'}),
        new Promise((_,reject)=>{timer=view.setTimeout(()=>reject(Error('handoff_timeout')),10000);})
      ]);
      if(win.closed)return;
      if(!response||typeof response.assertion!=='string'||!/^[A-Za-z0-9_-]{100,3000}$/.test(response.assertion))throw Error('invalid_handoff');
      const form=win.document.createElement('form');form.method='POST';form.action='https://cliente.cloudpelizzon.com.br/login';
      const hidden=win.document.createElement('input');hidden.type='hidden';hidden.name='assertion';hidden.value=response.assertion;
      form.append(hidden);win.document.body.append(form);form.submit();
    }catch{
      if(!win.closed){try{win.location.replace('https://cliente.cloudpelizzon.com.br/login');}catch{}}
      this.toast('Acesse o portal com seu e-mail e senha. A confirmação automática não foi concluída.','error');
    }finally{if(timer!==undefined)view.clearTimeout(timer);}
  }
  bind(){this.shadowRoot.querySelector('[data-portal-pair]')?.addEventListener('click',e=>this.cpOpenSecurePortal(e));this.shadowRoot.querySelectorAll('[data-start-trial]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.v2StartTrial(x.dataset.startTrial)}));this.shadowRoot.querySelectorAll('[data-updates]').forEach(x=>x.addEventListener('click',()=>window.location.assign('/cloudpelizzon-updates')));this.shadowRoot.querySelectorAll('[data-open]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openModule(x.dataset.open)}));this.shadowRoot.querySelectorAll('[data-open-card]').forEach(x=>x.addEventListener('click',e=>{if(e.target.closest('[data-detail],[data-open],[data-request]'))return;this.openModule(x.dataset.openCard)}));this.shadowRoot.querySelectorAll('[data-detail]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.selectedSku=x.dataset.detail;this.render();scrollTo(0,0)}));this.shadowRoot.querySelector('[data-back]')?.addEventListener('click',()=>{this.selectedSku=null;this.render();scrollTo(0,0)});this.shadowRoot.querySelectorAll('[data-license]').forEach(x=>x.addEventListener('click',()=>this.showLicense()));this.shadowRoot.querySelectorAll('[data-close-license]').forEach(x=>x.addEventListener('click',()=>this.hideLicense()));this.shadowRoot.querySelector('[data-activate]')?.addEventListener('click',()=>this.activateLicense());this.shadowRoot.querySelector('[data-clear-license]')?.addEventListener('click',()=>this.clearLicense());this.shadowRoot.querySelector('[data-diagnose]')?.addEventListener('click',()=>this.diagnoseLicense());this.shadowRoot.querySelector('[data-checkin]')?.addEventListener('click',()=>this.checkinNow());this.shadowRoot.querySelectorAll('[data-request]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.showRequest(x.dataset.request)}));this.shadowRoot.querySelectorAll('[data-close-request]').forEach(x=>x.addEventListener('click',()=>this.hideRequest()));this.shadowRoot.querySelector('[data-send-request]')?.addEventListener('click',()=>this.submitRequest());this.shadowRoot.querySelector('[data-whatsapp]')?.addEventListener('click',()=>this.openWhatsapp());this.shadowRoot.querySelectorAll('[data-maint-preview]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openMaintenancePreview(Number(x.dataset.maintPreview))}));this.shadowRoot.querySelectorAll('[data-close-maint-preview]').forEach(x=>x.addEventListener('click',()=>this.closeMaintenancePreview()));this.shadowRoot.querySelector('[data-preview-prev]')?.addEventListener('click',()=>this.stepMaintenancePreview(-1));this.shadowRoot.querySelector('[data-preview-next]')?.addEventListener('click',()=>this.stepMaintenancePreview(1));this.shadowRoot.querySelectorAll('[data-preview-thumb]').forEach(x=>x.addEventListener('click',()=>{this.previewIndex=Number(x.dataset.previewThumb)||0;this.updateMaintenancePreview()}));this.shadowRoot.querySelectorAll('[data-home-dot]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.setHomeCarousel(x.closest('[data-home-carousel]'),Number(x.dataset.homeDot)||0)}));this.shadowRoot.querySelectorAll('[data-energy-shot]').forEach(x=>x.addEventListener('click',e=>{e.stopPropagation();this.openEnergyPreview(Number(x.dataset.energyShot)||0)}));this.shadowRoot.querySelectorAll('[data-energy-close]').forEach(x=>x.addEventListener('click',()=>this.closeEnergyPreview()));this.shadowRoot.querySelector('[data-energy-prev]')?.addEventListener('click',()=>this.stepEnergyPreview(-1));this.shadowRoot.querySelector('[data-energy-next]')?.addEventListener('click',()=>this.stepEnergyPreview(1));this.shadowRoot.querySelector('#energy-shot-modal')?.addEventListener('click',e=>{if(e.target?.id==='energy-shot-modal')this.closeEnergyPreview()});this.shadowRoot.querySelector('[data-energy-carousel-prev]')?.addEventListener('click',()=>this.stepEnergyCarousel(-1));this.shadowRoot.querySelector('[data-energy-carousel-next]')?.addEventListener('click',()=>this.stepEnergyCarousel(1));this.shadowRoot.querySelectorAll('[data-energy-carousel-dot]').forEach(x=>x.addEventListener('click',()=>{this.setEnergyCarousel(Number(x.dataset.energyCarouselDot)||0);this.startEnergyCarousel()}));this.shadowRoot.querySelectorAll('[data-cpauto-gallery-step]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();const c=btn.closest('.cpauto-gallery')?.querySelector('[data-home-carousel]');
      if(!c)return;this.setHomeCarousel(c,(Number(c.dataset.current)||0)+Number(btn.dataset.cpautoGalleryStep||0));
    }));this.startHomeCarousels()}
  css(){return `<style>
    /* CP_AUTOMATION_GALLERY_V022: galeria exclusiva CP-AUTOMATION */
    .cpauto-gallery .home-carousel-stage{min-height:clamp(310px,42vw,690px)!important}
    .cpauto-gallery .home-real-shot{height:clamp(270px,39vw,650px)!important;padding:12px!important}
    .cpauto-gallery .home-real-shot img{width:100%;height:100%;object-fit:contain!important;object-position:center!important}
    .cpauto-gallery .home-slide-caption{padding:11px 16px!important}
    .cpauto-gallery .home-slide-caption b{font-size:13px!important}
    .cpauto-gallery .home-slide-caption span{font-size:11px!important;color:#b9d5e3!important}
    .cpauto-gallery .home-dots{display:flex;flex-wrap:wrap;gap:7px}
    .cpauto-gallery .home-dots button{min-width:20px;height:7px}
    .cpauto-gallery-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0;flex-wrap:wrap}
    .cpauto-gallery-controls button{display:flex;align-items:center;gap:6px;border:1px solid #1f83a9;background:#082636;color:#c5f3ff;border-radius:9px;padding:10px 14px;font-weight:800}
    .cpauto-gallery-controls button:hover{background:#103f58}
    .cpauto-gallery-controls span{color:#97b5c7;font-size:12px}
    @media(max-width:800px){.cpauto-gallery .home-carousel-stage{min-height:280px!important}.cpauto-gallery .home-real-shot{height:240px!important}.cpauto-gallery-controls{justify-content:center}}
    .cp-showcase-modal[hidden]{display:none!important}
    .cp-showcase-modal{position:fixed;inset:0;width:100vw;height:100dvh;z-index:2147483646;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:clamp(10px,2vw,22px);background:rgba(0,5,11,.985);backdrop-filter:blur(10px);color:#f2fbff}
    .cp-showcase-header{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:60px}
    .cp-showcase-header b{display:block;font-size:clamp(15px,2vw,23px);margin-top:4px}
    .cp-showcase-header small{display:block;color:#8badbe;margin-top:3px;font-size:11px}
    .cp-showcase-close,.cp-showcase-arrow{border:1px solid #287397;background:#072539;color:#eafaff;border-radius:12px;display:grid;place-items:center;cursor:pointer}
    .cp-showcase-close{width:48px;height:48px;flex:none}
    .cp-showcase-arrow{height:74px;width:52px}
    .cp-showcase-close ha-icon,.cp-showcase-arrow ha-icon{--mdc-icon-size:28px}
    .cp-showcase-stage{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;gap:10px;align-items:center;min-height:0;justify-items:center}
    .cp-showcase-stage #cp-showcase-image{display:block;width:100%!important;height:100%!important;max-width:min(92vw,1920px)!important;max-height:calc(100dvh - 175px)!important;min-height:0;object-fit:contain!important;object-position:center;border:1px solid rgba(61,185,237,.3);border-radius:12px;background:#020a12}
    .cp-showcase-footer{display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:12px;color:#8fb8cb;min-height:28px}
    .cp-showcase-footer #cp-showcase-counter{color:#45c9ff;font-weight:900}
    .detail .real-preview-card:focus-visible,.detail .real-board:focus-visible{outline:3px solid #26baff;outline-offset:2px}
    .detail .home-carousel .home-real-shot,.detail .real-preview-card,.detail .real-board{cursor:zoom-in}
    @media(max-width:640px){.cp-showcase-stage{grid-template-columns:36px minmax(0,1fr) 36px;gap:3px}.cp-showcase-arrow{width:36px;height:60px}.cp-showcase-footer>span:last-child{display:none}.cp-showcase-stage #cp-showcase-image{max-height:calc(100dvh - 155px)!important}}
    :host{display:block;min-height:100vh;background:#020a12;color:#edf8ff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}button{font:inherit;cursor:pointer}.cc,.detail{width:min(1740px,calc(100vw - 28px));margin:auto;padding:20px 0 36px}.eyebrow{display:block;color:#2db6ff;font-size:9px;font-weight:900;letter-spacing:.18em}.hero{position:relative;display:flex;justify-content:space-between;align-items:center;gap:24px;min-height:150px;padding:18px 22px;border:1px solid rgba(47,170,235,.35);border-radius:24px;background:radial-gradient(circle at 17% 10%,rgba(31,142,231,.18),transparent 28%),linear-gradient(135deg,#061a29,#031019);overflow:hidden}.hero:after{content:"";position:absolute;width:520px;height:520px;border:1px solid rgba(34,160,229,.15);border-radius:50%;right:-170px;top:-270px;box-shadow:0 0 0 48px rgba(35,150,220,.03),0 0 0 100px rgba(35,150,220,.02)}.brand{display:flex;gap:25px;align-items:center;position:relative;z-index:1}.brand img{width:220px;max-height:72px;object-fit:contain}.brand h1{font-size:clamp(24px,2vw,30px);line-height:1.08;margin:6px 0 8px;max-width:700px}.brand h1 em{font-style:normal;color:#54c8ff}.brand p{max-width:720px;color:#88a7b7;font-size:12px;line-height:1.55}.hero-state{position:relative;z-index:1;display:flex;gap:18px;align-items:center;padding:12px 15px;border:1px solid rgba(49,154,205,.22);border-radius:15px;background:rgba(4,18,28,.72)}.hero-state>div{display:flex;flex-direction:column}.hero-state small{color:#5f8497;font-size:8px;font-weight:900}.hero-state b{font-size:11px}.pulse{width:8px;height:8px;border-radius:50%;background:#2db6ff;box-shadow:0 0 18px #2db6ff}.summary{display:grid;grid-template-columns:220px 220px 220px minmax(420px,1fr);gap:10px;margin:12px 0 26px}.summary>article{min-height:76px;display:flex;gap:11px;align-items:center;padding:13px;border-radius:15px;background:#061722;border:1px solid rgba(48,139,184,.25)}.summary ha-icon{color:#38bfff}.summary span{display:block;color:#62879a;font-size:8px;font-weight:900}.summary b{font-size:15px}.installation{justify-content:space-between!important}.installation code{display:block;margin-top:4px;color:#a6ddf7;font-size:9px;word-break:break-all}.installation button,.primary,.secondary,.danger{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:10px;padding:9px 13px;font-weight:900;font-size:10px}.installation button,.primary{border:1px solid #42bfff;background:linear-gradient(135deg,#0665ad,#119cf4);color:white;box-shadow:0 0 28px rgba(24,153,255,.13)}.secondary{border:1px solid rgba(89,157,190,.35);background:#0a2230;color:#c8e8f7}.danger{border:1px solid #d85b67;background:#4b1f27;color:#ffe8eb}.big{padding:12px 18px;font-size:11px}.block{margin:28px 0}.block>header{display:flex;justify-content:space-between;align-items:end;margin-bottom:12px}.block h2{font-size:25px;margin:4px 0}.block p{color:#7293a3;font-size:11px}.active-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.active-card{position:relative;min-height:350px;overflow:hidden;border:1px solid rgba(41,171,237,.42);border-radius:22px;background:#04131e;cursor:pointer}.active-back{position:absolute;inset:0;background-image:var(--bg);background-size:cover;background-position:center;filter:saturate(1.1) brightness(.8);transform:scale(1.02)}.active-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,10,17,.98) 0%,rgba(2,10,17,.78) 58%,rgba(2,10,17,.18) 100%)}.active-content{position:absolute;inset:0;padding:18px;display:flex;flex-direction:column;justify-content:space-between}.badges,.locked-head{display:flex;justify-content:space-between;align-items:center}.badges span,.sku,.licensed,.locked-state{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;border:1px solid rgba(74,157,191,.35);background:rgba(4,25,37,.84)}.licensed{color:#90d9ff;border-color:#168fdd!important;background:#062d49!important}.locked-state{color:#ffd47b;border-color:#88661a!important;background:#35270b!important}.active-copy{max-width:68%}.active-copy h3{font-size:28px;margin:5px 0}.active-copy p{color:#90a9b6;font-size:11px;line-height:1.5}.mini-demo,.demo-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.mini-demo{max-width:70%}.mini-demo>div,.demo-metrics>div{padding:10px;border-radius:10px;background:rgba(3,21,31,.84);border:1px solid rgba(46,154,206,.25)}.mini-demo span,.demo-metrics span{display:block;color:#5e8091;font-size:8px;font-weight:800}.mini-demo b,.demo-metrics b{display:block;margin-top:4px;font-size:15px}.actions{display:flex;gap:8px}.catalog{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.locked-card{position:relative;min-height:370px;border-radius:20px;border:1px solid rgba(49,141,185,.25);background:#061722;padding:13px;cursor:pointer;transition:.25s}.locked-card:hover{transform:translateY(-4px);border-color:rgba(55,188,255,.5);box-shadow:0 20px 60px rgba(0,0,0,.25)}.locked-demo{margin-top:10px}.home-carousel{position:relative}.home-carousel-stage{position:relative;min-height:214px;border-radius:14px;overflow:hidden;background:#020d15;border:1px solid rgba(47,151,200,.26)}.home-slide{position:absolute;inset:0;opacity:0;pointer-events:none;transition:opacity .7s ease,transform .7s ease;transform:scale(1.012);background:#020d15}.home-slide.on{opacity:1;pointer-events:auto;transform:scale(1)}.home-real-shot{height:174px;padding:6px;background:#01080d}.home-real-shot img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#01070c;border-radius:9px}.home-slide-caption{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;background:linear-gradient(180deg,rgba(4,20,30,.78),#061722);border-top:1px solid rgba(57,174,226,.18)}.home-slide-caption b{font-size:9px}.home-slide-caption span{max-width:68%;text-align:right;color:#7695a4;font-size:7px}.home-carousel-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 3px 0}.home-carousel-footer>span{color:#557887;font-size:7px}.home-dots{display:flex;gap:5px}.home-dots button{width:18px;height:4px;padding:0;border:0;border-radius:999px;background:#173747;transition:.25s}.home-dots button.on{width:28px;background:#32bfff;box-shadow:0 0 12px rgba(50,191,255,.38)}.synthetic-slide{padding:10px}.synthetic-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.synthetic-head span{font-size:8px;font-weight:900;color:#d6f2ff;letter-spacing:.04em}.synthetic-head i{width:6px;height:6px;border-radius:50%;background:#2db6ff;box-shadow:0 0 10px #2db6ff}.synthetic-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.synthetic-kpis>div{padding:7px;border-radius:8px;border:1px solid rgba(47,146,192,.25);background:#051a26}.synthetic-kpis span{display:block;color:#648695;font-size:6px}.synthetic-kpis b{display:block;margin-top:3px;font-size:10px}.synthetic-chart{margin-top:8px;padding:6px;border-radius:10px;background:#051722;border:1px solid rgba(47,146,192,.16)}.synthetic-chart svg{display:block;width:100%;height:88px}.synthetic-rows{display:grid;gap:7px}.synthetic-rows>div{display:grid;grid-template-columns:1.2fr .6fr 1fr .55fr;align-items:center;gap:7px;padding:8px 7px;border-radius:8px;background:#051722;border:1px solid rgba(47,146,192,.13)}.synthetic-rows b,.synthetic-rows span,.synthetic-rows strong{font-size:7px}.synthetic-rows span{color:#7f9aa8}.synthetic-rows strong{color:#72d9ff;text-align:right}.synthetic-rows em{height:4px;border-radius:999px;background:linear-gradient(90deg,#22b7ff var(--p),#163747 var(--p));font-style:normal}.synthetic-status-grid{display:grid;grid-template-columns:.7fr 1.5fr;gap:9px;align-items:center}.synthetic-ring{width:100px;height:100px;margin:auto;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#04151f 55%,transparent 57%),conic-gradient(#32bfff 0 82%,#173847 82%);box-shadow:0 0 28px rgba(36,177,239,.1)}.synthetic-ring b{font-size:19px}.synthetic-ring span{font-size:6px;color:#638594}.synthetic-alerts{display:grid;gap:6px}.synthetic-alerts>div{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;padding:8px;border-radius:8px;background:#051722;border:1px solid rgba(47,146,192,.12)}.synthetic-alerts i{width:6px;height:6px;border-radius:50%;background:#38c2ff}.synthetic-alerts i.s1{background:#ffcb45}.synthetic-alerts i.s2{background:#7f8eff}.synthetic-alerts i.s3{background:#56d2af}.synthetic-alerts b{font-size:7px}.synthetic-alerts span{font-size:6px;color:#638594}.synthetic-feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.synthetic-feature-grid>div{display:flex;align-items:center;gap:7px;padding:9px;border-radius:9px;background:#051722;border:1px solid rgba(47,146,192,.14)}.synthetic-feature-grid ha-icon{--mdc-icon-size:18px;color:#32bfff}.synthetic-feature-grid span{font-size:7px;font-weight:800}.synthetic-insight{display:flex;align-items:center;gap:8px;margin-top:8px;padding:9px;border-radius:9px;background:linear-gradient(135deg,#052032,#061722);border:1px solid rgba(50,184,244,.22)}.synthetic-insight ha-icon{--mdc-icon-size:22px;color:#ffd05e}.synthetic-insight b{display:block;font-size:8px}.synthetic-insight span{display:block;margin-top:2px;color:#6f8e9d;font-size:6px}.locked-copy{padding:13px 4px 3px}.locked-copy h3{font-size:20px;margin:4px 0}.locked-copy p{min-height:48px;color:#7896a5;font-size:10px;line-height:1.5}.see{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07);color:#b3d5e4;font-size:9px;font-weight:900}.see ha-icon{color:#36bfff}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.topbar>button{border:0;background:transparent;color:#a7c2cf;font-weight:900}.topbar>div{display:flex;gap:8px}.product-hero{padding:18px;border-radius:24px;border:1px solid rgba(49,166,221,.34);background:radial-gradient(circle at 0% 0%,rgba(27,127,214,.12),transparent 30%),#04131e}.product-title{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:15px}.product-title h1{font-size:40px;margin:6px 0}.product-title p{max-width:900px;color:#8faab7;font-size:13px}.cta{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.demo{border-radius:18px;border:1px solid rgba(50,162,213,.3);background:#020d15;padding:12px;overflow:hidden}.demo.mini{padding:9px}.demo-top,.chart-title{display:flex;justify-content:space-between;align-items:center}.demo-brand{display:flex;gap:9px;align-items:center}.demo-brand span{padding:4px 6px;border-radius:999px;background:#073554;color:#91ddff;font-size:7px;font-weight:900}.demo-brand b{font-size:9px}.demo-live{font-size:7px;color:#688b9c}.demo-live i{display:inline-block;width:5px;height:5px;border-radius:50%;background:#2db6ff;box-shadow:0 0 10px #2db6ff;margin-right:4px}.demo-metrics{margin:9px 0}.demo.mini .demo-metrics>div{padding:7px}.demo.mini .demo-metrics b{font-size:12px}.demo-main{display:grid;grid-template-columns:1.7fr .8fr;gap:8px}.chart,.alerts,.table,.gauge{border-radius:12px;background:#051722;border:1px solid rgba(38,114,150,.2);padding:9px}.chart-title b{font-size:9px}.chart-title span{font-size:7px;color:#5e8090}.chart svg{width:100%;height:150px;display:block}.demo.mini .chart svg{height:85px}.alerts>div:not(.chart-title){display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}.alerts b{font-size:8px}.alerts em{font-style:normal;font-size:7px;color:#607f8f}.dot{width:6px;height:6px;border-radius:50%;background:#36bfff}.d1{background:#ffcb45}.d2{background:#7b8eff}.d3{background:#5ad2b0}.demo-bottom{display:grid;grid-template-columns:1.5fr .7fr;gap:8px;margin-top:8px}.table>div:not(.chart-title){display:grid;grid-template-columns:1.4fr .7fr .7fr;gap:8px;padding:7px 2px;border-bottom:1px solid rgba(255,255,255,.05)}.table b,.table span{font-size:8px}.table span{color:#8aa5b2}.gauge{display:flex;align-items:center;gap:13px}.ring{width:95px;height:95px;flex:none;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#061722 56%,transparent 58%),conic-gradient(#2db6ff 0 78%,#17303d 78%)}.ring b{font-size:18px}.ring span{font-size:7px;color:#6f91a1}.gauge>div:last-child b{font-size:10px}.gauge p{font-size:8px;color:#6e8e9d;line-height:1.45}.real-module-preview{margin-top:14px;padding:12px;border-radius:18px;border:1px solid rgba(49,177,231,.34);background:#020d15;box-shadow:inset 0 0 55px rgba(13,135,202,.035)}.real-preview-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:4px 4px 11px}.real-preview-head b{display:block;margin-top:4px;font-size:13px}.real-chip{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,200,84,.34);background:rgba(74,51,7,.38);color:#ffd66d;font-size:7px;font-weight:900;letter-spacing:.08em}.real-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.real-preview-card{margin:0;overflow:hidden;border-radius:14px;border:1px solid rgba(54,151,197,.28);background:#03111a;cursor:zoom-in;transition:transform .16s,border-color .16s,box-shadow .16s}.real-preview-card:hover{transform:translateY(-2px);border-color:#36bfff;box-shadow:0 13px 34px rgba(0,0,0,.24)}.real-preview-image,.board-real-image{position:relative;padding:8px;background:#020d15}.real-preview-image img,.board-real-image img{display:block;width:100%;height:260px;object-fit:contain;object-position:center;background:#01070d;border-radius:11px;border:1px solid rgba(45,150,197,.18)}.real-preview-card figcaption{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#061722}.real-preview-card figcaption b{font-size:10px}.real-preview-card figcaption span{color:#7896a4;font-size:8px;line-height:1.45}.preview-zoom{position:absolute;right:15px;bottom:15px;display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:rgba(4,25,38,.88);border:1px solid rgba(55,187,239,.42);color:#dff6ff;font-size:8px;font-weight:900}.preview-zoom ha-icon{--mdc-icon-size:14px}.real-preview-note{display:flex;align-items:center;gap:12px;margin-top:10px;padding:14px 16px;border-radius:14px;border:1px solid rgba(43,155,207,.22);background:linear-gradient(145deg,#061a27,#04131d)}.real-preview-note ha-icon{--mdc-icon-size:34px;color:#37bfff}.real-preview-note b{display:block;font-size:11px}.real-preview-note span{display:block;margin-top:5px;color:#7896a4;font-size:8px;line-height:1.5}.real-board{cursor:zoom-in}.board-real-image img{height:240px}.preview-modal{position:fixed;inset:0;z-index:12000;display:none;grid-template-rows:auto 1fr auto;gap:12px;padding:18px;background:rgba(0,5,9,.97)}.preview-modal.show{display:grid}.preview-modal-head{display:flex;align-items:center;justify-content:space-between;gap:20px}.preview-modal-head>div{min-width:0}.preview-modal-head b{display:block;margin-top:4px;font-size:17px}.preview-modal-head span:not(.eyebrow){display:block;margin-top:3px;color:#88a7b6;font-size:10px}.preview-modal-head>button{width:42px;height:42px;border-radius:11px;border:1px solid #2b5a72;background:#08202e;color:white}.preview-modal-stage{position:relative;min-height:0;display:grid;place-items:center}.preview-modal-stage img{max-width:96vw;max-height:77vh;width:auto;height:auto;object-fit:contain;border-radius:12px;border:1px solid rgba(61,184,235,.35);box-shadow:0 28px 100px rgba(0,0,0,.55)}.preview-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:60px;border-radius:12px;border:1px solid rgba(73,182,227,.42);background:rgba(4,25,38,.88);color:white}.preview-nav ha-icon{--mdc-icon-size:30px}.preview-nav.prev{left:8px}.preview-nav.next{right:8px}.preview-modal-thumbs{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.preview-modal-thumbs button{padding:8px 11px;border-radius:9px;border:1px solid #254f65;background:#071d2a;color:#a9cbd9;font-size:9px;font-weight:800}.preview-modal-thumbs button.on{border-color:#43c5ff;background:#0a3550;color:white}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.features article{display:flex;gap:12px;min-height:120px;padding:14px;border-radius:15px;background:#061722;border:1px solid rgba(48,136,179,.23)}.ficon{width:40px;height:40px;display:grid;place-items:center;flex:none;border-radius:11px;color:#35bfff;background:#062c45;border:1px solid rgba(53,191,255,.3)}.features h3{font-size:13px}.features p{margin-top:4px;color:#7896a4;font-size:9px;line-height:1.5}.board-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.board{overflow:hidden;border-radius:18px;border:1px solid rgba(48,140,184,.25);background:#061722}.board-demo{padding:8px}.board-copy{display:flex;gap:12px;align-items:center;padding:12px;border-top:1px solid rgba(255,255,255,.05)}.board-copy>span{font-size:22px;font-weight:900;color:#1d6a93}.board-copy h3{font-size:14px}.board-copy p{font-size:8px;color:#6f8f9f}.buy{margin-top:26px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px;border-radius:20px;border:1px solid rgba(45,174,237,.35);background:linear-gradient(135deg,#071d2b,#04131d)}.buy h2{font-size:23px;margin:4px 0}.buy p{color:#7997a6;font-size:10px}.buy>div:last-child{display:flex;gap:8px}.modal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:18px}.modal.show{display:flex}.backdrop{position:absolute;inset:0;background:rgba(0,5,9,.82);backdrop-filter:blur(8px)}.modal-card{position:relative;z-index:1;width:min(900px,96vw);max-height:94vh;overflow:auto;padding:20px;border-radius:22px;background:#061722;border:1px solid rgba(52,168,220,.38);box-shadow:0 40px 140px #000}.x{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:#0b2230;color:white}.modal-head{display:flex;gap:18px;align-items:center;padding-right:45px}.modal-head img{width:210px;max-height:70px;object-fit:contain}.modal-head h2{font-size:24px;margin:4px 0}.modal-head p{font-size:10px;color:#7594a3}.license-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:18px 0}.license-cards>div{padding:11px;border-radius:10px;background:#04121b;border:1px solid rgba(255,255,255,.07)}.license-cards span,.diag-grid span{display:block;color:#607f8f;font-size:8px;font-weight:900}.license-cards b,.license-cards code,.diag-grid b{display:block;margin-top:3px;font-size:10px;word-break:break-all}.license-tools{margin-bottom:10px}.diagnostics{display:none;margin:10px 0}.diagnostics.show{display:block}.diag-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.diag-grid>div{padding:9px;border-radius:9px;background:#04131d;border:1px solid rgba(255,255,255,.06)}.diag-grid .wide{grid-column:1/-1}.good{color:#6acbff}.bad{color:#ff7e87}.modal-card label{display:block;color:#87a4b2;font-size:9px;font-weight:900}.modal-card textarea{width:100%;margin-top:6px;padding:10px;border-radius:10px;background:#020f17;color:white;border:1px solid #29546a;resize:vertical}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.security-note{display:block;margin-top:12px;color:#5f8192;font-size:8px;line-height:1.45}.toast{position:fixed;right:22px;bottom:22px;z-index:10000;opacity:0;transform:translateY(20px);max-width:470px;padding:12px 15px;border-radius:10px;background:#07395f;border:1px solid #249fff;color:white;font-size:10px;font-weight:900;transition:.2s}.toast.show{opacity:1;transform:translateY(0)}.toast.error{background:#4c2026;border-color:#f0606c}.center{min-height:85vh;display:flex;align-items:center;justify-content:center;gap:12px}.center>div{display:flex;flex-direction:column}.center small{color:#6b8a99}.spin{width:28px;height:28px;border-radius:50%;border:3px solid #163847;border-top-color:#2db6ff;animation:r .8s linear infinite}@keyframes r{to{transform:rotate(360deg)}}.error{color:#ff7b84}.energy-flow-fixed .home-real-shot{height:230px!important;padding:4px!important}.energy-flow-fixed .home-real-shot img{object-fit:contain!important;object-position:center!important}.active-compact-card[data-open-card]{cursor:pointer!important}.active-compact-card .home-static-preview{cursor:zoom-in!important} .active-grid.cp-compact{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;justify-content:start!important;align-items:start!important}@media(max-width:1100px){.active-grid.cp-compact{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:760px){.active-grid.cp-compact{grid-template-columns:1fr!important}}.active-compact-card{min-height:370px!important}:is(.active-compact-card,.locked-card) .locked-copy .actions{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}.active-compact-card .locked-copy .see{margin-top:10px}.home-static-preview{position:relative;border-radius:14px;overflow:hidden;background:#020d15;border:1px solid rgba(47,151,200,.26)}.home-static-preview .home-real-shot{height:214px;padding:6px;background:#01080d}.home-static-preview .home-real-shot img{display:block;width:100%;height:100%;object-fit:contain;object-position:center;background:#01070c;border-radius:9px}.home-static-preview .home-slide-caption{position:relative;left:auto;right:auto;bottom:auto}.active-compact-card .locked-head .licensed{margin-left:auto}.active-compact-card:hover{transform:translateY(-4px);border-color:rgba(55,188,255,.5);box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .request-card{width:min(820px,96vw)}.request-context{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0}.request-context>div{padding:11px;border-radius:11px;background:#04121b;border:1px solid rgba(255,255,255,.07)}.request-context span{display:block;color:#607f8f;font-size:8px;font-weight:900}.request-context b,.request-context code{display:block;margin-top:4px;font-size:10px;word-break:break-all}.request-context .wide{grid-column:1/-1}.request-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}.request-grid label{font-size:9px;color:#91adba}.request-grid input,.request-grid textarea{width:100%;margin-top:6px;padding:12px;border-radius:11px;background:#020f17;color:#fff;border:1px solid #29546a;outline:none}.request-grid input:focus,.request-grid textarea:focus{border-color:#2db6ff;box-shadow:0 0 0 3px rgba(45,182,255,.1)}.request-grid .wide{grid-column:1/-1}.request-success{text-align:center;padding:18px 12px}.success-orb{width:76px;height:76px;margin:4px auto 16px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,#0f4e68,#062536);border:1px solid #32b8ec;box-shadow:0 0 50px rgba(45,182,255,.18)}.success-orb ha-icon{--mdc-icon-size:38px;color:#64d8ff}.request-success h2{font-size:25px;margin:7px 0}.request-success p{max-width:620px;margin:0 auto;color:#87a6b5;line-height:1.55}.request-statuses{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:18px 0}.request-statuses span{padding:7px 10px;border-radius:999px;background:#062536;border:1px solid rgba(61,175,226,.28);font-size:8px;font-weight:900}.cp-request161{background:linear-gradient(120deg,#f6a700,#ffe191)!important;color:#071622!important;border:1px solid #ffd874!important;font-weight:800!important;box-shadow:0 0 12px #f6a70033}.request-success-actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.whatsapp{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border-radius:10px;border:1px solid #35cf79;background:#0d6b3d;color:white;font-weight:900}.rot{animation:r .8s linear infinite}button:disabled{opacity:.6;cursor:wait}
    @media(max-width:1200px){.summary{grid-template-columns:repeat(2,1fr)}.installation{grid-column:1/-1}.catalog,.features{grid-template-columns:repeat(2,1fr)}.active-grid{grid-template-columns:1fr}.product-title{align-items:flex-start;flex-direction:column}.cta{justify-content:flex-start}}
:is(.active-compact-card,.locked-card) .locked-copy .actions{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);width:100%;align-items:stretch}:is(.active-compact-card,.locked-card) .locked-copy .actions>button{width:100%;min-width:0;min-height:44px;justify-content:center;white-space:normal;overflow-wrap:anywhere;padding:10px 8px;line-height:1.3}:is(.active-compact-card,.locked-card) .locked-copy .actions>button ha-icon{flex-shrink:0}:is(.active-compact-card,.locked-card) .locked-copy .actions>button[data-detail]{background:linear-gradient(120deg,#5931a6,#7d4dd3);border:1px solid #ab8aeb;color:#fff;box-shadow:0 0 10px #7d4dd326}:is(.active-compact-card,.locked-card) .locked-copy .actions>button[data-detail]:hover{background:#7949ce;border-color:#c7aaff}
    @media(max-width:760px){.home-carousel-stage{min-height:200px}.home-real-shot{height:160px}.synthetic-kpis{grid-template-columns:repeat(2,1fr)}.synthetic-status-grid{grid-template-columns:1fr}.synthetic-ring{width:72px;height:72px}.cc,.detail{width:calc(100vw - 16px);padding-top:8px}.hero,.brand,.product-title,.buy{align-items:flex-start;flex-direction:column}.brand img{width:220px}.brand h1{font-size:26px}.hero-state{width:100%}.summary,.catalog,.features,.board-grid{grid-template-columns:1fr}.installation{align-items:flex-start;flex-direction:column}.active-copy{max-width:100%}.mini-demo,.demo-metrics{max-width:100%;grid-template-columns:repeat(2,1fr)}.demo-main,.demo-bottom{grid-template-columns:1fr}.product-title h1{font-size:32px}.buy>div:last-child{flex-wrap:wrap}.license-cards,.diag-grid,.request-grid,.request-context{grid-template-columns:1fr}.request-grid .wide,.request-context .wide{grid-column:auto}.modal-head{align-items:flex-start;flex-direction:column}.modal-head img{width:160px}.real-preview-head{align-items:flex-start;flex-direction:column}.real-preview-grid{grid-template-columns:1fr}.real-preview-image img,.board-real-image img{height:auto}.preview-nav{width:40px;height:50px}.preview-modal-stage img{max-height:70vh}}
    .cp-v2-trial-button{width:100%;margin-top:14px;padding:12px;border:1px solid #43c8ff;border-radius:12px;background:linear-gradient(95deg,#08659b,#073553);color:#effaff;font-weight:800;cursor:pointer}
    .cp-v2-trial-button span{display:block;font-size:10px;color:#addfff;margin-top:4px}
    .cp-v2-remaining{display:block;margin-top:8px;color:#a5f7cf;font-weight:700;font-size:12px}
    /* CP-TRIAL-CATALOG-BRIDGE-V1: green trial badge and red expired state */
    .cp-trial-active{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;border:1px solid rgba(76,234,151,.7);background:linear-gradient(135deg,rgba(11,99,56,.85),rgba(6,49,36,.9));color:#98ffd0;font-size:10px;font-weight:900;box-shadow:0 0 18px rgba(26,217,115,.19);white-space:normal}
    .cp-trial-expired{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,120,120,.5);background:rgba(100,28,34,.5);color:#ffc1bf;font-size:10px;font-weight:900}


    /* CP-TRIAL-V2-UI-R1 | UI only: eligibility/status comes from signed server state. */
    .cp-trial-available{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;border:1px solid rgba(55,234,141,.82);background:linear-gradient(125deg,rgba(12,91,56,.95),rgba(4,53,37,.94));color:#acffce;font-size:10px;font-weight:900;box-shadow:0 0 13px rgba(32,224,118,.17)}
    .cp-trial-expired{border-color:rgba(251,171,59,.82)!important;background:linear-gradient(125deg,rgba(121,64,6,.95),rgba(77,43,12,.95))!important;color:#ffdc99!important;box-shadow:0 0 12px rgba(255,155,37,.12)}
    .cp-v2-trial-button{background:linear-gradient(110deg,#b51e31,#851222)!important;border:1px solid #ff6978!important;color:#fff!important;font-size:14px!important;min-height:63px;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 0 18px rgba(210,25,55,.16);transition:background .2s,box-shadow .2s,transform .2s}
    .cp-v2-trial-button:hover{background:linear-gradient(110deg,#d42d40,#ac182c)!important;box-shadow:0 0 22px rgba(243,46,75,.3);transform:translateY(-1px)}
    .cp-v2-trial-button:focus-visible{outline:2px solid #fff;outline-offset:2px}
    /* CP-TRIAL-V2-UI-R4 | One moving LED dot follows each original border, no static neon. */
    .cp-v2-quicklinks a{position:relative;isolation:isolate;overflow:visible}
    .cp-v2-quicklinks ha-icon{--mdc-icon-size:24px!important;color:#65dcff!important;filter:drop-shadow(0 0 3px rgba(45,204,255,.4))}
    .cp-v2-quicklinks a::after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;background:#d3f9ff;box-shadow:0 0 5px 2px rgba(36,193,255,.58);pointer-events:none;z-index:3;offset-path:border-box;offset-rotate:0deg;offset-distance:0%;animation:cp-v2-led-orbit-r4 4.4s linear infinite}
    .cp-v2-quicklinks a:nth-child(2)::after{animation-delay:-1.1s}
    .cp-v2-quicklinks a:nth-child(3)::after{animation-delay:-2.2s}
    .cp-v2-quicklinks a:nth-child(4)::after{animation-delay:-3.3s}
    @keyframes cp-v2-led-orbit-r4{to{offset-distance:100%}}
    @supports not (offset-path:border-box){.cp-v2-quicklinks a::after{display:none}}
    /* CP-TRIAL-V2-UI-R5: optional visual animation enabled explicitly by CloudPelizzon owner; no global motion overrides. */

    /* CP_V2_OFFICIAL_QUICKLINKS_R1 */
    .cp-v2-hero-rail{position:relative;z-index:3;display:flex;flex-direction:column;gap:14px;align-items:flex-end;max-width:550px;flex:none}
    .cp-v2-quicklinks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;width:100%}
    .cp-v2-quicklinks a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-decoration:none;min-height:60px;padding:7px;border:1px solid rgba(36,172,245,.55);border-radius:10px;background:rgba(4,28,46,.87);font-size:10px;font-weight:800;color:#c9efff;text-align:center;transition:border-color .15s,background .15s}
    .cp-v2-quicklinks a:hover,.cp-v2-quicklinks a:focus-visible{background:#0b4b73;border-color:#49d8ff;outline:2px solid #32beff;outline-offset:1px}
    .cp-v2-quicklinks ha-icon{color:#45c7ff;--mdc-icon-size:19px}
    @media(max-width:1350px){.hero{flex-wrap:wrap!important}.cp-v2-hero-rail{width:100%;max-width:none;align-items:stretch}.cp-v2-quicklinks{width:100%}.cp-v2-hero-rail .hero-state{align-self:flex-end}}
    @media(max-width:700px){.cp-v2-quicklinks{grid-template-columns:repeat(2,minmax(0,1fr))}.cp-v2-hero-rail .hero-state{align-self:stretch}.cp-v2-quicklinks a{min-height:50px}}
  </style>`}
}
if(!customElements.get("cloudpelizzon-core-panel"))customElements.define("cloudpelizzon-core-panel",CloudPelizzonCorePanel);





/* CP_PRIVATE_LOCAL216 */
/* CP_LIFECYCLE229 */
/* Candidate Core integration: no engine code or installation keys in the browser. */
(() => {
  const Panel=customElements.get('cloudpelizzon-core-panel');
  if (!Panel || Panel.prototype.__privateInstall213) return;
  const p=Panel.prototype;p.__privateInstall213=true;

  const privateStyle220=`<style>
  .cp-private220{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;padding:28px 30px;margin:0 0 22px;border:1px solid rgba(46,197,245,.46);border-radius:20px;background:radial-gradient(ellipse at 100% 0,rgba(0,167,239,.15),transparent 65%),linear-gradient(125deg,#092435,#061722);box-shadow:0 14px 38px rgba(0,0,0,.24);overflow:hidden}
  .cp-private220:before{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(#46e4ff,#087dff)}
  .cp-private220 .cp-private-copy220{display:block;min-width:0}
  .cp-private220 .cp-private-kicker220{display:block;color:#48d9ff;font-size:10px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase;margin-bottom:9px}
  .cp-private220 h2{display:block;font-size:21px;line-height:1.3;margin:0 0 10px;color:#f0faff;font-weight:800}
  .cp-private220 p{display:block;max-width:720px;font-size:13px;line-height:1.65;margin:0;color:#adc7d8}
  .cp-private220 .cp-private-action220{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:365px}
  .cp-private220 .cp-private-button220{appearance:none;display:flex;align-items:center;justify-content:center;gap:13px;min-height:64px;width:100%;padding:16px 23px;border:1px solid #60e1ff;border-radius:14px;background:linear-gradient(120deg,#08bfe5,#087ced);color:#fff;font:inherit;font-size:14px;font-weight:800;line-height:1.45;text-align:left;cursor:pointer;box-shadow:0 6px 24px rgba(0,151,255,.27),inset 0 1px 0 rgba(255,255,255,.24);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
  .cp-private220 .cp-private-button220 ha-icon{--mdc-icon-size:26px;flex:none}
  .cp-private220 .cp-private-button220:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.12);box-shadow:0 10px 30px rgba(0,165,255,.4)}
  .cp-private220 .cp-private-button220:focus-visible{outline:3px solid #baf5ff;outline-offset:4px}
  .cp-private220 .cp-private-button220:disabled{cursor:wait;opacity:.65;transform:none}
  .cp-private220 .cp-private-note220{display:block;font-size:11px;color:#8cbbce;text-align:center;line-height:1.5}
  @media(max-width:850px){.cp-private220{grid-template-columns:1fr;gap:20px;padding:24px}.cp-private220 .cp-private-action220{max-width:none;align-items:stretch}.cp-private220 .cp-private-button220{text-align:center}}
  @media(prefers-reduced-motion:reduce){.cp-private220 .cp-private-button220{transition:none}.cp-private220 .cp-private-button220:hover:not(:disabled){transform:none}}
  </style>`;
  const renderDetail=p.renderDetail,renderHome=p.renderHome,bind=p.bind,activeCard=p.activeCard;
  p.activeCard=function(m){
    const html=activeCard.call(this,m);
    if(m?.license?.status!=='licensed'||this._private213?.[m.sku]?.mode==='local')return html;
    return html.replace(/data-open-card="[^"]*"/,`data-detail="${this.esc(m.sku)}"`).replace(/data-open="[^"]*"/g,`data-private-details213="${this.esc(m.sku)}"`).replace(/Abrir módulo/g,'Instalar módulo');
  };
  p.renderHome=function(...args){
    const html=renderHome.apply(this,args);
    const solar=this.moduleBySku('CP-SOLAR');
    if (solar?.license?.status!=='licensed') return html;
    const card=privateStyle220+'<section class="cp-private220"><div class="cp-private-copy220"><span class="cp-private-kicker220">Seu módulo • no seu Home Assistant</span><h2>Seu módulo completo no Home Assistant</h2><p>Confira a instalação local do Solar, com preservação da configuração e do histórico.</p></div><div class="cp-private-action220"><button class="cp-private-button220" type="button" data-private-details213="CP-SOLAR"><ha-icon icon="mdi:download-circle-outline" aria-hidden="true"></ha-icon><span>Ver instalação local do Solar</span></button></div></section>';
    return html.replace(/(<main\b[^>]*>)/, '$1'+card);
  };
  p.renderDetail=function(sku){
    const rendered=renderDetail.call(this,sku);
    let html=sku==='CP-SOLAR'?rendered.replace('Este módulo já está instalado nesta residência.','A interface do Solar já está disponível neste HA.'):rendered;
    const commercial=this.moduleBySku(sku)?.license?.status==='licensed';
    if(commercial && this._private213?.[sku]?.mode!=='local' && this.moduleBySku(sku)?.local_installed!==true)html=html.replace(/data-open="[^"]*"/g,'data-private-focus225').replace(/Abrir módulo/g,'Instalar módulo');
    const row=this._private213?.[sku]||((sku==='CP-SOLAR'||commercial)?{mode:'loading',can_install:false,message:'Consultando a disponibilidade da instalação local…'}:null);
    if (!row) return html;
    const label=row.mode==='local'?'Módulo completo instalado neste HA':'Instalação completa no seu Home Assistant';
    const detail=row.mode==='local'
      ?'O motor e os dados deste módulo estão neste Home Assistant. Seu cadastro e sua licença continuam vinculados à mesma instalação.'
      :'Para usar o módulo licenciado, primeiro baixe e instale o motor completo neste HA. Seu cadastro, sua configuração e seu histórico serão preservados. O uso em nuvem não está disponível para módulos comprados.';
    const action=row.can_install===true
      ?`<button class="cp-private-button220" type="button" data-private-install213="${this.esc(sku)}"><ha-icon icon="mdi:download-circle-outline" aria-hidden="true"></ha-icon><span>Baixar e instalar o módulo completo neste HA</span></button><small class="cp-private-note220">Configuração e histórico preservados</small>`
      :`<p role="status">${this.esc(row.message||'Preparando a entrega local deste módulo.')}</p>`;
    const card=privateStyle220+`<section class="cp-private220" aria-label="Instalação do módulo completo"><div class="cp-private-copy220"><span class="cp-private-kicker220">${row.mode==='local'?'Motor local • instalado':'Motor local • download completo'}</span><h2>${this.esc(label)}</h2><p>${this.esc(detail)}</p></div><div class="cp-private-action220">${action}</div></section>`;
    return html.replace(/(<main\b[^>]*>)/, '$1'+card);
  };
  p.refreshPrivate213=async function(sku){
    if (!this._hass || this._privateLoading213) return;
    this._privateLoading213=true;
    try {
      const row=await this._hass.callWS({type:'cloudpelizzon/private_modules/status',sku});
      this._private213={...this._private213,[sku]:row};
      if (this.selectedSku===sku) this.render();
    } catch (_) {
      // Missing/unavailable backend must never show an enabled installation button.
      this._private213={...this._private213,[sku]:{mode:'unavailable',can_install:false,message:'A instalação local ainda não está disponível para este módulo.'}};
      if (this.selectedSku===sku) this.render();
    } finally {this._privateLoading213=false;}
  };
  p.bind=function(...args){
    const result=bind.apply(this,args);
    const sku=this.selectedSku;
    this.shadowRoot.querySelectorAll('[data-private-focus225]').forEach(button=>button.onclick=()=>this.shadowRoot.querySelector('.cp-private220')?.scrollIntoView({block:'start',behavior:'smooth'}));
    this.shadowRoot.querySelectorAll('[data-private-details213]').forEach(button=>button.onclick=()=>{
      this.selectedSku=button.dataset.privateDetails213;this.render();
    });
    if (sku && !this._private213?.[sku]) queueMicrotask(()=>this.refreshPrivate213(sku));
    this.shadowRoot.querySelectorAll('[data-private-install213]').forEach(button=>{
      button.onclick=async()=>{
        const sku=button.dataset.privateInstall213;
        if (!confirm('Instalar o módulo completo neste HA? Faremos backup e migraremos seus dados. O cadastro e a licença serão mantidos.')) return;
        button.disabled=true;button.textContent='Preparando instalação e preservando seus dados…';
        try {
          const result=await this._hass.callWS({type:'cloudpelizzon/private_modules/install',sku,confirmed:true});
          this.toast?.(result.restart_required?'Instalação concluída. Use Reiniciar no Update Center para carregar o motor local.':result.installed?'Módulo completo instalado neste HA. Seus dados foram preservados.':'Instalação em andamento.');
          await this.refreshPrivate213(sku);
        } catch (e) {
          this.toast?.(e.message||'Não foi possível concluir a instalação. Os dados de origem foram preservados.',true);
          await this.refreshPrivate213(sku);
        }
      };
    });
    return result;
  };
})();

/* Public lifecycle presentation. Execution remains independently authorized. */
(() => {
 const Panel=customElements.get('cloudpelizzon-core-panel');if(!Panel||Panel.prototype.__lifecycle229)return;
 const p=Panel.prototype;p.__lifecycle229=true;
 const READY229=new Set(['CP-MAINTENANCE','CP-SOLAR','CP-SECURITY','CP-AUTOMATION','CP-LIGHTING']);
 const home=p.renderHome,bind=p.bind,load=p.load,hide=p.hideLicense,start=p.v2StartTrial;
 const css=`<style>
 .cp-groups229{margin-top:26px}.cp-groups229>header{display:flex;justify-content:space-between;align-items:end;margin:0 0 16px}.cp-groups229 h2{font-size:24px;margin:4px 0 6px}.cp-groups229 header p{color:#8aabbf;font-size:13px;margin:0;line-height:1.6}.cp-group-count229{font-size:12px;color:#90b8cb;border:1px solid #1a4559;border-radius:20px;padding:7px 12px}
 .cp-grid229{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.cp-card229{border:1px solid #1a4155;border-radius:18px;overflow:hidden;background:linear-gradient(140deg,#082333,#05151f);display:flex;flex-direction:column}.cp-card-head229{padding:15px 17px;display:flex;gap:10px;align-items:center;justify-content:space-between}.cp-card-head229 small{font-size:10px;color:#83b8d2;letter-spacing:.6px}.cp-badge229{padding:6px 10px;border-radius:20px;font-size:10px;font-weight:800;border:1px solid;white-space:nowrap}.cp-badge229.local{color:#60e5b2;border-color:#197752;background:#063526}.cp-badge229.pending{color:#ffd28d;border-color:#8b6226;background:#322713}.cp-badge229.trial{color:#60dfff;border-color:#187aa1;background:#073246}.cp-badge229.available{color:#c6aeff;border-color:#7052aa;background:#241a3c}.cp-badge229.expired{color:#f4aa8e;border-color:#8b4f34;background:#341d15}.cp-badge229.planned,.cp-badge229.unknown{color:#a6b6c5;border-color:#425466;background:#172631}
 .cp-card-preview229{padding:0 15px}.cp-card-body229{padding:19px 18px;display:flex;flex-direction:column;flex:1}.cp-card-body229 h3{font-size:19px;line-height:1.3;margin:0 0 9px}.cp-card-body229>p{color:#94afc0;font-size:12px;line-height:1.7;margin:0 0 14px}.cp-card-status229{font-size:12px;color:#b9d5e5;line-height:1.6;margin-top:auto;padding-top:12px;border-top:1px solid #173c50}.cp-card-actions229{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}.cp-card-actions229 button{padding:11px 16px!important;border-radius:10px!important;font-size:12px!important}.cp-card-actions229 .secondary{background:#102a3b!important;color:#bcd8e8!important;border:1px solid #31586c!important}.cp-card-actions229 .primary{background:linear-gradient(115deg,#04b9e8,#087cdf)!important;color:#fff!important;border:1px solid #49d5ff!important}.cp-card229.available .primary{background:linear-gradient(115deg,#7950d4,#a17ae9)!important;border-color:#b498ed!important}.cp-card229.expired .primary{background:#b77920!important;border-color:#e4af5a!important}
 .cp-connection229{padding:14px 18px;margin-bottom:18px;border:1px solid #92642a;border-radius:12px;color:#ffdb9b;background:#2a2115;font-size:13px;line-height:1.6}.cp-license-fields229{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:20px 0}.cp-license-fields229>div{padding:14px;background:#04141d;border:1px solid #234355;border-radius:10px;min-width:0}.cp-license-fields229 small{display:block;color:#82a8bc;font-size:11px;margin-bottom:7px}.cp-license-fields229 b,.cp-license-fields229 code{overflow-wrap:anywhere;color:#e6f7ff;font-size:13px}.cp-license-row229{border:1px solid #1c5361;border-radius:10px;padding:14px;margin-top:10px;font-size:13px;line-height:1.7}.cp-license-row229 code{overflow-wrap:anywhere}.cp-license-close229{background:#0e3d54;border:1px solid #3485a6;border-radius:9px;color:white;padding:10px 18px;cursor:pointer}
 @media(max-width:1100px){.cp-grid229{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.cp-grid229,.cp-license-fields229{grid-template-columns:1fr}.cp-groups229 h2{font-size:21px}.cp-card-actions229 button{flex:1}}
 </style>`;
 p.moduleState229=function(m){
  if(m?.license?.allowed===true&&m.license.status==='licensed')return m.local_installed===true||this._private213?.[m.sku]?.mode==='local'?'local':'pending';
  const t=m?.trial;if(t?.verified===true){
   if(t.phase==='trial_active'&&t.paid_confirmed===false)return Date.parse(t.blocks_at||'')>Date.now()?'trial':'expired';
   if(['trial_blocked','trial_removal_due'].includes(t.phase))return 'expired';
   if(t.phase==='not_started'&&READY229.has(m.sku))return 'available';
  }
  if(m?.license?.status==='unverified')return 'unknown';
  return m.lifecycle==='planned'?'planned':'unknown';
 };
 p.remaining229=function(deadline){const sec=Math.max(0,Math.floor((Date.parse(deadline||'')-Date.now())/1000));if(!Number.isFinite(sec))return '';const d=Math.floor(sec/86400),h=Math.floor(sec%86400/3600),min=Math.floor(sec%3600/60);return sec===0?'Prazo encerrado':`Restam ${d?d+'d ':''}${h?h+'h ':''}${min}min`;};
 p.updateTrialClocks=function(){this.shadowRoot.querySelectorAll('.cp-v2-remaining[data-deadline]').forEach(n=>n.textContent=this.remaining229(n.dataset.deadline));};
 p.moduleCard229=function(m){
  const state=this.moduleState229(m),sku=this.esc(m.sku),labels={local:'Contratado · instalado',pending:'Contratado · instalar',trial:'Teste em andamento',available:'Teste disponível',expired:'Teste encerrado',planned:'Em desenvolvimento',unknown:'Verificação pendente'};
  let action='',note='';
  if(state==='local'){action=`<button class="primary" data-open="${this.esc(m.path||'')}">Abrir módulo →</button>`;note='Motor instalado neste Home Assistant. Licença vinculada a esta instalação.';}
  else if(state==='pending'){action=`<button class="primary" data-private-details213="${sku}">Instalar módulo ↓</button>`;note='Instale o pacote completo neste HA para começar a usar. Sem execução paga na nuvem.';}
  else if(state==='trial'){action=`<button class="primary" data-open="${this.esc(m.path||'')}">Abrir teste →</button>`;note=`<span class="cp-v2-remaining" data-deadline="${this.esc(m.trial.blocks_at)}">${this.esc(this.remaining229(m.trial.blocks_at))}</span> · Prazo original mantido.`;}
  else if(state==='available'){action=`<button class="primary" data-start-trial="${sku}">Iniciar teste de 7 dias</button>`;note='O prazo começa somente quando você iniciar o teste.';}
  else if(state==='expired'){action=`<button class="primary" data-request="${sku}">Contratar módulo</button>`;note='O período de avaliação terminou. Consulte a proposta para continuar.';}
  else if(state==='planned'){note='Conheça a proposta deste módulo. A operação ainda não está disponível.';}
  else{note='Aguarde a confirmação do servidor. Nenhum acesso foi liberado por esta tela.';}
  return `<article class="cp-card229 ${state}"><div class="cp-card-head229"><small>${sku}</small><span class="cp-badge229 ${state}">${labels[state]}</span></div><div class="cp-card-preview229">${this.renderHomeCarousel(m.sku)}</div><div class="cp-card-body229"><h3>${this.esc(m.name)}</h3><p>${this.esc(m.description||'')}</p><div class="cp-card-status229">${note}</div><div class="cp-card-actions229">${action}<button class="secondary" data-detail="${sku}">Ver detalhes</button></div></div></article>`;
 };
 p.renderHome=function(...args){
  let html=home.apply(this,args).replace(/<section class="cp-private220">[\s\S]*?<\/section>/,'');
  const modules=this.data?.modules||[],groups=[['local','Seus módulos contratados','Instalados neste Home Assistant, prontos para uso.'],['pending','Instalação pendente','Sua licença está ativa. Instale o módulo completo para começar a usar.'],['trial','Seus testes em andamento','Acompanhe o prazo e explore os módulos durante a avaliação.'],['available','Experimente por 7 dias','Você escolhe quando iniciar cada teste.'],['expired','Testes encerrados','Contrate o módulo para continuar usando.'],['unknown','Verificação de acesso','A conexão precisa ser confirmada antes de abrir os módulos.'],['planned','Conheça os próximos módulos','Prévia das experiências que estão em desenvolvimento.']];
  const sections=groups.map(([key,title,description])=>{const rows=modules.filter(m=>this.moduleState229(m)===key);return rows.length?`<section class="cp-groups229"><header><div><h2>${title}</h2><p>${description}</p></div><span class="cp-group-count229">${rows.length}</span></header><div class="cp-grid229">${rows.map(m=>this.moduleCard229(m)).join('')}</div></section>`:'';}).join('');
  if(this.data?.status_verified===true)html=html.replace('<span>VALIDAÇÃO ONLINE</span><b>Pendente</b>','<span>VALIDAÇÃO ONLINE</span><b>Conectada</b>');
  html=html.replace(/<section class="block">[\s\S]*<\/main>/,sections+'</main>');
  return css+(this._connectionNotice229?`<div class="cp-connection229" role="status">${this.esc(this._connectionNotice229)}</div>`:'')+html;
 };
 p.v2TrialButton=function(m){return this.moduleState229(m)==='available'?`<button class="cp-v2-trial-button" type="button" data-start-trial="${this.esc(m.sku)}">Iniciar teste de 7 dias</button>`:'';};
 p.v2StartTrial=async function(sku){
  if(sku!=='CP-LIGHTING')return start.call(this,sku);
  const m=this.moduleBySku(sku);if(!m||this.moduleState229(m)!=='available')return this.toast('Consulte o estado atual do teste. O prazo existente não será reiniciado.','error');
  if(!confirm('Iniciar o teste de 7 dias de Iluminação Inteligente? O prazo começa agora e não pode ser reiniciado.'))return;
  try{const r=await this._hass.callWS({type:'cloudpelizzon/core/trial/v2/start',sku});await this.load();this.toast(r.first_activation?'Teste de Iluminação iniciado.':'Prazo original mantido.');}catch(e){this.toast(e.message||'Não foi possível iniciar o teste.','error');}
 };
 p.licenseSummary=function(){const rows=this.data?.modules||[],paid=rows.filter(m=>['local','pending'].includes(this.moduleState229(m))).length,active=rows.filter(m=>['local','trial'].includes(this.moduleState229(m))).length,trial=rows.filter(m=>this.moduleState229(m)==='trial').length;return {active,total:rows.length,tone:'on',label:paid?`${paid} contratado${paid>1?'s':''}${trial?` · ${trial} em teste`:''}`:trial?`${trial} em teste`:'Sem módulos contratados'};};
 p.load=async function(...args){
  await load.apply(this,args);
  if(this.error&&this.data){
   this._connectionNotice229='A conexão está temporariamente indisponível. Aguarde a próxima consulta ou tente novamente. Seus prazos e dados foram preservados.';
   this.data={...this.data,status_verified:false,modules:(this.data.modules||[]).map(m=>({...m,license:{...m.license,allowed:false,status:'unverified'},trial:undefined}))};
   this.error=null;this.render();
   this.dispatchEvent(new CustomEvent('cloudpelizzon-module-rights-changed',{detail:{modules:this.data.modules},bubbles:true,composed:true}));
  }else if(this.data?.status_verified!==false)this._connectionNotice229=null;
 };
 p.renderLicenseModal=function(){
  const d=this._profile229,customer=d?.customer,licenses=d?.licenses||[];
  const field=(name,value)=>`<div><small>${name}</small><b>${this.esc(value||'Não informado')}</b></div>`;
  const date=value=>value?new Date(value).toLocaleString('pt-BR'):'Sem expiração';
  return css+`<div id="license-modal" class="modal ${this._licenseOpen229?'show':''}"><div class="backdrop" data-close-license></div><section class="modal-card" role="dialog" aria-modal="true" aria-label="Licenças e instalação"><button class="x" data-close-license aria-label="Fechar">×</button><div class="modal-head"><div><span class="eyebrow">CLOUDPELIZZON · LICENSE SERVER</span><h2>Licenças e instalação</h2><p>Cadastro vinculado à instalação e licenças por módulo.</p></div></div><div class="cp-license-fields229">${field('Cliente',customer?.name||(this._profileLoading229?'Consultando cadastro…':'Cadastro indisponível'))}${field('Código do cliente',customer?.dolibarr_code_client)}${field('ID da instalação no Home Assistant',d?.core_id||this.data?.installation_id)}${field('Identidade assinada',d?.installation_id)}${field('Validação online',d?'Cadastro assinado pelo servidor':'Aguardando consulta')}${field('Última consulta',d?new Date(d.issued_at*1000).toLocaleString('pt-BR'):null)}</div>${this._profileError229?`<div class="cp-connection229">${this.esc(this._profileError229)}</div>`:''}${licenses.map(r=>`<div class="cp-license-row229"><b>${this.esc(this.moduleBySku(r.sku)?.name||r.sku)} · ${r.active?'Ativa':'Inativa'}</b><br><code>${this.esc(r.license_id)}</code><br>Validade: ${r.perpetual?'Perpétua':this.esc(date(r.expires_at))} · Revisão ${this.esc(r.revision)}</div>`).join('')||'<p>Nenhuma licença comercial foi apresentada nesta consulta.</p>'}<p style="font-size:12px;line-height:1.7;color:#91b3c6">A compra vincula a licença à instalação automaticamente. O uso do módulo comprado exige a instalação local completa. Testes de 7 dias são apresentados separadamente na Visão Geral.</p><div style="display:flex;gap:10px;margin-top:18px"><button type="button" class="cp-license-close229" data-profile-refresh229>Atualizar cadastro</button><button type="button" class="cp-license-close229" data-close-license>Fechar</button></div><cloudpelizzon-fleet-registration></cloudpelizzon-fleet-registration></section></div>`;
 };
 p.showLicense=async function(){
  this._licenseOpen229=true;if(this._profileLoading229)return;this._profileLoading229=true;this._profileError229=null;this.render();
  try{this._profile229=await this._hass.callWS({type:'cloudpelizzon/core/license/details'});}catch(e){this._profileError229=e.message||'Não foi possível consultar o cadastro.';}finally{this._profileLoading229=false;this.render();}
 };
 p.hideLicense=function(){this._licenseOpen229=false;return hide.call(this);};
 p.bind=function(...args){const r=bind.apply(this,args);this.shadowRoot.querySelector('[data-profile-refresh229]')?.addEventListener('click',()=>this.showLicense());return r;};
})();

/* CP_LICENSE475: presentation only; data comes from the existing protected signed-profile endpoint. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-core-panel').prototype;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const icon='<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/><path d="m8 12 3 3 5-6"/></svg>';
 const date=n=>n?new Date(typeof n==='number'?n*1000:n).toLocaleString('pt-BR'):'Não informado';
 const css=`#license-modal[popover]{position:fixed!important;inset:0!important;margin:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;padding:0!important;border:0!important;background:#06131f!important;color:#e9f7ff!important;font:14px system-ui!important;box-sizing:border-box!important;overflow:auto!important}#license-modal:not(:popover-open){display:none!important}#license-modal::backdrop{background:transparent;pointer-events:none}#license-modal *{box-sizing:border-box}#license-modal .license474{min-height:100%;padding:clamp(20px,3vw,45px);background:radial-gradient(ellipse at 100% 0,#12405a55,transparent 55%),#06131f}#license-modal header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:25px;border-bottom:1px solid #284453}#license-modal .brand474{display:flex;gap:16px;align-items:center}#license-modal .emblem474{display:grid;place-items:center;width:60px;height:60px;border-radius:18px;color:#63e1ff;background:linear-gradient(135deg,#17475d,#0c1c2e);border:1px solid #34829e;box-shadow:0 8px 25px #0006,inset 0 1px #a6eaff44}#license-modal small{color:#9cb9ca;display:block}#license-modal .eyebrow474{color:#58d8ff;font-size:11px;font-weight:800;letter-spacing:2px}#license-modal h2{font-size:27px;margin:7px 0;color:#f0faff}#license-modal p{color:#adc6d7;line-height:1.7}#license-modal button{border:1px solid #38718b;color:#dff5ff;background:linear-gradient(135deg,#153e55,#10283c);border-radius:10px;padding:11px 17px;font:600 13px system-ui;cursor:pointer;min-height:42px}#license-modal button:hover{border-color:#62dcff;background:#164760}#license-modal button:focus-visible{outline:2px solid #69e4ff;outline-offset:3px}#license-modal .actions474{display:flex;gap:10px;flex-wrap:wrap}#license-modal .summary474{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px;margin:24px 0}#license-modal .tile474,#license-modal .module474{padding:22px;border:1px solid #2d4e62;border-radius:16px;background:linear-gradient(140deg,#112b3e,#091c2a);box-shadow:0 10px 26px #0003,inset 0 1px #a7dcff0d}#license-modal .tile474 b{display:block;margin-top:8px;font-size:20px;overflow-wrap:anywhere}#license-modal .fields474{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:20px 0}#license-modal .fields474 b{font-size:14px}#license-modal .modules474{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:18px 0}#license-modal .module474 h3{color:#e9f7ff;font-size:17px;margin:12px 0 17px}#license-modal .status474{display:inline-flex;border:1px solid #268f78;border-radius:30px;padding:5px 10px;font-size:11px;color:#72f1c1;background:#08352f}#license-modal .status474.off{color:#ffd299;border-color:#8a6640;background:#33291d}#license-modal code{font-size:12px;overflow-wrap:anywhere;color:#b5cfde}#license-modal .notice474{padding:16px 20px;border:1px solid #32647c;border-radius:12px;background:#103048;color:#c1dfed}#license-modal .notice474.error{border-color:#a36a45;background:#36251e;color:#ffd8ac}#license-modal details{border:1px solid #294a5f;padding:17px;border-radius:13px;margin:25px 0}#license-modal summary{cursor:pointer;color:#9ccee4}#license-modal footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #294a5f;padding-top:20px;margin-top:28px;color:#9db9ca}#license-modal [data-license-close474]{background:linear-gradient(120deg,#087f9b,#1762a0);color:#fff} @media(max-width:850px){#license-modal .summary474,#license-modal .fields474,#license-modal .modules474{grid-template-columns:1fr}#license-modal header{align-items:flex-start;flex-wrap:wrap}#license-modal h2{font-size:23px}#license-modal footer{gap:20px;flex-wrap:wrap}}`;
 function markup(host){
  const actor=host._hass?.user?.id,d=host._profileActor474===actor?host._profile229:null,loading=host._profileLoading229,licenses=Array.isArray(d?.licenses)?d.licenses:[],active=licenses.filter(x=>x.active===true).length;
  const unknown=loading?'Consultando…':'Não informado pelo cadastro',field=(label,value)=>`<div class="tile474"><small>${esc(label)}</small><b>${esc(value||unknown)}</b></div>`;
  const fresh=d&&Date.now()/1000<d.expires_at;
  return `<div id="license-modal" popover="manual" role="dialog" aria-modal="false" aria-labelledby="license-title474"><style>${css}</style><main class="license474"><header><div class="brand474"><span class="emblem474">${icon}</span><div><small class="eyebrow474">CLOUDPELIZZON · SEU ECOSSISTEMA</small><h2 id="license-title474">Licenças e instalação</h2><small>Seus sistemas, vínculos e informações de contratação em um só lugar.</small></div></div><div class="actions474"><button type="button" data-license-refresh474>↻ Atualizar cadastro</button><button type="button" data-license-close474 aria-label="Fechar licenças">✕ Fechar tela</button></div></header><section class="summary474">${field('Cliente',d?.customer?.name)}${field('Código do cliente',d?.customer?.dolibarr_code_client)}${field('Módulos licenciados',d?String(active):null)}</section>${loading?'<p class="notice474" role="status">Consultando seu cadastro e suas licenças. Você pode fechar esta tela durante a consulta.</p>':''}${host._profileError229?`<p class="notice474 error" role="alert">${esc(host._profileError229)} Use “Atualizar cadastro” para tentar novamente.</p>`:''}<section class="fields474">${field('Instalação no Home Assistant',d?.core_id||host.data?.installation_id)}${field('Situação do cadastro',d?(fresh?'Cadastro confirmado':'Consulta anterior — atualize para conferir'):null)}${field('Última consulta recebida',d?date(d.issued_at):null)}</section><h2 style="font-size:20px;margin-top:30px">Seus sistemas CloudPelizzon</h2><section class="modules474">${licenses.map(r=>`<article class="module474"><span class="status474 ${r.active?'':'off'}">${r.active?'● Licença ativa':'● Licença inativa'}</span><h3>${esc(host.moduleBySku(r.sku)?.name||({'CP-LIGHTING':'Iluminação','CP-SOLAR':'Inteligência Solar','CP-SECURITY-PRO':'Central de Segurança Pro','CP-MAINTENANCE':'Manutenção Residencial Preventiva','CP-AUTOMATION':'Central Inteligente de Automações'})[r.sku]||r.sku)}</h3><small>Validade</small><p style="margin:5px 0 15px">${r.perpetual?'Perpétua':esc(date(r.expires_at))}</p><small>Identificação da licença</small><code>${esc(r.license_id)}</code><small style="margin-top:12px">Revisão ${esc(r.revision??'Não informada')}</small></article>`).join('')}</section>${!d&&!loading?'<p class="notice474">Não foi possível apresentar as licenças nesta consulta. Isso não significa que os seus módulos foram removidos.</p>':d&&!licenses.length?'<p class="notice474">O cadastro consultado não apresentou licenças comerciais.</p>':''}${d?.installation_id?`<details><summary>Identidade vinculada à instalação</summary><p><code>${esc(d.installation_id)}</code></p></details>`:''}<footer><span>CloudPelizzon · Automação para um futuro melhor</span><button type="button" data-license-close474>Voltar aos meus sistemas →</button></footer></main></div>`;
 }
 let active475;
 function layout475(host,modal){
  const shell=host.getRootNode()?.host,bar=shell?.shadowRoot?.querySelector('.topbar');
  const top=Math.max(0,bar?.getBoundingClientRect().bottom||0),left=Math.max(0,shell?.getBoundingClientRect().left||0);
  for(const [key,value] of Object.entries({top:top+'px',left:left+'px',right:'auto',bottom:'auto',width:(innerWidth-left)+'px',height:(innerHeight-top)+'px'}))modal.style.setProperty(key,value,'important');
  const main=modal.querySelector('.license474');main.style.zoom=innerWidth>=1000?'.67':'1';
 }
 window.addEventListener('resize',()=>{const host=active475?.deref();const modal=host?.shadowRoot?.querySelector('#license-modal');if(host?.isConnected&&modal)layout475(host,modal);});
 function display(host){
  if(!host._licenseOpen229||!host.isConnected||!host.shadowRoot)return;
  host.shadowRoot.querySelector('#license-modal')?.remove();
  const template=document.createElement('template');template.innerHTML=markup(host);host.shadowRoot.append(template.content);
  const modal=host.shadowRoot.querySelector('#license-modal');modal.showPopover();modal.style.setProperty('zoom','1','important');modal.style.setProperty('zoom',String(1/(modal.currentCSSZoom||1)),'important');layout475(host,modal);active475=new WeakRef(host);
  modal.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-license-close474')){e.preventDefault();e.stopImmediatePropagation();host.hideLicense();}else if(b.hasAttribute('data-license-refresh474')){e.preventDefault();e.stopImmediatePropagation();host.showLicense();}});
  modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();host.hideLicense();}});
 }
 p.renderLicenseModal=function(){return '';};
 const render=p.render;p.render=function(...args){const result=render.apply(this,args);display(this);return result;};
 p.hideLicense=function(){this._licenseOpen229=false;this._licenseSeq474=(this._licenseSeq474||0)+1;this._profileLoading229=false;const modal=this.shadowRoot?.querySelector('#license-modal');if(modal?.matches(':popover-open'))modal.hidePopover();modal?.remove();};
 p.showLicense=async function(){
  const actor=this._hass?.user?.id;if(this._profileActor474!==actor){this._profile229=null;this._profileActor474=actor;}
  if(this._profileLoading229&&this._licenseOpen229){display(this);return;}
  this._licenseOpen229=true;this._profileLoading229=true;this._profileError229=null;const seq=this._licenseSeq474=(this._licenseSeq474||0)+1;display(this);
  let timer;
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A consulta demorou além do esperado.')),16000);});
   const d=await Promise.race([this._hass.callWS({type:'cloudpelizzon/core/license/details'}),timeout]);
   if(seq!==this._licenseSeq474||actor!==this._hass?.user?.id||!this.isConnected)return;
   if(!d||!Array.isArray(d.licenses)||!d.customer)throw Error('O cadastro não retornou as informações esperadas.');
   this._profile229=d;this._profileActor474=actor;
  }catch(error){if(seq===this._licenseSeq474&&actor===this._hass?.user?.id)this._profileError229=error?.code==='unauthorized'?'Este usuário não tem permissão para consultar o cadastro.':'Não foi possível concluir a consulta do cadastro agora.';}
  finally{clearTimeout(timer);if(seq===this._licenseSeq474){this._profileLoading229=false;display(this);}}
 };
})();

/* CP_CATALOG476: official presentation assets; future modules never imply operational availability. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-core-panel').prototype,assets={"CP-SECURITY": {"name": "Central de Segurança", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-security.webp", "summary": "A base da proteção da casa: centraliza alarmes, sensores, presença e eventos em um único lugar.", "description": "Este módulo é o ponto de partida da segurança. Ele reúne o que aconteceu na casa — disparos, sensores, presença e ocorrências — para você visualizar, receber alertas e consultar histórico com clareza."}, "CP-SECURITY-PRO": {"name": "Central de Segurança", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-security.webp", "summary": "Alarmes, sensores e eventos de segurança em uma central essencial para a residência.", "description": "A Central de Segurança está em desenvolvimento. A proposta é reunir alertas e acompanhamento de sensores em uma interface essencial. A Central de Segurança Pro é o módulo avançado já desenvolvido; esta apresentação se refere exclusivamente à versão base."}, "CP-ENERGY": {"name": "Inteligência de Energia", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-energy.png", "summary": "Visão integrada do consumo da residência e da relação com a rede elétrica: consumo, importação, exportação e indicadores energéticos.", "description": "Entrega uma visão integrada do uso de energia da residência e da relação com a rede elétrica. Ajuda a acompanhar consumo, importação, exportação, eficiência e tendências para identificar desperdícios e oportunidades de economia."}, "CP-SOLAR": {"name": "Inteligência Solar", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-solar.png", "summary": "Geração fotovoltaica, desempenho, eficiência, inversores e acompanhamento da produção solar.", "description": "Olha especificamente para a geração fotovoltaica. Acompanha produção, eficiência, inversores e desempenho para mostrar se o sistema solar está entregando o esperado e como a geração se relaciona com o consumo."}, "CP-MAINTENANCE": {"name": "Manutenção Residencial Preventiva", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-maintenance.png", "summary": "Planejamento de revisões, vencimentos, histórico e saúde da manutenção residencial.", "description": "Com manutenção planejada, você preserva o patrimônio da residência, aumenta a segurança e reduz gastos inesperados, mantendo revisões, vencimentos e histórico sob controle."}, "CP-CAMERAS": {"name": "Inteligência de Câmeras", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-cameras.png", "summary": "Visão organizada das câmeras e dos eventos relevantes de monitoramento da residência.", "description": "Transforma várias câmeras e gravações em uma visão organizada de monitoramento. Centraliza eventos relevantes, facilita localizar ocorrências e integra alertas visuais ao restante do ecossistema."}, "CP-AUTOMATION": {"name": "Central Inteligente de Automações", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-automation.png", "summary": "Controle, monitoramento e governança das automações, execuções, riscos e desempenho do ecossistema.", "description": "Centraliza a operação das automações, mostra execuções, falhas, desativações, saúde e desempenho e cria uma camada de governança sobre todo o ecossistema automatizado."}, "CP-NOC": {"name": "Infraestrutura e NOC", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-noc.png", "summary": "Saúde da plataforma, conectividade, disponibilidade e diagnóstico da infraestrutura.", "description": "Monitora a saúde da plataforma, serviços, conectividade e disponibilidade. Permite identificar degradações e falhas antes que elas se transformem em interrupções perceptíveis para quem usa a casa."}, "CP-AMBIENTE": {"name": "Ambiente", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-ambiente.webp", "summary": "Temperatura, umidade, qualidade do ar e indicadores de conforto da residência.", "description": "Acompanha temperatura, umidade e indicadores de conforto ambiental. Esses dados podem alimentar automações de climatização e ajudar a manter os ambientes mais agradáveis e eficientes ao longo do dia."}, "CP-WATER": {"name": "Inteligência de Água", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-water.png", "summary": "Reservatórios, consumo, fluxo e eventos relacionados à água.", "description": "Acompanha reservatórios, consumo, fluxo e eventos relacionados à água. Ajuda a antecipar falta de abastecimento, identificar comportamentos anormais e reduzir desperdícios."}, "CP-GAS": {"name": "Segurança de Gás", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-gas.png", "summary": "Detecção, persistência, incidentes e recuperação de eventos relacionados a gás.", "description": "Acrescenta uma camada dedicada à detecção e acompanhamento de eventos de gás. Permite alertas críticos, persistência de incidentes e histórico para aumentar a capacidade de resposta em situações sensíveis."}, "CP-PRESENCE": {"name": "Presença Inteligente", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-presence.png", "summary": "Visão em tempo real de quem chega, sai e circula, usando presença como contexto para automações e segurança.", "description": "Usa chegada, saída, ocupação e localização como contexto para a casa. Segurança, iluminação e rotinas podem reagir automaticamente às pessoas, reduzindo comandos manuais e tornando o ambiente mais inteligente."}, "CP-FITOS": {"name": "FIT OS", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-fitos.png", "summary": "Treinos, evolução, metas e performance em uma experiência fitness integrada ao ecossistema CloudPelizzon.", "description": "Leva objetivos de fitness para dentro do ecossistema CloudPelizzon. Organiza treinos, evolução, metas, desempenho, recordes e indicadores para transformar atividade física em uma jornada mensurável."}, "CP-GAMIFICATION": {"name": "Gamificação", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-gamification.png", "summary": "Conquistas, recordes e engajamento com metas da residência para envolver toda a família.", "description": "Transforma metas, recordes e bons hábitos em conquistas visíveis para a família. Cria participação e motivação em temas como economia, manutenção, segurança e uso consciente dos recursos da casa."}, "CP-NOTIFICATIONS-PRO": {"name": "Notificações Pro", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-notifications-pro.png", "summary": "Notificações inteligentes por contexto, prioridade e destinatário, com múltiplos canais e regras de envio.", "description": "Entrega a informação certa para a pessoa certa, no canal certo e com a prioridade adequada. Organiza alertas por criticidade, reduz ruído e permite regras e escalonamentos para eventos realmente importantes."}, "CP-ALEXA": {"name": "Central de Monitoramento das Alexas", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-alexa.png", "summary": "Acompanhe status, comunicação, testes, alertas e saúde operacional das Alexas da residência em um único lugar.", "description": "Centraliza a saúde e a operação das Alexas da residência, permitindo detectar falhas rapidamente, validar comunicação, acompanhar testes, alertas e desempenho e aumentar a confiabilidade de anúncios e rotinas."}, "CP-BACKUP": {"name": "Inteligência de Backups", "image": "/cloudpelizzon-core/frontend/showcase/catalog477/cp-backup.png", "summary": "Proteção, replicação, integridade, monitoramento e restauração dos dados e serviços do ecossistema CloudPelizzon.", "description": "Centraliza a proteção dos dados e da operação, acompanha integridade, cobertura, replicação e saúde dos backups e aumenta a segurança para restaurar serviços e informações quando realmente for necessário."}};
const ready=new Set(['CP-SOLAR','CP-MAINTENANCE','CP-SECURITY','CP-AUTOMATION','CP-LIGHTING']);
const publicSku482=m=>m.sku==='CP-SECURITY-PRO'&&m.lifecycle==='planned'?'CP-SECURITY':m.sku==='CP-SECURITY'?'CP-SECURITY-PRO':m.sku;
const state=p.moduleState229,card=p.moduleCard229,detail=p.renderDetail,summary=p.licenseSummary,bind=p.bind,home=p.renderHome;
const future=(host,m)=>m?.lifecycle==='planned'&&!ready.has(m.sku)&&!['local','pending','trial','available','expired'].includes(state.call(host,m));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge='<span class="development476"><b>Em desenvolvimento</b><small>Indisponível para instalação</small></span>';
const css=`.development476{display:inline-flex;flex-direction:column;align-items:flex-start;gap:4px;border:1px solid #486779;border-radius:12px;padding:9px 12px;color:#c1d9e8;background:#102c3d;font-size:11px;white-space:normal}.development476 small{font-size:10px;font-weight:400;color:#9eb9c9}.official476{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#020b12;border-radius:12px}.cp-card229.planned .cp-card-preview229{padding:0 15px}.cp-card229.planned .cp-card-head229{align-items:flex-start}.cp-card229.planned .cp-card-body229 p{line-height:1.7}.cp-card229.planned .cp-card-actions229{margin-top:auto;padding-top:15px}.official476-open{padding:0!important;display:block;width:100%;border:0!important;background:transparent!important;cursor:zoom-in}.presentation476{padding:24px;color:#e9f7ff;font:14px system-ui;background:radial-gradient(ellipse at 90% 0,#153f5555,transparent 55%),#061522}.presentation476 header{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #315267;padding-bottom:18px}.presentation476 h1{font-size:26px;color:#f0faff;margin:8px 0}.presentation476 h2{font-size:20px;margin:0 0 12px}.presentation476 p{line-height:1.8;color:#afcbdc}.presentation476 button{min-height:40px;border:1px solid #3c7896;border-radius:10px;background:#11364b;color:#dff6ff;padding:10px 16px;font:600 12px system-ui;cursor:pointer}.presentation476 button.primary{background:linear-gradient(120deg,#049cb6,#1776bb);color:white}.presentation476 .body476{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(270px,.7fr);gap:24px;margin-top:24px;align-items:start}.presentation476 .art476{background:#020b12;padding:8px;border:1px solid #284d63;border-radius:16px}.presentation476 .art476 img{display:block;width:100%;height:calc(100dvh - 175px);object-fit:contain}.presentation476 .copy476{padding:22px;border:1px solid #2a536b;border-radius:16px;background:linear-gradient(130deg,#112e42,#071d2b)}.presentation476 .copy476 li{margin:12px 0;color:#b6d5e6;line-height:1.6}.presentation476 .actions476{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}.presentation476 .upcoming476{padding:15px;border-left:3px solid #49cde9;background:#123449;color:#c3e8f7;line-height:1.8;margin:20px 0}.image-failed476{display:none;color:#bad5e4;padding:20px;line-height:1.7}.presentation476 a{color:#68dbff}.presentation476 .eyebrow476{font-size:10px;letter-spacing:1.6px;color:#58d9ff}#cp-presentation476[popover]{position:fixed!important;inset:0!important;margin:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;border:0!important;padding:0!important;overflow:auto!important;background:#061522;color:#eaf8ff;box-sizing:border-box}#cp-presentation476:not(:popover-open){display:none!important}#cp-presentation476::backdrop{background:#061522}#cp-presentation476.immersive476 .copy476,#cp-presentation476.immersive476 [data-copy-hide476]{display:none}#cp-presentation476.immersive476 .body476{grid-template-columns:1fr;margin-top:10px}#cp-presentation476.immersive476 .art476 img{height:calc(100dvh - 125px)}.presentation476 .error476{color:#fbd29e}@media(max-width:950px){.presentation476 .body476{grid-template-columns:1fr}.presentation476 .art476 img{height:auto;max-height:65dvh}.presentation476 header{flex-wrap:wrap}.presentation476 h1{font-size:23px}}`;
function presentation(host,m,modal){const d=assets[m.sku],features=typeof CP_MODULES!=='undefined'?CP_MODULES[m.sku==='CP-SECURITY-PRO'&&m.lifecycle==='planned'?'CP-SECURITY':m.sku]?.features||[]:[];return `<style>${css}</style><main class="presentation476"><header><div><span class="eyebrow476">CLOUDPELIZZON · APRESENTAÇÃO DO MÓDULO</span><h1>${esc(m.name||d.name)}</h1></div><div class="actions476"><button type="button" ${modal?'data-close476':'data-back'}>← Voltar aos módulos</button><button type="button" data-zoom476="${esc(m.sku)}">Ampliar imagem ⤢</button></div></header><section class="body476"><div class="art476"><img src="${esc(d.image)}" alt="Apresentação oficial — ${esc(m.name||d.name)}" decoding="async"><div class="image-failed476">A imagem oficial não carregou nesta conexão. <a href="${esc(d.image)}" target="_blank" rel="noopener noreferrer">Abrir apresentação oficial ↗</a></div></div><aside class="copy476">${badge}<div class="upcoming476">Este módulo está em desenvolvimento e em breve estará disponível.<br>A instalação será liberada após a conclusão e a publicação da versão.</div><h2>Conheça a proposta</h2><p>${esc(d.description||d.summary)}</p>${features.length?`<h2>Recursos previstos</h2><ul>${features.map(f=>`<li><b>${esc(f[1])}</b><br>${esc(f[2])}</li>`).join('')}</ul>`:''}<div class="actions476"><button class="primary" type="button" ${modal?'data-request476':'data-request'}="${esc(m.sku)}">Solicitar Módulo →</button></div><small>Registre seu interesse para conhecer este módulo e acompanhar sua evolução.</small></aside></section></main>`;}
p.moduleState229=function(m){return future(this,m)?'planned':state.call(this,m);};
p.moduleCard229=function(m){if(!future(this,m)||!assets[m.sku])return card.call(this,m);const d=assets[m.sku];return `<article class="cp-card229 planned" data-planned476="${esc(m.sku)}"><div class="cp-card-head229"><small>${esc(publicSku482(m))}</small>${badge}</div><div class="cp-card-preview229"><button class="official476-open" type="button" data-presentation476="${esc(m.sku)}" aria-label="Ver apresentação de ${esc(m.name)}"><img class="official476" src="${esc(d.image)}" alt="Apresentação oficial — ${esc(m.name)}" loading="lazy" decoding="async"></button><div class="image-failed476">Apresentação oficial disponível em “Ver mais”.</div></div><div class="cp-card-body229"><h3>${esc(m.name||d.name)}</h3><p>${esc(d.summary)}</p><div class="cp-card-status229">Em breve, novas possibilidades para sua instalação.</div><div class="cp-card-actions229"><button class="secondary" type="button" data-presentation476="${esc(m.sku)}">Ver mais ⤢</button><button class="primary" type="button" data-request="${esc(m.sku)}">Solicitar Módulo →</button></div></div></article>`;};
p.renderDetail=function(sku){const m=this.moduleBySku(sku);return m&&future(this,m)&&assets[sku]?presentation(this,m,false):detail.call(this,sku);};
p.licenseSummary=function(){const result=summary.call(this);return this.data?.status_verified===false?{...result,label:'Consulta pendente',active:'—',tone:'off'}:result;};
p.renderHome=function(...args){return `<style>${css}</style>`+home.apply(this,args)+(this.data?.status_verified===false?'<div class="cp-connection229" role="status">A consulta de acesso está pendente. Isso não confirma cancelamento das licenças. <button type="button" data-check476>Verificar acesso novamente</button></div>':'');};
p.closePresentation476=function(){const modal=this.shadowRoot?.querySelector('#cp-presentation476');if(modal?.matches(':popover-open'))modal.hidePopover();modal?.remove();if(this._presentationFocus476?.isConnected)this._presentationFocus476.focus();this._presentationFocus476=null;};
p.openPresentation476=function(sku,immersive=false){const m=this.moduleBySku(sku);if(!m||!future(this,m)||!assets[sku])return;this.closePresentation476();this._presentationFocus476=this.shadowRoot.activeElement;const template=document.createElement('template');template.innerHTML=`<section id="cp-presentation476" popover="manual" role="dialog" aria-modal="true" aria-label="Apresentação de ${esc(m.name)}">${presentation(this,m,true)}</section>`;this.shadowRoot.append(template.content);const modal=this.shadowRoot.querySelector('#cp-presentation476');if(immersive)modal.classList.add('immersive476');modal.showPopover();modal.querySelector('[data-close476]')?.focus();modal.style.setProperty('zoom','1','important');modal.style.setProperty('zoom',String(1/(modal.currentCSSZoom||1)),'important');modal.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.hasAttribute('data-close476'))this.closePresentation476();else if(b.hasAttribute('data-zoom476'))modal.classList.toggle('immersive476');else if(b.hasAttribute('data-request476')){this.closePresentation476();this.showRequest(b.dataset.request476);}});modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();this.closePresentation476();}});modal.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.style.display='none';e.target.nextElementSibling.style.display='block';}},true);};
p.bind=function(...args){const result=bind.apply(this,args);for(const b of this.shadowRoot.querySelectorAll('[data-presentation476]'))b.onclick=()=>this.openPresentation476(b.dataset.presentation476);for(const b of this.shadowRoot.querySelectorAll('[data-zoom476]'))b.onclick=()=>this.openPresentation476(b.dataset.zoom476,true);for(const b of this.shadowRoot.querySelectorAll('[data-check476]'))b.onclick=async()=>{b.disabled=true;try{await this.load();}finally{if(b.isConnected)b.disabled=false;}};for(const img of this.shadowRoot.querySelectorAll('img.official476'))img.onerror=()=>{img.style.display='none';img.closest('.cp-card-preview229').querySelector('.image-failed476').style.display='block';};return result;};
})();


/* CP_PRESENTATION_SCALE477 */
(()=>{const p=customElements.get('cloudpelizzon-core-panel').prototype;
const css=`@media(min-width:1000px){:host .detail{zoom:.67!important;width:auto!important;max-width:none!important}:host .presentation476{zoom:.67!important}#cp-presentation476 .presentation476{zoom:.67!important}#cp-presentation476 .art476 img{height:calc((100dvh - 175px) / .67)!important}#cp-presentation476.immersive476 .art476 img{height:calc((100dvh - 125px) / .67)!important}}`;
function style(host){let node=host.shadowRoot?.querySelector('#cp-presentation-scale477');if(!node&&host.shadowRoot){node=document.createElement('style');node.id='cp-presentation-scale477';node.textContent=css;host.shadowRoot.append(node);}}
const render=p.render;p.render=function(...args){const result=render.apply(this,args);style(this);return result;};
const open=p.openPresentation476;p.openPresentation476=function(...args){const result=open.apply(this,args);style(this);return result;};
})();

/* CP478: official presentation carousel; no device or commercial side effects. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-core-panel').prototype,open=p.openPresentation476;
const css=`.presentation476 header{gap:20px;flex-wrap:wrap}.priority478{display:flex;align-items:center;gap:16px;flex:1;max-width:660px;margin:auto;padding:14px 20px;border:1px solid #227397;border-radius:14px;background:linear-gradient(110deg,#0c3c53,#102a42)}.priority478 p{margin:0;font-size:13px;line-height:1.5}.priority478 strong{display:block;color:#70e9ff;font-size:16px;margin-bottom:3px}.priority478 button{white-space:nowrap;background:linear-gradient(120deg,#08bfd9,#147ac8);box-shadow:0 0 24px #00beef22}.presentation476 .art476{position:relative;padding:8px 60px}.nav478{position:absolute;top:50%;transform:translateY(-50%);width:46px;min-height:66px!important;padding:0!important;font-size:30px!important;background:#07273de8!important;box-shadow:0 0 20px #00bce533}.nav478.prev{left:7px}.nav478.next{right:7px}.nav478:hover{background:#14516b!important}.nav478:focus-visible{outline:3px solid #71eaff;outline-offset:3px}.position478{display:block;text-align:center;color:#88bfd6;font-size:12px;padding:8px}.position478 b{color:#d7f5ff}@media(max-width:700px){.priority478{flex-basis:100%;max-width:none;flex-wrap:wrap}.presentation476 .art476{padding:4px 38px}.nav478{width:32px;min-height:48px!important}.nav478.prev{left:2px}.nav478.next{right:2px}}`;
p.openPresentation476=function(sku,immersive=false){
 open.call(this,sku,immersive);const modal=this.shadowRoot.querySelector('#cp-presentation476');if(!modal)return;
 const list=(this.data?.modules||[]).filter(m=>m.lifecycle==='planned'&&this.moduleState229(m)==='planned');const index=list.findIndex(m=>m.sku===sku);if(index<0)return;
 modal.dataset.sku478=sku;const style=document.createElement('style');style.textContent=css;modal.append(style);
 const header=modal.querySelector('header'),priority=document.createElement('div');priority.className='priority478';
 priority.innerHTML='<p><strong>Qual módulo você quer ver primeiro?</strong>Ajude-nos a priorizar a fila de desenvolvimento. Solicite seu favorito e registre seu interesse.</p><button type="button" class="primary" data-request476="'+sku+'">Solicitar Módulo →</button>';
 header.insertBefore(priority,header.querySelector('.actions476'));
 const art=modal.querySelector('.art476');
 for(const [direction,label,symbol] of [[-1,'Módulo anterior','‹'],[1,'Próximo módulo','›']]){
  const b=document.createElement('button');b.type='button';b.className='nav478 '+(direction<0?'prev':'next');b.textContent=symbol;b.setAttribute('aria-label',label);b.disabled=list.length<2;
  b.onclick=()=>this.openPresentation476(list[(index+direction+list.length)%list.length].sku,modal.classList.contains('immersive476'));art.append(b);
 }
 const count=document.createElement('span');count.className='position478';count.setAttribute('role','status');count.textContent=(index+1)+' de '+list.length+' módulos em desenvolvimento';art.append(count);
 modal.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select')||e.ctrlKey||e.altKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();modal.querySelector(e.key==='ArrowLeft'?'.nav478.prev':'.nav478.next')?.click();}});
};})();

/* CP483: public product identity; legacy runtime authorization remains untouched. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-core-panel').prototype,render=p.render;
p.render=function(...args){for(const m of this.data?.modules||[]){if(m.sku==='CP-SECURITY'){m.name='Central de Segurança Pro';m.display_sku483='CP-SECURITY-PRO';}else if(m.sku==='CP-SECURITY-PRO'&&m.lifecycle==='planned'){m.name='Central de Segurança';m.description='Versão base em desenvolvimento. A Central de Segurança Pro já foi desenvolvida.';m.request_sku483='CP-SECURITY';}}return render.apply(this,args);};
const card=p.moduleCard229;p.moduleCard229=function(m){const html=card.call(this,m);return m.sku==='CP-SECURITY'?html.replace('<small>CP-SECURITY</small>','<small>CP-SECURITY-PRO</small>'):html;};
})();

/* Keep an informational presentation connected while background status refreshes. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-core-panel').prototype,render=p.render,close=p.closePresentation476,open=p.openPresentation476;
p.render=function(...args){if(this.shadowRoot?.querySelector('#cp-presentation476:popover-open')&&!this.requestSku){this._presentationPending486=true;return;}this._presentationPending486=false;return render.apply(this,args);};
p.openPresentation476=function(...args){this._presentationTransition486=true;try{return open.apply(this,args);}finally{this._presentationTransition486=false;}};
p.closePresentation476=function(...args){const result=close.apply(this,args);if(this._presentationPending486&&!this._presentationTransition486){this._presentationPending486=false;this.render();}return result;};
})();
