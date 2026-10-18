// Última alteração realizada em 24/07/2026 às 16:15 - V311
// V292 - persistência definitiva das execuções: helper HA autoritativo, sincronização de override e proteção contra retorno de datas antigas
// Última alteração realizada em 19/07/2026 às 11:45 - V292
// V292 - evolução e histórico reais por categoria, cache isolado e leitura compatível com histórico compacto do HA
// Última alteração realizada em 17/07/2026 às 11:30 - V286
// V286 - auditoria visual completa dos cabeçalhos, imagens, status, tipografia e efeitos tecnológicos
// Última alteração realizada em 18/07/2026 às 00:30 - V287
// V289 - correção efetiva do CSS carregado, status centralizados, rodapé contextual e performance
// V280 - imagens finais nomeadas, cabeçalho sem cortes e cadastro compacto
// V279 - artes originais de cabeçalho e grade interna sem cortes
// V278 - correção de carregamento, imagens premium por categoria e upload no cadastro
// V277 - casa premium do anexo, cabeçalho legível e atualização móvel protegida
// V276 - composição fiel ao cabeçalho aprovado, sem casa na Visão Geral
// V275 - cabeçalho premium fiel ao conceito proposto e responsividade financeira revisada
// V274 - cabeçalho executivo unificado sem aumento de altura e índice alinhado à saúde
// V273 - Centro Inteligente da Categoria com índice de gestão, tendência e heatmap
// V272 - armazenamento compartilhado no Home Assistant e indicadores por categoria
// V271 - correção definitiva do carregamento do CSS e independência de versões antigas
// V270 - correção definitiva do registro do custom element sem construtor duplicado
// V269 - Excel individual por relatório/histórico
// V268 - correção de carregamento, novo identificador do custom card e proteção de renderização
// V267 - exportação XLSX real, multipágina, formatada e com logo; CSV removido
// V266 - rolagem preservada em Relatórios/Histórico e histórico em largura total com PDF
// V263 - cadastro Casa/Empresa, identidade visual nos relatórios, economia por serviço e sinaleiros suaves
// V258 - comparativo de custos, carrossel de indicadores e calendários amarelos
// Última alteração realizada em 16/07/2026 às 13:45
// V250 - resumo da provisão com manutenções pendentes de orçamento
// V246 - correção da aba Cadastro, categorias compactas e evolução anual com economia
// V247 - cadastro estável, anexo de imagem e exclusões auditadas
// V249 - exclusão local de todas as manutenções e categorias
// V249 - edição local de todas as manutenções e categorias
// Manutenção Residencial Card V227 - cabeçalho móvel compacto e responsivo
class ManutencaoResidencialCardV200 extends HTMLElement {
  setConfig(config) {
    this.c = {
      title: "Manutenções Preventivas",
      subtitle: "Controle residencial com ciclo, status, próxima execução e histórico",
      summary_entity: "sensor.manutencao_residencial_resumo_v200",
      default_view: "Casa",
      history_days: 3650,
      items: [],
      ...config,
    };
    this.v = this.c.default_view;
    this.calendarOffset = 0;
    this.annualCache = null;
    this.annualLoading = null;
    this.lastAnnualRenderKey = "";
    this.annualCategoryFilter = "Todas";
    this.searchTerm = "";
    this.favoriteKey = "manutencao_residencial_v213_favoritos";
    this.favorites = this.loadFavorites();
    this.recommendationCache = new Map();
    this.financeKey = "manutencao_residencial_v230_financeiro";
    this.financeRecords = this.loadFinanceRecords();
    this.ensureCriticalFinanceRecords();
    this.financeEstimateKey = "manutencao_residencial_v239_previsoes";
    this.financeEstimates = this.loadFinanceEstimates();
    this.financePeriodKey = "manutencao_residencial_v255_periodo_financeiro";
    const financePeriod = this.loadFinancePeriod();
    this.financeStartDate = financePeriod.start;
    this.financeEndDate = financePeriod.end;
    this.financeCategory = "Todas";
    this.financeView = "painel";
    this.financeIndicatorPage = 0;
    this.registrationKey = "manutencao_residencial_v245_cadastros";
    this.registrationData = this.loadRegistrationData();
    this.sharedStorageEntity = this.c.shared_storage_entity || "sensor.manutencao_residencial_dados_compartilhados";
    this.sharedStorageTopic = this.c.shared_storage_topic || "cloudpelizzon/maintenance/storage";
    this.sharedStorageRevision = null;
    this.sharedStorageHydrated = false;
    this.sharedSaveTimer = null;
    this.sharedSeedAttempted = false;
    this.registrationView = "manutencoes";
    this.healthEvolutionCache = new Map();
    this.healthEvolutionLoading = new Map();
    this.userInteractingUntil = 0;
    this.deferredRefreshTimer = null;
    this.lastRenderedStateSignature = "";
    this.lastClockUpdateAt = 0;
    this.annualLoading = null;
    this.lastAnnualRenderKey = "";
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this.h = hass;
    try {
      this.syncSharedStorageFromHass();

      if (!this.shadowRoot.innerHTML) {
        this.render();
        this.lastRenderedStateSignature = this.relevantStateSignature(hass);
        return;
      }

      const now = Date.now();
      const updated = this.shadowRoot.querySelector("#upd");
      if (updated && now - Number(this.lastClockUpdateAt || 0) >= 30000) {
        updated.textContent = new Date().toLocaleString("pt-BR");
        this.lastClockUpdateAt = now;
      }

      const active = this.shadowRoot.activeElement;
      const editing = !!active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName);
      const financeDateEditing = this.v === "financeiro" && !!active &&
        (active.id === "finance-start-date" || active.id === "finance-end-date");
      const financeStaticView = this.v === "financeiro" && ["relatorios", "historico"].includes(this.financeView);
      const interacting = now < Number(this.userInteractingUntil || 0);

      const signature = this.relevantStateSignature(hass);
      const changed = signature !== this.lastRenderedStateSignature;

      // Never rebuild the DOM during touch, scroll, form editing or report navigation.
      if (this.v === "cadastro" || editing || financeDateEditing || financeStaticView || interacting) {
        if (changed) this.scheduleDeferredRefresh();
        return;
      }

      // HA may call the setter every second. Re-render only when a relevant
      // maintenance/storage entity actually changed.
      if (!changed) return;

      this.lastRenderedStateSignature = signature;
      this.updatePreservingPosition();
    } catch (error) {
      console.error("Falha ao renderizar Manutenção Residencial V292:", error);
      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = `<ha-card><div style="padding:20px;color:#ff8a8a;background:#210f14;border:1px solid #8f3444;border-radius:12px"><b>Falha ao carregar o card V292</b><div style="margin-top:8px;color:#ffd8dd;font-family:monospace;white-space:pre-wrap">${String(error?.message || error)}</div></div></ha-card>`;
      }
    }
  }

  getCardSize() { return 12; }
  relevantStateSignature(hass = this.h) {
    if (!hass) return "";
    const ids = new Set([
      this.c?.summary_entity,
      this.sharedStorageEntity,
      ...(this.c?.items || []).flatMap(item => [item.entity, item.date_entity])
    ].filter(Boolean));
    return [...ids].map(id => {
      const state = hass.states?.[id];
      if (!state) return `${id}:missing`;
      const a = state.attributes || {};
      return [id,state.state,a.ultima_execucao,a.proxima_execucao,a.dias_restantes,a.percentual_ciclo,a.categoria,a.updated_at,a.revision,a.payload]
        .map(v=>String(v??"")).join("|");
    }).join("§");
  }

  markUserInteraction(duration = 3000) {
    this.userInteractingUntil = Date.now() + duration;
  }

  scheduleDeferredRefresh() {
    clearTimeout(this.deferredRefreshTimer);
    const delay = Math.max(500, Number(this.userInteractingUntil || 0) - Date.now() + 300);
    this.deferredRefreshTimer = setTimeout(() => {
      if (Date.now() < Number(this.userInteractingUntil || 0)) return this.scheduleDeferredRefresh();
      const signature = this.relevantStateSignature(this.h);
      if (signature !== this.lastRenderedStateSignature) {
        this.lastRenderedStateSignature = signature;
        this.updatePreservingPosition();
      }
    }, delay);
  }

  captureNavigationPosition() {
    const selectors = [".shell","main",".concept-header",".finance-executive-v241",".finance-reports-v241",".finance-table-wrap"];
    const scrolls = {};
    selectors.forEach(s => {
      const el=this.shadowRoot?.querySelector(s);
      if(el) scrolls[s]={left:el.scrollLeft,top:el.scrollTop};
    });
    return {x:window.scrollX,y:window.scrollY,scrolls};
  }

  restoreNavigationPosition(pos) {
    if(!pos)return;
    requestAnimationFrame(()=>{
      Object.entries(pos.scrolls||{}).forEach(([s,p])=>{
        const el=this.shadowRoot?.querySelector(s);
        if(el){el.scrollLeft=p.left;el.scrollTop=p.top;}
      });
      window.scrollTo(pos.x,pos.y);
    });
  }

  updatePreservingPosition() {
    const pos=this.captureNavigationPosition();
    this.update();
    this.restoreNavigationPosition(pos);
  }

  categoryVisualClass(category) {
    const normalized = String(category || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `category-visual-${normalized || "default"}`;
  }

  categoryHeaderImage(category) {
    const original = this.allCategoryDefinitions().find(c => c.name === category || c.originalName === category);
    if (original?.headerImage) return original.headerImage;
    const map = {
      "Casa": "/cloudpelizzon-maintenance/frontend/assets/01_casa.png?v=311-final-1",
      "Energia": "/cloudpelizzon-maintenance/frontend/assets/02_energia.png?v=311-final-1",
      "Gás": "/cloudpelizzon-maintenance/frontend/assets/03_gas.png?v=311-final-1",
      "Veículos": "/cloudpelizzon-maintenance/frontend/assets/04_veiculos.png?v=311-final-1",
      "Tecnologia": "/cloudpelizzon-maintenance/frontend/assets/06_tecnologia.png?v=311-final-1"
    };
    return map[category] || "";
  }

  generalHeaderImage() {
    return "/cloudpelizzon-maintenance/frontend/assets/05_visao_geral.png?v=311-final-1";
  }

  st(entity) { return this.h?.states?.[entity]; }
  fmt(value) {
    if (!value || value === "none") return "Não registrado";
    const a = String(value).split("-");
    return a.length === 3 ? `${a[2]}/${a[1]}/${a[0]}` : value;
  }
  slug(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  sharedStoragePayload() {
    return {
      schemaVersion: 272,
      revision: Date.now(),
      updatedAt: new Date().toISOString(),
      financeRecords: Array.isArray(this.financeRecords) ? this.financeRecords : [],
      financeEstimates: this.financeEstimates && typeof this.financeEstimates === "object" ? this.financeEstimates : {},
      registrationData: this.registrationData && typeof this.registrationData === "object" ? this.registrationData : {},
      favorites: [...(this.favorites || [])],
      financePeriod: this.normalizeFinancePeriod(this.financeStartDate, this.financeEndDate)
    };
  }

  hasMeaningfulLocalStorage() {
    const profile = this.registrationData?.profile || {};
    return (this.financeRecords?.length || 0) > 1 ||
      Object.keys(this.financeEstimates || {}).length > 0 ||
      (this.registrationData?.maintenances?.length || 0) > 0 ||
      (this.registrationData?.categories?.length || 0) > 0 ||
      Boolean(profile.logo || profile.address || profile.phone || profile.email);
  }

  scheduleSharedStorageSave() {
    if (!this.h?.callService || this.applyingSharedStorage) return;
    clearTimeout(this.sharedSaveTimer);
    this.sharedSaveTimer = setTimeout(() => this.publishSharedStorage(), 450);
  }

  async publishSharedStorage() {
    if (!this.h?.callService || this.applyingSharedStorage) return;
    const payload = this.sharedStoragePayload();
    try {
      await this.h.callService("mqtt", "publish", {
        topic: this.sharedStorageTopic,
        payload: JSON.stringify(payload),
        qos: 1,
        retain: true
      });
      this.sharedStorageRevision = String(payload.revision);
    } catch (error) {
      console.warn("Falha ao sincronizar os dados de manutenção com o Home Assistant.", error);
    }
  }

  syncSharedStorageFromHass() {
    const entity = this.h?.states?.[this.sharedStorageEntity];
    const attrs = entity?.attributes || {};
    const revision = String(attrs.revision || entity?.state || "");
    const valid = Number(attrs.schemaVersion || 0) >= 272 &&
      Array.isArray(attrs.financeRecords) &&
      attrs.registrationData && typeof attrs.registrationData === "object";

    if (!valid) {
      if (!this.sharedSeedAttempted && this.hasMeaningfulLocalStorage()) {
        this.sharedSeedAttempted = true;
        setTimeout(() => this.publishSharedStorage(), 800);
      }
      return;
    }
    if (this.sharedStorageHydrated && revision && revision === this.sharedStorageRevision) return;

    this.applyingSharedStorage = true;
    try {
      this.financeRecords = attrs.financeRecords || [];
      this.financeEstimates = attrs.financeEstimates && typeof attrs.financeEstimates === "object" ? attrs.financeEstimates : {};
      this.registrationData = attrs.registrationData && typeof attrs.registrationData === "object" ? attrs.registrationData : this.registrationData;
      this.favorites = new Set(Array.isArray(attrs.favorites) ? attrs.favorites : []);
      const period = this.normalizeFinancePeriod(attrs.financePeriod?.start, attrs.financePeriod?.end);
      this.financeStartDate = period.start;
      this.financeEndDate = period.end;

      localStorage.setItem(this.financeKey, JSON.stringify(this.financeRecords));
      localStorage.setItem(this.financeEstimateKey, JSON.stringify(this.financeEstimates));
      localStorage.setItem(this.registrationKey, JSON.stringify(this.registrationData));
      localStorage.setItem(this.favoriteKey, JSON.stringify([...this.favorites]));
      localStorage.setItem(this.financePeriodKey, JSON.stringify(period));
      this.sharedStorageRevision = revision;
      this.sharedStorageHydrated = true;
      this.ensureCriticalFinanceRecords();
    } catch (error) {
      console.warn("Falha ao carregar os dados compartilhados de manutenção.", error);
    } finally {
      this.applyingSharedStorage = false;
    }
  }

  loadFavorites() {
    try {
      const raw = localStorage.getItem(this.favoriteKey || "manutencao_residencial_v213_favoritos");
      const parsed = JSON.parse(raw || "[]");
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (_) {
      return new Set();
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem(this.favoriteKey, JSON.stringify([...this.favorites]));
    } catch (_) {}
    this.scheduleSharedStorageSave();
  }

  loadFinanceRecords() {
    try {
      const data = JSON.parse(localStorage.getItem(this.financeKey || "manutencao_residencial_v230_financeiro") || "[]");
      return Array.isArray(data) ? data : [];
    } catch (_) { return []; }
  }

  saveFinanceRecords() {
    try { localStorage.setItem(this.financeKey, JSON.stringify(this.financeRecords || [])); } catch (_) {}
    this.scheduleSharedStorageSave();
  }

  ensureCriticalFinanceRecords() {
    // Disabled in the commercial build: no customer-specific seed data.
  }

  loadFinanceEstimates() {
    try {
      const data = JSON.parse(localStorage.getItem(this.financeEstimateKey || "manutencao_residencial_v239_previsoes") || "{}");
      return data && typeof data === "object" && !Array.isArray(data) ? data : {};
    } catch (_) { return {}; }
  }

  saveFinanceEstimates() {
    try { localStorage.setItem(this.financeEstimateKey, JSON.stringify(this.financeEstimates || {})); } catch (_) {}
    this.scheduleSharedStorageSave();
  }

  loadRegistrationData() {
    const fallback = { categories: [], maintenances: [], deletedMaintenances: [], deletedCategories: [], maintenanceOverrides: {}, categoryOverrides: {}, profile: { type:"Casa", name:"Casa / Empresa", logo:"", address:"", cityState:"", document:"", contact:"", phone:"", email:"", additional:"" } };
    try {
      const data = JSON.parse(localStorage.getItem(this.registrationKey || "manutencao_residencial_v245_cadastros") || "null");
      if (!data || typeof data !== "object") return fallback;
      return {
        categories: Array.isArray(data.categories) ? data.categories : [],
        maintenances: Array.isArray(data.maintenances) ? data.maintenances : [],
        deletedMaintenances: Array.isArray(data.deletedMaintenances) ? data.deletedMaintenances : [],
        deletedCategories: Array.isArray(data.deletedCategories) ? data.deletedCategories : [],
        maintenanceOverrides: data.maintenanceOverrides && typeof data.maintenanceOverrides === "object" ? data.maintenanceOverrides : {},
        categoryOverrides: data.categoryOverrides && typeof data.categoryOverrides === "object" ? data.categoryOverrides : {},
        profile: data.profile && typeof data.profile === "object" ? { type:"Casa", name:"Casa / Empresa", logo:"", address:"", cityState:"", document:"", contact:"", phone:"", email:"", additional:"", ...data.profile } : fallback.profile
      };
    } catch (_) { return fallback; }
  }

  saveRegistrationData() {
    const data = this.registrationData || {categories:[],maintenances:[],deletedMaintenances:[],deletedCategories:[],maintenanceOverrides:{},categoryOverrides:{},profile:{type:"Casa",name:"Casa / Empresa",logo:"",address:"",cityState:"",document:"",contact:"",phone:"",email:"",additional:""}};
    data.deletedMaintenances = Array.isArray(data.deletedMaintenances) ? data.deletedMaintenances : [];
    data.deletedCategories = Array.isArray(data.deletedCategories) ? data.deletedCategories : [];
    data.maintenanceOverrides = data.maintenanceOverrides && typeof data.maintenanceOverrides === "object" ? data.maintenanceOverrides : {};
    data.categoryOverrides = data.categoryOverrides && typeof data.categoryOverrides === "object" ? data.categoryOverrides : {};
    data.profile = data.profile && typeof data.profile === "object" ? data.profile : {type:"Casa",name:"Casa / Empresa",logo:"",address:"",cityState:"",document:"",contact:"",phone:"",email:"",additional:""};
    try { localStorage.setItem(this.registrationKey, JSON.stringify(data)); } catch (_) {}
    this.scheduleSharedStorageSave();
  }


  houseProfile() {
    return { type:"Casa", name:"Casa / Empresa", logo:"", address:"", cityState:"", document:"", contact:"", phone:"", email:"", additional:"", ...(this.registrationData?.profile||{}) };
  }

  profileIdentityMarkup(compact=false) {
    const p=this.houseProfile();
    const logo=p.logo?`<img src="${this.escapeHtml(p.logo)}" alt="Logotipo">`:`<ha-icon icon="${p.type==='Empresa'?'mdi:office-building-outline':'mdi:home-outline'}"></ha-icon>`;
    const details=[p.address,p.cityState,p.document,p.contact,p.phone,p.email].filter(Boolean).map(v=>this.escapeHtml(v)).join(' • ');
    return `<div class="profile-identity ${compact?'compact':''}"><div class="profile-logo">${logo}</div><div><b>${this.escapeHtml(p.name||'Casa / Empresa')}</b><small>${this.escapeHtml(p.type||'Casa')}${details?` • ${details}`:''}</small>${!compact&&p.additional?`<em>${this.escapeHtml(p.additional)}</em>`:''}</div></div>`;
  }

  trendSignal(value) {
    if(value==null || !Number.isFinite(Number(value))) return {cls:'signal-none',label:'Sem comparação'};
    const n=Number(value);
    if(Math.abs(n)<0.01) return {cls:'signal-stable',label:'Estável'};
    return n>0?{cls:'signal-up',label:'Aumento'}:{cls:'signal-down',label:'Redução'};
  }


  maintenanceOverride(key) {
    return this.registrationData?.maintenanceOverrides?.[String(key || "")] || {};
  }

  categoryOverride(name) {
    return this.registrationData?.categoryOverrides?.[String(name || "")] || {};
  }

  resolvedCategoryName(name) {
    return this.categoryOverride(name)?.name || name;
  }

  isMaintenanceDeleted(key) {
    return (this.registrationData?.deletedMaintenances || []).includes(String(key || ""));
  }

  isCategoryDeleted(name) {
    return (this.registrationData?.deletedCategories || []).includes(String(name || ""));
  }

  categoryDefinitions() {
    const defaults = [
      { name:"Casa", icon:"🏠" }, { name:"Energia", icon:"⚡" }, { name:"Gás", icon:"🔥" },
      { name:"Veículos", icon:"🚗" }, { name:"Tecnologia", icon:"💻" }
    ];
    const fromConfig = (this.c.items || []).map(q => ({ name:q.category || q.categoria, icon:q.category_icon || "" })).filter(x=>x.name);
    const custom = this.registrationData?.categories || [];
    const map = new Map();
    [...defaults,...fromConfig,...custom].forEach(x=>{
      if(!x?.name || map.has(x.name)) return;
      const ov=this.categoryOverride(x.name);
      map.set(x.name,{originalName:x.name,name:ov.name||x.name,icon:ov.icon||x.icon||"🛠️",color:ov.color||x.color||"#35b9ff"});
    });
    return [...map.values()].filter(x => !this.isCategoryDeleted(x.originalName) && !this.isCategoryDeleted(x.name));
  }

  allCategoryDefinitions() {
    const defaults = [
      { name:"Casa", icon:"🏠" }, { name:"Energia", icon:"⚡" }, { name:"Gás", icon:"🔥" },
      { name:"Veículos", icon:"🚗" }, { name:"Tecnologia", icon:"💻" }
    ];
    const fromConfig = (this.c.items || []).map(q => ({ name:q.category || q.categoria, icon:q.category_icon || "" })).filter(x=>x.name);
    const custom = this.registrationData?.categories || [];
    const map = new Map();
    [...defaults,...fromConfig,...custom].forEach(x=>{
      if(!x?.name || map.has(x.name)) return;
      const ov=this.categoryOverride(x.name);
      map.set(x.name,{originalName:x.name,name:ov.name||x.name,icon:ov.icon||x.icon||"🛠️",color:ov.color||x.color||"#35b9ff"});
    });
    return [...map.values()];
  }

  customMaintenanceState(raw) {
    const last = raw.last || null;
    const cycleDays = Math.max(1, Number(raw.cycleDays || 365));
    if (!last) return { state:"Sem registro", next:null, remaining:0, daysSince:0, percent:0 };
    const ld = new Date(`${last}T00:00:00`);
    if (Number.isNaN(ld.getTime())) return { state:"Sem registro", next:null, remaining:0, daysSince:0, percent:0 };
    const nextDate = new Date(ld); nextDate.setDate(nextDate.getDate()+cycleDays);
    const today = new Date(); today.setHours(0,0,0,0);
    const daysSince = Math.floor((today-ld)/86400000);
    const remaining = Math.ceil((nextDate-today)/86400000);
    const attentionDays = Math.max(7, Math.min(30, Math.round(cycleDays*.15)));
    const state = remaining < 0 ? "Vencido" : remaining <= attentionDays ? "Atenção" : "Em dia";
    const percent = Math.max(0, Math.round(daysSince/cycleDays*100));
    const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,"0")}-${String(nextDate.getDate()).padStart(2,"0")}`;
    return { state, next:iso, remaining, daysSince, percent };
  }

  formatCycle(days) {
    const d=Number(days)||0;
    if(d===30) return "A cada 30 dias";
    if(d===45) return "A cada 45 dias";
    if(d===60) return "A cada 60 dias";
    if(d===90) return "A cada 90 dias";
    if(d%365===0) return `Ciclo de ${d/365} ano${d/365>1?'s':''}`;
    if(d%30===0) return `Ciclo de ${d/30} meses`;
    return `Ciclo de ${d} dias`;
  }

  resolveCycleDays(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === "") continue;
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
      const raw = String(value).trim().toLowerCase();
      const numeric = Number(raw.replace(",", "."));
      if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
      let match = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:dia|dias)/i);
      if (match) return Math.max(1, Math.round(Number(match[1].replace(",", "."))));
      match = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:m[eê]s|meses)/i);
      if (match) return Math.max(1, Math.round(Number(match[1].replace(",", ".")) * 30));
      match = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:ano|anos)/i);
      if (match) return Math.max(1, Math.round(Number(match[1].replace(",", ".")) * 365));
    }
    return 0;
  }

  estimateFor(item) {
    const stored = this.financeEstimates?.[item?.entity] || this.financeEstimates?.[item?.date_entity] || {};
    const hasStored = stored.material !== undefined || stored.labor !== undefined;
    let material = Number(stored.material ?? item?.estimatedMaterial ?? 0) || 0;
    let labor = Number(stored.labor ?? item?.estimatedLabor ?? 0) || 0;

    // Compatibilidade: se ainda não existe provisão explícita, usa o último custo real
    // dessa manutenção como referência para as próximas ocorrências do ciclo.
    if (!hasStored && material <= 0 && labor <= 0) {
      const keys = new Set([item?.entity, item?.date_entity].filter(Boolean));
      const latest = (this.financeRecords || [])
        .filter(record => keys.has(record.itemEntity) || keys.has(record.dateEntity) || (record.name === item?.name && record.category === item?.category))
        .sort((a, b) => String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")))[0];
      if (latest) {
        material = Math.max(0, Number(latest.productsCost || 0));
        labor = Math.max(0, Number(latest.laborCost || 0));
      }
    }
    return { material, labor, total: material + labor };
  }

  saveEstimateFor(item, material, labor) {
    const key = item?.entity || item?.date_entity;
    if (!key) return;
    this.financeEstimates[key] = {
      material: Math.max(0, Number(material || 0)),
      labor: Math.max(0, Number(labor || 0)),
      updatedAt: new Date().toISOString()
    };
    this.saveFinanceEstimates();
  }


  defaultFinancePeriod() {
    const now = new Date();
    return {
      start: `${now.getFullYear()}-01-01`,
      end: `${now.getFullYear()}-12-31`
    };
  }

  normalizeFinancePeriod(start, end) {
    const fallback = this.defaultFinancePeriod();
    const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
    let normalizedStart = valid(start) ? String(start) : fallback.start;
    let normalizedEnd = valid(end) ? String(end) : fallback.end;
    if (normalizedStart > normalizedEnd) [normalizedStart, normalizedEnd] = [normalizedEnd, normalizedStart];
    return { start: normalizedStart, end: normalizedEnd };
  }

  loadFinancePeriod() {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.financePeriodKey || "manutencao_residencial_v255_periodo_financeiro") || "null");
      return this.normalizeFinancePeriod(parsed?.start, parsed?.end);
    } catch (_) {
      return this.defaultFinancePeriod();
    }
  }

  saveFinancePeriod() {
    const period = this.normalizeFinancePeriod(this.financeStartDate, this.financeEndDate);
    this.financeStartDate = period.start;
    this.financeEndDate = period.end;
    try { localStorage.setItem(this.financePeriodKey, JSON.stringify(period)); } catch (_) {}
    this.scheduleSharedStorageSave();
  }

  financePeriod() {
    const period = this.normalizeFinancePeriod(this.financeStartDate, this.financeEndDate);
    const [sy, sm, sd] = period.start.split("-").map(Number);
    const [ey, em, ed] = period.end.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endDisplay = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    const endExclusive = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0);
    return { ...period, startDate: start, endDisplay, endExclusive };
  }

  financePeriodMonths() {
    const { startDate, endDisplay } = this.financePeriod();
    const months = [];
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const limit = new Date(endDisplay.getFullYear(), endDisplay.getMonth(), 1);
    while (cursor <= limit && months.length < 120) {
      months.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`,
        label: cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").replace(/^./, c => c.toUpperCase()),
        fullLabel: cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, c => c.toUpperCase()),
        date: new Date(cursor)
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    }
    return months;
  }

  provisionWindow(reference = new Date()) {
    const period = this.financePeriod();
    return { start: period.startDate, endExclusive: period.endExclusive, endDisplay: period.endDisplay };
  }

  provisionSchedule(items, startDate = this.financeStartDate, endDate = this.financeEndDate, category = "Todas") {
    const period = this.normalizeFinancePeriod(startDate, endDate);
    const [sy,sm,sd] = period.start.split("-").map(Number);
    const [ey,em,ed] = period.end.split("-").map(Number);
    const start = new Date(sy, sm-1, sd, 0, 0, 0, 0);
    const endExclusive = new Date(ey, em-1, ed+1, 0, 0, 0, 0);
    const result = [];

    for (const item of (items || [])) {
      const estimate = this.estimateFor(item);
      if (!estimate.total || !item.next || (category !== "Todas" && item.category !== category)) continue;
      const [y,m,d] = String(item.next).split("-").map(Number);
      let due = new Date(y, (m || 1) - 1, d || 1);
      if (Number.isNaN(due.getTime())) continue;

      const cycleDays = Math.max(0, Number(item.cycleDays || 0));
      if (due < start) {
        if (cycleDays > 0) {
          const elapsedDays = Math.floor((start - due) / 86400000);
          const jumps = Math.max(0, Math.floor(elapsedDays / cycleDays));
          due = new Date(due.getTime() + jumps * cycleDays * 86400000);
          while (due < start) due = new Date(due.getTime() + cycleDays * 86400000);
        } else {
          due = new Date(start);
        }
      }

      let occurrence = 1;
      while (due < endExclusive) {
        result.push({
          item, estimate, due: new Date(due), occurrence,
          month: due.getMonth(),
          monthKey: `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}`,
          date: `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,"0")}-${String(due.getDate()).padStart(2,"0")}`
        });
        if (cycleDays <= 0) break;
        due = new Date(due.getTime() + cycleDays * 86400000);
        occurrence += 1;
      }
    }
    return result.sort((a,b) => a.due - b.due || String(a.item.name).localeCompare(String(b.item.name), "pt-BR"));
  }

  maintenanceOccursInFinancePeriod(item) {
    if (!item?.next) return false;
    const { startDate, endExclusive } = this.financePeriod();
    const [y,m,d] = String(item.next).split("-").map(Number);
    let due = new Date(y, (m || 1) - 1, d || 1);
    if (Number.isNaN(due.getTime())) return false;
    const cycleDays = Math.max(0, Number(item.cycleDays || 0));
    if (due < startDate && cycleDays > 0) {
      const elapsedDays = Math.floor((startDate - due) / 86400000);
      const jumps = Math.max(0, Math.floor(elapsedDays / cycleDays));
      due = new Date(due.getTime() + jumps * cycleDays * 86400000);
      while (due < startDate) due = new Date(due.getTime() + cycleDays * 86400000);
    }
    if (due < startDate && cycleDays <= 0) return false;
    return due >= startDate && due < endExclusive;
  }

  rollingProvisionMonths(reference = new Date()) {
    return this.financePeriodMonths().map((month,index)=>({ ...month, index }));
  }

  money(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  async imageFileToDataUrl(file, maxSize = 720, quality = 0.82) {
    if (!file) return "";
    if (!String(file.type || "").startsWith("image/")) throw new Error("Selecione um arquivo de imagem válido.");
    if (file.size > 12 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 12 MB.");
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
      img.src = source;
    });
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    context.drawImage(image, 0, 0, width, height);
    let result = canvas.toDataURL("image/webp", quality);
    if (!result || result === "data:,") result = canvas.toDataURL("image/jpeg", quality);
    if (result.length > 900000) result = canvas.toDataURL("image/jpeg", 0.68);
    return result;
  }

  bindRegistrationImagePicker(root, options = {}) {
    const fileInput = root?.querySelector(options.fileSelector || "[data-image-file]");
    const pathInput = root?.querySelector(options.pathSelector || "[data-image-path]");
    const preview = root?.querySelector(options.previewSelector || "[data-image-preview]");
    const clearButton = root?.querySelector(options.clearSelector || "[data-clear-image]");
    const state = { dataUrl: options.initialImage || "" };
    const show = value => {
      if (!preview) return;
      if (value) { preview.src = value; preview.classList.add("has-image"); }
      else { preview.removeAttribute("src"); preview.classList.remove("has-image"); }
    };
    show(state.dataUrl || pathInput?.value || "");
    pathInput?.addEventListener("input", () => { state.dataUrl = ""; show(pathInput.value.trim()); });
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        state.dataUrl = await this.imageFileToDataUrl(file);
        if (pathInput) pathInput.value = "";
        show(state.dataUrl);
      } catch (error) {
        fileInput.value = "";
        alert(error?.message || String(error));
      }
    });
    clearButton?.addEventListener("click", event => {
      event.preventDefault(); state.dataUrl = "";
      if (fileInput) fileInput.value = "";
      if (pathInput) pathInput.value = "";
      show("");
    });
    return { value: () => state.dataUrl || pathInput?.value.trim() || "" };
  }

  isFavorite(entity) {
    return this.favorites.has(entity);
  }

  isSmartFavorite(item) {
    return item.priority === "Crítica" || item.state === "Vencido" || item.remaining <= 30;
  }

  smartFavoriteReason(item) {
    if (item.state === "Vencido" && item.priority === "Crítica") return "Crítica vencida";
    if (item.state === "Vencido") return "Manutenção vencida";
    if (item.priority === "Crítica") return "Criticidade crítica";
    if (item.remaining <= 30) return `Vence em ${Math.max(0, item.remaining)} dias`;
    return "Acompanhamento inteligente";
  }

  favoriteRank(item) {
    if (this.isFavorite(item.entity)) return 0;
    if (this.isSmartFavorite(item)) return 1;
    return 2;
  }

  sortMaintenanceItems(items) {
    return [...items].sort((a, b) => {
      const favoriteDifference = this.favoriteRank(a) - this.favoriteRank(b);
      if (favoriteDifference !== 0) return favoriteDifference;

      const stateOrder = { "Vencido": 0, "Atenção": 1, "Em dia": 2, "Sem registro": 3 };
      const stateDifference = (stateOrder[a.state] ?? 4) - (stateOrder[b.state] ?? 4);
      if (stateDifference !== 0) return stateDifference;

      const remainingDifference = Number(a.remaining || 0) - Number(b.remaining || 0);
      if (remainingDifference !== 0) return remainingDifference;

      return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    });
  }

  toggleFavorite(entity) {
    if (this.favorites.has(entity)) this.favorites.delete(entity);
    else this.favorites.add(entity);
    this.saveFavorites();
    this.update();
  }


  icon(category) {
    return this.categoryDefinitions().find(x=>x.name===category)?.icon || { Casa: "🏠", Energia: "⚡", "Gás": "🔥", "Veículos": "🚗", Tecnologia: "💻" }[category] || "🛠️";
  }
  cls(status) {
    return status === "Vencido" ? "danger" : status === "Atenção" ? "warning" : status === "Em dia" ? "ok" : "neutral";
  }
  statusIcon(status) {
    return status === "Vencido" ? "✕" : status === "Atenção" ? "!" : status === "Em dia" ? "✓" : "?";
  }
  statusMdi(status) {
    return status === "Vencido" ? "mdi:alert-octagon" :
      status === "Atenção" ? "mdi:clock-alert" :
      status === "Em dia" ? "mdi:shield-check" : "mdi:help-circle";
  }
  maintenanceMdi(item) {
    const n = (item?.name || "").toLowerCase();
    if (n.includes("água") || n.includes("purificador")) return "mdi:water-check";
    if (n.includes("grama")) return "mdi:grass";
    if (n.includes("portão")) return "mdi:gate";
    if (n.includes("calhas")) return "mdi:home-roof";
    if (n.includes("óleo")) return "mdi:oil";
    if (n.includes("filtro")) return "mdi:filter-cog";
    if (n.includes("freio") || n.includes("pastilhas")) return "mdi:car-brake-alert";
    if (n.includes("amortecedor")) return "mdi:car-cog";
    if (n.includes("palheta")) return "mdi:wiper-wash";
    if (n.includes("volante")) return "mdi:steering";
    if (n.includes("gás") || n.includes("botijão") || n.includes("mangueira") || n.includes("registro")) return "mdi:gas-cylinder";
    if (n.includes("servidor")) return "mdi:server";
    if (n.includes("switch")) return "mdi:router-network";
    if (n.includes("ps5")) return "mdi:sony-playstation";
    if (n.includes("solar")) return "mdi:solar-panel-large";
    if (n.includes("nobreak") || n.includes("bateria")) return "mdi:battery-charging-high";
    if (n.includes("ar condicionado")) return "mdi:air-conditioner";
    if (item?.category === "Veículos") return "mdi:car-wrench";
    return "mdi:tools";
  }
  items() {
    const configured = (this.c.items || []).map(q => {
      const s = this.st(q.entity);
      const a = s?.attributes || {};
      const key=q.entity || q.date_entity || a.nome;
      const ov=this.maintenanceOverride(key);
      const baseCategory=a.categoria || q.category || "Outros";
      const cycleDays=this.resolveCycleDays(ov.cycleDays, a.ciclo_dias, q.cycleDays, a.ciclo_texto, q.cycle);
      // V292: para itens do Home Assistant, o input_datetime/template é a fonte
      // autoritativa da última execução. Um override antigo salvo no navegador/MQTT
      // não pode sobrescrever uma execução mais recente registrada pelo card.
      const haLast = a.ultima_execucao && !["unknown","unavailable","none",""] .includes(String(a.ultima_execucao).toLowerCase())
        ? a.ultima_execucao
        : null;
      const last = haLast ?? ov.last ?? null;
      const localCalc = ov.cycleDays || (!haLast && ov.last)
        ? this.customMaintenanceState({last,cycleDays:cycleDays||365})
        : null;
      return {
        ...q,
        source: "home_assistant",
        registrationKey:key,
        state: localCalc?.state || s?.state || "Sem registro",
        name: ov.name || a.nome || q.name || q.entity,
        category: ov.category || this.resolvedCategoryName(baseCategory),
        originalCategory: baseCategory,
        action: ov.action || a.acao || "Registrar manutenção",
        image: ov.image ?? a.imagem ?? q.image ?? "",
        cycle: this.formatCycle(cycleDays) || a.ciclo_texto || q.cycle || "",
        cycleDays,
        criticality: ov.criticality || ov.priority || a.criticidade || a.prioridade || q.criticality || q.priority || "Importante",
        priority: ov.criticality || ov.priority || a.criticidade || a.prioridade || q.criticality || q.priority || "Importante",
        priorityWeight: Number(a.peso_prioridade || q.priorityWeight || 3),
        last,
        next: localCalc?.next || a.proxima_execucao,
        remaining: localCalc?.remaining ?? Number(a.dias_restantes || 0),
        daysSince: localCalc?.daysSince ?? Number(a.dias_desde || 0),
        percent: localCalc?.percent ?? Number(a.percentual_ciclo || 0),
        estimatedMaterial: Number(ov.estimatedMaterial ?? a.custo_material_previsto ?? q.custo_material_previsto ?? q.estimated_material_cost ?? 0) || 0,
        estimatedLabor: Number(ov.estimatedLabor ?? a.custo_mao_obra_previsto ?? q.custo_mao_obra_previsto ?? q.estimated_labor_cost ?? 0) || 0,
      };
    });
    const custom = (this.registrationData?.maintenances || []).map(raw => {
      const calc = this.customMaintenanceState(raw);
      return {
        ...raw,
        ...calc,
        source:"local",
        entity:`local_maintenance.${raw.id}`,
        date_entity:`local_datetime.${raw.id}`,
        action:raw.action || "Registrar manutenção",
        cycle:raw.cycle || this.formatCycle(raw.cycleDays),
        criticality:raw.criticality || raw.priority || "Importante",
        priority:raw.criticality || raw.priority || "Importante",
        priorityWeight:Number(raw.priorityWeight || (raw.priority==="Crítica"?5:raw.priority==="Baixa"?1:3)),
        estimatedMaterial:Number(raw.estimatedMaterial||0),
        estimatedLabor:Number(raw.estimatedLabor||0)
      };
    });
    return [...configured,...custom].filter(item => {
      const key = item.source === "local" ? item.entity : (item.entity || item.date_entity || item.name);
      return !this.isMaintenanceDeleted(key) && !this.isCategoryDeleted(item.category);
    });
  }

  allMaintenanceItemsForRegistration() {
    const configured = (this.c.items || []).map(q => {
      const s = this.st(q.entity), a = s?.attributes || {};
      const key=q.entity || q.date_entity || a.nome;
      const ov=this.maintenanceOverride(key);
      const baseCategory=a.categoria || q.category || "Outros";
      return {
        ...q,
        source:"home_assistant",
        registrationKey:key,
        name:ov.name || a.nome || q.name || q.entity,
        category:ov.category || this.resolvedCategoryName(baseCategory),
        originalCategory:baseCategory,
        cycleDays:this.resolveCycleDays(ov.cycleDays, a.ciclo_dias, q.cycleDays, a.ciclo_texto, q.cycle),
        criticality:ov.criticality || ov.priority || a.criticidade || a.prioridade || q.criticality || q.priority || "Importante",
        priority:ov.criticality || ov.priority || a.criticidade || a.prioridade || q.criticality || q.priority || "Importante",
        // V292: a data real do helper sempre prevalece sobre um override local antigo.
        last:(a.ultima_execucao && !["unknown","unavailable","none",""] .includes(String(a.ultima_execucao).toLowerCase())) ? a.ultima_execucao : (ov.last ?? null),
        image:ov.image ?? a.imagem ?? q.image ?? "",
        estimatedMaterial:Number(ov.estimatedMaterial ?? a.custo_material_previsto ?? q.custo_material_previsto ?? q.estimated_material_cost ?? 0) || 0,
        estimatedLabor:Number(ov.estimatedLabor ?? a.custo_mao_obra_previsto ?? q.custo_mao_obra_previsto ?? q.estimated_labor_cost ?? 0) || 0
      };
    });
    const custom = (this.registrationData?.maintenances || []).map(m => ({
      ...m,
      criticality:m.criticality || m.priority || "Importante",
      priority:m.criticality || m.priority || "Importante",
      source:"local",
      registrationKey:`local_maintenance.${m.id}`
    }));
    return [...configured,...custom].filter(m => !this.isMaintenanceDeleted(m.registrationKey) && !this.isCategoryDeleted(m.category));
  }

  render() {
    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="/cloudpelizzon-maintenance/frontend/maintenance-v311.css?v=311-criticality-policy-r57" data-maintenance-style="v285">
      <ha-card>
        <div class="shell">
          <aside class="sidebar">
            <div class="brand">🏠</div>
            ${["geral", ...this.categoryDefinitions().map(x=>x.name)].map(v => `
              <button class="nav" data-v="${v}">
                <span>${v === "geral" ? "📊" : this.icon(v)}</span>
                <small>${v === "geral" ? "Visão Geral" : v}</small>
              </button>`).join("")}
            <button class="nav extra-nav finance-nav" data-finance="1"><span><ha-icon icon="mdi:cash-multiple"></ha-icon></span><small>Financeiro</small></button>
            <button class="nav extra-nav registration-nav" data-registration="1"><span><ha-icon icon="mdi:database-plus-outline"></ha-icon></span><small>Cadastro</small></button>
            <button class="nav extra-nav" data-favorites="1"><span><ha-icon icon="mdi:bookmark-outline"></ha-icon></span><small>Favoritos</small></button>
            <button class="nav extra-nav" data-recommendations="1"><span><ha-icon icon="mdi:brain"></ha-icon></span><small>IA Preventiva</small></button>
            <button class="nav extra-nav" data-help="1"><span><ha-icon icon="mdi:help-circle-outline"></ha-icon></span><small>Ajuda</small></button>
            <button class="nav extra-nav" data-quick="1"><span><ha-icon icon="mdi:lightning-bolt-circle"></ha-icon></span><small>Ações</small></button>
            <button class="nav history" data-h="1"><span>🕘</span><small>Histórico</small></button>
          </aside>
          <main>
            <header>
              <div class="header-title"><h1>${this.c.title}</h1><p>${this.c.subtitle}</p></div>
              <div class="header-search">
                <ha-icon icon="mdi:magnify"></ha-icon>
                <input id="maintenance-search" type="search" placeholder="Pesquisar manutenção...">
                <button id="clear-search" title="Limpar pesquisa"><ha-icon icon="mdi:close"></ha-icon></button>
              </div>
              <div class="header-meta">
                <div class="toolbar-info"><ha-icon icon="mdi:filter-variant"></ha-icon><span id="search-result-count"></span></div>
                <div class="updated">Atualizado em<br><strong id="upd"></strong></div>
              </div>
            </header>
            <section id="summary"></section>
            <section id="tabs"></section>
            <section id="cards"></section>
          </main>
        </div>
        <div id="modal"></div>
      </ha-card>`;
    this.shadowRoot.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { this.v = b.dataset.v; this.update(); });
    const interactionTargets = [this.shadowRoot.querySelector(".shell"), this.shadowRoot.querySelector("main")].filter(Boolean);
    interactionTargets.forEach(target => {
      ["touchstart", "touchmove", "pointerdown", "wheel", "scroll"].forEach(eventName => {
        target.addEventListener(eventName, () => this.markUserInteraction(eventName === "scroll" ? 1800 : 3200), { passive:true });
      });
    });
    const interactionRoot=this.shadowRoot.querySelector(".shell");
    if(interactionRoot && !interactionRoot.hasAttribute("data-v278-interaction-bound")){
      interactionRoot.setAttribute("data-v278-interaction-bound","1");
      ["touchstart","touchmove","pointerdown","wheel","scroll"].forEach(evt=>{
        interactionRoot.addEventListener(evt,()=>this.markUserInteraction(evt==="scroll"?2200:4200),{passive:true});
      });
    }

    this.shadowRoot.querySelector("[data-h]").onclick = () => this.history();
    this.shadowRoot.querySelector("[data-finance]").onclick = () => { this.v = "financeiro"; this.financeView = "painel"; this.update(); };
    this.shadowRoot.querySelector("[data-registration]").onclick = () => { this.v = "cadastro"; this.registrationView = "manutencoes"; this.update(); };
    this.shadowRoot.querySelector("[data-favorites]").onclick = () => { this.v = "favoritos"; this.update(); };
    this.shadowRoot.querySelector("[data-recommendations]").onclick = () => this.openRecommendations();
    this.shadowRoot.querySelector("[data-help]").onclick = () => this.openHelp();
    this.shadowRoot.querySelector("[data-quick]").onclick = () => this.openQuickActions();
    const search = this.shadowRoot.querySelector("#maintenance-search");
    search.value = this.searchTerm;
    search.addEventListener("input", e => {
      this.searchTerm = e.target.value || "";
      this.update();
      requestAnimationFrame(() => {
        const input = this.shadowRoot.querySelector("#maintenance-search");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      });
    });
    this.shadowRoot.querySelector("#clear-search").onclick = () => {
      this.searchTerm = "";
      const input = this.shadowRoot.querySelector("#maintenance-search");
      if (input) input.value = "";
      this.update();
    };
    this.update();
  }

  calendar(items) {
    const base = new Date();
    const shown = new Date(base.getFullYear(), base.getMonth() + this.calendarOffset, 1);
    const y = shown.getFullYear(), m = shown.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const due = {};
    items.forEach(i => {
      if (!i.next) return;
      const p = String(i.next).split("-");
      if (p.length !== 3) return;
      const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      if (d.getFullYear() === y && d.getMonth() === m) {
        due[d.getDate()] = due[d.getDate()] || [];
        due[d.getDate()].push(i);
      }
    });
    const names = ["D", "S", "T", "Q", "Q", "S", "S"];
    let cells = names.map(n => `<b class="dow">${n}</b>`).join("");
    for (let x = 0; x < first.getDay(); x++) cells += '<span class="empty-day"></span>';
    for (let d = 1; d <= last.getDate(); d++) {
      const dayItems = due[d] || [];
      const statuses = dayItems.map(i => this.cls(i.state));
      const status = statuses.includes("danger") ? "danger" : statuses.includes("warning") ? "warning" : statuses.includes("ok") ? "ok" : "";
      const isToday = d === base.getDate() && m === base.getMonth() && y === base.getFullYear();
      cells += `<button class="calendar-day ${status} ${isToday ? "today" : ""}" data-cal-day="${d}" ${dayItems.length ? "" : "disabled"}>
        <i>${d}</i>${dayItems.length ? `<u>${dayItems.length}</u>` : ""}
      </button>`;
    }
    return `<div class="calendar panel-top">
      <div class="panel-heading calendar-heading">
        <div class="heading-icon calendar-icon"><ha-icon icon="mdi:calendar-month"></ha-icon></div>
        <div><h3>CALENDÁRIO</h3><small>Navegue pelas próximas manutenções</small></div>
      </div>
      <div class="calendar-nav">
        <button data-cal-prev title="Mês anterior"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <strong>${shown.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
        <button data-cal-next title="Próximo mês"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
      </div>
      <div class="cal-grid">${cells}</div>
      <div class="calendar-legend"><span class="ok">● Em dia</span><span class="warning">● Atenção</span><span class="danger">● Vencida</span></div>
    </div>`;
  }

  bindCalendar(items) {
    const root = this.shadowRoot;
    root.querySelector("[data-cal-prev]")?.addEventListener("click", () => {
      this.calendarOffset -= 1;
      this.update();
    });
    root.querySelector("[data-cal-next]")?.addEventListener("click", () => {
      this.calendarOffset += 1;
      this.update();
    });
    root.querySelectorAll("[data-cal-day]").forEach(btn => btn.addEventListener("click", () => {
      const base = new Date();
      const shown = new Date(base.getFullYear(), base.getMonth() + this.calendarOffset, Number(btn.dataset.calDay));
      const iso = `${shown.getFullYear()}-${String(shown.getMonth()+1).padStart(2,"0")}-${String(shown.getDate()).padStart(2,"0")}`;
      const matches = items.filter(i => i.next === iso);
      if (matches.length) this.calendarDayDetails(iso, matches);
    }));
  }

  calendarDayDetails(date, items) {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="calendar-modal">
      <button class="modal-close" data-close>✕</button>
      <div class="modal-head"><div><h2><ha-icon icon="mdi:calendar-check"></ha-icon> ${this.fmt(date)}</h2><p>${items.length} manutenção(ões) prevista(s) para esta data.</p></div></div>
      <div class="calendar-events">${items.map(i => `<button data-calendar-item="${i.entity}">
        <span class="event-icon ${this.cls(i.state)}"><ha-icon icon="${this.maintenanceMdi(i)}"></ha-icon></span>
        <span><b>${i.name}</b><small>${i.category} • ${i.cycle} • Prev. ${this.money(this.estimateFor(i).total)}</small></span>
        <em class="${this.cls(i.state)}">${i.state}</em>
      </button>`).join("")}</div>
    </div></div>`;
    modal.querySelector("[data-close]").onclick = () => modal.innerHTML = "";
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) modal.innerHTML = ""; };
    modal.querySelectorAll("[data-calendar-item]").forEach(b => b.onclick = () => {
      const item = items.find(i => i.entity === b.dataset.calendarItem);
      modal.innerHTML = "";
      if (item) this.details(item);
    });
  }

  card(i) {
    const c = this.cls(i.state);
    const r = i.remaining < 0 ? `Vencida há ${Math.abs(i.remaining)} dias` : `Em ${i.remaining} dias`;
    const ringP = Math.min(100, Math.max(0, i.percent));
    return `<article class="maintenance-card ${c}" data-card="${i.entity}">
      <div class="card-title">
        <span class="card-title-spacer"></span>
        <div class="card-title-center">
          <button class="favorite-button ${this.isFavorite(i.entity) ? "active" : this.isSmartFavorite(i) ? "smart" : ""}" data-favorite="${i.entity}" title="${this.isFavorite(i.entity) ? "Remover dos favoritos" : this.isSmartFavorite(i) ? this.smartFavoriteReason(i) : "Adicionar aos favoritos"}">
            <ha-icon icon="${this.isFavorite(i.entity) ? "mdi:bookmark-check" : this.isSmartFavorite(i) ? "mdi:bookmark-multiple-outline" : "mdi:bookmark-outline"}"></ha-icon>
          </button>
          <h3>${i.name}</h3>
          ${this.isFavorite(i.entity) ? `<span class="manual-favorite-label">Favorito</span>` : this.v === "favoritos" && this.isSmartFavorite(i) ? `<span class="smart-favorite-label">${this.smartFavoriteReason(i)}</span>` : ""}
        </div>
        <span class="badge ${c}"><ha-icon icon="${this.statusMdi(i.state)}"></ha-icon>${i.state}</span>
      </div>
      <div class="card-body">
        <div class="image-column">
          <div class="image-box"><img src="${i.image}" alt="${i.name}"></div>
          <span class="cycle-label">${i.cycle}</span>
        </div>
        <div class="dates">
          <div><small>Última execução</small><b>${this.fmt(i.last)}</b></div>
          <div><small>Próxima execução</small><b>${this.fmt(i.next)}</b></div>
          <em class="${c}">${r}</em>
        </div>
        <div class="progress ${c}" style="--p:${ringP}"><b>${i.percent}%</b><small>do ciclo</small></div>
      </div>
      <div class="actions">
        <button data-d="${i.date_entity}">✓ ${i.action}</button>
        <button data-ih="${i.date_entity}" title="Histórico">🕘</button>
      </div>
    </article>`;
  }

  update() {
    if (!this.h) return;
    this.shadowRoot.querySelector("#upd").textContent = new Date().toLocaleString("pt-BR");
    this.shadowRoot.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("active", b.dataset.v === this.v));

    const allItems = this.items();
    const categoryView = !["geral", "favoritos", "financeiro", "cadastro"].includes(this.v);
    const I = categoryView ? allItems.filter(item => item.category === this.v) : allItems;
    this.shadowRoot.querySelector("[data-finance]")?.classList.toggle("active", this.v === "financeiro");
    const tabsHost = this.shadowRoot.querySelector("#tabs");
    if (this.v === "financeiro") {
      tabsHost?.style.setProperty("display", "block", "important");
      this.shadowRoot.querySelector("[data-registration]")?.classList.remove("active");
      this.renderFinanceDashboard(allItems);
      return;
    }
    if (this.v === "cadastro") {
      tabsHost?.style.setProperty("display", "block", "important");
      this.shadowRoot.querySelector("[data-registration]")?.classList.add("active");
      this.shadowRoot.querySelector("[data-finance]")?.classList.remove("active");
      this.renderRegistrationDashboard();
      return;
    }
    this.shadowRoot.querySelector("[data-registration]")?.classList.remove("active");
    tabsHost?.style.setProperty("display", "none", "important");
    const normalizedSearch = this.slug(this.searchTerm || "");
    const searchedItems = !normalizedSearch ? I : I.filter(i => {
      const haystack = this.slug(`${i.name} ${i.category} ${i.state} ${i.priority} ${i.cycle}`);
      return haystack.includes(normalizedSearch);
    });
    const displayItems = this.v === "favoritos"
      ? this.sortMaintenanceItems(
          searchedItems.filter(i => this.isFavorite(i.entity))
        )
      : this.sortMaintenanceItems(searchedItems);
    const resultCount = this.shadowRoot.querySelector("#search-result-count");
    if (resultCount) {
      const scope = this.v === "favoritos" ? "favorito(s) manual(is)" : "resultado(s)";
      resultCount.textContent = `${displayItems.length} ${scope}`;
    }
    this.shadowRoot.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("active", b.dataset.v === this.v));
    this.shadowRoot.querySelector("[data-favorites]")?.classList.toggle("active", this.v === "favoritos");
    const counts = {
      em_dia: I.filter(i => i.state === "Em dia").length,
      atencao: I.filter(i => i.state === "Atenção").length,
      vencidas: I.filter(i => i.state === "Vencido").length,
    };
    const total = Math.max(1, I.length);
    const health = Math.round((counts.em_dia * 100 + counts.atencao * 60) / total);
    const pd = Math.round(counts.em_dia * 100 / total);
    const pa = Math.round(counts.atencao * 100 / total);
    const pv = Math.round(counts.vencidas * 100 / total);
    const healthText = health >= 90 ? "Ótimo" : health >= 70 ? "Bom" : health >= 50 ? "Atenção" : "Crítico";
    const upcoming = [...I].sort((a, b) => a.remaining - b.remaining).slice(0, 4);

    this.shadowRoot.querySelector("#summary").innerHTML = categoryView
      ? this.unifiedCategoryHeaderHtml(I, this.v, counts, health, healthText, pd, pa, pv)
      : this.unifiedGeneralHeaderHtml(I, counts, health, healthText, pd, pa, pv);


    const cats = this.categoryDefinitions().map(x=>x.name);
    this.shadowRoot.querySelector("#tabs").innerHTML = "";

    const groups = this.v === "geral" || this.v === "favoritos"
      ? cats.filter(cat => displayItems.some(i => i.category === cat))
      : [this.v];
    // V288: o rodapé recebe somente os itens do contexto ativo.
    // Na Visão Geral, mantém o conjunto consolidado de todas as categorias.
    const footerItems = this.v === "geral"
      ? allItems
      : this.v === "favoritos"
        ? I.filter(item => this.isFavorite(item.entity))
        : allItems.filter(item => item.category === this.v);
    if (this.v !== "geral" && this.v !== "favoritos") this.annualCategoryFilter = this.v;
    const donutStyle = `--ok-p:${pd};--warn-p:${pa};--danger-p:${pv}`;
    const nextItem = [...footerItems].filter(i => i.next).sort((a,b) => a.remaining - b.remaining).find(i => i.remaining >= 0) || [...footerItems].sort((a,b) => a.remaining - b.remaining)[0];
    const maxOverdue = [...footerItems].filter(i => i.remaining < 0).sort((a,b) => a.remaining - b.remaining)[0];
    const priorityOrder = { "Crítica": 3, "Importante": 2, "Baixa": 1 };
    const topPriority = [...footerItems].sort((a,b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0) || a.remaining - b.remaining)[0];
    const riskPoints = footerItems.reduce((sum, i) => sum + (i.state === "Vencido" ? i.priorityWeight : i.state === "Atenção" ? Math.ceil(i.priorityWeight * .6) : 0), 0);
    const maxRiskPoints = Math.max(1, footerItems.reduce((sum, i) => sum + i.priorityWeight, 0));
    const riskPercent = Math.min(100, Math.round((riskPoints / maxRiskPoints) * 100));
    this.shadowRoot.querySelector("#cards").innerHTML = groups.map(c => {
      const list = this.sortMaintenanceItems(displayItems.filter(i => i.category === c));
      return `<div class="category-block"><div class="cards">${list.map(i => this.card(i)).join("")}</div></div>`;
    }).join("") + (!displayItems.length ? `<div class="empty-search"><ha-icon icon="mdi:magnify-close"></ha-icon><h3>${this.v === "favoritos" ? "Nenhum favorito selecionado" : "Nenhuma manutenção encontrada"}</h3><p>${this.v === "favoritos" ? "Marque a estrela de uma manutenção para exibi-la aqui." : "Altere a pesquisa ou selecione outra categoria."}</p></div>` : "") + `<footer class="dash-footer">
      <div class="annual footer-panel"><div class="footer-title"><div><h3>MANUTENÇÕES REALIZADAS EM ${new Date().getFullYear()}</h3><small>Quantidade, manutenção e data de cada execução</small></div><strong id="annual-total">--</strong></div><div id="annual-chart" class="annual-chart"><div class="chart-loading">Carregando histórico...</div></div></div>
      <div class="executive footer-panel">
        <div class="footer-title">
          <div><h3>PAINEL EXECUTIVO</h3><small>Indicadores que complementam o cabeçalho</small></div>
          <strong>${riskPercent}%</strong>
        </div>
        <div class="executive-grid">
          <div class="executive-risk-wrap">
            <strong class="executive-risk-title">RISCO GERAL</strong>
            <div class="executive-risk" style="--risk:${riskPercent}">
              <div><b>${riskPercent}%</b></div>
            </div>
            <span class="executive-risk-level">${riskPercent >= 70 ? "Alto" : riskPercent >= 35 ? "Moderado" : "Baixo"}</span>
          </div>
          <div class="executive-kpis">
            <button data-exec="all">
              <ha-icon icon="mdi:format-list-checks"></ha-icon>
              <span class="executive-kpi-copy"><b>Itens monitorados</b><small>Total acompanhado</small></span>
              <strong>${footerItems.length}</strong>
            </button>
            <button data-exec="annual">
              <ha-icon icon="mdi:calendar-check"></ha-icon>
              <span class="executive-kpi-copy"><b>Realizadas em ${new Date().getFullYear()}</b><small>Execuções registradas</small></span>
              <strong id="executive-annual-total">--</strong>
            </button>
            <button data-exec="next">
              <ha-icon icon="mdi:calendar-arrow-right"></ha-icon>
              <span class="executive-kpi-copy"><b>Próxima manutenção</b><small>${nextItem ? nextItem.name : "Sem item previsto"}</small></span>
              <strong>${nextItem ? this.fmt(nextItem.next) : "Sem previsão"}</strong>
            </button>
            <button data-exec="overdue">
              <ha-icon icon="mdi:timer-alert"></ha-icon>
              <span class="executive-kpi-copy"><b>Maior atraso</b><small>${maxOverdue ? maxOverdue.name : "Tudo em dia"}</small></span>
              <strong>${maxOverdue ? `${Math.abs(maxOverdue.remaining)} dias` : "Nenhum"}</strong>
            </button>
            <button data-exec="priority">
              <ha-icon icon="mdi:alert-decagram"></ha-icon>
              <span class="executive-kpi-copy"><b>Maior prioridade</b><small>${topPriority?.name || "Sem item"}</small></span>
              <strong>${topPriority?.priority || "—"}</strong>
            </button>
            <button data-exec="compliance">
              <ha-icon icon="mdi:check-decagram"></ha-icon>
              <span class="executive-kpi-copy"><b>Cumprimento</b><small>Itens não vencidos</small></span>
              <strong>${Math.round(((footerItems.length - footerItems.filter(i=>i.state === "Vencido").length) / Math.max(1, footerItems.length)) * 100)}%</strong>
            </button>
          </div>
        </div>
      </div>
      <div class="smart-indicator priority-distribution footer-panel">
        <div class="smart-head"><ha-icon icon="mdi:chart-donut-variant"></ha-icon><span>DISTRIBUIÇÃO POR CRITICIDADE</span><b>${footerItems.filter(i=>i.priority==="Crítica").length}</b></div>
        ${(() => {
          const levels = [
            {name:"Crítica", cls:"critical", icon:"mdi:alert-octagon"},
            {name:"Importante", cls:"important", icon:"mdi:alert-circle"},
            {name:"Baixa", cls:"low", icon:"mdi:information-outline"}
          ];
          const totalPriority = Math.max(1, footerItems.length);
          const criticalCount = footerItems.filter(i=>i.priority==="Crítica").length;
          const importantCount = footerItems.filter(i=>i.priority==="Importante").length;
          const lowCount = footerItems.filter(i=>i.priority==="Baixa").length;
          const criticalPct = Math.round(criticalCount*100/totalPriority);
          const importantPct = Math.round(importantCount*100/totalPriority);
          const lowPct = Math.max(0,100-criticalPct-importantPct);
          return `<div class="priority-distribution-body">
            <button class="priority-donut" data-priority-summary="Todas" style="--critical:${criticalPct};--important:${importantPct};--low:${lowPct}">
              <span><b>${footerItems.length}</b><small class="donut-caption">ativos</small></span>
            </button>
            <div class="priority-bars">${levels.map(level => {
              const list = footerItems.filter(i=>i.priority===level.name);
              const overdue = list.filter(i=>i.state==="Vencido").length;
              const pct = Math.round(list.length*100/totalPriority);
              return `<button class="priority-bar-row ${level.cls}" data-priority-summary="${level.name}">
                <span><ha-icon icon="${level.icon}"></ha-icon>${level.name}</span>
                <i><u style="--w:${pct}%"></u></i>
                <b>${list.length}</b>
                <small>${overdue} vencida(s)</small>
              </button>`;
            }).join("")}</div>
          </div>`;
        })()}
        <small>Clique na prioridade para abrir os respectivos itens</small>
      </div>
      <div class="smart-indicator performance-card footer-panel" data-performance>
        <div class="smart-head performance-head">
          <ha-icon icon="mdi:trophy-award"></ha-icon>
          <span>PERFORMANCE DAS MANUTENÇÕES</span>
          <b>${Math.round(((footerItems.length-footerItems.filter(i=>i.state==="Vencido").length)/Math.max(1,footerItems.length))*100)}%</b>
        </div>
        ${(() => {
          const completed = Math.max(0, Number(this.shadowRoot.querySelector("#annual-total")?.textContent || 0));
          const overdueOpen = footerItems.filter(i=>i.state==="Vencido").length;
          const currentOnTime = Math.max(0, footerItems.length - overdueOpen);
          const rate = footerItems.length ? Math.round(currentOnTime * 100 / footerItems.length) : 0;
          const onTime = currentOnTime;
          const late = overdueOpen;
          return `<div class="performance-body">
            <div class="performance-gauge" style="--p:${rate}">
              <span><b>${rate}%</b><small class="donut-caption">no prazo</small></span>
            </div>
            <div class="performance-stats">
              <button data-performance-filter="ontime"><span><ha-icon icon="mdi:check-decagram"></ha-icon>Concluídas no prazo</span><b>${onTime}</b></button>
              <button data-performance-filter="late"><span><ha-icon icon="mdi:clock-alert-outline"></ha-icon>Concluídas em atraso</span><b>${late}</b></button>
              <button data-performance-filter="open"><span><ha-icon icon="mdi:alert-octagon-outline"></ha-icon>Ainda vencidas</span><b>${overdueOpen}</b></button>
            </div>
          </div>`;
        })()}
        <small>Meta anual: 90% • clique para abrir o histórico</small>
      </div>
    </footer>`;

    this.shadowRoot.querySelectorAll("[data-favorite]").forEach(b => b.onclick = e => { e.stopPropagation(); this.toggleFavorite(b.dataset.favorite); });
    this.shadowRoot.querySelectorAll("[data-d]").forEach(b => b.onclick = e => { e.stopPropagation(); this.done(b.dataset.d); });
    this.shadowRoot.querySelectorAll("[data-ih]").forEach(b => b.onclick = e => { e.stopPropagation(); this.history(b.dataset.ih); });
    this.shadowRoot.querySelectorAll("[data-card]").forEach(card => card.onclick = () => {
      const item = I.find(x => x.entity === card.dataset.card);
      if (item) this.details(item);
    });
    this.shadowRoot.querySelector("[data-register]")?.addEventListener("click", () => this.registerModal());
    this.shadowRoot.querySelector("[data-hist]")?.addEventListener("click", () => this.history());
    this.shadowRoot.querySelectorAll("[data-status-filter]").forEach(btn => btn.onclick = () => {
      const status = btn.dataset.statusFilter;
      this.showListModal(
        status === "Vencido" ? "Manutenções vencidas" : `Manutenções ${status.toLowerCase()}`,
        status === "Em dia" ? "mdi:shield-check" : status === "Atenção" ? "mdi:clock-alert" : "mdi:alert-octagon",
        I.filter(i => i.state === status)
      );
    });
    this.shadowRoot.querySelectorAll("[data-plan]").forEach(btn => btn.onclick = () => this.openPlanning(btn.dataset.plan, I));
    this.shadowRoot.querySelector("[data-open-upcoming]")?.addEventListener("click", () => this.openUpcoming(I));
    this.loadHealthEvolution(I);
    this.shadowRoot.querySelectorAll("[data-exec]").forEach(btn => btn.onclick = () => this.openExecutive(btn.dataset.exec, I, { nextItem, maxOverdue, topPriority }));
    this.shadowRoot.querySelectorAll("[data-smart]").forEach(btn => btn.onclick = () => this.openSmartIndicator(btn.dataset.smart, I));
    this.shadowRoot.querySelector("[data-performance]")?.addEventListener("click", () => this.history());
    this.shadowRoot.querySelectorAll("[data-performance-filter]").forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      const type = btn.dataset.performanceFilter;
      if (type === "open") {
        this.showListModal("Manutenções ainda vencidas", "mdi:alert-octagon-outline", I.filter(i => i.state === "Vencido"));
      } else {
        this.history();
      }
    });
    this.shadowRoot.querySelectorAll("[data-smart-cat]").forEach(btn => btn.onclick = () => {
      const cat = btn.dataset.smartCat;
      this.showListModal(`Manutenções de ${cat}`, "mdi:chart-bar", I.filter(i => i.category === cat));
    });
    this.shadowRoot.querySelectorAll("[data-priority-summary]").forEach(btn => btn.onclick = () => {
      const priority = btn.dataset.prioritySummary;
      const list = priority === "Todas" ? I : I.filter(i => i.priority === priority);
      this.showListModal(
        priority === "Todas" ? "Todos os ativos por criticidade" : `Criticidade ${priority}`,
        priority === "Crítica" ? "mdi:alert-octagon" : priority === "Importante" ? "mdi:alert-circle" : priority === "Baixa" ? "mdi:information-outline" : "mdi:chart-donut-variant",
        this.sortMaintenanceItems(list)
      );
    });
    this.loadAnnualStats(footerItems);
  }

  async loadAnnualStats(items) {
    const year = new Date().getFullYear();
    const host = this.shadowRoot.querySelector("#annual-chart");
    if (!host) return;

    const allowedEntities = new Set((items || []).map(i => i.entity));
    const contextualRows = rows => (rows || []).filter(r => allowedEntities.has(r.item?.entity));
    const categoryContext = !["geral", "favoritos"].includes(this.v);
    if (categoryContext) this.annualCategoryFilter = this.v;

    const renderRows = (sourceRows) => {
      const rows = contextualRows(sourceRows);
      const key = JSON.stringify(rows.map(r => [r.item.entity, r.date, this.annualCategoryFilter, this.v]));
      if (this.lastAnnualRenderKey === key && host.dataset.rendered === "1") return;
      this.lastAnnualRenderKey = key;
      host.dataset.rendered = "1";

      const totalHost = this.shadowRoot.querySelector("#annual-total");
      if (totalHost) totalHost.textContent = rows.length;
      const executiveTotal = this.shadowRoot.querySelector("#executive-annual-total");
      if (executiveTotal) executiveTotal.textContent = rows.length;

      if (!rows.length) {
        host.innerHTML = `<div class="empty-annual"><ha-icon icon="mdi:calendar-remove"></ha-icon><span>Nenhuma manutenção registrada em ${year}.</span></div>`;
        return;
      }

      const categories = categoryContext ? [this.v] : ["Todas", "Casa", "Energia", "Gás", "Veículos", "Tecnologia"];
      const categoryTotals = {};
      rows.forEach(r => categoryTotals[r.category] = (categoryTotals[r.category] || 0) + 1);
      const icons = { Todas:"mdi:format-list-bulleted", Casa:"mdi:home-heart", Energia:"mdi:lightning-bolt", "Gás":"mdi:fire", "Veículos":"mdi:car-wrench", Tecnologia:"mdi:server-network" };
      const filtered = categoryContext ? rows : (this.annualCategoryFilter === "Todas" ? rows : rows.filter(r => r.category === this.annualCategoryFilter));

      host.innerHTML = `
        <div class="annual-summary-grid">
          ${categories.map(cat => {
            const value = cat === "Todas" ? rows.length : (categoryTotals[cat] || 0);
            return `<button class="annual-filter ${this.annualCategoryFilter === cat ? "active" : ""}" data-annual-cat="${cat}">
              <ha-icon icon="${icons[cat]}"></ha-icon><span>${cat}</span><b>${value}</b>
            </button>`;
          }).join("")}
        </div>
        <div class="annual-list">
          ${filtered.slice(0, 10).map(r => `<button class="annual-row" data-annual-row="${r.item.entity}">
            <span class="annual-item-icon"><ha-icon icon="${this.maintenanceMdi(r.item)}"></ha-icon></span>
            <span class="annual-item-text"><b>${r.item.name}</b><small>${r.category}</small></span>
            <time>${this.fmt(r.date)}</time>
          </button>`).join("")}
        </div>
        ${filtered.length > 10 ? `<button class="annual-more" data-open-annual>Ver todas as ${filtered.length} realizações</button>` : ""}
      `;

      host.querySelectorAll("[data-annual-cat]").forEach(btn => btn.onclick = () => {
        this.annualCategoryFilter = btn.dataset.annualCat;
        this.lastAnnualRenderKey = "";
        renderRows(rows);
      });
      host.querySelectorAll("[data-annual-row]").forEach(btn => btn.onclick = () => {
        const row = filtered.find(r => r.item.entity === btn.dataset.annualRow);
        if (row) this.details(row.item);
      });
      host.querySelector("[data-open-annual]")?.addEventListener("click", () => this.openAnnualDetails(filtered, year));
    };

    if (this.annualCache?.year === year && Array.isArray(this.annualCache.rows)) {
      renderRows(this.annualCache.rows);
      return;
    }
    if (this.annualLoading) {
      renderRows(await this.annualLoading);
      return;
    }

    this.annualLoading = (async () => {
      const start = new Date(year, 0, 1).toISOString();
      const sourceItems = this.items();
      const entities = sourceItems.filter(i=>i.source!=="local").map(i => i.date_entity);
      const rows = [];
      try {
        const data = await this.h.callApi("GET", `history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(entities.join(","))}&minimal_response&no_attributes`);
        (data || []).forEach(series => {
          for (let x = 1; x < series.length; x++) {
            const cur = series[x], prev = series[x - 1];
            if (cur.state !== prev.state && /^\d{4}-\d{2}-\d{2}$/.test(cur.state) && Number(cur.state.slice(0,4)) === year) {
              const item = sourceItems.find(i => i.date_entity === cur.entity_id);
              if (item) rows.push({ item, category:item.category, date:cur.state });
            }
          }
        });
        sourceItems.forEach(i => {
          if (i.last && Number(String(i.last).slice(0,4)) === year && !rows.some(r => r.item.date_entity === i.date_entity && r.date === i.last)) {
            rows.push({ item:i, category:i.category, date:i.last });
          }
        });
      } catch (e) {
        console.error("Falha ao carregar histórico anual", e);
      }
      rows.sort((a,b) => String(b.date).localeCompare(String(a.date)) || a.item.name.localeCompare(b.item.name));
      this.annualCache = { year, rows };
      this.annualLoading = null;
      return rows;
    })();

    renderRows(await this.annualLoading);
  }

  openAnnualDetails(rows, year) {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="history-modal annual-modal">
      <div class="modal-head"><div><h2><ha-icon icon="mdi:calendar-check"></ha-icon> Manutenções realizadas em ${year}</h2><p>${rows.length} registros encontrados.</p></div><button id="close">✕</button></div>
      <div class="annual-full-list">${rows.map(r => `<button data-annual-item="${r.item.entity}">
        <span><ha-icon icon="${this.maintenanceMdi(r.item)}"></ha-icon></span>
        <span><b>${r.item.name}</b><small>${r.category}</small></span>
        <time>${this.fmt(r.date)}</time>
      </button>`).join("")}</div>
    </div></div>`;
    modal.querySelector("#close").onclick = () => modal.innerHTML = "";
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) modal.innerHTML = ""; };
    modal.querySelectorAll("[data-annual-item]").forEach(b => b.onclick = () => {
      const row = rows.find(r => r.item.entity === b.dataset.annualItem);
      modal.innerHTML = "";
      if (row) this.details(row.item);
    });
  }

  openPlanning(type, items, returnTo = null) {
    const filters = {
      overdue: { title:"Manutenções vencidas", icon:"mdi:calendar-alert", test:i => i.remaining < 0 },
      "30": { title:"Manutenções para até 30 dias", icon:"mdi:calendar-week", test:i => i.remaining >= 0 && i.remaining <= 30 },
      "90": { title:"Manutenções entre 31 e 90 dias", icon:"mdi:calendar-month-outline", test:i => i.remaining > 30 && i.remaining <= 90 },
      later: { title:"Manutenções acima de 90 dias", icon:"mdi:calendar-check", test:i => i.remaining > 90 }
    };
    const f = filters[type] || filters.overdue;
    const list = items.filter(f.test).sort((a,b) => a.remaining - b.remaining);
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="planning-modal">
      <div class="modal-head"><div><h2><ha-icon icon="${f.icon}"></ha-icon> ${f.title}</h2><p>${list.length} manutenção(ões) encontrada(s).</p></div><button id="close">✕</button></div>
      <div class="planning-list">${list.map(i => `<button data-planning-item="${i.entity}">
        <span class="event-icon ${this.cls(i.state)}"><ha-icon icon="${this.maintenanceMdi(i)}"></ha-icon></span>
        <span><b>${i.name}</b><small>${i.category} • Próxima: ${this.fmt(i.next)}</small></span>
        <em class="${this.cls(i.state)}">${i.remaining < 0 ? `${Math.abs(i.remaining)} dias em atraso` : `${i.remaining} dias`}</em>
      </button>`).join("") || '<div class="empty">Nenhuma manutenção neste período.</div>'}</div>
    </div></div>`;
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelectorAll("[data-planning-item]").forEach(btn => btn.onclick = () => {
      const item = list.find(i => i.entity === btn.dataset.planningItem);
      if (item) this.details(item, () => this.openPlanning(type, items, returnTo));
    });
  }


  openPriority(priority, items, returnTo = null) {
    const list = items.filter(i => i.priority === priority).sort((a,b) => {
      const order = {Vencido:0, "Atenção":1, "Em dia":2};
      return (order[a.state] ?? 3) - (order[b.state] ?? 3) || a.remaining - b.remaining;
    });
    const icons = {Crítica:"mdi:alert-octagon", Importante:"mdi:alert-circle", Baixa:"mdi:information-outline"};
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="planning-modal priority-modal">
      <div class="modal-head"><div><h2><ha-icon icon="${icons[priority] || "mdi:flag"}"></ha-icon> Criticidade ${priority}</h2><p>${list.length} manutenção(ões), ordenadas por situação e vencimento.</p></div><button id="close">✕</button></div>
      <div class="planning-list">${list.map(i => `<button data-priority-item="${i.entity}">
        <span class="event-icon ${this.cls(i.state)}"><ha-icon icon="${this.maintenanceMdi(i)}"></ha-icon></span>
        <span><b>${i.name}</b><small>${i.category} • Próxima: ${this.fmt(i.next)}</small></span>
        <em class="${this.cls(i.state)}">${i.state} • ${i.remaining < 0 ? `${Math.abs(i.remaining)} dias em atraso` : `${i.remaining} dias`}</em>
      </button>`).join("") || '<div class="empty">Nenhuma manutenção nesta criticidade.</div>'}</div>
    </div></div>`;
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelectorAll("[data-priority-item]").forEach(btn => btn.onclick = () => {
      const item = list.find(i => i.entity === btn.dataset.priorityItem);
      if (item) this.details(item, () => this.openPriority(priority, items, returnTo));
    });
  }


  async openUpcoming(items, returnTo = null) {
    const list = [...items].sort((a,b) => a.remaining - b.remaining);
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="planning-modal upcoming-modal">
      <div class="modal-head"><div><h2><ha-icon icon="mdi:clipboard-clock-outline"></ha-icon> Próximas manutenções</h2><p>${list.length} itens ordenados pela próxima execução.</p></div><button id="close">✕</button></div>
      <div class="planning-list">${list.map(i => `<button data-upcoming-item="${i.entity}">
        <span class="event-icon ${this.cls(i.state)}"><ha-icon icon="${this.maintenanceMdi(i)}"></ha-icon></span>
        <span><b>${i.name}</b><small>${i.category} • ${i.priority} • ${this.fmt(i.next)}</small></span>
        <em class="${this.cls(i.state)}">${i.remaining < 0 ? `${Math.abs(i.remaining)} dias em atraso` : `${i.remaining} dias`}</em>
      </button>`).join("")}</div>
    </div></div>`;
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelectorAll("[data-upcoming-item]").forEach(btn => btn.onclick = () => {
      const item = list.find(i => i.entity === btn.dataset.upcomingItem);
      if (item) this.details(item, () => this.openUpcoming(items, returnTo));
    });
  }

  addDaysDate(date, days) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + Number(days || 0));
    return d;
  }

  categoryIntelligence(items, category, months = null) {
    const defs = this.categoryDefinitions();
    const def = defs.find(x => x.name === category) || { name:category, icon:this.icon(category), color:"#35b9ff" };
    const valid = (items || []).filter(i => i.category === category);
    const currentHealth = valid.length
      ? Math.round(valid.reduce((sum, i) => sum + (i.state === "Em dia" ? 100 : i.state === "Atenção" ? 60 : 0), 0) / valid.length)
      : 0;

    const categoryFinance = (this.financeRecords || []).filter(r => r.category === category);
    const byMaintenance = new Map();
    categoryFinance.forEach(r => {
      const key = r.itemEntity || r.name;
      if (!byMaintenance.has(key)) byMaintenance.set(key, []);
      byMaintenance.get(key).push(r);
    });

    const variations = [];
    byMaintenance.forEach(rows => {
      rows.sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));
      if (rows.length < 2) return;
      const previous = Number(rows[rows.length - 2].paid ?? rows[rows.length - 2].total ?? 0);
      const latest = Number(rows[rows.length - 1].paid ?? rows[rows.length - 1].total ?? 0);
      if (previous > 0) variations.push(((latest - previous) / previous) * 100);
    });

    const averageVariation = variations.length
      ? variations.reduce((a,b) => a+b, 0) / variations.length
      : 0;
    const costStability = variations.length
      ? Math.max(0, Math.min(100, Math.round(100 - Math.min(100, Math.abs(averageVariation) * 3))))
      : 78;

    const historicalValues = Array.isArray(months) && months.length
      ? months.map(m => Number(m.value || 0))
      : [currentHealth, currentHealth, currentHealth, currentHealth, currentHealth, currentHealth, currentHealth];

    const historicalStart = historicalValues[0] ?? currentHealth;
    const historicalEnd = historicalValues[historicalValues.length - 1] ?? currentHealth;
    const healthTrend = historicalEnd - historicalStart;

    // Índice de gestão: combina saúde atual, estabilidade histórica e previsibilidade de custos.
    // É um indicador novo e não repete nenhum contador já mostrado no dashboard.
    // O Índice de Gestão usa a mesma base da Saúde da Categoria.
    // Dessa forma, nunca haverá divergência visual entre os dois indicadores.
    const managementIndex = currentHealth;

    const grade = managementIndex >= 90 ? "A" :
      managementIndex >= 70 ? "B" :
      managementIndex >= 50 ? "C" : "D";

    const gradeMeaning = managementIndex >= 90 ? "Excelente" :
      managementIndex >= 70 ? "Boa" :
      managementIndex >= 50 ? "Atenção" : "Crítica";

    const classification = `Nota ${grade} — ${gradeMeaning}`;

    let insight = "";
    if (healthTrend >= 8) {
      insight = "A categoria ganhou estabilidade nos últimos ciclos e apresenta evolução positiva.";
    } else if (healthTrend <= -8) {
      insight = "A categoria está perdendo estabilidade e merece revisão preventiva dos próximos ciclos.";
    } else if (averageVariation > 10) {
      insight = "Os custos recentes mostram tendência de alta, apesar da estabilidade operacional.";
    } else if (averageVariation < -10) {
      insight = "Os custos recentes recuaram sem comprometer a estabilidade da categoria.";
    } else if (currentHealth >= 90) {
      insight = "A categoria opera em nível excelente, com comportamento previsível e estável.";
    } else if (currentHealth >= 70) {
      insight = "A categoria permanece controlada, com sinais moderados para acompanhamento.";
    } else {
      insight = "A categoria exige atenção estratégica para recuperar estabilidade nos próximos ciclos.";
    }

    const motion = healthTrend > 3 ? "ascending" : healthTrend < -3 ? "descending" : "stable";
    const motionText = motion === "ascending" ? "Trajetória ascendente" :
      motion === "descending" ? "Trajetória descendente" : "Trajetória estável";

    return {
      ...def,
      currentHealth,
      managementIndex,
      grade,
      gradeMeaning,
      classification,
      insight,
      motion,
      motionText,
      averageVariation,
      months: historicalValues
    };
  }

  categoryBackdropSvg(category) {
    const common = `fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
    const svgs = {
      Casa: `<svg viewBox="0 0 240 150" aria-hidden="true">
        <g ${common}>
          <path d="M20 78 102 20l83 58"/>
          <path d="M39 72v62h125V72"/>
          <path d="M76 134V90h43v44"/>
          <path d="M134 92h20v23h-20zM51 91h18v18H51z"/>
          <path d="M10 136h198M18 136c12-18 22-24 34-25M164 136c12-19 23-23 38-25"/>
          <path d="M16 59h24M196 91h28M191 102h25"/>
          <path d="M188 45v91M180 56h16M180 69h16"/>
        </g>
      </svg>`,
      Energia: `<svg viewBox="0 0 240 150" aria-hidden="true">
        <g ${common}>
          <path d="M113 10 72 78h36l-17 62 70-87h-42l20-43z"/>
          <path d="M17 127h205M24 110c28-18 50-17 74 0s48 18 70 0 38-18 55-7"/>
          <circle cx="30" cy="32" r="10"/><path d="M30 9v8M30 47v8M7 32h8M45 32h8"/>
        </g>
      </svg>`,
      Gás: `<svg viewBox="0 0 240 150" aria-hidden="true">
        <g ${common}>
          <path d="M122 10c12 25-7 30 4 48 8 13 27 14 27 39 0 27-20 45-46 45s-47-18-47-45c0-25 18-37 31-55 7 19 23 24 31 11 7-11 4-25 0-43z"/>
          <path d="M106 77c9 12 2 20 4 30 2 8 10 11 17 3 4 16-4 25-17 25-14 0-25-10-25-24 0-14 8-23 21-34z"/>
          <path d="M17 140h206"/>
        </g>
      </svg>`,
      Veículos: `<svg viewBox="0 0 240 150" aria-hidden="true">
        <g ${common}>
          <path d="M31 98 48 64c4-8 11-13 21-13h91c9 0 17 5 21 13l17 34"/>
          <path d="M27 96h177v28H27z"/>
          <path d="M55 124a17 17 0 1 0 34 0M147 124a17 17 0 1 0 34 0"/>
          <path d="M62 63h100M17 82h23M199 82h24M17 42h56M178 42h45"/>
        </g>
      </svg>`,
      Tecnologia: `<svg viewBox="0 0 240 150" aria-hidden="true">
        <g ${common}>
          <rect x="45" y="28" width="144" height="88" rx="7"/>
          <path d="M30 132h174M91 116l-7 16M143 116l7 16"/>
          <path d="M70 51h29v23H70zM113 51h50M113 63h38M70 87h93"/>
          <circle cx="178" cy="39" r="4"/>
          <path d="M17 31h18M17 47h24M197 53h25M198 69h17"/>
        </g>
      </svg>`
    };
    return svgs[category] || svgs.Casa;
  }

  generalBackdropSvg() {
    return `<svg viewBox="0 0 260 150" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="27" y="32" width="66" height="48" rx="5"/>
        <rect x="106" y="20" width="58" height="61" rx="5"/>
        <rect x="177" y="42" width="54" height="39" rx="5"/>
        <path d="M39 68 54 53l13 9 15-20M117 66l11-14 10 7 14-24M187 68l10-9 9 5 15-15"/>
        <circle cx="59" cy="105" r="14"/>
        <path d="M59 91v14l10 7M113 105h112M113 95h76M113 115h52"/>
        <path d="M17 132h226M17 121h66"/>
        <circle cx="208" cy="105" r="11"/>
        <path d="M203 105h10M208 100v10"/>
      </g>
    </svg>`;
  }

  unifiedCategoryHeaderHtml(items, category, counts, health, healthText, pd, pa, pv) {
    const data = this.categoryIntelligence(items, category, this.cachedHealthEvolution(items));
    const color = data.color || "#35b9ff";
    const overdue = items.filter(i => i.remaining < 0).length;
    const d30 = items.filter(i => i.remaining >= 0 && i.remaining <= 30).length;
    const d90 = items.filter(i => i.remaining > 30 && i.remaining <= 90).length;
    const later = items.filter(i => i.remaining > 90).length;

    return `<div class="header-v285 category-header-v285 ${this.categoryVisualClass(category)}" style="--accent:${color}">
      <div class="header-v285-grid"></div>
      <div class="header-v285-scan"></div>

      <section class="hero-v285">
        <div class="hero-art-v285" style="--header-image:url(&quot;${this.escapeHtml(this.categoryHeaderImage(category))}&quot;)"></div>
        <div class="hero-copy-v285">
          <small>CATEGORIA</small>
          <h2>${category}</h2>
          <p>${data.insight}</p>
        </div>

        <div class="health-v285">
          <div class="health-ring-v285" style="--p:${health}">
            <div>
              <small>SAÚDE DA CATEGORIA</small>
              <b>${health}%</b>
              <strong>${healthText}</strong>
              <i></i>
            </div>
          </div>
        </div>

        <div class="status-stack-v285">
          <button class="status-v285 ok" data-status-filter="Em dia">
            <ha-icon icon="mdi:shield-check"></ha-icon>
            <span class="status-content-v288"><span>Em dia</span><b>${String(counts.em_dia).padStart(2,"0")}</b><small>${pd}% do total</small></span>
          </button>
          <button class="status-v285 warning" data-status-filter="Atenção">
            <ha-icon icon="mdi:clock-alert"></ha-icon>
            <span class="status-content-v288"><span>Atenção</span><b>${String(counts.atencao).padStart(2,"0")}</b><small>${pa}% do total</small></span>
          </button>
          <button class="status-v285 danger" data-status-filter="Vencido">
            <ha-icon icon="mdi:alert-octagon"></ha-icon>
            <span class="status-content-v288"><span>Vencidas</span><b>${String(counts.vencidas).padStart(2,"0")}</b><small>${pv}% do total</small></span>
          </button>
        </div>
      </section>

      <section class="evolution-panel-v307">
        <div class="evolution-v285">
          <div class="title-v285">
            <span>EVOLUÇÃO REAL DA SAÚDE — ÚLTIMOS 7 MESES</span>
            <strong id="evolution-trend">--</strong>
          </div>
          <div id="health-evolution-chart" class="health-evolution-chart evolution-chart-v285">
            <div class="evolution-loading"><ha-icon icon="mdi:loading"></ha-icon> Calculando...</div>
          </div>
        </div>
      </section>

      <section class="history-panel-v307">
        <div class="history-v285">
          <div class="title-v285">
            <span>HISTÓRICO REAL — 7 MESES</span>
            <small>${data.motionText}</small>
          </div>
          <div class="heatmap-v285" data-category-intelligence="${category}">
            ${data.months.map((value,idx)=>`<i style="--heat:${value}" title="${["Jan","Fev","Mar","Abr","Mai","Jun","Jul"][idx]}: ${value}%"><small>${["JAN","FEV","MAR","ABR","MAI","JUN","JUL"][idx]}</small><b>${Math.round(value)}%</b></i>`).join("")}
          </div>
          <div class="cycle-v285">
            <small>LINHA MÉDIA DO CICLO</small>
            <div><i></i><i></i><i></i><i class="today"></i><i></i><i></i><i></i></div>
            <footer><span>Última execução</span><strong>HOJE</strong><span>Próxima execução média</span></footer>
          </div>
        </div>
      </section>

      <section class="planning-v285">
        <div class="planning-head-v285">
          <div>
            <h3><ha-icon icon="mdi:clipboard-clock-outline"></ha-icon> PLANEJAMENTO DA CATEGORIA</h3>
            <small>Próximos prazos por período</small>
          </div>
          <button data-open-upcoming title="Abrir próximas manutenções"><ha-icon icon="mdi:calendar-arrow-right"></ha-icon></button>
        </div>
        <div class="planning-grid-v285">
          <button class="danger" data-plan="overdue"><span>Vencidas</span><b>${overdue}</b><small>Ação imediata</small></button>
          <button class="warning" data-plan="30"><span>Até 30 dias</span><b>${d30}</b><small>Planejar agora</small></button>
          <button class="info" data-plan="90"><span>31 a 90 dias</span><b>${d90}</b><small>Médio prazo</small></button>
          <button class="ok" data-plan="later"><span>Acima de 90 dias</span><b>${later}</b><small>Sem urgência</small></button>
        </div>
      </section>
    </div>`;
  }

  unifiedGeneralHeaderHtml(items, counts, health, healthText, pd, pa, pv) {
    const overdue = items.filter(i => i.remaining < 0).length;
    const d30 = items.filter(i => i.remaining >= 0 && i.remaining <= 30).length;
    const d90 = items.filter(i => i.remaining > 30 && i.remaining <= 90).length;
    const later = items.filter(i => i.remaining > 90).length;
    const categories = this.categoryDefinitions().map(def => {
      const list = items.filter(i => i.category === def.name);
      const score = list.length
        ? Math.round(list.reduce((sum,item)=>sum+(item.state==="Em dia"?100:item.state==="Atenção"?60:0),0)/list.length)
        : 0;
      return {...def, score, total:list.length};
    });

    return `<div class="header-v285 general-header-v285" style="--accent:#35e69a">
      <div class="header-v285-grid"></div>
      <div class="header-v285-scan"></div>

      <section class="hero-v285 general-hero-v285">
        <div class="hero-art-v285 general-art-v285" style="--header-image:url(&quot;${this.escapeHtml(this.generalHeaderImage())}&quot;)"></div>
        <div class="hero-copy-v285">
          <small>VISÃO CONSOLIDADA</small>
          <h2>Visão Geral</h2>
          <p>Indicadores gerais de saúde, tendência e distribuição por categoria em uma única leitura executiva.</p>
        </div>

        <div class="health-v285">
          <div class="health-ring-v285 general-ring-v285" style="--p:${health}">
            <div><small>SAÚDE GERAL</small><b>${health}%</b><strong>${healthText}</strong><i></i></div>
          </div>
        </div>

        <div class="status-stack-v285">
          <button class="status-v285 ok" data-status-filter="Em dia"><ha-icon icon="mdi:shield-check"></ha-icon><span class="status-content-v288"><span>Em dia</span><b>${String(counts.em_dia).padStart(2,"0")}</b><small>${pd}% do total</small></span></button>
          <button class="status-v285 warning" data-status-filter="Atenção"><ha-icon icon="mdi:clock-alert"></ha-icon><span class="status-content-v288"><span>Atenção</span><b>${String(counts.atencao).padStart(2,"0")}</b><small>${pa}% do total</small></span></button>
          <button class="status-v285 danger" data-status-filter="Vencido"><ha-icon icon="mdi:alert-octagon"></ha-icon><span class="status-content-v288"><span>Vencidas</span><b>${String(counts.vencidas).padStart(2,"0")}</b><small>${pv}% do total</small></span></button>
        </div>
      </section>

      <section class="general-evolution-panel-v311">
        <div class="evolution-v285">
          <div class="title-v285"><span>EVOLUÇÃO GERAL REAL — 7 MESES</span><strong id="evolution-trend">--</strong></div>
          <div id="health-evolution-chart" class="health-evolution-chart evolution-chart-v285"><div class="evolution-loading"><ha-icon icon="mdi:loading"></ha-icon> Calculando...</div></div>
        </div>
      </section>

      <section class="general-categories-panel-v311">
        <div class="categories-v285">
          <div class="title-v285"><span>SAÚDE POR CATEGORIA</span><small>Clique para filtrar</small></div>
          <div class="category-grid-v285">
            ${categories.map(c=>`<button data-smart-cat="${c.name}" style="--cat:${c.color}"><span>${c.icon}</span><small>${c.name}</small><b>${c.score}%</b><em>${c.total} item(ns)</em></button>`).join("")}
          </div>
        </div>
      </section>

      <section class="planning-v285 general-right-v285">
        <div class="planning-head-v285">
          <div><h3><ha-icon icon="mdi:clipboard-clock-outline"></ha-icon> PLANEJAMENTO CONSOLIDADO</h3><small>Próximos prazos por período</small></div>
          <button data-open-upcoming title="Abrir próximas manutenções"><ha-icon icon="mdi:calendar-arrow-right"></ha-icon></button>
        </div>
        <div class="planning-grid-v285 general-planning-grid-v285">
          <button class="danger" data-plan="overdue"><span>Vencidas</span><b>${overdue}</b><small>Ação imediata</small></button>
          <button class="warning" data-plan="30"><span>Até 30 dias</span><b>${d30}</b><small>Planejar agora</small></button>
          <button class="info" data-plan="90"><span>31 a 90 dias</span><b>${d90}</b><small>Médio prazo</small></button>
          <button class="ok" data-plan="later"><span>Acima de 90 dias</span><b>${later}</b><small>Sem urgência</small></button>
        </div>
      </section>
    </div>`;
  }

  categoryIntelligenceHtml(items, category) {
    const data = this.categoryIntelligence(items, category, this.cachedHealthEvolution(items));
    const color = data.color || "#35b9ff";
    return `<div class="category-intelligence-card" data-category-intelligence="${category}" style="--category-accent:${color};--management:${data.managementIndex}">
      <div class="category-intelligence-bg">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="category-intelligence-head">
        <div class="category-intelligence-identity">
          <div class="category-intelligence-symbol">${data.icon || this.icon(category)}</div>
          <div>
            <small>CENTRO INTELIGENTE</small>
            <h3>Categoria ${category}</h3>
          </div>
        </div>
        <div class="category-grade">
          <small>ÍNDICE</small>
          <strong>${data.grade}</strong>
        </div>
      </div>

      <div class="category-intelligence-body">
        <div class="management-orbit ${data.motion}">
          <div class="orbit-track orbit-one"></div>
          <div class="orbit-track orbit-two"></div>
          <div class="management-ring" style="--p:${data.managementIndex}">
            <div>
              <small>GESTÃO</small>
              <b>${data.managementIndex}</b>
              <em>/100</em>
            </div>
          </div>
          <span class="orbit-pulse pulse-one"></span>
          <span class="orbit-pulse pulse-two"></span>
        </div>

        <div class="category-intelligence-copy">
          <div class="intelligence-classification">
            <span class="motion-chip ${data.motion}">
              <ha-icon icon="${data.motion === "ascending" ? "mdi:trending-up" : data.motion === "descending" ? "mdi:trending-down" : "mdi:trending-neutral"}"></ha-icon>
              ${data.motionText}
            </span>
            <strong>${data.classification}</strong>
          </div>
          <p>${data.insight}</p>
          <div class="category-ai-line">
            <ha-icon icon="mdi:brain"></ha-icon>
            <span>Leitura preventiva baseada no comportamento histórico e financeiro da categoria.</span>
          </div>
        </div>
      </div>

      <div class="category-heatmap-section">
        <div class="category-heatmap-head">
          <span>MEMÓRIA DOS ÚLTIMOS 7 MESES</span>
          <small id="category-heatmap-trend">${data.motionText}</small>
        </div>
        <div class="category-heatmap" id="category-intelligence-heatmap">
          ${data.months.map((value, idx) => `<i style="--heat:${value}" title="Mês ${idx+1}: ${value}%"><b>${Math.round(value)}</b></i>`).join("")}
        </div>
      </div>
    </div>`;
  }

  renderCategoryIntelligence(months, items = null) {
    if (!this.shadowRoot || !this.v || ["geral","favoritos","financeiro","cadastro"].includes(this.v)) return;
    const host = this.shadowRoot.querySelector(".heatmap-v285[data-category-intelligence]") ||
      this.shadowRoot.querySelector("[data-category-intelligence]");
    if (!host) return;
    const values = (months || []).map(m => Number(m.value || 0));
    host.innerHTML = (months || []).map((month, idx) => {
      const value = values[idx] || 0;
      return `<i style="--heat:${value}" title="${month.full}: ${value}%"><small>${String(month.label || "").toUpperCase()}</small><b>${Math.round(value)}%</b></i>`;
    }).join("");
    const diff = values.length > 1 ? values[values.length - 1] - values[0] : 0;
    const motion = diff > 3 ? "Trajetória ascendente" : diff < -3 ? "Trajetória descendente" : "Trajetória estável";
    const motionHost = host.closest(".history-v285")?.querySelector(".title-v285 small");
    if (motionHost) motionHost.textContent = motion;
  }

  healthEvolutionKey(items) {
    return (items || [])
      .map(item => `${item.category || ""}|${item.date_entity || item.entity || ""}|${item.cycleDays || 0}|${item.last || ""}`)
      .sort()
      .join("§");
  }

  cachedHealthEvolution(items) {
    const key = this.healthEvolutionKey(items);
    return this.healthEvolutionCache instanceof Map ? (this.healthEvolutionCache.get(key) || null) : null;
  }

  normalizeHistoryDate(value) {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  async loadHealthEvolution(items) {
    const host = this.shadowRoot.querySelector("#health-evolution-chart");
    if (!host) return;

    const key = this.healthEvolutionKey(items);
    const cached = this.healthEvolutionCache instanceof Map ? this.healthEvolutionCache.get(key) : null;
    if (cached) {
      this.renderHealthEvolution(cached, items);
      return;
    }

    const pending = this.healthEvolutionLoading instanceof Map ? this.healthEvolutionLoading.get(key) : null;
    if (pending) {
      this.renderHealthEvolution(await pending, items);
      return;
    }

    const request = (async () => {
      const today = new Date();
      const firstMonth = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      // Busca uma janela ampla para localizar a última execução válida anterior
      // ao primeiro mês exibido, sem inventar dados históricos.
      const historyStart = new Date(firstMonth.getFullYear() - 6, firstMonth.getMonth(), 1).toISOString();
      const entities = [...new Set((items || []).filter(i => i.source !== "local" && i.date_entity).map(i => i.date_entity))];
      const histories = {};

      try {
        if (entities.length) {
          const query = new URLSearchParams({
            filter_entity_id: entities.join(","),
            minimal_response: "",
            no_attributes: ""
          });
          const data = await this.h.callApi("GET", `history/period/${historyStart}?${query.toString()}`);
          (data || []).forEach((series, index) => {
            let entityId = series?.find?.(row => row?.entity_id)?.entity_id || entities[index];
            const dates = [];
            (series || []).forEach(row => {
              if (row?.entity_id) entityId = row.entity_id;
              const normalized = this.normalizeHistoryDate(row?.state ?? row?.s);
              if (normalized) dates.push(normalized);
            });
            if (entityId) histories[entityId] = [...new Set(dates)].sort();
          });
        }
      } catch (error) {
        console.error("Falha ao calcular evolução mensal real", error);
      }

      const months = [];
      for (let offset = 6; offset >= 0; offset--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
        let totalScore = 0;
        let valid = 0;

        (items || []).forEach(item => {
          const dates = [...(histories[item.date_entity] || [])];
          const currentLast = this.normalizeHistoryDate(item.last);
          if (currentLast && !dates.includes(currentLast)) dates.push(currentLast);
          const past = dates
            .map(value => new Date(`${value}T00:00:00`))
            .filter(date => !Number.isNaN(date.getTime()) && date <= monthEnd)
            .sort((a, b) => a - b);
          const cycleDays = Number(item.cycleDays || 0);
          if (!past.length || cycleDays <= 0) return;

          const last = past[past.length - 1];
          const due = this.addDaysDate(last, cycleDays);
          const attentionDays = Math.min(30, Math.max(7, Math.round(cycleDays * .15)));
          const attentionStart = this.addDaysDate(due, -attentionDays);
          const score = monthEnd > due ? 0 : monthEnd >= attentionStart ? 60 : 100;
          totalScore += score;
          valid += 1;
        });

        months.push({
          label: monthDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          full: monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          value: valid ? Math.round(totalScore / valid) : 0,
          valid,
          total: (items || []).length
        });
      }

      if (!(this.healthEvolutionCache instanceof Map)) this.healthEvolutionCache = new Map();
      this.healthEvolutionCache.set(key, months);
      return months;
    })();

    if (!(this.healthEvolutionLoading instanceof Map)) this.healthEvolutionLoading = new Map();
    this.healthEvolutionLoading.set(key, request);
    try {
      this.renderHealthEvolution(await request, items);
    } finally {
      this.healthEvolutionLoading.delete(key);
    }
  }

  renderHealthEvolution(months, items = null) {
    const host = this.shadowRoot.querySelector("#health-evolution-chart");
    if (!host) return;
    const values = months.map(m => m.value);
    const min = Math.max(0, Math.min(...values) - 10);
    const max = 100;
    const width = 600, height = 115, padX = 24, padY = 14;
    const points = months.map((m, idx) => {
      const x = padX + idx * ((width - padX*2) / Math.max(1, months.length - 1));
      const y = padY + (max - m.value) * ((height - padY*2) / Math.max(1, max - min));
      return {x, y, ...m};
    });
    const path = points.map((p,i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${path} L ${points[points.length-1].x} ${height-padY} L ${points[0].x} ${height-padY} Z`;
    const diff = values.length > 1 ? values[values.length-1] - values[0] : 0;
    const trend = this.shadowRoot.querySelector("#evolution-trend");
    if (trend) {
      trend.textContent = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff)}%`;
      trend.className = diff >= 0 ? "trend-up" : "trend-down";
    }
    host.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Evolução da saúde">
      <defs><linearGradient id="evolutionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2be083" stop-opacity=".28"/><stop offset="100%" stop-color="#2be083" stop-opacity="0"/></linearGradient></defs>
      <path class="evolution-area" d="${area}"></path>
      <path class="evolution-line" d="${path}"></path>
      ${points.map(p => `<circle class="evolution-point" cx="${p.x}" cy="${p.y}" r="4"><title>${p.full}: ${p.value}%</title></circle>`).join("")}
    </svg>
    <div class="evolution-labels">${months.map(m => `<button title="${m.full}" data-evolution-month="${m.full}"><span>${m.label}</span><b>${m.value}%</b></button>`).join("")}</div>`;
    this.renderCategoryIntelligence(months, items);
  }


  openHelp() {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="help-modal">
      <div class="modal-head"><div><h2><ha-icon icon="mdi:help-circle-outline"></ha-icon> Ajuda do dashboard</h2><p>Clique em um tema para abrir a explicação completa.</p></div><button id="close">✕</button></div>
      <div class="help-grid">
        <button data-help-topic="health"><ha-icon icon="mdi:heart-pulse"></ha-icon><b>Saúde</b><p>Entenda o cálculo do índice geral.</p></button>
        <button data-help-topic="upcoming"><ha-icon icon="mdi:clipboard-clock-outline"></ha-icon><b>Próximas manutenções</b><p>Veja como prioridade e vencimento são ordenados.</p></button>
        <button data-help-topic="planning"><ha-icon icon="mdi:calendar-clock"></ha-icon><b>Planejamento</b><p>Entenda cada faixa de prazo.</p></button>
        <button data-help-topic="executive"><ha-icon icon="mdi:view-dashboard-variant"></ha-icon><b>Painel executivo</b><p>Conheça os indicadores complementares.</p></button>
        <button data-help-topic="history"><ha-icon icon="mdi:history"></ha-icon><b>Histórico</b><p>Aprenda a pesquisar, filtrar e exportar.</p></button>
        <button data-help-topic="interaction"><ha-icon icon="mdi:gesture-tap-button"></ha-icon><b>Interatividade</b><p>Descubra o que pode ser clicado.</p></button>
        <button data-help-topic="tip"><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon><b>Dica</b><p>Boas práticas para manter o painel confiável.</p></button>
      </div>
    </div></div>`;
    const close = () => modal.innerHTML = "";
    modal.querySelector("#close").onclick = close;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) close(); };
    modal.querySelectorAll("[data-help-topic]").forEach(btn => btn.onclick = () => this.openHelpTopic(btn.dataset.helpTopic));
  }

  openHelpTopic(topic) {
    const topics = {
      health: {
        icon:"mdi:heart-pulse", title:"Saúde do sistema",
        text:"O índice combina todos os itens: Em dia vale 100 pontos, Atenção vale 60 e Vencida vale 0. A média representa a saúde geral.",
        action:"Abra o card Saúde para acompanhar a evolução geral."
      },
      upcoming: {
        icon:"mdi:clipboard-clock-outline", title:"Próximas manutenções",
        text:"Os itens são ordenados pelo menor número de dias restantes. Vencidas aparecem primeiro, seguidas das mais próximas.",
        action:"Clique em qualquer linha para abrir os detalhes do item."
      },
      planning: {
        icon:"mdi:calendar-clock", title:"Planejamento",
        text:"As faixas agrupam manutenções vencidas, até 30 dias, entre 31 e 90 dias e acima de 90 dias.",
        action:"Clique em uma faixa para abrir todos os itens correspondentes."
      },
      executive: {
        icon:"mdi:view-dashboard-variant", title:"Painel executivo",
        text:"Apresenta risco geral, itens monitorados, realizações anuais, próxima manutenção, maior atraso, prioridade e cumprimento.",
        action:"Cada indicador é um botão e abre sua visualização relacionada."
      },
      history: {
        icon:"mdi:history", title:"Histórico",
        text:"O histórico usa o Recorder do Home Assistant e permite filtrar por texto, categoria, status, prioridade e ano.",
        action:"Use Exportar Excel para gerar um arquivo XLSX completo, formatado e dividido em abas."
      },
      interaction: {
        icon:"mdi:gesture-tap-button", title:"Interatividade",
        text:"Cards de manutenção, planejamento, painel executivo, gráficos e listas são clicáveis.",
        action:"Ao abrir uma subtela, o botão fechar retorna ao menu anterior."
      },
      tip: {
        icon:"mdi:lightbulb-on-outline", title:"Dica de uso",
        text:"Sempre registre a manutenção pelo botão do próprio item. Isso atualiza a próxima data, o histórico e todos os indicadores.",
        action:"Evite editar diretamente os sensores; altere somente a data de última execução quando necessário."
      }
    };
    const t = topics[topic] || topics.tip;
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="help-topic-modal">
      <div class="modal-head"><div><h2><ha-icon icon="${t.icon}"></ha-icon> ${t.title}</h2><p>Ajuda contextual do dashboard.</p></div><button id="close">✕</button></div>
      <div class="help-topic-content"><ha-icon icon="${t.icon}"></ha-icon><p>${t.text}</p><div><b>Como usar</b><span>${t.action}</span></div></div>
    </div></div>`;
    const back = () => this.openHelp();
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
  }

  openQuickActions() {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="quick-modal">
      <div class="modal-head"><div><h2><ha-icon icon="mdi:lightning-bolt-circle"></ha-icon> Ações rápidas</h2><p>Acesse as principais operações do módulo.</p></div><button id="close">✕</button></div>
      <div class="quick-grid">
        <button data-q="register"><ha-icon icon="mdi:calendar-check"></ha-icon><span><b>Registrar manutenção</b><small>Marque um serviço como realizado</small></span></button>
        <button data-q="history"><ha-icon icon="mdi:file-chart-outline"></ha-icon><span><b>Relatório completo</b><small>Consulte e exporte o histórico</small></span></button>
        <button data-q="overdue"><ha-icon icon="mdi:alert-octagon"></ha-icon><span><b>Ver vencidas</b><small>Abra todas as manutenções atrasadas</small></span></button>
        <button data-q="next30"><ha-icon icon="mdi:calendar-week"></ha-icon><span><b>Próximos 30 dias</b><small>Planeje as execuções mais próximas</small></span></button>
      </div>
    </div></div>`;
    const close = () => modal.innerHTML = "";
    modal.querySelector("#close").onclick = close;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) close(); };
    const items = this.items();
    const back = () => this.openQuickActions();
    modal.querySelector('[data-q="register"]').onclick = () => this.registerModal(back);
    modal.querySelector('[data-q="history"]').onclick = () => this.history(null, back);
    modal.querySelector('[data-q="overdue"]').onclick = () => this.openPlanning("overdue", items, back);
    modal.querySelector('[data-q="next30"]').onclick = () => this.openPlanning("30", items, back);
  }

  openExecutive(type, items, refs) {
    if (type === "all") return this.showListModal("Itens monitorados", "mdi:format-list-checks", items);
    if (type === "annual") return this.history();
    if (type === "next" && refs.nextItem) return this.details(refs.nextItem);
    if (type === "overdue" && refs.maxOverdue) return this.details(refs.maxOverdue);
    if (type === "priority" && refs.topPriority) return this.openPriority(refs.topPriority.priority, items);
    if (type === "compliance") return this.showListModal("Itens não vencidos", "mdi:check-decagram", items.filter(i => i.state !== "Vencido"));
  }

  openSmartIndicator(type, items) {
    if (type === "overdue") {
      return this.showListModal("Manutenções críticas vencidas", "mdi:alert-octagon",
        items.filter(i => i.state === "Vencido" && i.priority === "Crítica").sort((a,b)=>a.remaining-b.remaining));
    }
    return this.showListModal("Manutenções para os próximos 90 dias", "mdi:calendar-star",
      items.filter(i => i.remaining >= 0 && i.remaining <= 90).sort((a,b)=>a.remaining-b.remaining));
  }

  showListModal(title, icon, list, returnTo = null) {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="planning-modal">
      <div class="modal-head"><div><h2><ha-icon icon="${icon}"></ha-icon> ${title}</h2><p>${list.length} manutenção(ões) encontrada(s).</p></div><button id="close">✕</button></div>
      <div class="planning-list">${list.map(i => `<button data-list-item="${i.entity}">
        <span class="event-icon ${this.cls(i.state)}"><ha-icon icon="${this.maintenanceMdi(i)}"></ha-icon></span>
        <span><b>${i.name}</b><small>${i.category} • ${i.priority} • Próxima: ${this.fmt(i.next)}</small></span>
        <em class="${this.cls(i.state)}">${i.state} • ${i.remaining < 0 ? `${Math.abs(i.remaining)} dias em atraso` : `${i.remaining} dias`}</em>
      </button>`).join("") || '<div class="empty">Nenhuma manutenção encontrada.</div>'}</div>
    </div></div>`;
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelectorAll("[data-list-item]").forEach(btn => btn.onclick = () => {
      const item = list.find(i => i.entity === btn.dataset.listItem);
      if (item) this.details(item, () => this.showListModal(title, icon, list, returnTo));
    });
  }


  async fetchItemHistoryDates(item) {
    const cacheKey = `history:${item.entity}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached) return cached;
    const start = new Date(Date.now() - Number(this.c.history_days || 3650) * 86400000).toISOString();
    const dates = [];
    try {
      const data = await this.h.callApi("GET", `history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(item.date_entity)}&minimal_response&no_attributes`);
      (data || []).forEach(series => {
        for (let x = 1; x < series.length; x++) {
          const cur = series[x], prev = series[x - 1];
          if (cur.state !== prev.state && /^\d{4}-\d{2}-\d{2}$/.test(cur.state)) dates.push(cur.state);
        }
      });
    } catch (error) {
      console.error("Falha ao carregar timeline", error);
    }
    if (item.last && !dates.includes(item.last)) dates.push(item.last);
    const unique = [...new Set(dates)].sort();
    this.recommendationCache.set(cacheKey, unique);
    return unique;
  }

  humanCycle(days) {
    const d = Math.max(1, Math.round(Number(days || 0)));
    if (d >= 330 && d % 365 <= 45) {
      const years = Math.max(1, Math.round(d / 365));
      return `${years} ${years === 1 ? "ano" : "anos"}`;
    }
    if (d >= 150) {
      const months = Math.max(1, Math.round(d / 30));
      return `${months} meses`;
    }
    return `${d} dias`;
  }

  async analyzeItem(item) {
    const cacheKey = `analysis:${item.entity}:${item.last}`;
    if (this.recommendationCache.has(cacheKey)) return this.recommendationCache.get(cacheKey);
    const dates = await this.fetchItemHistoryDates(item);
    const intervals = [];
    for (let x = 1; x < dates.length; x++) {
      const a = new Date(`${dates[x-1]}T00:00:00`);
      const b = new Date(`${dates[x]}T00:00:00`);
      intervals.push(Math.round((b - a) / 86400000));
    }
    const average = intervals.length ? Math.round(intervals.reduce((a,b)=>a+b,0) / intervals.length) : null;
    const cycle = Number(item.cycleDays || 0);
    let severity = "info";
    let title = "Histórico insuficiente";
    let message = "Registre pelo menos duas execuções para que o sistema compare o comportamento real com o ciclo configurado.";
    let suggestedDays = null;

    if (item.state === "Vencido" && item.priority === "Crítica") {
      severity = "danger";
      title = "Execução prioritária recomendada";
      message = `${item.name} está vencida há ${Math.abs(item.remaining)} dias e possui prioridade crítica. Recomenda-se executar imediatamente.`;
    } else if (average && cycle) {
      const difference = (average - cycle) / cycle;
      if (difference <= -0.15) {
        severity = "warning";
        suggestedDays = average;
        title = "Considere reduzir o ciclo";
        message = `A média real entre execuções é de ${average} dias, aproximadamente ${Math.abs(Math.round(difference*100))}% menor que o ciclo atual de ${cycle} dias. Sugestão: revisar para ${this.humanCycle(average)}.`;
      } else if (difference >= 0.20) {
        severity = "info";
        suggestedDays = average;
        title = "Ciclo pode ser revisado";
        message = `A média real entre execuções é de ${average} dias, cerca de ${Math.round(difference*100)}% maior que o ciclo atual. Avalie se ${this.humanCycle(average)} representa melhor sua rotina, sem comprometer segurança ou garantia.`;
      } else {
        severity = "ok";
        title = "Ciclo adequado";
        message = `A média real é de ${average} dias e está compatível com o ciclo configurado de ${cycle} dias. Nenhuma alteração é recomendada.`;
      }
    } else if (item.state === "Atenção") {
      severity = "warning";
      title = "Planejamento recomendado";
      message = `Faltam ${item.remaining} dias. Planeje a execução antes de ${this.fmt(item.next)} para evitar vencimento.`;
    }

    const result = { severity, title, message, average, suggestedDays, records: dates.length };
    this.recommendationCache.set(cacheKey, result);
    return result;
  }

  async renderItemRecommendation(item) {
    const host = this.shadowRoot.querySelector("#detail-recommendation");
    if (!host) return;
    const analysis = await this.analyzeItem(item);
    if (!this.shadowRoot.querySelector("#detail-recommendation")) return;
    host.innerHTML = `<div class="recommendation-box ${analysis.severity}">
      <div><ha-icon icon="mdi:brain"></ha-icon><span><b>${analysis.title}</b><small>${analysis.records} registro(s) analisado(s)${analysis.average ? ` • média ${analysis.average} dias` : ""}</small></span></div>
      <p>${analysis.message}</p>
    </div>`;
  }

  async openTimeline(item, returnTo = null) {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="timeline-modal"><div class="modal-head"><div><h2><ha-icon icon="mdi:timeline-clock-outline"></ha-icon> Timeline — ${item.name}</h2><p>Carregando execuções registradas...</p></div><button id="close">✕</button></div></div></div>`;
    const dates = await this.fetchItemHistoryDates(item);
    const grouped = dates.slice().reverse().reduce((acc, date) => {
      const year = date.slice(0,4);
      (acc[year] ||= []).push(date);
      return acc;
    }, {});
    const panel = modal.querySelector(".timeline-modal");
    panel.innerHTML = `<div class="modal-head"><div><h2><ha-icon icon="mdi:timeline-clock-outline"></ha-icon> Timeline — ${item.name}</h2><p>${dates.length} execução(ões) encontrada(s).</p></div><button id="close">✕</button></div>
      <div class="timeline">${Object.entries(grouped).map(([year, yearDates]) => `<section><div class="timeline-year">${year}</div><div class="timeline-events">${yearDates.map(date => `<button data-timeline-date="${date}">
        <span><ha-icon icon="mdi:check-decagram"></ha-icon></span><div><b>${this.fmt(date)}</b><small>${item.action}</small></div>
      </button>`).join("")}</div></section>`).join("") || '<div class="empty">Nenhuma execução registrada.</div>'}</div>`;
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    panel.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
  }

  async openRecommendations() {
    const modal = this.shadowRoot.querySelector("#modal");
    const items = this.items();
    modal.innerHTML = `<div class="overlay"><div class="recommendations-modal"><div class="modal-head"><div><h2><ha-icon icon="mdi:brain"></ha-icon> IA Preventiva</h2><p>IA Preventiva analisando histórico, ciclos e prioridades...</p></div><button id="close">✕</button></div><div class="recommendations-loading">Processando ${items.length} itens...</div></div></div>`;
    const analyses = await Promise.all(items.map(async item => ({ item, analysis: await this.analyzeItem(item) })));
    const order = { danger:0, warning:1, info:2, ok:3 };
    analyses.sort((a,b) => (order[a.analysis.severity] ?? 4) - (order[b.analysis.severity] ?? 4) || a.item.remaining - b.item.remaining);
    const panel = modal.querySelector(".recommendations-modal");
    panel.innerHTML = `<div class="modal-head"><div><h2><ha-icon icon="mdi:brain"></ha-icon> IA Preventiva</h2><p>Análise preventiva baseada no histórico do Recorder, ciclos, prioridade e comportamento real.</p></div><button id="close">✕</button></div>
      <div class="recommendation-summary">${["danger","warning","info","ok"].map(s => `<div class="${s}"><b>${analyses.filter(x=>x.analysis.severity===s).length}</b><span>${s==="danger"?"Urgentes":s==="warning"?"Revisar":s==="info"?"Sugestões":"Adequadas"}</span></div>`).join("")}</div>
      <div class="recommendations-list">${analyses.map(({item,analysis}) => `<button class="recommendation-row ${analysis.severity}" data-recommendation="${item.entity}">
        <span class="recommendation-icon"><ha-icon icon="${this.maintenanceMdi(item)}"></ha-icon></span>
        <span><b>${item.name}</b><small>${analysis.title} • ${analysis.records} registro(s)</small><em>${analysis.message}</em></span>
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </button>`).join("")}</div>`;
    const close = () => modal.innerHTML = "";
    panel.querySelector("#close").onclick = close;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) close(); };
    panel.querySelectorAll("[data-recommendation]").forEach(btn => btn.onclick = () => {
      const item = items.find(i => i.entity === btn.dataset.recommendation);
      if (item) this.details(item, () => this.openRecommendations());
    });
  }


  normalizedFinanceRecord(record) {
    const products = Number(record?.productsCost || 0);
    const labor = Number((record?.laborCost ?? (record?.productsCost == null ? record?.paid : 0)) || 0);
    return { ...record, productsCost: products, laborCost: labor, paid: products + labor };
  }

  financeRecordsForItem(item) {
    const itemSlug = this.slug(item?.name || "");
    return (this.financeRecords || [])
      .map(record => this.normalizedFinanceRecord(record))
      .filter(record =>
        (item?.entity && record.itemEntity === item.entity) ||
        (item?.date_entity && record.dateEntity === item.date_entity) ||
        (!!itemSlug && this.slug(record.name || "") === itemSlug)
      )
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  }

  costComparisonFor(item) {
    const history = this.financeRecordsForItem(item);
    const last = history.length ? history[history.length - 1] : null;
    const estimate = this.estimateFor(item);
    const previous = Number(last?.paid || 0);
    const next = Number(estimate?.total || 0);
    const difference = next - previous;
    const percentage = previous > 0 ? (difference / previous) * 100 : null;
    let status = "no-comparison";
    if (last && next > 0) {
      if (Math.abs(difference) < 0.01 || Math.abs(percentage || 0) < 1) status = "stable";
      else if (difference > 0) status = "up";
      else status = "down";
    }
    return { history, last, estimate, previous, next, difference, percentage, status };
  }

  costTrendSummary(items) {
    const rows = (items || []).map(item => ({ item, ...this.costComparisonFor(item) }));
    const comparable = rows.filter(row => row.last && row.next > 0);
    const counts = {
      up: comparable.filter(row => row.status === "up").length,
      stable: comparable.filter(row => row.status === "stable").length,
      down: comparable.filter(row => row.status === "down").length,
      none: rows.length - comparable.length,
    };
    const biggestIncrease = comparable.filter(row => row.status === "up").sort((a,b)=>(b.percentage||0)-(a.percentage||0))[0] || null;
    const biggestReduction = comparable.filter(row => row.status === "down").sort((a,b)=>(a.percentage||0)-(b.percentage||0))[0] || null;
    return { rows, counts, biggestIncrease, biggestReduction };
  }

  costTimelineMarkup(item) {
    const comparison = this.costComparisonFor(item);
    const real = comparison.history.slice(-5);
    const points = real.map(record => ({
      type: "real",
      date: record.date,
      value: Number(record.paid || 0),
      material: Number(record.productsCost || 0),
      labor: Number(record.laborCost || 0),
      executor: record.executor || "—",
    }));
    if (comparison.next > 0) points.push({
      type: "forecast",
      date: item.next || "Próxima",
      value: comparison.next,
      material: Number(comparison.estimate.material || 0),
      labor: Number(comparison.estimate.labor || 0),
      executor: "Previsto",
    });
    const statusLabel = comparison.status === "up" ? "Aumento" : comparison.status === "down" ? "Redução" : comparison.status === "stable" ? "Estável" : "Sem comparação";
    const variation = comparison.last && comparison.next > 0
      ? `${comparison.difference >= 0 ? "+" : ""}${this.money(comparison.difference)}${comparison.percentage == null ? "" : ` • ${comparison.percentage >= 0 ? "+" : ""}${comparison.percentage.toFixed(1)}%`}`
      : "Histórico ou previsão insuficiente";
    return `<section class="detail-cost-comparison ${comparison.status}">
      <div class="detail-cost-head"><span><ha-icon icon="mdi:chart-timeline-variant-shimmer"></ha-icon> Histórico e previsão de custo</span><em>${statusLabel}</em></div>
      <div class="detail-cost-kpis">
        <span><small>Último custo real</small><b>${comparison.last ? this.money(comparison.previous) : "Sem histórico"}</b></span>
        <div class="next-cost-edit">
          <small>Próximo custo previsto</small>
          <div class="next-cost-control"><span>R$</span><input id="detail-next-cost" type="number" min="0" step="0.01" value="${comparison.next.toFixed(2)}" aria-label="Próximo custo previsto"><button type="button" data-save-next-cost title="Salvar próximo custo previsto"><ha-icon icon="mdi:content-save-check-outline"></ha-icon></button></div>
          <em>Usado nas provisões, gráficos e relatórios</em>
        </div>
        <span class="variation"><small>Variação</small><b>${variation}</b></span>
      </div>
      <div class="detail-cost-timeline ${points.length < 2 ? "single" : ""}">${points.length ? points.map((point,index)=>`<div class="cost-point ${point.type}" style="--index:${index};--count:${points.length}" title="${this.fmt(point.date)} • Total ${this.money(point.value)} • Materiais ${this.money(point.material)} • Mão de obra ${this.money(point.labor)} • ${this.escapeHtml(point.executor)}"><i></i><b>${this.money(point.value)}</b><small>${this.fmt(point.date)}</small></div>`).join("") : '<div class="cost-timeline-empty">Registre uma execução ou informe uma previsão para formar a linha do tempo.</div>'}</div>
    </section>`;
  }

  details(item, returnTo = null) {
    const c = this.cls(item.state);
    const r = item.remaining < 0 ? `Vencida há ${Math.abs(item.remaining)} dias` : `Faltam ${item.remaining} dias`;
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="detail-modal ${c}">
      <button class="modal-close" data-close>✕</button>
      <div class="detail-hero"><img src="${item.image}" alt="${item.name}"><div><span class="detail-category">${this.icon(item.category)} ${item.category} • ${item.priority}</span><h2>${item.name}</h2><div class="detail-badges"><span class="badge ${c}"><i>${this.statusIcon(item.state)}</i>${item.state}</span><button class="detail-favorite ${this.isFavorite(item.entity) ? "active" : ""}" data-detail-favorite><ha-icon icon="${this.isFavorite(item.entity) ? "mdi:bookmark-check" : "mdi:bookmark-outline"}"></ha-icon>${this.isFavorite(item.entity) ? "Favorito" : "Favoritar"}</button></div></div></div>
      <div class="detail-grid">
        <div><small>Última execução</small><b>${this.fmt(item.last)}</b></div>
        <div><small>Próxima execução</small><b>${this.fmt(item.next)}</b></div>
        <div><small>Ciclo</small><b>${item.cycle}</b></div>
        <div><small>Situação</small><b class="${c}">${r}</b></div>
      </div>
      ${(() => { const estimate = this.estimateFor(item); return `<section class="detail-provision-editor">
        <div class="detail-provision-head"><span><ha-icon icon="mdi:cash-clock"></ha-icon> Provisão da próxima manutenção</span><b id="detail-provision-total">${this.money(estimate.total)}</b></div>
        <div class="detail-provision-fields">
          <label>Produtos / materiais (R$)<input id="detail-est-material" type="number" min="0" step="0.01" value="${estimate.material.toFixed(2)}"></label>
          <label>Mão de obra prevista (R$)<input id="detail-est-labor" type="number" min="0" step="0.01" value="${estimate.labor.toFixed(2)}"></label>
          <button data-save-provision><ha-icon icon="mdi:content-save-check-outline"></ha-icon> Salvar previsão</button>
        </div>
        <small>Esses valores alimentam a provisão mensal, os gráficos e os relatórios financeiros. Na execução, eles poderão ser atualizados.</small>
      </section>`; })()}
      ${this.costTimelineMarkup(item)}
      <div class="detail-progress"><div class="progress ${c}" style="--p:${Math.min(100, Math.max(0, item.percent))}"><b>${item.percent}%</b><small>do ciclo</small></div><p>Decorridos <b>${item.daysSince} dias</b> desde o último registro.</p></div>
      <div class="detail-intelligence" id="detail-recommendation"><div class="intelligence-loading"><ha-icon icon="mdi:brain"></ha-icon> Analisando histórico...</div></div>
      <div class="detail-actions"><button data-detail-done>✓ ${item.action}</button><button data-detail-history>🕘 Ver histórico</button><button data-detail-timeline><ha-icon icon="mdi:timeline-clock-outline"></ha-icon> Timeline</button></div>
    </div></div>`;
    const back = () => {
      modal.innerHTML = "";
      if (returnTo) requestAnimationFrame(() => returnTo());
    };
    modal.querySelector("[data-close]").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelector("[data-detail-favorite]").onclick = () => {
      this.toggleFavorite(item.entity);
      this.details(this.items().find(i => i.entity === item.entity) || item, returnTo);
    };
    modal.querySelector("[data-detail-done]").onclick = async () => { await this.done(item.date_entity); back(); };
    modal.querySelector("[data-detail-history]").onclick = () => this.history(item.date_entity, () => this.details(item, returnTo));
    modal.querySelector("[data-detail-timeline]").onclick = () => this.openTimeline(item, () => this.details(item, returnTo));
    const estMaterial = modal.querySelector("#detail-est-material");
    const estLabor = modal.querySelector("#detail-est-labor");
    const nextCostInput = modal.querySelector("#detail-next-cost");
    const refreshProvision = (syncNext = true) => {
      const total = Number(estMaterial?.value || 0) + Number(estLabor?.value || 0);
      const output = modal.querySelector("#detail-provision-total");
      if (output) output.textContent = this.money(total);
      if (syncNext && nextCostInput && document.activeElement !== nextCostInput) nextCostInput.value = total.toFixed(2);
      return total;
    };
    const distributeNextCost = () => {
      const total = Math.max(0, Number(nextCostInput?.value || 0));
      const material = Math.max(0, Number(estMaterial?.value || 0));
      const labor = Math.max(0, Number(estLabor?.value || 0));
      const currentTotal = material + labor;
      let nextMaterial = 0;
      let nextLabor = 0;
      if (currentTotal > 0 && material > 0 && labor > 0) {
        nextMaterial = Math.round((total * material / currentTotal) * 100) / 100;
        nextLabor = Math.round((total - nextMaterial) * 100) / 100;
      } else if (material > 0 && labor <= 0) {
        nextMaterial = total;
      } else {
        // Serviços sem materiais cadastrados, como lavagem do carro, permanecem como mão de obra.
        nextLabor = total;
      }
      if (estMaterial) estMaterial.value = nextMaterial.toFixed(2);
      if (estLabor) estLabor.value = nextLabor.toFixed(2);
      refreshProvision(false);
      return { material: nextMaterial, labor: nextLabor, total };
    };
    estMaterial?.addEventListener("input", () => refreshProvision(true));
    estLabor?.addEventListener("input", () => refreshProvision(true));
    nextCostInput?.addEventListener("input", () => refreshProvision(false));
    nextCostInput?.addEventListener("keydown", event => {
      if (event.key === "Enter") modal.querySelector("[data-save-next-cost]")?.click();
    });
    modal.querySelector("[data-save-next-cost]")?.addEventListener("click", () => {
      const values = distributeNextCost();
      this.saveEstimateFor(item, values.material, values.labor);
      if (this.v === "financeiro") this.renderFinanceDashboard(this.items());
      const current = this.items().find(i => i.entity === item.entity) || item;
      this.details(current, returnTo);
    });
    modal.querySelector("[data-save-provision]")?.addEventListener("click", () => {
      this.saveEstimateFor(item, estMaterial?.value, estLabor?.value);
      refreshProvision(true);
      if (this.v === "financeiro") this.renderFinanceDashboard(this.items());
      const current = this.items().find(i => i.entity === item.entity) || item;
      this.details(current, returnTo);
    });
    this.renderItemRecommendation(item);
  }

  registerModal(returnTo = null) {
    const I = this.items().sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = `<div class="overlay"><div class="register-modal"><div class="modal-head"><div><h2>🗓 Registrar manutenção</h2><p>Selecione o item que acabou de ser realizado.</p></div><button data-close>✕</button></div><div class="register-list">${I.map(i => `<button data-register-item="${i.date_entity}"><span>${this.icon(i.category)}</span><div><b>${i.name}</b><small>${i.category} • ${i.cycle} • Prev. ${this.money(this.estimateFor(i).total)}</small></div><i>›</i></button>`).join("")}</div></div></div>`;
    const back = () => {
      modal.innerHTML = "";
      if (returnTo) requestAnimationFrame(() => returnTo());
    };
    modal.querySelector("[data-close]").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelectorAll("[data-register-item]").forEach(b => b.onclick = () => { const item = I.find(i => i.date_entity === b.dataset.registerItem); if (item) this.openFinanceEntry(item, returnTo); });
  }

  async done(entity) {
    const item = this.items().find(x => x.date_entity === entity);
    if (item) this.openFinanceEntry(item);
  }


  _localDateValue(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  async _setMaintenanceExecutionDate(item, date) {
    if (item?.source === "local" || String(item?.date_entity || "").startsWith("local_datetime.")) {
      const target=(this.registrationData?.maintenances||[]).find(x=>`local_maintenance.${x.id}`===item.entity || `local_datetime.${x.id}`===item.date_entity);
      if(!target) throw new Error("Cadastro local da manutenção não encontrado.");
      target.last=date; target.updatedAt=new Date().toISOString(); this.saveRegistrationData(); return true;
    }
    const entity = item?.date_entity || item?.dateEntity;
    if (!entity || !this.h?.states?.[entity]) {
      throw new Error(`Helper de data não encontrado para ${item?.name || "a manutenção"}.`);
    }
    const attrs = this.h.states[entity].attributes || {};
    const payload = { entity_id: entity };
    if (attrs.has_date !== false) payload.date = date;
    if (attrs.has_time === true) payload.time = "00:00:00";
    await this.h.callService("input_datetime", "set_datetime", payload);

    // Mantém o cadastro compartilhado coerente com a data efetivamente gravada.
    // Isso evita que um override antigo reapareça ao abrir o painel em outro dispositivo.
    const overrideKey = item?.registrationKey || item?.entity || entity;
    if (overrideKey) {
      this.registrationData.maintenanceOverrides = this.registrationData.maintenanceOverrides || {};
      const currentOverride = this.registrationData.maintenanceOverrides[overrideKey] || {};
      this.registrationData.maintenanceOverrides[overrideKey] = {
        ...currentOverride,
        last: date,
        updatedAt: new Date().toISOString()
      };
      this.saveRegistrationData();
    }

    const expected = attrs.has_time === true ? `${date} 00:00:00` : date;
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      const current = String(this.h?.states?.[entity]?.state || "");
      if (current === expected || current.startsWith(date)) return true;
    }
    throw new Error(`O Home Assistant não confirmou a atualização de ${entity}. Estado atual: ${this.h?.states?.[entity]?.state || "indisponível"}.`);
  }

  async _syncFinanceRecordMaintenance(record) {
    const item = this.items().find(i => i.entity === record.itemEntity || i.date_entity === record.dateEntity);
    if (!item) throw new Error("A manutenção vinculada a este lançamento não foi encontrada.");
    await this._setMaintenanceExecutionDate(item, record.date);
    this.annualCache = null;
    this.recommendationCache.clear();
    this.healthEvolutionCache = new Map();
    setTimeout(() => this.update(), 350);
  }

  openFinanceEntry(item, returnTo = null) {
    const modal = this.shadowRoot.querySelector("#modal");
    const today = this._localDateValue();
    const estimate = this.estimateFor(item);
    modal.innerHTML = `<div class="overlay"><div class="finance-entry-modal">
      <button class="modal-close" data-close>✕</button>
      <div class="finance-entry-head"><div class="finance-entry-icon"><ha-icon icon="${this.maintenanceMdi(item)}"></ha-icon></div><div><span>${this.icon(item.category)} ${item.category}</span><h2>${this.escapeHtml(item.name)}</h2><p>Registre a execução, as compras e o impacto financeiro.</p></div></div>
      <div class="finance-section-title"><ha-icon icon="mdi:chart-timeline-variant"></ha-icon><span>Previsão / provisão desta manutenção</span></div>
      <div class="finance-form-grid finance-estimate-grid">
        <label>Material previsto (R$)<input id="f-est-material" type="number" min="0" step="0.01" value="${estimate.material.toFixed(2)}"></label>
        <label>Mão de obra prevista (R$)<input id="f-est-labor" type="number" min="0" step="0.01" value="${estimate.labor.toFixed(2)}"></label>
        <div class="estimate-total"><span>Provisão total</span><b id="f-est-total">${this.money(estimate.total)}</b><small>Este valor aparecerá no card e nas previsões financeiras.</small></div>
      </div>
      <div class="finance-section-title"><ha-icon icon="mdi:clipboard-account-outline"></ha-icon><span>Execução do serviço</span></div>
      <div class="finance-form-grid">
        <label>Data<input id="f-date" type="date" value="${today}"></label>
        <label>Executado por<select id="f-executor"><option>Responsável / morador</option><option>Empresa / profissional</option><option>Misto</option></select></label>
        <label class="finance-full">Empresa / profissional<input id="f-provider" placeholder="Opcional"></label>
      </div>
      <div class="finance-section-title"><ha-icon icon="mdi:cart-outline"></ha-icon><span>Produtos, peças e materiais</span></div>
      <div class="finance-form-grid">
        <label class="finance-full">Produtos comprados<input id="f-products" placeholder="Ex.: 2 mangueiras de gás e 1 registro"></label>
        <label>Valor de produtos/peças (R$)<input id="f-products-cost" type="number" min="0" step="0.01" value="0"></label>
      </div>
      <div class="finance-section-title"><ha-icon icon="mdi:account-wrench-outline"></ha-icon><span>Mão de obra e economia</span></div>
      <div class="finance-form-grid">
        <label>Valor pago em mão de obra (R$)<input id="f-labor-cost" type="number" min="0" step="0.01" value="0"></label>
        <label>Preço de mercado da mão de obra (R$)<input id="f-market-labor" type="number" min="0" step="0.01" value="${estimate.labor.toFixed(2)}"></label>
        <label>Economia em mão de obra (R$)<input id="f-saving" type="number" min="0" step="0.01" value="0"></label>
        <label class="finance-calculation-note"><span>Como é calculado</span><small>Quando o responsável / morador executa: preço de mercado da mão de obra menos o valor pago em mão de obra. Produtos e peças entram no gasto, mas não reduzem a economia do trabalho realizado.</small></label>
        <label class="finance-full">Observações<textarea id="f-notes" rows="3" placeholder="Garantia, loja, marca, quilometragem, detalhes da execução..."></textarea></label>
      </div>
      <div class="finance-live-result finance-live-result-v231"><div><span>Produtos/peças</span><b id="f-products-preview">${this.money(0)}</b></div><div><span>Mão de obra</span><b id="f-labor-preview">${this.money(0)}</b></div><div><span>Total pago</span><b id="f-paid-preview">${this.money(0)}</b></div><div><span>Economizado</span><b id="f-saving-preview">${this.money(0)}</b></div></div>
      <div class="finance-entry-actions"><button data-cancel>Cancelar</button><button class="primary" data-save><ha-icon icon="mdi:content-save-check"></ha-icon>Registrar manutenção</button></div>
    </div></div>`;
    const productsCost=modal.querySelector("#f-products-cost"), laborCost=modal.querySelector("#f-labor-cost"), marketLabor=modal.querySelector("#f-market-labor"), saving=modal.querySelector("#f-saving"), executor=modal.querySelector("#f-executor"), estMaterial=modal.querySelector("#f-est-material"), estLabor=modal.querySelector("#f-est-labor");
    let manualSaving=false;
    const refresh=()=>{
      if(!manualSaving && executor.value==="Responsável / morador") saving.value=Math.max(0,Number(marketLabor.value||0)-Number(laborCost.value||0)).toFixed(2);
      const totalPaid=Number(productsCost.value||0)+Number(laborCost.value||0);
      modal.querySelector("#f-products-preview").textContent=this.money(productsCost.value);
      modal.querySelector("#f-labor-preview").textContent=this.money(laborCost.value);
      modal.querySelector("#f-paid-preview").textContent=this.money(totalPaid);
      modal.querySelector("#f-saving-preview").textContent=this.money(saving.value);
      const estimatedTotal=Number(estMaterial.value||0)+Number(estLabor.value||0);
      modal.querySelector("#f-est-total").textContent=this.money(estimatedTotal);
    };
    let marketEdited=false;
    [productsCost,laborCost,executor,estMaterial].forEach(x=>x.oninput=refresh);
    marketLabor.oninput=()=>{marketEdited=true;manualSaving=false;refresh()};
    estLabor.oninput=()=>{if(!marketEdited)marketLabor.value=estLabor.value;refresh()};
    saving.oninput=()=>{manualSaving=true;refresh()};
    const close=()=>{ modal.innerHTML=""; if(returnTo) requestAnimationFrame(()=>returnTo()); };
    modal.querySelector("[data-close]").onclick=close; modal.querySelector("[data-cancel]").onclick=close;
    modal.querySelector(".overlay").onclick=e=>{if(e.target.classList.contains("overlay"))close()};
    let busy=false, completedRecord=null;
    const saveButton=modal.querySelector("[data-save]");
    saveButton.onclick=async()=>{
      if(busy)return;
      if(completedRecord){
        busy=true;saveButton.disabled=true;
        try{await this.__cpSaveSnapshot();close();this.update();}
        catch(error){alert(`A execução já foi registrada. Falta salvar o financeiro: ${error?.message||error}. Tente salvar novamente.`)}
        finally{busy=false;saveButton.disabled=false}
        return;
      }
      const date=modal.querySelector("#f-date").value;
      if(!date) return alert("Informe a data.");
      const productValue=Number(productsCost.value||0), laborValue=Number(laborCost.value||0);
      const totalPaid=productValue+laborValue;
      const enteredEstimatedMaterial=Number(estMaterial.value||0), enteredEstimatedLabor=Number(estLabor.value||0);
      // Se o usuário não informar nova previsão, preserva o custo real recém-lançado
      // como base das próximas repetições da manutenção.
      const estimatedMaterial=(enteredEstimatedMaterial>0 || enteredEstimatedLabor>0) ? enteredEstimatedMaterial : productValue;
      const estimatedLabor=(enteredEstimatedMaterial>0 || enteredEstimatedLabor>0) ? enteredEstimatedLabor : laborValue;
      const estimateKey=item.entity || item.date_entity;
      if (estimateKey) this.financeEstimates[estimateKey]={material:estimatedMaterial,labor:estimatedLabor,updatedAt:new Date().toISOString()};
      const record={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,itemEntity:item.entity,dateEntity:item.date_entity,name:item.name,category:item.category,date,executor:executor.value,provider:modal.querySelector("#f-provider").value.trim(),products:modal.querySelector("#f-products").value.trim(),productsCost:productValue,laborCost:laborValue,paid:totalPaid,marketLabor:Number(marketLabor.value||0),market:Number(marketLabor.value||0)+productValue,saving:Number(saving.value||0),notes:modal.querySelector("#f-notes").value.trim(),estimatedMaterial,estimatedLabor,estimatedTotal:estimatedMaterial+estimatedLabor,createdAt:new Date().toISOString(),schemaVersion:262};
      busy=true;saveButton.disabled=true;
      try {
        await this._setMaintenanceExecutionDate(item, date, record);
        completedRecord=record;
        this.financeRecords.unshift(record);
        if(this.__cpSaveSnapshot) await this.__cpSaveSnapshot(); else this.saveFinanceRecords(); this.annualCache=null; this.recommendationCache.clear(); this.healthEvolutionCache=null;
        if(item.source!=="local") try{await this.h.callService("logbook","log",{name:"Manutenção Residencial",message:`${item.action}: ${item.name} • Produtos ${this.money(record.productsCost)} • Mão de obra ${this.money(record.laborCost)} • Total ${this.money(record.paid)} • Economia ${this.money(record.saving)}`,entity_id:item.date_entity})}catch(_){}
        close(); setTimeout(()=>this.update(),400);
      } catch(error){ alert(completedRecord?`A execução já foi registrada. Falta salvar o financeiro: ${error?.message||error}. Tente salvar novamente.`:`Não foi possível registrar: ${error?.message||error}`); }
      finally{busy=false;saveButton.disabled=false}
    };
    refresh();
  }

  criticalityPolicyDefaults() {
    return {
      "Crítica": {attention_days:30,due_enabled:true,escalation_days:[7,30,90,180],escalation_count:4,mobile_enabled:true,alexa_enabled:true},
      "Importante": {attention_days:30,due_enabled:true,escalation_days:[30],escalation_count:1,mobile_enabled:true,alexa_enabled:true},
      "Baixa": {attention_days:30,due_enabled:true,escalation_days:[90,180],escalation_count:2,mobile_enabled:true,alexa_enabled:true}
    };
  }

  notificationConfigForRegistration() {
    const defaults=this.criticalityPolicyDefaults();
    const raw=(this.__cpSettings&&this.__cpSettings.notifications&&typeof this.__cpSettings.notifications==='object')?this.__cpSettings.notifications:{};
    const policies={};
    for(const name of Object.keys(defaults)) policies[name]={...defaults[name],...((raw.priority_policies||{})[name]||{})};
    return {enabled:Boolean(raw.enabled),priority_policies:policies};
  }

  criticalityPolicySummary(criticality) {
    const cfg=this.notificationConfigForRegistration();
    const p=cfg.priority_policies[criticality]||cfg.priority_policies.Importante;
    const days=Array.isArray(p.escalation_days)?p.escalation_days.slice(0,Number(p.escalation_count||0)):[];
    const before=Number(p.attention_days||0)>0?`${Number(p.attention_days)} dia(s) antes`:'sem antecipação';
    const due=p.due_enabled!==false?'no vencimento':'sem aviso no vencimento';
    const late=days.length?`atrasos em ${days.join(', ')} dia(s)`:'sem lembretes de atraso';
    const total=(Number(p.attention_days||0)>0?1:0)+(p.due_enabled!==false?1:0)+days.length;
    const channels=[p.mobile_enabled!==false?'celular':null,p.alexa_enabled!==false?'Alexa':null].filter(Boolean).join(' + ')||'nenhum canal';
    return `Criticidade ${criticality}: ${before} • ${due} • ${late} • máximo ${total} aviso(s) por ciclo • ${channels}.`;
  }

  renderAlertPolicyRegistration(cards) {
    const cfg=this.notificationConfigForRegistration();
    const defaults=this.criticalityPolicyDefaults();
    const specs={"Crítica":['critical','🚨','Maior impacto: alertas mais próximos e escalonamento completo.'],"Importante":['important','⚠️','Impacto intermediário: rotina equilibrada de lembretes.'],"Baixa":['low','🛠️','Baixo impacto: lembretes mais espaçados.']};
    const esc=v=>this.escapeHtml(String(v??''));
    const policyCard=(name)=>{const p=cfg.priority_policies[name]||defaults[name];const [key,icon,caption]=specs[name];return `<article class="cp-policy-card ${key}" data-alert-policy="${key}"><header><span class="cp-policy-icon">${icon}</span><div><b>Criticidade ${name}</b><small>${caption}</small></div></header><div class="cp-policy-fields"><label>Avisar antes do vencimento<small>0 desativa a antecipação.</small><div class="cp-number-unit"><input data-alert-attention="${key}" type="number" min="0" max="3650" value="${Number(p.attention_days||0)}"><span>dias</span></div></label><label class="cp-check"><input data-alert-due="${key}" type="checkbox" ${p.due_enabled!==false?'checked':''}> Avisar no vencimento</label><label>Marcos de atraso<small>Separe por vírgula. Ex.: 7, 30, 90, 180.</small><input data-alert-days="${key}" value="${esc((p.escalation_days||[]).join(', '))}"></label><label>Qtd. de lembretes após vencer<input data-alert-count="${key}" type="number" min="0" max="12" value="${Number(p.escalation_count||0)}"></label><label class="cp-check"><input data-alert-mobile="${key}" type="checkbox" ${p.mobile_enabled!==false?'checked':''}> Enviar para celular</label><label class="cp-check"><input data-alert-alexa="${key}" type="checkbox" ${p.alexa_enabled!==false?'checked':''}> Anunciar na Alexa</label></div><div class="cp-policy-summary" data-alert-summary="${key}"></div></article>`};
    cards.innerHTML=`<div class="alert-policy-registration"><section class="registration-panel registration-form alert-policy-main"><div class="registration-head"><div><h2>Políticas de alertas por criticidade</h2><p>Estas regras são herdadas automaticamente por todas as manutenções existentes e futuras.</p></div><ha-icon icon="mdi:bell-cog-outline"></ha-icon></div><section class="cp-policy-explainer"><div class="cp-policy-explainer-head"><ha-icon icon="mdi:information-outline"></ha-icon><div><b>Como funciona</b><p>Ao cadastrar uma manutenção você informa a criticidade. O CloudPelizzon usa a política correspondente para definir antecedência, vencimento, quantidade de lembretes e canais de entrega.</p></div></div><div class="cp-policy-flow"><span><b>1</b>Criticidade</span><i>→</i><span><b>2</b>Antecedência</span><i>→</i><span><b>3</b>Vencimento/atraso</span><i>→</i><span><b>✓</b>Celular / Alexa</span></div></section><label class="cp-alert-engine-toggle"><input id="cp-alert-engine-enabled" type="checkbox" ${cfg.enabled?'checked':''}><span><b>Motor automático de avisos ativo</b><small>Ative esta opção para que o CloudPelizzon acompanhe automaticamente os prazos das manutenções e envie os alertas conforme a criticidade e os canais configurados. Se permanecer desativada, suas políticas continuam salvas, mas nenhum aviso automático será enviado.</small></span></label><div class="cp-priority-policy-grid">${policyCard('Crítica')}${policyCard('Importante')}${policyCard('Baixa')}</div><div class="finance-entry-actions cp-alert-actions"><button data-alert-restore><ha-icon icon="mdi:restore"></ha-icon>Restaurar padrão CloudPelizzon</button><button data-alert-advanced><ha-icon icon="mdi:tune-variant"></ha-icon>Configurar canais / Alexa</button><select id="cp-alert-test-criticality"><option>Crítica</option><option selected>Importante</option><option>Baixa</option></select><button data-alert-test><ha-icon icon="mdi:send-check-outline"></ha-icon><span>Testar aviso</span></button><button class="primary" data-alert-save><ha-icon icon="mdi:content-save-check-outline"></ha-icon>Salvar políticas</button></div><div class="cp-alert-test-feedback" data-alert-test-feedback aria-live="polite"></div></section></div>`;
    const keys={critical:'Crítica',important:'Importante',low:'Baixa'};
    const parseDays=(v)=>[...new Set(String(v||'').replaceAll(';',',').split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=1&&x<=3650))].sort((a,b)=>a-b).slice(0,12);
    const readPolicies=()=>Object.fromEntries(Object.entries(keys).map(([key,name])=>{const days=parseDays(cards.querySelector(`[data-alert-days="${key}"]`)?.value);const count=Math.max(0,Math.min(12,Number(cards.querySelector(`[data-alert-count="${key}"]`)?.value||0)));return [name,{attention_days:Math.max(0,Math.min(3650,Number(cards.querySelector(`[data-alert-attention="${key}"]`)?.value||0))),due_enabled:cards.querySelector(`[data-alert-due="${key}"]`)?.checked!==false,escalation_days:days.length?days:[...defaults[name].escalation_days],escalation_count:Math.min(count,days.length||defaults[name].escalation_days.length),mobile_enabled:cards.querySelector(`[data-alert-mobile="${key}"]`)?.checked!==false,alexa_enabled:cards.querySelector(`[data-alert-alexa="${key}"]`)?.checked!==false}];}));
    const update=()=>{const policies=readPolicies();Object.entries(keys).forEach(([key,name])=>{const p=policies[name],active=p.escalation_days.slice(0,p.escalation_count),total=(p.attention_days>0?1:0)+(p.due_enabled?1:0)+active.length,el=cards.querySelector(`[data-alert-summary="${key}"]`);if(el)el.innerHTML=`<b>Resumo:</b> ${p.attention_days>0?`${p.attention_days} dia(s) antes`:'sem antecipação'} • ${p.due_enabled?'avisa no vencimento':'não avisa no vencimento'} • ${active.length?`atrasos em ${active.join(', ')} dia(s)`:'sem escalonamento'} • <strong>máximo ${total} aviso(s) / ciclo</strong>.`;});};
    cards.querySelectorAll('[data-alert-attention],[data-alert-due],[data-alert-days],[data-alert-count],[data-alert-mobile],[data-alert-alexa]').forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update);});
    cards.querySelector('[data-alert-restore]').onclick=()=>{Object.entries(keys).forEach(([key,name])=>{const p=defaults[name];cards.querySelector(`[data-alert-attention="${key}"]`).value=p.attention_days;cards.querySelector(`[data-alert-due="${key}"]`).checked=p.due_enabled;cards.querySelector(`[data-alert-days="${key}"]`).value=p.escalation_days.join(', ');cards.querySelector(`[data-alert-count="${key}"]`).value=p.escalation_count;cards.querySelector(`[data-alert-mobile="${key}"]`).checked=p.mobile_enabled;cards.querySelector(`[data-alert-alexa="${key}"]`).checked=p.alexa_enabled;});update();};
    const save=async()=>{const hass=this.__cpRealHass||this.h;if(!hass?.callWS)throw new Error('WebSocket do Home Assistant indisponível.');const current=(this.__cpSettings?.notifications&&typeof this.__cpSettings.notifications==='object')?this.__cpSettings.notifications:{};const notifications={...current,enabled:cards.querySelector('#cp-alert-engine-enabled')?.checked===true,priority_policies:readPolicies()};const result=await hass.callWS({type:'cloudpelizzon/maintenance/settings/update',notifications});this.__cpSettings=result?.settings||this.__cpSettings;return result;};
    cards.querySelector('[data-alert-save]').onclick=async()=>{try{const r=await save();alert(r?.primed>0?`Políticas salvas. ${r.primed} manutenção(ões) foram usadas como baseline sem alertas retroativos.`:'Políticas de criticidade salvas com sucesso.');this.renderRegistrationDashboard();}catch(e){alert(`Falha ao salvar políticas: ${e?.message||e}`);}};
    cards.querySelector('[data-alert-test]').onclick=async()=>{
      const btn=cards.querySelector('[data-alert-test]'),label=btn?.querySelector('span'),feedback=cards.querySelector('[data-alert-test-feedback]');
      if(this.__cpAlertTestRunning)return;
      this.__cpAlertTestRunning=true;
      if(btn)btn.disabled=true;if(label)label.textContent='Enviando...';
      const criticality=cards.querySelector('#cp-alert-test-criticality')?.value||'Importante';
      if(feedback){feedback.textContent=`Enviando um único teste da criticidade ${criticality}. Aguarde a confirmação.`;feedback.className='cp-alert-test-feedback busy';}
      try{
        await save();
        const hass=this.__cpRealHass||this.h,r=await hass.callWS({type:'cloudpelizzon/maintenance/notifications/test',criticality});
        if(r?.throttled){const wait=Math.max(1,Number(r.retry_after||10));if(feedback){feedback.textContent=`Teste duplicado bloqueado. Aguarde ${wait}s antes de testar novamente.`;feedback.className='cp-alert-test-feedback warn';}}
        else if(r?.delivered){if(feedback){feedback.textContent=`✓ Teste ${criticality} aceito por: ${(r.channels||[]).join(', ')}.`;feedback.className='cp-alert-test-feedback ok';}}
        else if(feedback){feedback.textContent=`Teste ${criticality} sem entrega. ${r?.result||''}`;feedback.className='cp-alert-test-feedback warn';}
      }catch(e){if(feedback){feedback.textContent=`Falha no teste: ${e?.message||e}`;feedback.className='cp-alert-test-feedback error';}}
      finally{setTimeout(()=>{this.__cpAlertTestRunning=false;if(btn)btn.disabled=false;if(label)label.textContent='Testar aviso';},10000);}
    };
    cards.querySelector('[data-alert-advanced]').onclick=()=>{if(typeof this.__cpOpenNotificationSettings==='function')this.__cpOpenNotificationSettings();else if(typeof this.__cpOpenSettings==='function')this.__cpOpenSettings();else alert('Ajustes avançados indisponíveis.');};
    update();
  }

  renderRegistrationDashboard() {
    const summary=this.shadowRoot.querySelector("#summary"),tabs=this.shadowRoot.querySelector("#tabs"),cards=this.shadowRoot.querySelector("#cards");
    const defs=this.allCategoryDefinitions();
    const activeDefs=this.categoryDefinitions();
    const maint=this.allMaintenanceItemsForRegistration();
    const customMaint=this.registrationData.maintenances||[];
    const customCategories=this.registrationData.categories||[];
    summary.innerHTML=`<div class="registration-kpis"><article><ha-icon icon="mdi:shape-outline"></ha-icon><span>Categorias disponíveis<b>${activeDefs.length}</b></span></article><article><ha-icon icon="mdi:tools"></ha-icon><span>Manutenções cadastradas<b>${maint.length}</b></span></article><article><ha-icon icon="mdi:database-check-outline"></ha-icon><span>Cadastros pelo painel<b>${customMaint.length}</b></span></article></div>`;
    tabs.innerHTML=`<div class="registration-toolbar"><div><button class="${this.registrationView==='perfil'?'active':''}" data-reg-view="perfil"><ha-icon icon="mdi:home-city-outline"></ha-icon>Casa/Empresa</button><button class="${this.registrationView==='manutencoes'?'active':''}" data-reg-view="manutencoes"><ha-icon icon="mdi:tools"></ha-icon>Manutenções</button><button class="${this.registrationView==='categorias'?'active':''}" data-reg-view="categorias"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>Categorias</button><button class="${this.registrationView==='alertas'?'active':''}" data-reg-view="alertas"><ha-icon icon="mdi:bell-cog-outline"></ha-icon>Alertas</button></div><small>Cadastre manutenções, criticidade e políticas de aviso em um único local.</small></div>`;
    if(this.registrationView==='perfil'){
      const p=this.houseProfile();
      cards.innerHTML=`<div class="registration-layout profile-registration-layout"><section class="registration-panel registration-form"><div class="registration-head"><div><h2>Casa / Empresa</h2><p>Identidade usada em todos os relatórios e exportações.</p></div><ha-icon icon="mdi:home-city-outline"></ha-icon></div><div class="registration-grid profile-fields"><label>Tipo<select id="profile-type"><option ${p.type==='Casa'?'selected':''}>Casa</option><option ${p.type==='Empresa'?'selected':''}>Empresa</option></select></label><label>Nome da casa / empresa<input id="profile-name" value="${this.escapeHtml(p.name||'')}" placeholder="Minha Casa / Empresa"></label><div class="registration-image-field profile-image-field"><label>Logo por caminho<input id="profile-logo-path" data-image-path value="${String(p.logo||'').startsWith('data:')?'':this.escapeHtml(p.logo||'')}" placeholder="/local/manutencao/logo.png"></label><label class="registration-file-label">Upload da logo<input id="profile-logo-file" data-image-file type="file" accept="image/*"><span><ha-icon icon="mdi:image-plus-outline"></ha-icon>Selecionar arquivo</span></label><div class="registration-image-preview profile-logo-preview"><img data-image-preview alt="Pré-visualização da logo"><button data-clear-image type="button" title="Remover logo"><ha-icon icon="mdi:close"></ha-icon></button></div></div><label>Endereço<input id="profile-address" value="${this.escapeHtml(p.address||'')}"></label><label>Cidade / Estado<input id="profile-city" value="${this.escapeHtml(p.cityState||'')}"></label><label>Documento / identificação<input id="profile-document" value="${this.escapeHtml(p.document||'')}" placeholder="Opcional"></label><label>Responsável / contato<input id="profile-contact" value="${this.escapeHtml(p.contact||'')}"></label><label>Telefone<input id="profile-phone" value="${this.escapeHtml(p.phone||'')}"></label><label>E-mail<input id="profile-email" type="email" value="${this.escapeHtml(p.email||'')}"></label><label class="registration-full">Dados adicionais<textarea id="profile-additional" rows="4" placeholder="Informações complementares para os relatórios">${this.escapeHtml(p.additional||'')}</textarea></label></div><button class="registration-save" data-save-profile><ha-icon icon="mdi:content-save-check-outline"></ha-icon>Salvar Casa/Empresa</button></section><section class="registration-panel profile-preview-panel"><div class="registration-head"><div><h2>Prévia da identidade</h2><p>Aplicada em PDF, Excel, histórico e relatórios.</p></div></div>${this.profileIdentityMarkup(false)}</section></div>`;
    }else if(this.registrationView==='alertas'){
      this.renderAlertPolicyRegistration(cards);
    }else if(this.registrationView==='categorias'){
      cards.innerHTML=`<div class="registration-layout"><section class="registration-panel registration-form"><div class="registration-head"><div><h2>Nova categoria</h2><p>Crie uma classificação para organizar manutenções e relatórios.</p></div><ha-icon icon="mdi:shape-plus-outline"></ha-icon></div><div class="registration-grid"><label>Nome<input id="reg-cat-name" placeholder="Ex.: Piscina"></label><label>Ícone/emoji<input id="reg-cat-icon" maxlength="4" value="🛠️"></label><label>Cor<input id="reg-cat-color" type="color" value="#35b9ff"></label><div class="registration-image-field registration-full"><label>Imagem do cabeçalho por caminho<input id="reg-cat-image-path" data-image-path placeholder="/local/manutencao/07_piscina.png"></label><label class="registration-file-label">Importar imagem do cabeçalho<input id="reg-cat-image-file" data-image-file type="file" accept="image/*"><span><ha-icon icon="mdi:image-plus-outline"></ha-icon>Selecionar imagem</span></label><div class="registration-image-preview category-header-preview"><img data-category-image-preview alt="Prévia do cabeçalho"><button data-clear-category-image type="button" title="Remover imagem"><ha-icon icon="mdi:close"></ha-icon></button></div></div></div><button class="registration-save" data-save-category><ha-icon icon="mdi:content-save-plus-outline"></ha-icon>Salvar categoria</button></section><section class="registration-panel"><div class="registration-head"><div><h2>Categorias cadastradas</h2><p>Todas podem ser excluídas desta visualização.</p></div><b>${defs.filter(c=>!this.isCategoryDeleted(c.name)).length}</b></div><div class="registration-list">${defs.filter(c=>!this.isCategoryDeleted(c.name)).map(c=>`<article><i class="category-list-icon" style="--category-color:${c.color||'#35b9ff'};--category-thumb:url(&quot;${this.escapeHtml(c.headerImage||this.categoryHeaderImage(c.name)||'')}&quot;)">${c.icon}</i><span><b>${this.escapeHtml(c.name)}</b><small>${customCategories.some(x=>x.name===c.name)?'Personalizada':'Padrão do sistema'}</small></span><button data-edit-category="${this.escapeHtml(c.originalName||c.name)}" title="Editar categoria"><ha-icon icon="mdi:pencil-outline"></ha-icon></button><button data-delete-category="${this.escapeHtml(c.originalName||c.name)}" title="Excluir categoria"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button></article>`).join('')}</div></section></div>`;
    }else{
      cards.innerHTML=`<div class="registration-layout maintenance-registration"><section class="registration-panel registration-form"><div class="registration-head"><div><h2>Nova manutenção</h2><p>Cadastre ciclo, previsão financeira e dados operacionais.</p></div><ha-icon icon="mdi:tools"></ha-icon></div><div class="registration-grid maintenance-fields"><label>Nome<input id="reg-name" placeholder="Ex.: Limpeza da piscina"></label><label>Categoria<select id="reg-category">${activeDefs.map(c=>`<option>${this.escapeHtml(c.name)}</option>`).join('')}</select></label><label>Criticidade<select id="reg-criticality"><option>Importante</option><option>Crítica</option><option>Baixa</option></select><small>Define a política automática de alertas desta manutenção.</small></label><label>Ciclo em dias<input id="reg-cycle" type="number" min="1" value="365"></label><label>Última execução<input id="reg-last" type="date"></label><label class="cp-check"><input id="reg-notify-enabled" type="checkbox" checked> Avisos automáticos pela criticidade</label><div class="registration-auto-notice" id="reg-notify-policy"></div><div class="registration-image-field"><label>Imagem por caminho<input id="reg-image" data-image-path placeholder="/local/manutencao/imagem.png"></label><label class="registration-file-label">Anexar imagem<input id="reg-image-file" data-image-file type="file" accept="image/*"><span><ha-icon icon="mdi:image-plus-outline"></ha-icon>Selecionar arquivo</span></label><div class="registration-image-preview"><img data-image-preview alt="Pré-visualização"><button data-clear-image type="button" title="Remover imagem"><ha-icon icon="mdi:close"></ha-icon></button></div></div><label>Material previsto (R$)<input id="reg-material" type="number" min="0" step="0.01" value="0"></label><label>Mão de obra prevista (R$)<input id="reg-labor" type="number" min="0" step="0.01" value="0"></label></div><button class="registration-save" data-save-maintenance><ha-icon icon="mdi:content-save-plus-outline"></ha-icon>Salvar manutenção</button></section><section class="registration-panel"><div class="registration-head"><div><h2>Todas as manutenções</h2><p>Itens do Home Assistant e itens criados pelo painel.</p></div><b>${maint.length}</b></div><div class="registration-list maintenance-list">${maint.length?maint.map(m=>`<article><i>${this.icon(m.category)}</i><span><b>${this.escapeHtml(m.name)}</b><small>${this.escapeHtml(m.category)} • ${this.formatCycle(m.cycleDays)} • Criticidade ${this.escapeHtml(m.criticality||m.priority||'Importante')} • ${m.source==='local'?'Criada pelo painel':'Home Assistant'}</small></span><button data-edit-maintenance-key="${this.escapeHtml(m.registrationKey)}" data-edit-maintenance-source="${m.source}" data-edit-maintenance-id="${m.id||''}" title="Editar"><ha-icon icon="mdi:pencil-outline"></ha-icon></button><button data-delete-maintenance-key="${this.escapeHtml(m.registrationKey)}" data-delete-maintenance-source="${m.source}" data-delete-maintenance-id="${m.id||''}" title="Excluir da visualização"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button></article>`).join(''):'<div class="registration-empty"><ha-icon icon="mdi:database-plus-outline"></ha-icon><p>Nenhuma manutenção ativa.</p></div>'}</div></section></div>`;
    }
    tabs.querySelectorAll('[data-reg-view]').forEach(b=>b.onclick=()=>{this.registrationView=b.dataset.regView;this.renderRegistrationDashboard()});
    const profileImage=this.registrationView==='perfil'?this.bindRegistrationImagePicker(cards,{fileSelector:'#profile-logo-file',pathSelector:'#profile-logo-path',previewSelector:'[data-image-preview]',clearSelector:'[data-clear-image]',initialImage:this.houseProfile().logo||''}):null;
    const categoryImage=this.registrationView==='categorias'?this.bindRegistrationImagePicker(cards,{fileSelector:'#reg-cat-image-file',pathSelector:'#reg-cat-image-path',previewSelector:'[data-category-image-preview]',clearSelector:'[data-clear-category-image]'}):null;
    cards.querySelector('[data-save-profile]')?.addEventListener('click',()=>{
      const name=cards.querySelector('#profile-name')?.value.trim(); if(!name)return alert('Informe o nome da casa ou empresa.');
      this.registrationData.profile={type:cards.querySelector('#profile-type')?.value||'Casa',name,logo:profileImage?.value()||'',address:cards.querySelector('#profile-address')?.value.trim()||'',cityState:cards.querySelector('#profile-city')?.value.trim()||'',document:cards.querySelector('#profile-document')?.value.trim()||'',contact:cards.querySelector('#profile-contact')?.value.trim()||'',phone:cards.querySelector('#profile-phone')?.value.trim()||'',email:cards.querySelector('#profile-email')?.value.trim()||'',additional:cards.querySelector('#profile-additional')?.value.trim()||'',updatedAt:new Date().toISOString()};
      this.saveRegistrationData();this.renderRegistrationDashboard();
    });
    cards.querySelector('[data-save-category]')?.addEventListener('click',()=>{
      const name=cards.querySelector('#reg-cat-name').value.trim(),icon=cards.querySelector('#reg-cat-icon').value.trim()||'🛠️',color=cards.querySelector('#reg-cat-color').value;
      if(!name)return alert('Informe o nome da categoria.');
      if(defs.some(x=>this.slug(x.name)===this.slug(name)))return alert('Esta categoria já existe.');
      this.registrationData.categories.push({name,icon,color,headerImage:categoryImage?.value()||"",createdAt:new Date().toISOString()});this.saveRegistrationData();this.render();
    });
    cards.querySelectorAll('[data-delete-category]').forEach(b=>b.onclick=()=>{
      const name=b.dataset.deleteCategory;
      const resolved=this.resolvedCategoryName(name);const linked=this.allMaintenanceItemsForRegistration().filter(m=>m.category===name||m.category===resolved||m.originalCategory===name);
      const text=linked.length?`Excluir a categoria ${name} e também ocultar ${linked.length} manutenção(ões) vinculada(s) neste navegador?`:`Excluir a categoria ${name} desta visualização?`;
      if(!confirm(text))return;
      this.registrationData.deletedCategories=this.registrationData.deletedCategories||[];
      if(!this.registrationData.deletedCategories.includes(name))this.registrationData.deletedCategories.push(name);
      linked.forEach(m=>{if(m.source==='local'){
        this.registrationData.maintenances=this.registrationData.maintenances.filter(x=>x.id!==m.id);
        delete this.financeEstimates[`local_maintenance.${m.id}`];
      }else{
        this.registrationData.deletedMaintenances=this.registrationData.deletedMaintenances||[];
        if(!this.registrationData.deletedMaintenances.includes(m.registrationKey))this.registrationData.deletedMaintenances.push(m.registrationKey);
      }});
      this.registrationData.categories=this.registrationData.categories.filter(x=>x.name!==name);
      this.saveFinanceEstimates();this.saveRegistrationData();this.v='geral';this.render();
    });
    const registrationImage = this.registrationView === 'manutencoes' ? this.bindRegistrationImagePicker(cards, {fileSelector:'#reg-image-file',pathSelector:'#reg-image',previewSelector:'[data-image-preview]',clearSelector:'[data-clear-image]'}) : null;
    if(this.registrationView==='manutencoes'){
      const criticalitySelect=cards.querySelector('#reg-criticality'),hint=cards.querySelector('#reg-notify-policy');
      const refreshCriticalityHint=()=>{if(hint&&criticalitySelect)hint.textContent=this.criticalityPolicySummary(criticalitySelect.value);};
      criticalitySelect?.addEventListener('change',refreshCriticalityHint);refreshCriticalityHint();
    }
    cards.querySelector('[data-save-maintenance]')?.addEventListener('click',()=>{
      const name=cards.querySelector('#reg-name').value.trim(); if(!name)return alert('Informe o nome da manutenção.');
      const id=`m_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      this.registrationData.maintenances.push({id,name,category:cards.querySelector('#reg-category').value,criticality:cards.querySelector('#reg-criticality').value,priority:cards.querySelector('#reg-criticality').value,cycleDays:Math.max(1,Number(cards.querySelector('#reg-cycle').value||365)),last:cards.querySelector('#reg-last').value||null,image:registrationImage?.value() || '',estimatedMaterial:Number(cards.querySelector('#reg-material').value||0),estimatedLabor:Number(cards.querySelector('#reg-labor').value||0),notificationsEnabled:cards.querySelector('#reg-notify-enabled')?.checked!==false,notificationPolicy:'auto_criticality',createdAt:new Date().toISOString()});
      this.financeEstimates[`local_maintenance.${id}`]={material:Number(cards.querySelector('#reg-material').value||0),labor:Number(cards.querySelector('#reg-labor').value||0),updatedAt:new Date().toISOString()};this.saveFinanceEstimates();this.saveRegistrationData();this.render();
    });
    cards.querySelectorAll('[data-delete-maintenance-key]').forEach(b=>b.onclick=()=>{
      if(!confirm('Excluir esta manutenção da visualização? O histórico financeiro já lançado será preservado.'))return;
      const key=b.dataset.deleteMaintenanceKey,source=b.dataset.deleteMaintenanceSource,id=b.dataset.deleteMaintenanceId;
      if(source==='local'){
        this.registrationData.maintenances=this.registrationData.maintenances.filter(x=>x.id!==id);
        delete this.financeEstimates[`local_maintenance.${id}`];
        this.favorites.delete(`local_maintenance.${id}`);
      }else{
        this.registrationData.deletedMaintenances=this.registrationData.deletedMaintenances||[];
        if(!this.registrationData.deletedMaintenances.includes(key))this.registrationData.deletedMaintenances.push(key);
        delete this.financeEstimates[key];
        this.favorites.delete(key);
      }
      this.saveFinanceEstimates();this.saveFavorites();this.saveRegistrationData();this.render();
    });
    cards.querySelectorAll('[data-edit-maintenance-key]').forEach(b=>b.onclick=()=>{
      const key=b.dataset.editMaintenanceKey,source=b.dataset.editMaintenanceSource,id=b.dataset.editMaintenanceId;
      const m=source==='local'?customMaint.find(x=>x.id===id):this.allMaintenanceItemsForRegistration().find(x=>x.registrationKey===key);
      if(!m)return;
      this.openMaintenanceRegistrationEditor(m,{source,key});
    });
    cards.querySelectorAll('[data-edit-category]').forEach(b=>b.onclick=()=>{
      const originalName=b.dataset.editCategory;
      const c=this.allCategoryDefinitions().find(x=>(x.originalName||x.name)===originalName);
      if(c)this.openCategoryRegistrationEditor(c);
    });
  }

  openMaintenanceRegistrationEditor(m, context={source:"local",key:null}) {
    const modal=this.shadowRoot.querySelector('#modal'),defs=this.categoryDefinitions();
    modal.innerHTML=`<div class="overlay"><div class="registration-edit-modal"><button class="modal-close" data-close>✕</button><h2>Editar manutenção</h2><div class="registration-grid maintenance-fields"><label>Nome<input id="edit-name" value="${this.escapeHtml(m.name)}"></label><label>Categoria<select id="edit-category">${defs.map(c=>`<option ${c.name===m.category?'selected':''}>${this.escapeHtml(c.name)}</option>`).join('')}</select></label><label>Criticidade<select id="edit-criticality">${['Importante','Crítica','Baixa'].map(x=>`<option ${x===(m.criticality||m.priority)?'selected':''}>${x}</option>`).join('')}</select><small>Define a política de alertas desta manutenção.</small></label><label>Ciclo em dias<input id="edit-cycle" type="number" min="1" value="${m.cycleDays}"></label><label>Última execução<input id="edit-last" type="date" value="${m.last||''}"></label><label class="cp-check"><input id="edit-notify-enabled" type="checkbox" ${m.notificationsEnabled!==false?'checked':''}> Avisos automáticos pela criticidade</label><div class="registration-auto-notice" id="edit-notify-policy"></div><div class="registration-image-field"><label>Imagem por caminho<input id="edit-image" data-image-path value="${String(m.image||'').startsWith('data:')?'':this.escapeHtml(m.image||'')}"></label><label class="registration-file-label">Anexar nova imagem<input id="edit-image-file" data-image-file type="file" accept="image/*"><span><ha-icon icon="mdi:image-plus-outline"></ha-icon>Selecionar arquivo</span></label><div class="registration-image-preview"><img data-image-preview alt="Pré-visualização"><button data-clear-image type="button" title="Remover imagem"><ha-icon icon="mdi:close"></ha-icon></button></div></div><label>Material previsto<input id="edit-material" type="number" min="0" step="0.01" value="${Number(m.estimatedMaterial||0).toFixed(2)}"></label><label>Mão de obra prevista<input id="edit-labor" type="number" min="0" step="0.01" value="${Number(m.estimatedLabor||0).toFixed(2)}"></label></div><div class="finance-entry-actions"><button data-cancel>Cancelar</button><button class="primary" data-save>Salvar alterações</button></div></div></div>`;
    const close=()=>modal.innerHTML='';modal.querySelector('[data-close]').onclick=close;modal.querySelector('[data-cancel]').onclick=close;modal.querySelector('.overlay').onclick=e=>{if(e.target.classList.contains('overlay'))close()};
    const editImage = this.bindRegistrationImagePicker(modal, {fileSelector:'#edit-image-file',pathSelector:'#edit-image',previewSelector:'[data-image-preview]',clearSelector:'[data-clear-image]',initialImage:m.image||''});
    const editCriticality=modal.querySelector('#edit-criticality'),editHint=modal.querySelector('#edit-notify-policy');
    const refreshEditCriticalityHint=()=>{if(editHint&&editCriticality)editHint.textContent=this.criticalityPolicySummary(editCriticality.value);};
    editCriticality?.addEventListener('change',refreshEditCriticalityHint);refreshEditCriticalityHint();
    modal.querySelector('[data-save]').onclick=async()=>{
      const values={
        name:modal.querySelector('#edit-name').value.trim()||m.name,
        category:modal.querySelector('#edit-category').value,
        criticality:modal.querySelector('#edit-criticality').value,priority:modal.querySelector('#edit-criticality').value,
        cycleDays:Math.max(1,Number(modal.querySelector('#edit-cycle').value||365)),
        last:modal.querySelector('#edit-last').value||null,
        image:editImage.value(),
        estimatedMaterial:Number(modal.querySelector('#edit-material').value||0),
        estimatedLabor:Number(modal.querySelector('#edit-labor').value||0),
        notificationsEnabled:modal.querySelector('#edit-notify-enabled')?.checked!==false,
        notificationPolicy:'auto_criticality',
        updatedAt:new Date().toISOString()
      };
      if(context.source==='local'){
        Object.assign(m,values);
        this.financeEstimates[`local_maintenance.${m.id}`]={material:values.estimatedMaterial,labor:values.estimatedLabor,updatedAt:values.updatedAt};
      }else{
        const key=context.key || m.registrationKey || m.entity;
        this.registrationData.maintenanceOverrides=this.registrationData.maintenanceOverrides||{};
        this.registrationData.maintenanceOverrides[key]=values;
        this.financeEstimates[key]={material:values.estimatedMaterial,labor:values.estimatedLabor,updatedAt:values.updatedAt};
        if(values.last && m.date_entity && this.h?.states?.[m.date_entity]){
          try{
            const attrs=this.h.states[m.date_entity].attributes||{};
            const data=attrs.has_time?{entity_id:m.date_entity,datetime:`${values.last} 12:00:00`}:{entity_id:m.date_entity,date:values.last};
            await this.h.callService('input_datetime','set_datetime',data);
          }catch(error){console.warn('V249: não foi possível sincronizar a data original',error);}
        }
      }
      this.saveFinanceEstimates();this.saveRegistrationData();close();this.render();
    };
  }

  openCategoryRegistrationEditor(c) {
    const modal=this.shadowRoot.querySelector('#modal');
    const originalName=c.originalName||c.name;
    modal.innerHTML=`<div class="overlay"><div class="registration-edit-modal"><button class="modal-close" data-close>✕</button><h2>Editar categoria</h2><div class="registration-grid"><label>Nome<input id="edit-cat-name" value="${this.escapeHtml(c.name)}"></label><label>Ícone/emoji<input id="edit-cat-icon" maxlength="4" value="${this.escapeHtml(c.icon||'🛠️')}"></label><label>Cor<input id="edit-cat-color" type="color" value="${this.escapeHtml(c.color||'#35b9ff')}"></label><div class="registration-image-field registration-full"><label>Imagem do cabeçalho por caminho<input id="edit-cat-image-path" data-image-path value="${String(c.headerImage||'').startsWith('data:')?'':this.escapeHtml(c.headerImage||'')}"></label><label class="registration-file-label">Importar nova imagem<input id="edit-cat-image-file" data-image-file type="file" accept="image/*"><span><ha-icon icon="mdi:image-plus-outline"></ha-icon>Selecionar imagem</span></label><div class="registration-image-preview category-header-preview"><img data-edit-category-preview alt="Prévia"><button data-clear-edit-category-image type="button"><ha-icon icon="mdi:close"></ha-icon></button></div></div></div><div class="finance-entry-actions"><button data-cancel>Cancelar</button><button class="primary" data-save>Salvar alterações</button></div></div></div>`;
    const close=()=>modal.innerHTML='';
    const categoryEditImage=this.bindRegistrationImagePicker(modal,{fileSelector:'#edit-cat-image-file',pathSelector:'#edit-cat-image-path',previewSelector:'[data-edit-category-preview]',clearSelector:'[data-clear-edit-category-image]',initialImage:c.headerImage||this.categoryHeaderImage(c.name)||''});
    modal.querySelector('[data-close]').onclick=close;modal.querySelector('[data-cancel]').onclick=close;modal.querySelector('.overlay').onclick=e=>{if(e.target.classList.contains('overlay'))close()};
    modal.querySelector('[data-save]').onclick=()=>{
      const name=modal.querySelector('#edit-cat-name').value.trim();
      if(!name)return alert('Informe o nome da categoria.');
      const icon=modal.querySelector('#edit-cat-icon').value.trim()||'🛠️';
      const color=modal.querySelector('#edit-cat-color').value||'#35b9ff';
      const headerImage=categoryEditImage?.value()||'';
      const custom=this.registrationData.categories.find(x=>x.name===originalName);
      if(custom){custom.name=name;custom.icon=icon;custom.color=color;custom.headerImage=headerImage;}
      else{
        this.registrationData.categoryOverrides=this.registrationData.categoryOverrides||{};
        this.registrationData.categoryOverrides[originalName]={name,icon,color,headerImage,updatedAt:new Date().toISOString()};
      }
      // Atualiza as manutenções locais vinculadas e overrides já existentes.
      (this.registrationData.maintenances||[]).forEach(m=>{if(m.category===originalName||m.category===c.name)m.category=name;});
      Object.values(this.registrationData.maintenanceOverrides||{}).forEach(ov=>{if(ov.category===originalName||ov.category===c.name)ov.category=name;});
      if(this.financeCategory===originalName||this.financeCategory===c.name)this.financeCategory=name;
      this.saveRegistrationData();close();this.render();
    };
  }

  renderFinanceDashboard(items) {
    this.financeView = this.financeView || "painel";
    const summary=this.shadowRoot.querySelector("#summary"), tabs=this.shadowRoot.querySelector("#tabs"), cards=this.shadowRoot.querySelector("#cards");
    const categories=["Todas",...this.categoryDefinitions().map(x=>x.name)];
    const num=(r,k)=>Number(r?.[k]||0);
    const normalized=(this.financeRecords||[]).map(r=>{
      const products=num(r,"productsCost");
      const labor=Number((r.laborCost ?? (r.productsCost==null ? r.paid : 0)) || 0);
      return {...r,productsCost:products,laborCost:labor,paid:products+labor};
    });
    const period=this.financePeriod();
    const periodLabel=`${period.startDate.toLocaleDateString("pt-BR")} a ${period.endDisplay.toLocaleDateString("pt-BR")}`;
    const inPeriod=date=>String(date||"")>=period.start&&String(date||"")<=period.end;
    const periodRecords=normalized.filter(r=>inPeriod(r.date));
    const filtered=periodRecords.filter(r=>this.financeCategory==="Todas"||r.category===this.financeCategory);
    const paid=filtered.reduce((s,r)=>s+num(r,"paid"),0);
    const saving=filtered.reduce((s,r)=>s+num(r,"saving"),0);
    const productsTotal=filtered.reduce((s,r)=>s+num(r,"productsCost"),0);
    const laborTotal=filtered.reduce((s,r)=>s+num(r,"laborCost"),0);
    const balance=saving-paid;
    const diy=filtered.filter(r=>(r.executor && !["Empresa / profissional","Misto"].includes(r.executor))).length;
    const avg=filtered.length?paid/filtered.length:0;
    const periodMonthsForProjection=Math.max(1,this.financePeriodMonths().length);
    const annualProjection=paid/periodMonthsForProjection*12;
    const market=filtered.reduce((s,r)=>s+num(r,"marketLabor"),0);
    const now=new Date();
    const provisionWindow=this.provisionWindow(now);
    const rollingMonths=this.rollingProvisionMonths(now);
    const rollingMonthIndex=new Map(rollingMonths.map((month,index)=>[month.key,index]));
    const scheduledProvision=this.provisionSchedule(items,this.financeStartDate,this.financeEndDate,this.financeCategory);
    const provisionTotal=scheduledProvision.reduce((s,x)=>s+x.estimate.total,0);
    const provisionMaterial=scheduledProvision.reduce((s,x)=>s+x.estimate.material,0);
    const provisionLabor=scheduledProvision.reduce((s,x)=>s+x.estimate.labor,0);
    const visibleProvision=scheduledProvision.slice(0,5);
    const visibleProvisionSubtotal=visibleProvision.reduce((sum,row)=>sum+row.estimate.total,0);
    const hiddenProvisionCount=Math.max(0,scheduledProvision.length-visibleProvision.length);
    // A cobertura da provisão considera toda a carteira filtrada, e não apenas
    // as manutenções que possuem ao menos uma ocorrência dentro do período selecionado.
    const provisionCoverageItems=(items||[]).filter(item=>
      (this.financeCategory==="Todas"||item.category===this.financeCategory) &&
      this.maintenanceOccursInFinancePeriod(item)
    );
    const provisionedCoverageItems=provisionCoverageItems.filter(item=>this.estimateFor(item).total>0);
    const unprovisionedItems=provisionCoverageItems.filter(item=>this.estimateFor(item).total<=0);
    const provisionedCoverageCount=provisionedCoverageItems.length;
    const unprovisionedCount=unprovisionedItems.length;
    const periodMonths=this.financePeriodMonths();
    const periodMonthIndex=new Map(periodMonths.map((month,index)=>[month.key,index]));
    const monthNames=periodMonths.map(month=>month.label);
    const fullMonths=periodMonths.map(month=>month.fullLabel);
    const monthly=periodMonths.map((month,m)=>({m,key:month.key,label:month.label,fullLabel:month.fullLabel,paid:0,saving:0,products:0,labor:0,count:0}));
    filtered.forEach(r=>{const key=String(r.date||"").slice(0,7);const m=periodMonthIndex.get(key);if(m!==undefined&&monthly[m]){monthly[m].paid+=num(r,"paid");monthly[m].saving+=num(r,"saving");monthly[m].products+=num(r,"productsCost");monthly[m].labor+=num(r,"laborCost");monthly[m].count++}});
    const provisionMonthly=periodMonths.map((month,m)=>({m,key:month.key,label:month.label,fullLabel:month.fullLabel,total:0,material:0,labor:0,count:0}));
    scheduledProvision.forEach(x=>{const m=rollingMonthIndex.get(x.monthKey);if(m!==undefined&&provisionMonthly[m]){provisionMonthly[m].total+=x.estimate.total;provisionMonthly[m].material+=x.estimate.material;provisionMonthly[m].labor+=x.estimate.labor;provisionMonthly[m].count++}});
    const maxFlow=Math.max(1,...monthly.flatMap(x=>[x.paid,x.saving]),...provisionMonthly.map(x=>x.total));
    const cumulativePaid=monthly.map((_,i)=>monthly.slice(0,i+1).reduce((s,v)=>s+v.paid,0));
    const cumulativeSaving=monthly.map((_,i)=>monthly.slice(0,i+1).reduce((s,v)=>s+v.saving,0));
    const cumulativeProvision=provisionMonthly.map((_,i)=>provisionMonthly.slice(0,i+1).reduce((s,v)=>s+v.total,0));
    const maxAnnual=Math.max(1,...cumulativePaid,...cumulativeSaving,...cumulativeProvision);
    const cats=this.categoryDefinitions().map(def=>def.name).map(cat=>{const real=periodRecords.filter(r=>r.category===cat), prov=this.provisionSchedule(items,this.financeStartDate,this.financeEndDate,cat);return{cat,paid:real.reduce((s,r)=>s+num(r,"paid"),0),saving:real.reduce((s,r)=>s+num(r,"saving"),0),provision:prov.reduce((s,x)=>s+x.estimate.total,0),count:real.length}});
    const maxCat=Math.max(1,...cats.flatMap(x=>[x.paid,x.provision]));
    const provisionCategoryTotal=cats.reduce((sum,row)=>sum+row.provision,0);
    const provisionMonthlyTotal=provisionMonthly.reduce((sum,row)=>sum+row.total,0);
    const auditTolerance=0.01;
    const provisionOccurrenceTotal=scheduledProvision.reduce((sum,row)=>sum+Number(row.estimate?.total||0),0);
    const provisionAuditOk=
      Math.abs((provisionMaterial+provisionLabor)-provisionTotal)<=auditTolerance&&
      Math.abs(provisionOccurrenceTotal-provisionTotal)<=auditTolerance&&
      Math.abs(provisionMonthlyTotal-provisionTotal)<=auditTolerance&&
      Math.abs(provisionCategoryTotal-provisionTotal)<=auditTolerance;
    if(!provisionAuditOk)console.warn('Manutenção V256: divergência de provisão detectada',{
      windowStart:provisionWindow.start.toISOString(),windowEndExclusive:provisionWindow.endExclusive.toISOString(),
      total:provisionTotal,occurrences:provisionOccurrenceTotal,material:provisionMaterial,labor:provisionLabor,
      monthly:provisionMonthlyTotal,categories:provisionCategoryTotal,rows:scheduledProvision.length
    });
    const topExpense=[...filtered].sort((a,b)=>b.paid-a.paid)[0];
    const topSaving=[...filtered].sort((a,b)=>b.saving-a.saving)[0];
    const statusCounts={ok:provisionCoverageItems.filter(i=>i.state==="Em dia").length,warning:provisionCoverageItems.filter(i=>i.state==="Atenção").length,danger:provisionCoverageItems.filter(i=>i.state==="Vencido").length,total:provisionCoverageItems.length};
    const activeLabel=this.financeCategory==="Todas"?"Todas as categorias":this.financeCategory;
    const trendScopeItems=(items||[]).filter(item=>this.financeCategory==="Todas"||item.category===this.financeCategory);
    const costTrends=this.costTrendSummary(trendScopeItems);
    const reportComparisonRows=trendScopeItems.map(item=>{
      const history=this.financeRecordsForItem(item).filter(record=>!this.financeEndDate||String(record.date||"")<=this.financeEndDate);
      const last=history.length?history[history.length-1]:null;
      const previous=history.length>1?history[history.length-2]:null;
      const estimate=this.estimateFor(item);
      const previousValue=Number(previous?.paid||0),lastValue=Number(last?.paid||0),nextValue=Number(estimate?.total||0);
      const lastDifference=previous?lastValue-previousValue:null;
      const lastPercentage=previous&&previousValue>0?(lastDifference/previousValue)*100:null;
      const nextDifference=last?nextValue-lastValue:null;
      const nextPercentage=last&&lastValue>0?(nextDifference/lastValue)*100:null;
      return {item,previous,last,estimate,previousValue,lastValue,nextValue,lastDifference,lastPercentage,nextDifference,nextPercentage};
    }).filter(row=>row.last||row.nextValue>0).sort((a,b)=>String(a.item.name).localeCompare(String(b.item.name),'pt-BR'));
    const providerMap=new Map();
    filtered.forEach(record=>{
      const provider=(record.provider||"").trim()||(((record.executor||"").trim() && !["Empresa / profissional","Misto"].includes((record.executor||"").trim()))?"Execução própria":((record.executor||"").trim()||"Não informado"));
      if(!providerMap.has(provider))providerMap.set(provider,{provider,count:0,materials:0,labor:0,total:0,lastDate:"",maintenances:new Set()});
      const row=providerMap.get(provider);
      row.count++;row.materials+=Number(record.productsCost||0);row.labor+=Number(record.laborCost||0);row.total+=Number(record.paid||0);
      if(String(record.date||"")>row.lastDate)row.lastDate=String(record.date||"");
      row.maintenances.add(record.name||"Manutenção");
    });
    const providerRows=[...providerMap.values()].map(row=>({...row,average:row.count?row.total/row.count:0,maintenances:[...row.maintenances].sort((a,b)=>a.localeCompare(b,'pt-BR'))})).sort((a,b)=>b.total-a.total||a.provider.localeCompare(b.provider,'pt-BR'));
    const providerServiceRows=[...filtered].sort((a,b)=>String(a.provider||a.executor||'').localeCompare(String(b.provider||b.executor||''),'pt-BR')||String(b.date||'').localeCompare(String(a.date||''))).map(record=>{const provider=(record.provider||'').trim()||(((record.executor||'').trim() && !['Empresa / profissional','Misto'].includes((record.executor||'').trim()))?'Execução própria':((record.executor||'').trim()||'Não informado'));return {...record,providerLabel:provider};});
    const providerServiceTotals=providerServiceRows.reduce((acc,row)=>{acc.materials+=Number(row.productsCost||0);acc.labor+=Number(row.laborCost||0);acc.total+=Number(row.paid||0);acc.saving+=Number(row.saving||0);return acc;},{materials:0,labor:0,total:0,saving:0});
    const profile=this.houseProfile();
    const indicatorPage=Number(this.financeIndicatorPage||0);
    const ring=(value,total,cls,label)=>{const pct=total>0?Math.round(value/total*100):0;return `<div class="exec-ring ${cls}" style="--p:${Math.min(100,pct)}"><span><b>${pct}%</b><small>${label}</small></span></div>`};

    summary.innerHTML=`<div class="v241-kpi-row">
      <article class="v241-kpi expense"><ha-icon icon="mdi:wallet-outline"></ha-icon><div><small>Gasto realizado</small><b>${this.money(paid)}</b><em>${filtered.length} lançamento(s)</em></div></article>
      <article class="v241-kpi saving"><ha-icon icon="mdi:piggy-bank-outline"></ha-icon><div><small>Economia realizada</small><b>${this.money(saving)}</b><em>${market?`${Math.round(saving/Math.max(1,market)*100)}% da mão de obra`:"Economia comprovada"}</em></div></article>
      <article class="v241-kpi products"><ha-icon icon="mdi:cart-outline"></ha-icon><div><small>Materiais realizados</small><b>${this.money(productsTotal)}</b><em>${paid?Math.round(productsTotal/paid*100):0}% do desembolso</em></div></article>
      <article class="v241-kpi labor"><ha-icon icon="mdi:account-hard-hat-outline"></ha-icon><div><small>Mão de obra realizada</small><b>${this.money(laborTotal)}</b><em>${paid?Math.round(laborTotal/paid*100):0}% do desembolso</em></div></article>
      <article class="v241-kpi balance"><ha-icon icon="mdi:scale-balance"></ha-icon><div><small>Saldo econômico</small><b>${this.money(balance)}</b><em>economia − gasto</em></div></article>
      <article class="v241-kpi provision"><ha-icon icon="mdi:calendar-clock-outline"></ha-icon><div><small>Provisão no período</small><b>${this.money(provisionTotal)}</b><em>${scheduledProvision.length} ocorrência(s) • ${periodLabel}</em></div></article>
    </div>`;

    tabs.innerHTML=`<div class="finance-toolbar-v241"><div class="finance-view-tabs"><button data-fin-view="painel" class="${this.financeView==='painel'?'active':''}"><ha-icon icon="mdi:view-dashboard"></ha-icon>Painel</button><button data-fin-view="relatorios" class="${this.financeView==='relatorios'?'active':''}"><ha-icon icon="mdi:chart-box-outline"></ha-icon>Relatórios</button><button data-fin-view="historico" class="${this.financeView==='historico'?'active':''}"><ha-icon icon="mdi:history"></ha-icon>Histórico</button></div><div class="finance-tools-v241"><label class="finance-date-filter"><small>De</small><input type="date" id="finance-start-date" value="${this.financeStartDate}"><ha-icon class="finance-calendar-icon" icon="mdi:calendar-month"></ha-icon></label><label class="finance-date-filter"><small>Até</small><input type="date" id="finance-end-date" value="${this.financeEndDate}"><ha-icon class="finance-calendar-icon" icon="mdi:calendar-month"></ha-icon></label><select id="finance-category">${categories.map(c=>`<option ${this.financeCategory===c?'selected':''}>${c}</option>`).join('')}</select><button data-clear-finance title="Limpar categoria"><ha-icon icon="mdi:filter-remove-outline"></ha-icon>Todas</button><button data-current-year title="Usar ano atual"><ha-icon icon="mdi:calendar-today"></ha-icon>Ano atual</button><button data-next-12-months title="Próximos 12 meses"><ha-icon icon="mdi:calendar-range"></ha-icon>12 meses</button><button data-new-finance class="primary"><ha-icon icon="mdi:plus"></ha-icon>Novo lançamento</button><button data-export-excel><ha-icon icon="mdi:file-excel-outline"></ha-icon>Excel</button><button data-report-finance><ha-icon icon="mdi:file-pdf-box"></ha-icon>PDF</button><button data-backup-finance><ha-icon icon="mdi:database-export-outline"></ha-icon>Backup</button></div></div>`;

    const panelMarkup=`<div class="finance-executive-v241">
      <section class="finance-panel v241-flow"><div class="finance-panel-head"><h3>FLUXO FINANCEIRO MENSAL <small>— realizado, economia e provisão futura</small></h3><div class="finance-legend"><span class="paid">● Realizado</span><span class="saving">● Economia</span><span class="provision">● Provisão</span></div></div><div class="v241-month-chart" style="--period-month-count:${monthly.length}">${monthly.map((x,index)=>`<div class="v241-month" title="${x.fullLabel} • Realizado ${this.money(x.paid)} • Economia ${this.money(x.saving)} • Provisão ${this.money(provisionMonthly[index].total)}"><div><i class="paid" style="--h:${x.paid/maxFlow*100}%"></i><i class="saving" style="--h:${x.saving/maxFlow*100}%"></i><i class="provision" style="--h:${provisionMonthly[index].total/maxFlow*100}%"></i></div><span>${x.label}</span></div>`).join('')}</div></section>
      <section class="finance-panel v241-composition"><div class="finance-panel-head"><h3>COMPOSIÇÃO DO DESEMBOLSO <small>— materiais e mão de obra</small></h3></div><div class="v241-composition-body">${ring(productsTotal,Math.max(1,paid),'products','Materiais')}${ring(laborTotal,Math.max(1,paid),'labor','Mão de obra')}</div><div class="v241-composition-values"><span><i class="products"></i>Materiais<b>${this.money(productsTotal)}</b></span><span><i class="labor"></i>Mão de obra<b>${this.money(laborTotal)}</b></span></div></section>
      <section class="finance-panel v241-provision-chart"><div class="finance-panel-head"><h3>DISTRIBUIÇÃO DA PROVISÃO <small>— ${periodLabel}</small></h3></div><div class="v241-provision-bars" style="--period-month-count:${provisionMonthly.length}">${provisionMonthly.map(x=>`<div title="${x.fullLabel} • ${x.count} manutenção(ões) • ${this.money(x.total)}"><b>${x.total?Number(x.total || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }):'0'}</b><i style="--h:${x.total/Math.max(1,...provisionMonthly.map(v=>v.total))*100}%"></i><span>${x.label}</span></div>`).join('')}</div><div class="v241-provision-summary"><span>Materiais<b>${this.money(provisionMaterial)}</b></span><span>Mão de obra<b>${this.money(provisionLabor)}</b></span><span class="total">Total provisão<b>${this.money(provisionTotal)}</b></span></div></section>
      <section class="finance-panel v241-categories"><div class="finance-panel-head"><h3>GASTOS POR CATEGORIA <small>— realizado versus provisão</small></h3><button data-clear-finance-inline>Todas</button></div><div class="v241-category-list">${cats.map(x=>`<button data-fin-cat="${x.cat}" class="${this.financeCategory===x.cat?'active':''}"><span>${this.icon(x.cat)} <b>${x.cat}</b></span><div><i class="paid" style="--w:${x.paid/maxCat*100}%"></i><i class="provision" style="--w:${x.provision/maxCat*100}%"></i></div><em><u>${this.money(x.paid)}</u><u>${this.money(x.provision)}</u></em></button>`).join('')}</div></section>
      <section class="finance-panel v241-indicators"><div class="finance-panel-head indicator-carousel-head"><h3>${indicatorPage===0?'INDICADORES FINANCEIROS <small>— eficiência e impacto</small>':'TENDÊNCIA DE CUSTOS <small>— último real versus próxima previsão</small>'}</h3><div class="indicator-carousel-controls"><button data-indicator-prev title="Página anterior"><ha-icon icon="mdi:chevron-left"></ha-icon></button><span><i class="${indicatorPage===0?'active':''}"></i><i class="${indicatorPage===1?'active':''}"></i></span><button data-indicator-next title="Próxima página"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div></div>${indicatorPage===0?`<div class="v241-indicator-grid">${ring(saving,Math.max(1,market),'saving','Economia')}${ring(diy,Math.max(1,filtered.length),'diy','Feito por você')}<article><ha-icon icon="mdi:calculator"></ha-icon><b>${this.money(avg)}</b><small>Custo médio</small></article><article><ha-icon icon="mdi:calendar-arrow-right"></ha-icon><b>${this.money(annualProjection)}</b><small>Projeção anual</small></article><article class="wide expense"><small>Maior despesa</small><b>${topExpense?this.escapeHtml(topExpense.name):'Sem dados'}</b><em>${this.money(topExpense?.paid||0)}</em></article><article class="wide saving"><small>Maior economia</small><b>${topSaving?this.escapeHtml(topSaving.name):'Sem dados'}</b><em>${this.money(topSaving?.saving||0)}</em></article></div>`:`<div class="cost-trend-page"><div class="cost-trend-counts"><article class="up"><ha-icon icon="mdi:trending-up"></ha-icon><b>${costTrends.counts.up}</b><small>Subiram</small></article><article class="stable"><ha-icon icon="mdi:minus"></ha-icon><b>${costTrends.counts.stable}</b><small>Estáveis</small></article><article class="down"><ha-icon icon="mdi:trending-down"></ha-icon><b>${costTrends.counts.down}</b><small>Reduziram</small></article><article class="none"><ha-icon icon="mdi:help-circle-outline"></ha-icon><b>${costTrends.counts.none}</b><small>Sem comparação</small></article></div><div class="cost-trend-highlights"><button data-cost-trend-item="${costTrends.biggestIncrease?.item?.entity||''}" class="increase" ${costTrends.biggestIncrease?'':'disabled'}><small>Maior aumento</small><b>${costTrends.biggestIncrease?this.escapeHtml(costTrends.biggestIncrease.item.name):'Sem dados'}</b><em>${costTrends.biggestIncrease?`+${costTrends.biggestIncrease.percentage.toFixed(1)}% • +${this.money(costTrends.biggestIncrease.difference)}`:'—'}</em></button><button data-cost-trend-item="${costTrends.biggestReduction?.item?.entity||''}" class="reduction" ${costTrends.biggestReduction?'':'disabled'}><small>Maior redução</small><b>${costTrends.biggestReduction?this.escapeHtml(costTrends.biggestReduction.item.name):'Sem dados'}</b><em>${costTrends.biggestReduction?`${costTrends.biggestReduction.percentage.toFixed(1)}% • ${this.money(costTrends.biggestReduction.difference)}`:'—'}</em></button></div></div>`}</section>
      <section class="finance-panel v241-next"><div class="finance-panel-head"><h3>PRÓXIMAS DESPESAS PREVISTAS <small>— materiais e mão de obra</small></h3><button data-view-all-provisions>Ver todas →</button></div><div class="v241-next-list">${visibleProvision.map(x=>`<button data-provision-item="${x.item.entity}"><span class="v244-next-icon">${this.icon(x.item.category)}</span><div class="v244-next-line"><b>${this.escapeHtml(x.item.name)}</b><small>— ${x.item.category}: ${this.fmt(x.date)}</small><em>— Mat: ${this.money(x.estimate.material)}</em><em>— MO: ${this.money(x.estimate.labor)}</em><strong>— ${this.money(x.estimate.total)}</strong></div></button>`).join('')||'<div class="finance-empty-mini">Nenhuma previsão cadastrada.</div>'}</div><footer><span>Mostrando ${visibleProvision.length} de ${scheduledProvision.length} ocorrência(s)${hiddenProvisionCount?` • ${hiddenProvisionCount} oculta(s)`:''}</span><b>Subtotal exibido: ${this.money(visibleProvisionSubtotal)}</b></footer></section>
      <section class="finance-panel v241-year"><div class="finance-panel-head"><h3>EVOLUÇÃO DO PERÍODO <small>— <i class="legend-real"></i> Realizado <i class="legend-saving"></i> Economia <i class="legend-forecast"></i> Provisão</small></h3></div><svg viewBox="0 0 600 150" preserveAspectRatio="none"><polyline class="real" points="${cumulativePaid.map((value,i)=>`${monthly.length===1?300:(i/(monthly.length-1))*594+3},${145-(value/maxAnnual*135)}`).join(' ')}"></polyline><polyline class="saving" points="${cumulativeSaving.map((value,i)=>`${monthly.length===1?300:(i/(monthly.length-1))*594+3},${145-(value/maxAnnual*135)}`).join(' ')}"></polyline><polyline class="forecast" points="${cumulativeProvision.map((value,i)=>`${monthly.length===1?300:(i/(monthly.length-1))*594+3},${145-(value/maxAnnual*135)}`).join(' ')}"></polyline></svg><div class="v241-year-labels" style="--period-month-count:${monthly.length}">${monthly.map(m=>`<span>${m.label}</span>`).join('')}</div></section>
      <section class="finance-panel v241-status"><div class="finance-panel-head"><h3>SITUAÇÃO DAS MANUTENÇÕES <small>— ocorrências no período</small></h3></div><div class="v241-status-grid"><article class="ok"><b>${String(statusCounts.ok).padStart(2,'0')}</b><span>Em dia</span><small>${Math.round(statusCounts.ok/Math.max(1,statusCounts.total)*100)}%</small></article><article class="warning"><b>${String(statusCounts.warning).padStart(2,'0')}</b><span>Atenção</span><small>${Math.round(statusCounts.warning/Math.max(1,statusCounts.total)*100)}%</small></article><article class="danger"><b>${String(statusCounts.danger).padStart(2,'0')}</b><span>Vencidas</span><small>${Math.round(statusCounts.danger/Math.max(1,statusCounts.total)*100)}%</small></article><article class="info"><b>${String(statusCounts.total).padStart(2,'0')}</b><span>Total</span><small>manutenções</small></article></div></section>
      <section class="finance-panel v241-provision-resume"><div class="finance-panel-head"><h3>RESUMO DA PROVISÃO <small>— cobertura da carteira no período${provisionAuditOk?" • valores conciliados":" • revisar divergência"}</small></h3></div><div class="v241-provision-resume-grid"><span><ha-icon icon="mdi:calendar-check"></ha-icon><b>${provisionedCoverageCount}</b><small>Provisionadas</small></span><span class="pending ${unprovisionedCount?'has-pending':''}" title="${unprovisionedCount} manutenção(ões) ainda sem valor previsto"><ha-icon icon="mdi:calendar-question"></ha-icon><b>${unprovisionedCount}</b><small>Faltam provisionar</small></span><span><ha-icon icon="mdi:cart-outline"></ha-icon><b>${this.money(provisionMaterial)}</b><small>Materiais</small></span><span><ha-icon icon="mdi:account-hard-hat-outline"></ha-icon><b>${this.money(provisionLabor)}</b><small>Mão de obra</small></span><span class="total"><b>${this.money(provisionTotal)}</b><small>Total previsto</small></span></div></section>
    </div>`;

    const reportComparisonBody=reportComparisonRows.map(row=>{
      const previousProvider=row.previous?.provider||row.previous?.executor||"—";
      const lastProvider=row.last?.provider||row.last?.executor||"—";
      const lastVariation=row.previous?`${row.lastDifference>=0?"+":""}${this.money(row.lastDifference)}${row.lastPercentage==null?"":` • ${row.lastPercentage>=0?"+":""}${row.lastPercentage.toFixed(1)}%`}`:"Primeiro registro";
      const nextVariation=row.last&&row.nextValue>0?`${row.nextDifference>=0?"+":""}${this.money(row.nextDifference)}${row.nextPercentage==null?"":` • ${row.nextPercentage>=0?"+":""}${row.nextPercentage.toFixed(1)}%`}`:"Sem comparação";
      const lastSignal=this.trendSignal(row.lastDifference),nextSignal=this.trendSignal(row.nextDifference);
      return `<tr><td><b>${this.escapeHtml(row.item.name)}</b><small>${this.escapeHtml(row.item.category)}</small></td><td>${row.previous?`${this.fmt(row.previous.date)}<small>${this.escapeHtml(previousProvider)}</small>`:"—"}</td><td>${row.previous?this.money(row.previousValue):"—"}</td><td>${row.last?`${this.fmt(row.last.date)}<small>${this.escapeHtml(lastProvider)}</small>`:"—"}</td><td>${row.last?this.money(row.lastValue):"—"}</td><td class="${lastSignal.cls}"><span class="signal-dot"></span>${lastVariation}</td><td>${row.nextValue>0?this.money(row.nextValue):"—"}</td><td class="${nextSignal.cls}"><span class="signal-dot"></span>${nextVariation}</td></tr>`;
    }).join('');
    const providerReportBody=providerServiceRows.map(row=>`<tr><td><b>${this.escapeHtml(row.providerLabel)}</b></td><td>${this.fmt(row.date)}</td><td>${this.escapeHtml(row.name||'Manutenção')}</td><td>${this.money(row.productsCost||0)}</td><td>${this.money(row.laborCost||0)}</td><td><b>${this.money(row.paid||0)}</b></td><td class="saving-text"><b>${this.money(row.saving||0)}</b></td><td>${this.escapeHtml(row.executor||'—')}</td></tr>`).join('');
    const monthlyTotals={events:monthly.reduce((s,x)=>s+x.count,0),materials:monthly.reduce((s,x)=>s+x.products,0),labor:monthly.reduce((s,x)=>s+x.labor,0),paid:monthly.reduce((s,x)=>s+x.paid,0),saving:monthly.reduce((s,x)=>s+x.saving,0),provision:provisionMonthly.reduce((s,x)=>s+x.total,0)};
    monthlyTotals.result=monthlyTotals.saving-monthlyTotals.paid;
    const comparisonTotals=reportComparisonRows.reduce((acc,row)=>{if(row.previous)acc.previous+=row.previousValue;if(row.last)acc.last+=row.lastValue;if(row.lastDifference!=null)acc.historyVariation+=row.lastDifference;if(row.nextValue>0)acc.next+=row.nextValue;if(row.nextDifference!=null)acc.forecastVariation+=row.nextDifference;return acc;},{previous:0,last:0,historyVariation:0,next:0,forecastVariation:0});
    const providerTotals={services:providerServiceRows.length,materials:providerServiceTotals.materials,labor:providerServiceTotals.labor,total:providerServiceTotals.total,saving:providerServiceTotals.saving};
    const categoryReportRows=cats.map(row=>{
      const records=periodRecords.filter(record=>record.category===row.cat);
      return {
        category:row.cat,
        services:records.length,
        materials:records.reduce((sum,record)=>sum+Number(record.productsCost||0),0),
        labor:records.reduce((sum,record)=>sum+Number(record.laborCost||0),0),
        paid:records.reduce((sum,record)=>sum+Number(record.paid||0),0),
        saving:records.reduce((sum,record)=>sum+Number(record.saving||0),0),
        provision:Number(row.provision||0)
      };
    });
    const categoryReportTotals=categoryReportRows.reduce((acc,row)=>{
      acc.services+=row.services;acc.materials+=row.materials;acc.labor+=row.labor;acc.paid+=row.paid;acc.saving+=row.saving;acc.provision+=row.provision;return acc;
    },{services:0,materials:0,labor:0,paid:0,saving:0,provision:0});
    categoryReportTotals.balance=categoryReportTotals.saving-categoryReportTotals.paid;
    const reportPdfButton=type=>`<button data-report-type="${type}" class="report-pdf-button"><ha-icon icon="mdi:file-pdf-box"></ha-icon>Gerar PDF</button>`;
    const reportExcelButton=type=>`<button data-excel-type="${type}" class="report-excel-button"><ha-icon icon="mdi:file-excel-outline"></ha-icon>Gerar Excel</button>`;
    const reportActions=type=>`<div class="report-export-actions">${reportExcelButton(type)}${reportPdfButton(type)}</div>`;
    const launchesRows=filtered.map(r=>`<tr><td>${this.fmt(r.date)}</td><td><b>${this.escapeHtml(r.name)}</b></td><td>${this.escapeHtml(r.category)}</td><td>${this.escapeHtml(r.executor||'—')}</td><td>${this.escapeHtml(r.provider||'—')}</td><td>${this.money(r.productsCost||0)}</td><td>${this.money(r.laborCost||0)}</td><td><b>${this.money(r.paid||0)}</b></td><td class="saving-text">${this.money(r.saving||0)}</td></tr>`).join('');
    const categoryReportBody=categoryReportRows.map(row=>`<tr><td><b>${this.icon(row.category)} ${this.escapeHtml(row.category)}</b></td><td>${row.services}</td><td>${this.money(row.materials)}</td><td>${this.money(row.labor)}</td><td>${this.money(row.paid)}</td><td class="saving-text">${this.money(row.saving)}</td><td>${this.money(row.provision)}</td><td class="${row.saving-row.paid>=0?'saving-text':'expense-text'}">${this.money(row.saving-row.paid)}</td></tr>`).join('');
    const reportMarkup=`<div class="finance-reports-v241 report-grid-v265">
      <section class="finance-panel report-selector-v264"><div><b>CENTRAL DE RELATÓRIOS</b><small>Visualize na tela ou gere o relatório completo e cada visão individual.</small></div><div class="report-selector-actions-v264"><button data-report-type="complete" class="active"><ha-icon icon="mdi:file-document-multiple-outline"></ha-icon>Completo</button><button data-report-type="launches"><ha-icon icon="mdi:format-list-bulleted"></ha-icon>Lançamentos</button><button data-report-type="comparison"><ha-icon icon="mdi:compare-horizontal"></ha-icon>Comparativo</button><button data-report-type="providers"><ha-icon icon="mdi:account-hard-hat-outline"></ha-icon>Empresas</button><button data-report-type="provisions"><ha-icon icon="mdi:calendar-cash"></ha-icon>Provisão</button><button data-report-type="monthly"><ha-icon icon="mdi:calendar-month-outline"></ha-icon>Fechamento mensal</button><button data-report-type="categories"><ha-icon icon="mdi:chart-bar-stacked"></ha-icon>Por categoria</button></div></section>
      <section class="finance-panel report-visual-header report-visual-header-v264"><div class="report-title-identity">${this.profileIdentityMarkup(true)}<div class="report-title-copy-v264"><small>RELATÓRIO FINANCEIRO DE MANUTENÇÕES — ${this.escapeHtml(profile.name)}</small><div class="report-period-compact-v264"><b>${periodLabel}</b><span>${activeLabel}</span></div></div></div><div class="report-header-numbers report-header-numbers-v261"><span class="kpi-gasto">Gasto realizado<b>${this.money(paid)}</b></span><span class="kpi-economia">Economia realizada<b>${this.money(saving)}</b></span><span class="kpi-materiais">Materiais realizados<b>${this.money(productsTotal)}</b></span><span class="kpi-maoobra">Mão de obra realizada<b>${this.money(laborTotal)}</b></span><span class="kpi-provisao">Provisão<b>${this.money(provisionTotal)}</b></span><span class="kpi-saldo">Saldo<b>${this.money(balance)}</b></span></div></section>

      <section class="finance-panel report-card-v265 report-launches-table"><div class="finance-panel-head"><h3>LANÇAMENTOS REALIZADOS <small>— despesas e economias registradas</small></h3>${reportActions('launches')}</div><div class="finance-table-wrap"><table><thead><tr><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Executor</th><th>Empresa / profissional</th><th>Materiais</th><th>Mão de obra</th><th>Total</th><th>Economia</th></tr></thead><tbody>${launchesRows||'<tr><td colspan="9">Nenhum lançamento no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="5">TOTAL • ${filtered.length} lançamento(s)</th><th>${this.money(productsTotal)}</th><th>${this.money(laborTotal)}</th><th>${this.money(paid)}</th><th>${this.money(saving)}</th></tr></tfoot></table></div></section>

      <section class="finance-panel report-card-v265 report-chart-large"><div class="finance-panel-head"><h3>FECHAMENTO MENSAL <small>— realizado, economia e provisão</small></h3>${reportActions('monthly')}</div><div class="finance-table-wrap"><table><thead><tr><th>Mês</th><th>Eventos</th><th>Materiais</th><th>Mão de obra</th><th>Pago</th><th>Economia</th><th>Provisão</th><th>Resultado</th></tr></thead><tbody>${monthly.map((x,index)=>`<tr><td>${x.fullLabel}</td><td>${x.count}</td><td>${this.money(x.products)}</td><td>${this.money(x.labor)}</td><td>${this.money(x.paid)}</td><td class="saving-text">${this.money(x.saving)}</td><td>${this.money(provisionMonthly[index].total)}</td><td class="${x.saving-x.paid>=0?'saving-text':'expense-text'}">${this.money(x.saving-x.paid)}</td></tr>`).join('')}</tbody><tfoot><tr><th>TOTAL</th><th>${monthlyTotals.events}</th><th>${this.money(monthlyTotals.materials)}</th><th>${this.money(monthlyTotals.labor)}</th><th>${this.money(monthlyTotals.paid)}</th><th>${this.money(monthlyTotals.saving)}</th><th>${this.money(monthlyTotals.provision)}</th><th>${this.money(monthlyTotals.result)}</th></tr></tfoot></table></div></section>

      <section class="finance-panel report-card-v265 report-category-table"><div class="finance-panel-head"><h3>RESUMO FINANCEIRO POR CATEGORIA <small>— realizado, economia e provisão</small></h3>${reportActions('categories')}</div><div class="finance-table-wrap"><table><thead><tr><th>Categoria</th><th>Serviços</th><th>Materiais</th><th>Mão de obra</th><th>Pago</th><th>Economia</th><th>Provisão</th><th>Saldo</th></tr></thead><tbody>${categoryReportBody||'<tr><td colspan="8">Nenhuma categoria no filtro.</td></tr>'}</tbody><tfoot><tr><th>TOTAL</th><th>${categoryReportTotals.services}</th><th>${this.money(categoryReportTotals.materials)}</th><th>${this.money(categoryReportTotals.labor)}</th><th>${this.money(categoryReportTotals.paid)}</th><th>${this.money(categoryReportTotals.saving)}</th><th>${this.money(categoryReportTotals.provision)}</th><th>${this.money(categoryReportTotals.balance)}</th></tr></tfoot></table></div></section>

      <section class="finance-panel report-card-v265 report-comparison-table"><div class="finance-panel-head"><h3>COMPARATIVO DAS ÚLTIMAS MANUTENÇÕES <small>— penúltima, última e próxima previsão</small></h3>${reportActions('comparison')}</div><div class="finance-table-wrap"><table><thead><tr><th>Manutenção</th><th>Penúltima / responsável</th><th>Valor anterior</th><th>Última / responsável</th><th>Último valor</th><th>Variação histórica</th><th>Próxima previsão</th><th>Variação prevista</th></tr></thead><tbody>${reportComparisonBody||'<tr><td colspan="8">Sem histórico suficiente para comparação.</td></tr>'}</tbody><tfoot><tr><th colspan="2">TOTAL</th><th>${this.money(comparisonTotals.previous)}</th><th></th><th>${this.money(comparisonTotals.last)}</th><th>${this.money(comparisonTotals.historyVariation)}</th><th>${this.money(comparisonTotals.next)}</th><th>${this.money(comparisonTotals.forecastVariation)}</th></tr></tfoot></table></div></section>

      <section class="finance-panel report-card-v265 report-provider-table"><div class="finance-panel-head"><h3>COMPARATIVO POR EMPRESA / PROFISSIONAL <small>— cada serviço em uma linha</small></h3>${reportActions('providers')}</div><div class="finance-table-wrap"><table><thead><tr><th>Empresa / responsável</th><th>Data</th><th>Manutenção</th><th>Materiais</th><th>Mão de obra</th><th>Total pago</th><th>Economia</th><th>Executor</th></tr></thead><tbody>${providerReportBody||'<tr><td colspan="8">Nenhuma empresa ou responsável no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="3">TOTAL • ${providerTotals.services} serviço(s)</th><th>${this.money(providerTotals.materials)}</th><th>${this.money(providerTotals.labor)}</th><th>${this.money(providerTotals.total)}</th><th>${this.money(providerTotals.saving)}</th><th></th></tr></tfoot></table></div></section>

      <section class="finance-panel report-card-v265 report-provision-table"><div class="finance-panel-head"><h3>PROVISÃO NO PERÍODO SELECIONADO <small>— programação financeira</small></h3>${reportActions('provisions')}</div><div class="finance-table-wrap"><table><thead><tr><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Materiais</th><th>Mão de obra</th><th>Total</th></tr></thead><tbody>${scheduledProvision.map(x=>`<tr><td>${this.fmt(x.date)}</td><td>${this.escapeHtml(x.item.name)}</td><td>${x.item.category}</td><td>${this.money(x.estimate.material)}</td><td>${this.money(x.estimate.labor)}</td><td><b>${this.money(x.estimate.total)}</b></td></tr>`).join('')||'<tr><td colspan="6">Sem provisões no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="3">TOTAL • ${scheduledProvision.length} ocorrência(s)</th><th>${this.money(provisionMaterial)}</th><th>${this.money(provisionLabor)}</th><th>${this.money(provisionTotal)}</th></tr></tfoot></table></div></section>
    </div>`;

    const historyTotals=filtered.reduce((acc,row)=>{acc.materials+=Number(row.productsCost||0);acc.labor+=Number(row.laborCost||0);acc.paid+=Number(row.paid||0);acc.saving+=Number(row.saving||0);return acc;},{materials:0,labor:0,paid:0,saving:0});
    const historyMarkup=`<div class="finance-dashboard history-dashboard-v266"><section class="finance-panel history-identity-panel">${this.profileIdentityMarkup(true)}</section><section class="finance-panel professional-history professional-history-v266"><div class="finance-panel-head"><h3>HISTÓRICO FINANCEIRO <small>— ${activeLabel} • ${periodLabel}</small></h3><div class="history-head-actions"><strong>${filtered.length}</strong><button data-excel-history class="report-excel-button"><ha-icon icon="mdi:file-excel-outline"></ha-icon>Gerar Excel</button><button data-report-history class="report-pdf-button"><ha-icon icon="mdi:file-pdf-box"></ha-icon>Gerar PDF</button><button data-back-panel class="history-back-button"><ha-icon icon="mdi:arrow-left"></ha-icon>Voltar ao painel</button></div></div><div class="finance-table-wrap history-table-wrap-v266">${filtered.length?`<table class="history-table-v266"><thead><tr><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Executor</th><th>Empresa / profissional</th><th>Produtos / peças</th><th>Materiais</th><th>Mão de obra</th><th>Total</th><th>Economia</th><th>Preço de mercado</th><th>Observações</th><th>Ações</th></tr></thead><tbody>${filtered.map(r=>`<tr><td>${this.fmt(r.date)}</td><td><b>${this.escapeHtml(r.name)}</b></td><td>${this.escapeHtml(r.category)}</td><td>${this.escapeHtml(r.executor||'—')}</td><td>${this.escapeHtml(r.provider||'—')}</td><td>${this.escapeHtml(r.products||'—')}</td><td>${this.money(r.productsCost||0)}</td><td>${this.money(r.laborCost||0)}</td><td><b>${this.money(r.paid)}</b></td><td class="saving-text"><b>${this.money(r.saving)}</b></td><td>${this.money(r.marketLabor||r.market||0)}</td><td class="history-notes-v266">${this.escapeHtml(r.notes||'—')}</td><td><div class="finance-row-actions"><button data-sync-fin="${r.id}" title="Sincronizar manutenção"><ha-icon icon="mdi:calendar-sync"></ha-icon></button><button data-delete-fin="${r.id}" title="Excluir"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button></div></td></tr>`).join('')}</tbody><tfoot><tr><th colspan="6">TOTAL • ${filtered.length} lançamento(s)</th><th>${this.money(historyTotals.materials)}</th><th>${this.money(historyTotals.labor)}</th><th>${this.money(historyTotals.paid)}</th><th>${this.money(historyTotals.saving)}</th><th colspan="3"></th></tr></tfoot></table>`:`<div class="finance-empty"><ha-icon icon="mdi:filter-off-outline"></ha-icon><h3>Nenhum lançamento neste filtro</h3><button data-clear-finance-empty>Mostrar todas as categorias</button></div>`}</div></section></div>`;

    cards.innerHTML=this.financeView==='relatorios'?reportMarkup:this.financeView==='historico'?historyMarkup:panelMarkup;
    const rerender=()=>this.renderFinanceDashboard(items);
    const applyDateFilter=()=>{
      const start=tabs.querySelector('#finance-start-date')?.value;
      const end=tabs.querySelector('#finance-end-date')?.value;
      const normalized=this.normalizeFinancePeriod(start,end);
      this.financeStartDate=normalized.start;
      this.financeEndDate=normalized.end;
      this.saveFinancePeriod();
      rerender();
    };
    tabs.querySelector('#finance-start-date').onchange=applyDateFilter;
    tabs.querySelector('#finance-end-date').onchange=applyDateFilter;
    tabs.querySelector('[data-current-year]').onclick=()=>{const now=new Date();this.financeStartDate=`${now.getFullYear()}-01-01`;this.financeEndDate=`${now.getFullYear()}-12-31`;this.saveFinancePeriod();rerender()};
    tabs.querySelector('[data-next-12-months]').onclick=()=>{const now=new Date();const end=new Date(now.getFullYear(),now.getMonth()+12,now.getDate());this.financeStartDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;this.financeEndDate=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;this.saveFinancePeriod();rerender()};
    tabs.querySelector('#finance-category').onchange=e=>{this.financeCategory=e.target.value;rerender()};
    tabs.querySelectorAll('[data-fin-view]').forEach(b=>b.onclick=()=>{this.financeView=b.dataset.finView;rerender()});
    tabs.querySelector('[data-new-finance]').onclick=()=>this.registerModal(()=>{this.v='financeiro';this.update()});
    tabs.querySelector('[data-export-excel]')?.addEventListener('click',()=>this.exportFinanceExcel(filtered));
    tabs.querySelector('[data-report-finance]').onclick=()=>this.exportFinanceReport(filtered,'complete');
    tabs.querySelector('[data-backup-finance]').onclick=()=>this.exportFinanceBackup();
    const clear=()=>{this.financeCategory='Todas';rerender()};
    tabs.querySelector('[data-clear-finance]').onclick=clear;
    cards.querySelector('[data-clear-finance-inline]')?.addEventListener('click',clear);
    cards.querySelector('[data-clear-finance-empty]')?.addEventListener('click',clear);
    cards.querySelectorAll('[data-fin-cat]').forEach(b=>b.onclick=()=>{this.financeCategory=b.dataset.finCat;rerender()});
    cards.querySelector('[data-indicator-prev]')?.addEventListener('click',()=>{this.financeIndicatorPage=(Number(this.financeIndicatorPage||0)+1)%2;rerender()});
    cards.querySelector('[data-indicator-next]')?.addEventListener('click',()=>{this.financeIndicatorPage=(Number(this.financeIndicatorPage||0)+1)%2;rerender()});
    cards.querySelectorAll('[data-cost-trend-item]').forEach(button=>button.onclick=()=>{const item=items.find(row=>row.entity===button.dataset.costTrendItem);if(item)this.details(item,()=>{this.v='financeiro';this.update()})});
    cards.querySelector('[data-view-all-provisions]')?.addEventListener('click',()=>this.openProvisionScheduleModal(scheduledProvision,provisionTotal,provisionMaterial,provisionLabor));
    cards.querySelectorAll('[data-provision-item]').forEach(b=>b.onclick=()=>{const item=items.find(i=>i.entity===b.dataset.provisionItem);if(item)this.details(item,()=>{this.v='financeiro';this.update()})});
    cards.querySelector('[data-fin-view-short]')?.addEventListener('click',()=>{this.financeView='relatorios';rerender()});
    cards.querySelector('[data-back-panel]')?.addEventListener('click',()=>{this.financeView='painel';rerender()});
    cards.querySelector('[data-report-history]')?.addEventListener('click',()=>this.exportFinanceReport(filtered,'history'));
    cards.querySelector('[data-excel-history]')?.addEventListener('click',event=>this.exportFinanceExcel(filtered,'history',event.currentTarget));
    cards.querySelectorAll('[data-report-type]').forEach(button=>button.addEventListener('click',()=>this.exportFinanceReport(filtered,button.dataset.reportType||'complete')));
    cards.querySelectorAll('[data-excel-type]').forEach(button=>button.addEventListener('click',event=>this.exportFinanceExcel(filtered,button.dataset.excelType||'complete',event.currentTarget)));
    cards.querySelectorAll('[data-sync-fin]').forEach(b=>b.onclick=async()=>{const record=this.financeRecords.find(r=>r.id===b.dataset.syncFin);if(!record)return;b.disabled=true;try{await this._syncFinanceRecordMaintenance(record);alert(`Data de ${record.name} atualizada para ${this.fmt(record.date)}.`)}catch(error){alert(`Não foi possível atualizar a manutenção: ${error?.message||error}`)}finally{b.disabled=false}});
    cards.querySelectorAll('[data-delete-fin]').forEach(b=>b.onclick=()=>{if(confirm('Excluir este lançamento?')){this.financeRecords=this.financeRecords.filter(r=>r.id!==b.dataset.deleteFin);this.saveFinanceRecords();rerender()}});
  }

  exportFinanceReport(rows, reportType="complete") {
    const normalizedRows=(rows||[]).map(record=>this.normalizedFinanceRecord(record));
    const profile=this.houseProfile();
    const total=normalizedRows.reduce((s,r)=>s+Number(r.paid||0),0);
    const saving=normalizedRows.reduce((s,r)=>s+Number(r.saving||0),0);
    const materialsTotal=normalizedRows.reduce((s,r)=>s+Number(r.productsCost||0),0);
    const laborTotal=normalizedRows.reduce((s,r)=>s+Number(r.laborCost||0),0);
    const provisions=this.provisionSchedule(this.items(),this.financeStartDate,this.financeEndDate,this.financeCategory);
    const provisionMaterial=provisions.reduce((s,x)=>s+Number(x.estimate.material||0),0);
    const provisionLabor=provisions.reduce((s,x)=>s+Number(x.estimate.labor||0),0);
    const provisionTotal=provisions.reduce((s,x)=>s+Number(x.estimate.total||0),0);
    const formatDateHyphen=value=>{const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return match?`${match[3]}-${match[2]}-${match[1]}`:String(value||'—')};
    const launchBody=normalizedRows.map(r=>`<tr><td>${this.fmt(r.date)}</td><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.category)}</td><td>${this.escapeHtml(r.executor)}</td><td>${this.escapeHtml(r.provider||"—")}</td><td>${this.money(r.productsCost||0)}</td><td>${this.money(r.laborCost||0)}</td><td>${this.money(r.paid)}</td><td>${this.money(r.saving)}</td></tr>`).join("");
    const historyBody=normalizedRows.map(r=>`<tr><td>${this.fmt(r.date)}</td><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.category)}</td><td>${this.escapeHtml(r.executor||"—")}</td><td>${this.escapeHtml(r.provider||"—")}</td><td>${this.escapeHtml(r.products||"—")}</td><td>${this.money(r.productsCost||0)}</td><td>${this.money(r.laborCost||0)}</td><td>${this.money(r.paid||0)}</td><td>${this.money(r.saving||0)}</td><td>${this.money(r.marketLabor||r.market||0)}</td><td>${this.escapeHtml(r.notes||"—")}</td></tr>`).join("");
    const scopeItems=this.items().filter(item=>this.financeCategory==="Todas"||item.category===this.financeCategory);
    const comparisonRows=scopeItems.map(item=>{
      const history=this.financeRecordsForItem(item).filter(record=>!this.financeEndDate||String(record.date||"")<=this.financeEndDate);
      const last=history.length?history[history.length-1]:null,previous=history.length>1?history[history.length-2]:null,estimate=this.estimateFor(item);
      const previousValue=Number(previous?.paid||0),lastValue=Number(last?.paid||0),nextValue=Number(estimate?.total||0);
      return {item,previous,last,estimate,previousValue,lastValue,nextValue,lastDifference:previous?lastValue-previousValue:null,nextDifference:last?nextValue-lastValue:null};
    }).filter(row=>row.last||row.nextValue>0).sort((a,b)=>String(a.item.name).localeCompare(String(b.item.name),'pt-BR'));
    const comparisonBody=comparisonRows.map(row=>{
      const previousProvider=row.previous?.provider||row.previous?.executor||"—",lastProvider=row.last?.provider||row.last?.executor||"—";
      const historyVariation=row.lastDifference==null?"Primeiro registro":`${row.lastDifference>=0?"+":""}${this.money(row.lastDifference)}`;
      const forecastVariation=row.nextDifference==null?"Sem comparação":`${row.nextDifference>=0?"+":""}${this.money(row.nextDifference)}`;
      const historySignal=this.trendSignal(row.lastDifference),forecastSignal=this.trendSignal(row.nextDifference);
      return `<tr><td>${this.escapeHtml(row.item.name)}</td><td>${row.previous?this.fmt(row.previous.date):"—"}</td><td>${this.escapeHtml(previousProvider)}</td><td>${row.previous?this.money(row.previousValue):"—"}</td><td>${row.last?this.fmt(row.last.date):"—"}</td><td>${this.escapeHtml(lastProvider)}</td><td>${row.last?this.money(row.lastValue):"—"}</td><td class="${historySignal.cls}"><span class="signal-dot"></span>${historyVariation}</td><td>${row.nextValue>0?this.money(row.nextValue):"—"}</td><td class="${forecastSignal.cls}"><span class="signal-dot"></span>${forecastVariation}</td></tr>`;
    }).join("");
    const comparisonTotals=comparisonRows.reduce((acc,row)=>{if(row.previous)acc.previous+=row.previousValue;if(row.last)acc.last+=row.lastValue;if(row.lastDifference!=null)acc.history+=row.lastDifference;if(row.nextValue>0)acc.next+=row.nextValue;if(row.nextDifference!=null)acc.forecast+=row.nextDifference;return acc;},{previous:0,last:0,history:0,next:0,forecast:0});
    const providerRows=normalizedRows.map(record=>{
      const provider=(record.provider||"").trim()||(((record.executor||"").trim() && !["Empresa / profissional","Misto"].includes((record.executor||"").trim()))?"Execução própria":((record.executor||"").trim()||"Não informado"));
      return {...record,providerLabel:provider};
    }).sort((a,b)=>String(a.providerLabel).localeCompare(String(b.providerLabel),'pt-BR')||String(b.date||'').localeCompare(String(a.date||'')));
    const providerBody=providerRows.map(row=>`<tr><td>${this.escapeHtml(row.providerLabel)}</td><td>${this.fmt(row.date)}</td><td>${this.escapeHtml(row.name||'Manutenção')}</td><td>${this.money(row.productsCost||0)}</td><td>${this.money(row.laborCost||0)}</td><td>${this.money(row.paid||0)}</td><td>${this.money(row.saving||0)}</td><td>${this.escapeHtml(row.executor||'—')}</td></tr>`).join("");
    const providerTotals=providerRows.reduce((acc,row)=>{acc.materials+=Number(row.productsCost||0);acc.labor+=Number(row.laborCost||0);acc.total+=Number(row.paid||0);acc.saving+=Number(row.saving||0);return acc;},{count:providerRows.length,materials:0,labor:0,total:0,saving:0});
    const provisionBody=provisions.map(x=>`<tr><td>${this.fmt(x.date)}</td><td>${this.escapeHtml(x.item.name)}</td><td>${this.escapeHtml(x.item.category)}</td><td>${this.money(x.estimate.material)}</td><td>${this.money(x.estimate.labor)}</td><td>${this.money(x.estimate.total)}</td></tr>`).join("");

    const months=this.financePeriodMonths();
    const monthMap=new Map(months.map((m,i)=>[m.key,i]));
    const monthly=months.map(m=>({label:m.fullLabel,count:0,materials:0,labor:0,paid:0,saving:0,provision:0}));
    normalizedRows.forEach(r=>{const i=monthMap.get(String(r.date||'').slice(0,7));if(i!==undefined){monthly[i].count++;monthly[i].materials+=Number(r.productsCost||0);monthly[i].labor+=Number(r.laborCost||0);monthly[i].paid+=Number(r.paid||0);monthly[i].saving+=Number(r.saving||0)}});
    provisions.forEach(p=>{const i=monthMap.get(String(p.date||'').slice(0,7));if(i!==undefined)monthly[i].provision+=Number(p.estimate?.total||0)});
    const monthlyTotals=monthly.reduce((a,m)=>{a.count+=m.count;a.materials+=m.materials;a.labor+=m.labor;a.paid+=m.paid;a.saving+=m.saving;a.provision+=m.provision;return a;},{count:0,materials:0,labor:0,paid:0,saving:0,provision:0});
    const monthlyBody=monthly.map(m=>`<tr><td>${this.escapeHtml(m.label)}</td><td>${m.count}</td><td>${this.money(m.materials)}</td><td>${this.money(m.labor)}</td><td>${this.money(m.paid)}</td><td>${this.money(m.saving)}</td><td>${this.money(m.provision)}</td><td>${this.money(m.saving-m.paid)}</td></tr>`).join('');

    const categoryRows=this.categoryDefinitions().map(def=>def.name).filter(cat=>this.financeCategory==='Todas'||cat===this.financeCategory).map(category=>{
      const realized=normalizedRows.filter(r=>r.category===category);
      const categoryProvisions=provisions.filter(p=>p.item?.category===category);
      return {category,count:realized.length,materials:realized.reduce((s,r)=>s+Number(r.productsCost||0),0),labor:realized.reduce((s,r)=>s+Number(r.laborCost||0),0),paid:realized.reduce((s,r)=>s+Number(r.paid||0),0),saving:realized.reduce((s,r)=>s+Number(r.saving||0),0),provision:categoryProvisions.reduce((s,p)=>s+Number(p.estimate?.total||0),0)};
    });
    const categoryTotals=categoryRows.reduce((a,r)=>{a.count+=r.count;a.materials+=r.materials;a.labor+=r.labor;a.paid+=r.paid;a.saving+=r.saving;a.provision+=r.provision;return a;},{count:0,materials:0,labor:0,paid:0,saving:0,provision:0});
    const categoryBody=categoryRows.map(r=>`<tr><td>${this.escapeHtml(r.category)}</td><td>${r.count}</td><td>${this.money(r.materials)}</td><td>${this.money(r.labor)}</td><td>${this.money(r.paid)}</td><td>${this.money(r.saving)}</td><td>${this.money(r.provision)}</td><td>${this.money(r.saving-r.paid)}</td></tr>`).join('');

    const sections={
      history:`<section class="report-section"><h2>Histórico financeiro detalhado</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Executor</th><th>Empresa / profissional</th><th>Produtos / peças</th><th>Materiais</th><th>Mão de obra</th><th>Total</th><th>Economia</th><th>Preço de mercado</th><th>Observações</th></tr></thead><tbody>${historyBody||'<tr><td colspan="12">Sem lançamentos no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="6">TOTAL • ${normalizedRows.length} lançamento(s)</th><th>${this.money(materialsTotal)}</th><th>${this.money(laborTotal)}</th><th>${this.money(total)}</th><th>${this.money(saving)}</th><th colspan="2"></th></tr></tfoot></table></div></section>`,
      launches:`<section class="report-section"><h2>Lançamentos realizados</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Executor</th><th>Empresa / profissional</th><th>Materiais</th><th>Mão de obra</th><th>Total</th><th>Economia</th></tr></thead><tbody>${launchBody||'<tr><td colspan="9">Sem lançamentos no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="5">TOTAL</th><th>${this.money(materialsTotal)}</th><th>${this.money(laborTotal)}</th><th>${this.money(total)}</th><th>${this.money(saving)}</th></tr></tfoot></table></div></section>`,
      comparison:`<section class="report-section"><h2>Comparativo das últimas manutenções</h2><div class="table-wrap"><table><thead><tr><th>Manutenção</th><th>Penúltima data</th><th>Responsável anterior</th><th>Valor anterior</th><th>Última data</th><th>Último responsável</th><th>Último valor</th><th>Variação histórica</th><th>Próxima previsão</th><th>Variação prevista</th></tr></thead><tbody>${comparisonBody||'<tr><td colspan="10">Sem histórico suficiente.</td></tr>'}</tbody><tfoot><tr><th colspan="3">TOTAL</th><th>${this.money(comparisonTotals.previous)}</th><th colspan="2"></th><th>${this.money(comparisonTotals.last)}</th><th>${this.money(comparisonTotals.history)}</th><th>${this.money(comparisonTotals.next)}</th><th>${this.money(comparisonTotals.forecast)}</th></tr></tfoot></table></div></section>`,
      providers:`<section class="report-section"><h2>Comparativo por empresa / profissional</h2><div class="table-wrap"><table><thead><tr><th>Empresa / responsável</th><th>Data</th><th>Manutenção</th><th>Materiais</th><th>Mão de obra</th><th>Total pago</th><th>Economia</th><th>Executor</th></tr></thead><tbody>${providerBody||'<tr><td colspan="8">Sem empresas ou responsáveis no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="3">TOTAL • ${providerTotals.count} serviço(s)</th><th>${this.money(providerTotals.materials)}</th><th>${this.money(providerTotals.labor)}</th><th>${this.money(providerTotals.total)}</th><th>${this.money(providerTotals.saving)}</th><th></th></tr></tfoot></table></div></section>`,
      provisions:`<section class="report-section"><h2>Provisão no período selecionado</h2><div class="table-wrap"><table><thead><tr><th>Previsão</th><th>Manutenção</th><th>Categoria</th><th>Materiais</th><th>Mão de obra</th><th>Total</th></tr></thead><tbody>${provisionBody||'<tr><td colspan="6">Sem provisões no filtro.</td></tr>'}</tbody><tfoot><tr><th colspan="3">TOTAL</th><th>${this.money(provisionMaterial)}</th><th>${this.money(provisionLabor)}</th><th>${this.money(provisionTotal)}</th></tr></tfoot></table></div></section>`,
      monthly:`<section class="report-section"><h2>Fechamento mensal</h2><div class="table-wrap"><table><thead><tr><th>Mês</th><th>Eventos</th><th>Materiais</th><th>Mão de obra</th><th>Pago</th><th>Economia</th><th>Provisão</th><th>Resultado</th></tr></thead><tbody>${monthlyBody||'<tr><td colspan="8">Sem dados no período.</td></tr>'}</tbody><tfoot><tr><th>TOTAL</th><th>${monthlyTotals.count}</th><th>${this.money(monthlyTotals.materials)}</th><th>${this.money(monthlyTotals.labor)}</th><th>${this.money(monthlyTotals.paid)}</th><th>${this.money(monthlyTotals.saving)}</th><th>${this.money(monthlyTotals.provision)}</th><th>${this.money(monthlyTotals.saving-monthlyTotals.paid)}</th></tr></tfoot></table></div></section>`,
      categories:`<section class="report-section"><h2>Resumo financeiro por categoria</h2><div class="table-wrap"><table><thead><tr><th>Categoria</th><th>Serviços</th><th>Materiais</th><th>Mão de obra</th><th>Pago</th><th>Economia</th><th>Provisão</th><th>Saldo</th></tr></thead><tbody>${categoryBody||'<tr><td colspan="8">Sem categorias no filtro.</td></tr>'}</tbody><tfoot><tr><th>TOTAL</th><th>${categoryTotals.count}</th><th>${this.money(categoryTotals.materials)}</th><th>${this.money(categoryTotals.labor)}</th><th>${this.money(categoryTotals.paid)}</th><th>${this.money(categoryTotals.saving)}</th><th>${this.money(categoryTotals.provision)}</th><th>${this.money(categoryTotals.saving-categoryTotals.paid)}</th></tr></tfoot></table></div></section>`
    };
    const reportNames={complete:'Relatório completo',history:'Histórico financeiro detalhado',launches:'Lançamentos realizados',comparison:'Comparativo das últimas manutenções',providers:'Comparativo por empresa / profissional',provisions:'Provisão no período',monthly:'Fechamento mensal',categories:'Resumo por categoria'};
    const selected=reportType==='complete'?['launches','comparison','providers','provisions','monthly','categories']:[sections[reportType]?reportType:'launches'];
    const reportContent=selected.map(key=>sections[key]).join('');
    const w=window.open("","_blank","width=1300,height=900"); if(!w)return alert("O navegador bloqueou a abertura do relatório.");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${this.escapeHtml(reportNames[reportType]||reportNames.complete)} — ${this.escapeHtml(profile.name)}</title><style>
      @page{size:A4 landscape;margin:9mm}html,body,*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}body{font:12px Arial;color:#17202a;margin:24px;background:#fff}h1{margin:0;font-size:22px}.report-brand{display:flex;align-items:center;gap:14px}.report-logo{width:58px;height:58px;border:1px solid #cbd7df;border-radius:10px;display:grid;place-items:center;overflow:hidden;background:#f8fbfc}.report-logo img{width:100%;height:100%;object-fit:contain}.report-logo span{font-size:28px}.brand-details{display:flex;flex-direction:column;gap:3px}.brand-details small{color:#65727c}h2{margin-top:24px;border-bottom:2px solid #149454;padding-bottom:6px;font-size:18px}header{border-bottom:3px solid #149454;padding-bottom:15px;margin-bottom:18px}.meta{color:#667;margin-top:7px}.report-kind{display:inline-block;margin-top:6px;padding:4px 8px;background:#eef8f2;border:1px solid #9ac7aa;border-radius:6px;color:#17683a;font-weight:700}.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:14px 0}.kpis div{border:1px solid #d7e0e6;border-left:5px solid #8796a3;border-radius:8px;padding:8px 9px;min-width:0}.kpis small{display:block;color:#53606b;font-size:8px}.kpis b{font-size:14px;display:block;margin-top:4px;white-space:nowrap}.kpi-gasto{background:#fff1f1!important;border-left-color:#dc6b72!important}.kpi-economia{background:#eefcf4!important;border-left-color:#55ad7a!important}.kpi-materiais{background:#edf8ff!important;border-left-color:#55a9d8!important}.kpi-maoobra{background:#f6f0ff!important;border-left-color:#9270c7!important}.kpi-saldo{background:#fff7ea!important;border-left-color:#d69b52!important}.kpi-provisao{background:#fffbe8!important;border-left-color:#cfb333!important}.report-section{page-break-before:auto}.table-wrap{overflow-x:auto;margin-bottom:18px}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th,td{padding:7px;border-bottom:1px solid #dce3e8;text-align:left;vertical-align:top}th{background:#eef4f6!important;white-space:nowrap}tfoot th,tfoot td{background:#eaf4ef!important;font-weight:700;border-top:2px solid #79a98d}.signal-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;border:1px solid #9aa7af}.signal-up{background:#fff4f1!important}.signal-up .signal-dot{background:#d99a86}.signal-down{background:#f1faf5!important}.signal-down .signal-dot{background:#8ebda2}.signal-stable{background:#fffbea!important}.signal-stable .signal-dot{background:#cab86e}.signal-none{background:#f3f5f7!important}.signal-none .signal-dot{background:#b7c0c7}footer{margin-top:24px;color:#667;font-size:11px}@media print{html,body,*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}button{display:none}body{margin:0;font-size:8.5px;background:#fff!important}h2{page-break-after:avoid}.table-wrap{overflow:visible}.kpis{grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}.kpis div{padding:6px}.kpis b{font-size:11px}}
    </style></head><body><header><div class="report-brand"><div class="report-logo">${profile.logo?`<img src="${this.escapeHtml(profile.logo)}" alt="Logo">`:`<span>🏠</span>`}</div><div class="brand-details"><h1>Relatório Financeiro de Manutenções — ${this.escapeHtml(profile.name)}</h1><small>${this.escapeHtml(profile.type||'Casa')}${profile.address?` • ${this.escapeHtml(profile.address)}`:''}${profile.cityState?` • ${this.escapeHtml(profile.cityState)}`:''}</small><div class="meta">Período: ${formatDateHyphen(this.financeStartDate)} a ${formatDateHyphen(this.financeEndDate)} • Categoria: ${this.escapeHtml(this.financeCategory)} • Emitido em ${new Date().toLocaleString('pt-BR')}</div><span class="report-kind">${this.escapeHtml(reportNames[reportType]||reportNames.complete)}</span></div></div></header>
    <div class="kpis"><div class="kpi-gasto"><small>Gasto realizado</small><b>${this.money(total)}</b></div><div class="kpi-economia"><small>Economia realizada</small><b>${this.money(saving)}</b></div><div class="kpi-materiais"><small>Materiais realizados</small><b>${this.money(materialsTotal)}</b></div><div class="kpi-maoobra"><small>Mão de obra realizada</small><b>${this.money(laborTotal)}</b></div><div class="kpi-saldo"><small>Saldo econômico</small><b>${this.money(saving-total)}</b></div><div class="kpi-provisao"><small>Provisão no período</small><b>${this.money(provisionTotal)}</b></div></div>
    ${reportContent}<footer>${this.escapeHtml(profile.name)} • Gerado pelo Sistema de Manutenções Preventivas.${profile.additional?` • ${this.escapeHtml(profile.additional)}`:''}</footer><script>setTimeout(()=>window.print(),300)<\/script></body></html>`);w.document.close();
  }

  exportFinanceBackup() {
    const payload={version:271,exportedAt:new Date().toISOString(),profile:this.houseProfile(),records:this.financeRecords.map(r=>({...r,otherCost:undefined})),estimates:this.financeEstimates,registrationData:this.registrationData};
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})); a.download=`backup_manutencoes_financeiro_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  openProvisionScheduleModal(rows=[], total=0, material=0, labor=0) {
    const modal=this.shadowRoot.querySelector("#modal");
    if(!modal)return;
    let accumulated=0;
    const body=(rows||[]).map((row,index)=>{accumulated+=Number(row.estimate?.total||0);return `<tr><td>${index+1}</td><td>${this.fmt(row.date)}</td><td><b>${this.escapeHtml(row.item?.name||'')}</b></td><td>${this.escapeHtml(row.item?.category||'')}</td><td>${this.money(row.estimate?.material||0)}</td><td>${this.money(row.estimate?.labor||0)}</td><td><b>${this.money(row.estimate?.total||0)}</b></td><td>${this.money(accumulated)}</td></tr>`}).join('');
    modal.innerHTML=`<div class="overlay"><div class="history-modal wide-history provision-all-modal"><div class="modal-head"><div><h2><ha-icon icon="mdi:calendar-cash"></ha-icon> Provisão no período selecionado</h2><p>${rows.length} ocorrência(s), ordenadas por data.</p></div><button data-close>✕</button></div><div class="provision-modal-kpis"><span>Materiais<b>${this.money(material)}</b></span><span>Mão de obra<b>${this.money(labor)}</b></span><span>Total geral<b>${this.money(total)}</b></span></div><div class="finance-table-wrap"><table><thead><tr><th>#</th><th>Data</th><th>Manutenção</th><th>Categoria</th><th>Materiais</th><th>Mão de obra</th><th>Total</th><th>Acumulado</th></tr></thead><tbody>${body||'<tr><td colspan="8">Nenhuma provisão cadastrada.</td></tr>'}</tbody><tfoot><tr><th colspan="4">TOTAL CONCILIADO</th><th>${this.money(material)}</th><th>${this.money(labor)}</th><th>${this.money(total)}</th><th>${this.money(total)}</th></tr></tfoot></table></div></div></div>`;
    const close=()=>modal.innerHTML='';
    modal.querySelector('[data-close]')?.addEventListener('click',close);
    modal.querySelector('.overlay')?.addEventListener('click',event=>{if(event.target.classList.contains('overlay'))close()});
  }


  async exportFinanceExcel(rows, reportType="complete", triggerButton=null) {
    const button=triggerButton || this.shadowRoot?.querySelector('[data-export-excel]');
    const original=button?.innerHTML;
    if(button){button.disabled=true;button.innerHTML='<ha-icon icon="mdi:loading" class="spin"></ha-icon>Gerando XLSX';}
    try {
      const p=this.houseProfile();
      const normalized=(rows||[]).map(r=>this.normalizedFinanceRecord(r));
      const provisions=this.provisionSchedule(this.items(),this.financeStartDate,this.financeEndDate,this.financeCategory);
      const total=normalized.reduce((s,r)=>s+Number(r.paid||0),0);
      const saving=normalized.reduce((s,r)=>s+Number(r.saving||0),0);
      const materialsTotal=normalized.reduce((s,r)=>s+Number(r.productsCost||0),0);
      const laborTotal=normalized.reduce((s,r)=>s+Number(r.laborCost||0),0);
      const provisionMaterial=provisions.reduce((s,x)=>s+Number(x.estimate?.material||0),0);
      const provisionLabor=provisions.reduce((s,x)=>s+Number(x.estimate?.labor||0),0);
      const provisionTotal=provisions.reduce((s,x)=>s+Number(x.estimate?.total||0),0);
      const period=`${this.fmt(this.financeStartDate)} a ${this.fmt(this.financeEndDate)}`;
      const category=this.financeCategory||'Todas';
      const emitted=new Date().toLocaleString('pt-BR');
      const scopeItems=this.items().filter(item=>category==='Todas'||item.category===category);

      const comparisons=scopeItems.map(item=>{
        const history=this.financeRecordsForItem(item).filter(record=>!this.financeEndDate||String(record.date||'')<=this.financeEndDate);
        const last=history.length?history[history.length-1]:null;
        const previous=history.length>1?history[history.length-2]:null;
        const estimate=this.estimateFor(item);
        const previousValue=Number(previous?.paid||0),lastValue=Number(last?.paid||0),nextValue=Number(estimate?.total||0);
        return {item,previous,last,previousValue,lastValue,nextValue,lastDifference:previous?lastValue-previousValue:null,nextDifference:last?nextValue-lastValue:null};
      }).filter(r=>r.last||r.nextValue>0).sort((a,b)=>String(a.item.name).localeCompare(String(b.item.name),'pt-BR'));

      const providerRows=normalized.map(record=>({
        ...record,
        providerLabel:(record.provider||'').trim()||(((record.executor||'').trim() && !['Empresa / profissional','Misto'].includes((record.executor||'').trim()))?'Execução própria':((record.executor||'').trim()||'Não informado'))
      })).sort((a,b)=>String(a.providerLabel).localeCompare(String(b.providerLabel),'pt-BR')||String(b.date||'').localeCompare(String(a.date||'')));

      const months=this.financePeriodMonths();
      const monthMap=new Map(months.map((m,i)=>[m.key,i]));
      const monthly=months.map(m=>({label:m.fullLabel,count:0,materials:0,labor:0,paid:0,saving:0,provision:0}));
      normalized.forEach(r=>{const i=monthMap.get(String(r.date||'').slice(0,7));if(i!==undefined){monthly[i].count++;monthly[i].materials+=Number(r.productsCost||0);monthly[i].labor+=Number(r.laborCost||0);monthly[i].paid+=Number(r.paid||0);monthly[i].saving+=Number(r.saving||0)}});
      provisions.forEach(x=>{const i=monthMap.get(String(x.date||'').slice(0,7));if(i!==undefined)monthly[i].provision+=Number(x.estimate?.total||0)});

      const categories=this.categoryDefinitions().map(d=>d.name).filter(c=>category==='Todas'||c===category).map(cat=>{
        const realized=normalized.filter(r=>r.category===cat),planned=provisions.filter(x=>x.item?.category===cat);
        return {category:cat,count:realized.length,materials:realized.reduce((s,r)=>s+Number(r.productsCost||0),0),labor:realized.reduce((s,r)=>s+Number(r.laborCost||0),0),paid:realized.reduce((s,r)=>s+Number(r.paid||0),0),saving:realized.reduce((s,r)=>s+Number(r.saving||0),0),provision:planned.reduce((s,x)=>s+Number(x.estimate?.total||0),0)};
      });

      const moneyStyle=4,totalStyle=6;
      const signal=(difference,first=false)=>{
        if(first||difference==null)return {text:'○ Primeiro registro',style:10};
        if(Math.abs(difference)<.01)return {text:'● Estável',style:9};
        if(difference>0)return {text:'▲ Aumento',style:7};
        return {text:'▼ Redução',style:8};
      };
      const money=v=>({v:Number(v||0),style:moneyStyle});
      const totalMoney=v=>({v:Number(v||0),style:totalStyle});
      const sum=(arr,key)=>arr.reduce((s,r)=>s+Number(r[key]||0),0);

      const sheetSpecs=[];
      sheetSpecs.push({name:'Resumo',title:'Resumo financeiro executivo',headers:['Indicador','Valor','Observação'],rows:[
        ['Gasto realizado',money(total),`${normalized.length} lançamento(s)`],
        ['Economia realizada',money(saving),'Economia comprovada'],
        ['Materiais realizados',money(materialsTotal),'Produtos e peças'],
        ['Mão de obra realizada',money(laborTotal),'Serviços contratados'],
        ['Saldo econômico',money(saving-total),'Economia menos gasto'],
        ['Provisão no período',money(provisionTotal),`${provisions.length} ocorrência(s)`],
        ['Materiais provisionados',money(provisionMaterial),'Previsão do período'],
        ['Mão de obra provisionada',money(provisionLabor),'Previsão do período'],
      ],totals:null,widths:[28,18,42]});

      const launchRows=normalized.map(r=>[this.fmt(r.date),r.name,r.category,r.executor||'—',r.provider||'—',r.products||'—',money(r.productsCost),money(r.laborCost),money(r.paid),money(r.saving),money(r.marketLabor||r.market||0),r.notes||'—']);
      sheetSpecs.push({name:'Lançamentos',title:'Lançamentos realizados',headers:['Data','Manutenção','Categoria','Executor','Empresa / profissional','Produtos / peças','Materiais','Mão de obra','Total','Economia','Preço de mercado','Observações'],rows:launchRows,totals:['TOTAL',`${normalized.length} lançamento(s)`,'','','','',totalMoney(materialsTotal),totalMoney(laborTotal),totalMoney(total),totalMoney(saving),'',''],widths:[14,28,16,18,25,28,15,15,15,15,17,38]});

      const monthlyRows=monthly.map(m=>[m.label,m.count,money(m.materials),money(m.labor),money(m.paid),money(m.saving),money(m.provision),money(m.saving-m.paid)]);
      sheetSpecs.push({name:'Fechamento Mensal',title:'Fechamento mensal',headers:['Mês','Eventos','Materiais','Mão de obra','Pago','Economia','Provisão','Resultado'],rows:monthlyRows,totals:['TOTAL',sum(monthly,'count'),totalMoney(sum(monthly,'materials')),totalMoney(sum(monthly,'labor')),totalMoney(sum(monthly,'paid')),totalMoney(sum(monthly,'saving')),totalMoney(sum(monthly,'provision')),totalMoney(sum(monthly,'saving')-sum(monthly,'paid'))],widths:[22,12,16,16,16,16,16,16]});

      const categoryRows=categories.map(r=>[r.category,r.count,money(r.materials),money(r.labor),money(r.paid),money(r.saving),money(r.provision),money(r.saving-r.paid)]);
      sheetSpecs.push({name:'Por Categoria',title:'Resumo financeiro por categoria',headers:['Categoria','Serviços','Materiais','Mão de obra','Pago','Economia','Provisão','Saldo'],rows:categoryRows,totals:['TOTAL',sum(categories,'count'),totalMoney(sum(categories,'materials')),totalMoney(sum(categories,'labor')),totalMoney(sum(categories,'paid')),totalMoney(sum(categories,'saving')),totalMoney(sum(categories,'provision')),totalMoney(sum(categories,'saving')-sum(categories,'paid'))],widths:[22,12,16,16,16,16,16,16]});

      const comparisonRows=comparisons.map(r=>{
        const hs=signal(r.lastDifference,!r.previous),fs=signal(r.nextDifference,!r.last);
        return [r.item.name,r.previous?this.fmt(r.previous.date):'—',r.previous?.provider||r.previous?.executor||'—',r.previous?money(r.previousValue):'—',r.last?this.fmt(r.last.date):'—',r.last?.provider||r.last?.executor||'—',r.last?money(r.lastValue):'—',{v:hs.text,style:hs.style},r.nextValue?money(r.nextValue):'—',{v:fs.text,style:fs.style}];
      });
      sheetSpecs.push({name:'Comparativo',title:'Comparativo das últimas manutenções',headers:['Manutenção','Penúltima data','Responsável anterior','Valor anterior','Última data','Último responsável','Último valor','Variação histórica','Próxima previsão','Variação prevista'],rows:comparisonRows,totals:['TOTAL','','',totalMoney(comparisons.reduce((s,r)=>s+(r.previous?r.previousValue:0),0)),'','',totalMoney(comparisons.reduce((s,r)=>s+(r.last?r.lastValue:0),0)),'',totalMoney(comparisons.reduce((s,r)=>s+r.nextValue,0)),''],widths:[28,15,24,16,15,24,16,20,18,20]});

      const providerData=providerRows.map(r=>[r.providerLabel,this.fmt(r.date),r.name,r.category,r.executor||'—',money(r.productsCost),money(r.laborCost),money(r.paid),money(r.saving)]);
      sheetSpecs.push({name:'Empresas',title:'Comparativo por empresa / profissional',headers:['Empresa / responsável','Data','Manutenção','Categoria','Executor','Materiais','Mão de obra','Total pago','Economia'],rows:providerData,totals:['TOTAL',`${providerRows.length} serviço(s)`,'','','',totalMoney(sum(providerRows,'productsCost')),totalMoney(sum(providerRows,'laborCost')),totalMoney(sum(providerRows,'paid')),totalMoney(sum(providerRows,'saving'))],widths:[28,14,30,16,18,16,16,16,16]});

      const provisionRows=provisions.map(x=>[this.fmt(x.date),x.item?.name||'',x.item?.category||'',money(x.estimate?.material),money(x.estimate?.labor),money(x.estimate?.total)]);
      sheetSpecs.push({name:'Provisão',title:'Provisão no período selecionado',headers:['Data prevista','Manutenção','Categoria','Materiais','Mão de obra','Total previsto'],rows:provisionRows,totals:['TOTAL',`${provisions.length} ocorrência(s)`,'',totalMoney(provisionMaterial),totalMoney(provisionLabor),totalMoney(provisionTotal)],widths:[16,30,18,18,18,18]});

      const historyRows=normalized.map(r=>[this.fmt(r.date),r.name,r.category,r.executor||'—',r.provider||'—',r.products||'—',money(r.productsCost),money(r.laborCost),money(r.paid),money(r.saving),money(r.marketLabor||r.market||0),r.notes||'—']);
      sheetSpecs.push({name:'Histórico',title:'Histórico financeiro detalhado',headers:['Data','Manutenção','Categoria','Executor','Empresa / profissional','Produtos / peças','Materiais','Mão de obra','Total','Economia','Preço de mercado','Observações'],rows:historyRows,totals:['TOTAL',`${normalized.length} lançamento(s)`,'','','','',totalMoney(materialsTotal),totalMoney(laborTotal),totalMoney(total),totalMoney(saving),'',''],widths:[14,28,16,18,25,28,15,15,15,15,17,38]});

      const individualSheetMap={
        launches:'Lançamentos',
        monthly:'Fechamento Mensal',
        categories:'Por Categoria',
        comparison:'Comparativo',
        providers:'Empresas',
        provisions:'Provisão',
        history:'Histórico'
      };
      if(reportType && reportType!=='complete'){
        const requestedName=individualSheetMap[reportType];
        const selected=sheetSpecs.find(spec=>spec.name===requestedName);
        if(!selected) throw new Error(`Relatório Excel não encontrado: ${reportType}`);
        sheetSpecs.splice(0,sheetSpecs.length,selected);
      }

      const encoder=new TextEncoder();
      const xmlEscape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
      const colName=n=>{let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s};
      const cellXml=(r,c,value,defaultStyle=0)=>{
        const ref=`${colName(c)}${r}`;
        const obj=value&&typeof value==='object'&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,'v')?value:{v:value,style:defaultStyle};
        const style=Number(obj.style??defaultStyle);
        if(typeof obj.v==='number'&&Number.isFinite(obj.v))return `<c r="${ref}" s="${style}"><v>${obj.v}</v></c>`;
        const text=String(obj.v??'');
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
      };
      const mergeRange=(a,b,c,d)=>`${colName(b)}${a}:${colName(d)}${c}`;

      const styleXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode='R$ #,##0.00;[Red]-R$ #,##0.00'/></numFmts><fonts count="5"><font><sz val="10"/><name val="Calibri"/><family val="2"/><charset val="0"/><color rgb="FF172033"/></font><font><b/><sz val="18"/><name val="Calibri"/><family val="2"/><charset val="0"/><color rgb="FF0B1F33"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/><charset val="0"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Calibri"/><family val="2"/><charset val="0"/><color rgb="FF0B1F33"/></font><font><b/><sz val="13"/><name val="Calibri"/><family val="2"/><charset val="0"/><color rgb="FF0B1F33"/></font></fonts><fills count="13"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0E8F55"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF5EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE6E6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4F5EA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF4D6"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F2F4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEDED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F7EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF5FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2EBFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCDD8E0"/></left><right style="thin"><color rgb="FFCDD8E0"/></right><top style="thin"><color rgb="FFCDD8E0"/></top><bottom style="thin"><color rgb="FFCDD8E0"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF70A887"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="3" fillId="4" borderId="2" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="3" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="3" fillId="8" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="164" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="4" fillId="6" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="4" fillId="11" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="4" fillId="12" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="4" fillId="7" borderId="1" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

      async function logoBytes(source){
        if(!source)return null;
        try{
          const img=new Image();img.crossOrigin='anonymous';
          await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=source});
          const canvas=document.createElement('canvas');const maxW=260,maxH=150,ratio=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);
          canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          const data=canvas.toDataURL('image/png').split(',')[1];const bin=atob(data);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
        }catch(error){console.warn('Não foi possível incorporar a logo no XLSX.',error);return null}
      }
      const logo=await logoBytes(p.logo||'');
      const files={};
      const sheetXmls=[],sheetRels=[],drawingXmls=[],drawingRels=[];
      const kpis=[['Gasto realizado',total,11],['Economia realizada',saving,12],['Materiais realizados',materialsTotal,13],['Mão de obra realizada',laborTotal,14],['Saldo econômico',saving-total,15],['Provisão no período',provisionTotal,16]];

      sheetSpecs.forEach((spec,index)=>{
        const maxCols=Math.max(spec.headers.length,12),merges=[];let rowsXml=[];
        rowsXml.push(`<row r="1" ht="27" customHeight="1">${cellXml(1,logo?3:1,`Relatório Financeiro de Manutenções — ${p.name||'Casa/Empresa'}`,1)}</row>`);
        merges.push(mergeRange(1,logo?3:1,1,maxCols));
        rowsXml.push(`<row r="2" ht="20" customHeight="1">${cellXml(2,logo?3:1,`${p.type||''} • ${[p.address,p.cityState].filter(Boolean).join(' • ')}`,2)}</row>`);merges.push(mergeRange(2,logo?3:1,2,maxCols));
        rowsXml.push(`<row r="3" ht="20" customHeight="1">${cellXml(3,logo?3:1,`Responsável: ${p.contact||'—'} • ${[p.phone,p.email].filter(Boolean).join(' • ')}`,2)}</row>`);merges.push(mergeRange(3,logo?3:1,3,maxCols));
        rowsXml.push(`<row r="4" ht="20" customHeight="1">${cellXml(4,logo?3:1,`Período: ${period} • Categoria: ${category} • Emitido em ${emitted}`,2)}</row>`);merges.push(mergeRange(4,logo?3:1,4,maxCols));
        if(logo){merges.push('A1:B4')}
        const kpiCells=[];for(let i=0;i<6;i++){const c1=i*2+1,c2=c1+1;kpiCells.push(cellXml(6,c1,`${kpis[i][0]}\n${this.money(kpis[i][1])}`,kpis[i][2]));merges.push(mergeRange(6,c1,7,c2))}
        rowsXml.push(`<row r="6" ht="25" customHeight="1">${kpiCells.join('')}</row><row r="7" ht="25" customHeight="1"></row>`);
        rowsXml.push(`<row r="9" ht="24" customHeight="1">${cellXml(9,1,spec.title,1)}</row>`);merges.push(mergeRange(9,1,9,maxCols));
        rowsXml.push(`<row r="10" ht="24" customHeight="1">${spec.headers.map((h,i)=>cellXml(10,i+1,h,3)).join('')}</row>`);
        spec.rows.forEach((data,ri)=>{const r=11+ri;rowsXml.push(`<row r="${r}" ht="22" customHeight="1">${data.map((v,ci)=>cellXml(r,ci+1,v,5)).join('')}</row>`)});
        if(spec.totals){const r=11+spec.rows.length;rowsXml.push(`<row r="${r}" ht="24" customHeight="1">${spec.totals.map((v,ci)=>cellXml(r,ci+1,v,6)).join('')}</row>`)}
        const cols=Array.from({length:maxCols},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${spec.widths[i]||14}" customWidth="1"/>`).join('');
        const lastRow=10+spec.rows.length+(spec.totals?1:0);
        const drawing=logo?'<drawing r:id="rId1"/>':'';
        const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><tabColor rgb="FF0E8F55"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${colName(maxCols)}${lastRow}"/><sheetViews><sheetView workbookViewId="0" view="normal" zoomScale="100" showGridLines="0" showRowColHeaders="1"><pane ySplit="10" topLeftCell="A11" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A11" sqref="A11"/></sheetView></sheetViews><sheetFormatPr baseColWidth="10" defaultColWidth="18" defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${rowsXml.join('')}</sheetData><autoFilter ref="A10:${colName(spec.headers.length)}${Math.max(10,lastRow)}"/><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>${drawing}</worksheet>`;
        sheetXmls.push(sheetXml);
        if(logo){sheetRels.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${index+1}.xml"/></Relationships>`);drawingXmls.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>50000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>50000</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index+1}" name="Logo"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`);drawingRels.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/></Relationships>`)}
      });

      const workbookSheets=sheetSpecs.map((s,i)=>`<sheet name="${xmlEscape(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
      const workbookRels=sheetSpecs.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheetSpecs.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
      const overrides=sheetSpecs.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+(logo?sheetSpecs.map((s,i)=>`<Override PartName="/xl/drawings/drawing${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join(''):'');
      files['[Content_Types].xml']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
      files['_rels/.rels']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
      files['xl/workbook.xml']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="171027"/></workbook>`);
      files['xl/_rels/workbook.xml.rels']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`);
      files['xl/styles.xml']=encoder.encode(styleXml);
      sheetXmls.forEach((xml,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=encoder.encode(xml);if(logo){files[`xl/worksheets/_rels/sheet${i+1}.xml.rels`]=encoder.encode(sheetRels[i]);files[`xl/drawings/drawing${i+1}.xml`]=encoder.encode(drawingXmls[i]);files[`xl/drawings/_rels/drawing${i+1}.xml.rels`]=encoder.encode(drawingRels[i])}});
      if(logo)files['xl/media/logo.png']=logo;
      const nowIso=new Date().toISOString();
      files['docProps/core.xml']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Relatório Financeiro de Manutenções — ${xmlEscape(p.name||'Casa/Empresa')}</dc:title><dc:creator>Sistema de Manutenções Preventivas</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified></cp:coreProperties>`);
      files['docProps/app.xml']=encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Sistema de Manutenções Preventivas</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Planilhas</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetSpecs.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetSpecs.length}" baseType="lpstr">${sheetSpecs.map(s=>`<vt:lpstr>${xmlEscape(s.name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts><Company>${xmlEscape(p.name||'')}</Company></Properties>`);

      const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
      const crc32=data=>{let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
      const u16=(v,a,o)=>{a[o]=v&255;a[o+1]=(v>>>8)&255};const u32=(v,a,o)=>{a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255};
      const entries=[];let offset=0;const localParts=[];
      for(const [name,data] of Object.entries(files)){const nameBytes=encoder.encode(name),crc=crc32(data),header=new Uint8Array(30+nameBytes.length);u32(0x04034b50,header,0);u16(20,header,4);u16(0x0800,header,6);u16(0,header,8);u16(0,header,10);u16(0,header,12);u32(crc,header,14);u32(data.length,header,18);u32(data.length,header,22);u16(nameBytes.length,header,26);u16(0,header,28);header.set(nameBytes,30);localParts.push(header,data);entries.push({nameBytes,crc,size:data.length,offset});offset+=header.length+data.length}
      const centralParts=[];let centralSize=0;for(const e of entries){const h=new Uint8Array(46+e.nameBytes.length);u32(0x02014b50,h,0);u16(20,h,4);u16(20,h,6);u16(0x0800,h,8);u16(0,h,10);u16(0,h,12);u16(0,h,14);u32(e.crc,h,16);u32(e.size,h,20);u32(e.size,h,24);u16(e.nameBytes.length,h,28);u16(0,h,30);u16(0,h,32);u16(0,h,34);u16(0,h,36);u32(0,h,38);u32(e.offset,h,42);h.set(e.nameBytes,46);centralParts.push(h);centralSize+=h.length}
      const endRecord=new Uint8Array(22);u32(0x06054b50,endRecord,0);u16(0,endRecord,4);u16(0,endRecord,6);u16(entries.length,endRecord,8);u16(entries.length,endRecord,10);u32(centralSize,endRecord,12);u32(offset,endRecord,16);u16(0,endRecord,20);
      const blob=new Blob([...localParts,...centralParts,endRecord],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const reportFileNames={
        complete:'relatorio_completo',
        launches:'lancamentos_realizados',
        monthly:'fechamento_mensal',
        categories:'resumo_por_categoria',
        comparison:'comparativo_manutencoes',
        providers:'comparativo_empresas',
        provisions:'provisao_periodo',
        history:'historico_financeiro'
      };
      const filePrefix=reportFileNames[reportType]||'relatorio_manutencoes';
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${filePrefix}_${this.financeStartDate}_a_${this.financeEndDate}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    } catch(error) {
      console.error('Falha ao gerar XLSX:',error);
      alert(`Não foi possível gerar o arquivo XLSX: ${error?.message||error}`);
    } finally {
      if(button){button.disabled=false;button.innerHTML=original||'<ha-icon icon="mdi:file-excel-outline"></ha-icon>Excel';}
    }
  }

  addDaysIso(iso, days) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [y,m,d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(days || 0));
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
  }

  daysFromToday(iso) {
    if (!iso) return 0;
    const [y,m,d] = iso.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
  }

  reportStatus(days) {
    return days < 0 ? "Vencida" : days <= 30 ? "Atenção" : "Em dia";
  }

  async history(entity = null, returnTo = null) {
    const modal = this.shadowRoot.querySelector("#modal");
    modal.innerHTML = '<div class="overlay"><div class="history-modal loading"><h2>Carregando histórico...</h2></div></div>';
    const days = Number(this.c.history_days || 3650);
    const start = new Date(Date.now() - days * 86400000).toISOString();
    const allItems = this.items();
    const entities = entity ? [entity] : allItems.filter(i=>i.source!=="local").map(i => i.date_entity);
    const rows = [];
    try {
      const data = entities.length ? await this.h.callApi("GET", `history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(entities.join(","))}&minimal_response&no_attributes`) : [];
      (data || []).forEach(series => {
        for (let x = 1; x < series.length; x++) {
          if (series[x].state !== series[x - 1].state && /^\d{4}-\d{2}-\d{2}$/.test(series[x].state)) {
            const item = allItems.find(z => z.date_entity === series[x].entity_id);
            if (item) rows.push({ date: series[x].state, item });
          }
        }
      });
    } catch (error) { console.error(error); }

    allItems.filter(i => !entity || i.date_entity === entity).forEach(i => {
      if (i.last && !rows.some(r => r.item.entity === i.entity && r.date === i.last)) rows.push({ date:i.last, item:i });
    });

    rows.forEach(r => {
      r.next = this.addDaysIso(r.date, Number(r.item.cycleDays || this.attr(r.item.entity, "ciclo_dias", 0)));
      r.days = this.daysFromToday(r.next);
      r.status = this.reportStatus(r.days);
    });
    rows.sort((a, b) => b.date.localeCompare(a.date));

    const years = [...new Set(rows.map(r => String(r.date).slice(0,4)))].sort((a,b) => b.localeCompare(a));
    modal.innerHTML = `<div class="overlay"><div class="history-modal wide-history"><div class="modal-head"><div><h2>🕘 Histórico de manutenções</h2><p>Filtre por texto, categoria, status, prioridade e ano.</p></div><button id="close">✕</button></div><div class="history-filters">
      <input id="q" placeholder="Buscar manutenção...">
      <select id="cat">${["Todas", ...this.categoryDefinitions().map(x=>x.name)].map(c => `<option>${c}</option>`).join("")}</select>
      <select id="status">${["Todos", "Em dia", "Atenção", "Vencida"].map(s => `<option>${s}</option>`).join("")}</select>
      <select id="priority">${["Todas", "Crítica", "Importante", "Baixa"].map(p => `<option>${p}</option>`).join("")}</select>
      <select id="year"><option>Todos</option>${years.map(y => `<option>${y}</option>`).join("")}</select>
    </div><div id="list"></div></div></div>`;

    const draw = () => {
      const q = modal.querySelector("#q").value.toLowerCase();
      const c = modal.querySelector("#cat").value;
      const status = modal.querySelector("#status").value;
      const priority = modal.querySelector("#priority").value;
      const year = modal.querySelector("#year").value;
      const filtered = rows.filter(r =>
        (!q || `${r.item.name} ${r.item.category} ${r.item.priority} ${r.date} ${r.next} ${r.status}`.toLowerCase().includes(q)) &&
        (c === "Todas" || r.item.category === c) &&
        (status === "Todos" || r.status === status) &&
        (priority === "Todas" || r.item.priority === priority) &&
        (year === "Todos" || String(r.date).startsWith(year))
      );
      modal.querySelector("#list").innerHTML = filtered.length ? `<table><thead><tr><th>Última manutenção</th><th>Manutenção</th><th>Categoria</th><th>Criticidade</th><th>Próxima manutenção</th><th>Prazo</th><th>Status</th></tr></thead><tbody>${filtered.map(r => `<tr>
        <td>${this.fmt(r.date)}</td>
        <td><b>${r.item.name}</b></td>
        <td>${this.icon(r.item.category)} ${r.item.category}</td>
        <td><span class="priority-badge priority-${this.slug(r.item.priority)}">${r.item.priority}</span></td>
        <td>${this.fmt(r.next)}</td>
        <td class="${r.days < 0 ? "danger" : r.days <= 30 ? "warning" : "ok"}">${r.days < 0 ? `${Math.abs(r.days)} dias em atraso` : `${r.days} dias`}</td>
        <td><span class="history-status ${this.cls(r.status === "Vencida" ? "Vencido" : r.status)}">${r.status}</span></td>
      </tr>`).join("")}</tbody></table>` : '<div class="empty">Nenhum registro encontrado.</div>';


    };
    const back = () => returnTo ? returnTo() : (modal.innerHTML = "");
    modal.querySelector("#close").onclick = back;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) back(); };
    modal.querySelector("#q").oninput = draw;
    ["cat", "status", "priority", "year"].forEach(id => modal.querySelector(`#${id}`).onchange = draw);
    draw();
  }
}
// Registro isolado para o painel encapsulado CloudPelizzon.
if (!customElements.get("cloudpelizzon-maintenance-v311-core")) {
  customElements.define("cloudpelizzon-maintenance-v311-core", ManutencaoResidencialCardV200);
}
console.info("[CloudPelizzon Maintenance] V311 core encapsulado carregado");
