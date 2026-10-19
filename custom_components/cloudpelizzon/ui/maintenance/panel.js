const CP_BASE = "/cloudpelizzon-maintenance/frontend";
const CP_CORE_URL = `${CP_BASE}/legacy-v311-core.js?v=311-excel-r119`;
const CP_CORE_TAG = "cloudpelizzon-maintenance-v311-core";
const CP_API_SNAPSHOT = "cloudpelizzon/maintenance/compat/get_snapshot";
const CP_API_SAVE = "cloudpelizzon/maintenance/compat/save_snapshot";
const CP_API_COMPLETE = "cloudpelizzon/maintenance/complete";
const CP_API_HISTORY_IMPORT = "cloudpelizzon/maintenance/history/import_legacy";
const CP_API_SETTINGS_UPDATE = "cloudpelizzon/maintenance/settings/update";
const CP_API_NOTIFY_STATUS = "cloudpelizzon/maintenance/notifications/status";
const CP_API_NOTIFY_TEST = "cloudpelizzon/maintenance/notifications/test";
const CP_API_NOTIFY_CHECK = "cloudpelizzon/maintenance/notifications/check_now";
const CP_LICENSE_STATUS = "cloudpelizzon/core/license/status";
const CP_MODULE_SKU = "CP-MAINTENANCE";
const CP_CATEGORY_DEFAULTS = {
  "Casa": {icon:"🏠", image:`${CP_BASE}/assets/01_casa.png`},
  "Energia": {icon:"⚡", image:`${CP_BASE}/assets/02_energia.png`},
  "Gás": {icon:"🔥", image:`${CP_BASE}/assets/03_gas.png`},
  "Veículos": {icon:"🚗", image:`${CP_BASE}/assets/04_veiculos.png`},
  "Tecnologia": {icon:"💻", image:`${CP_BASE}/assets/06_tecnologia.png`},
};

let corePromise = null;

function loadLegacyCore() {
  if (customElements.get(CP_CORE_TAG)) return Promise.resolve();
  if (corePromise) return corePromise;
  corePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CP_CORE_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Não foi possível carregar o núcleo visual V311."));
    document.head.appendChild(script);
  });
  return corePromise;
}

function genericProfile(profile = {}) {
  return {
    type: "Casa",
    name: "Casa / Empresa",
    logo: "",
    address: "",
    cityState: "",
    document: "",
    contact: "",
    phone: "",
    email: "",
    additional: "",
    ...profile,
  };
}

function defaultPeriod() {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function patchLegacyPrototype() {
  const Klass = customElements.get(CP_CORE_TAG);
  if (!Klass) throw new Error("Núcleo V311 não registrado.");
  const p = Klass.prototype;
  if (p.__cpParityPatched) return;
  p.__cpParityPatched = true;

  const originalItems = p.items;
  const originalRender = p.render;
  const originalQuickActions = p.openQuickActions;

  // The commercial build never reads browser-local maintenance databases.
  p.loadFavorites = () => new Set();
  p.loadFinanceRecords = () => [];
  p.loadFinanceEstimates = () => ({});
  p.loadRegistrationData = () => ({
    categories: [], maintenances: [], deletedMaintenances: [], deletedCategories: [],
    maintenanceOverrides: {}, categoryOverrides: {}, profile: genericProfile(),
  });
  p.loadFinancePeriod = () => defaultPeriod();
  p.ensureCriticalFinanceRecords = () => {};
  p.syncSharedStorageFromHass = () => {};
  p.hasMeaningfulLocalStorage = () => false;

  p.scheduleSharedStorageSave = function () {
    if (this.applyingSharedStorage || !this.__cpScheduleSave) return;
    this.__cpScheduleSave();
  };
  p.publishSharedStorage = async function () {
    if (this.__cpSaveSnapshot) await this.__cpSaveSnapshot();
  };
  p.saveFavorites = function () { this.scheduleSharedStorageSave(); };
  p.saveFinanceRecords = function () { this.scheduleSharedStorageSave(); };
  p.saveFinanceEstimates = function () { this.scheduleSharedStorageSave(); };
  p.saveRegistrationData = function () {
    const d = this.registrationData || {};
    d.categories = Array.isArray(d.categories) ? d.categories : [];
    d.maintenances = Array.isArray(d.maintenances) ? d.maintenances : [];
    d.deletedMaintenances = [];
    d.deletedCategories = [];
    d.maintenanceOverrides = {};
    d.categoryOverrides = {};
    d.profile = genericProfile(d.profile || {});
    this.registrationData = d;
    this.scheduleSharedStorageSave();
  };
  p.saveFinancePeriod = function (start = this.financeStartDate, end = this.financeEndDate) {
    const period = this.normalizeFinancePeriod(start, end);
    this.financeStartDate = period.start;
    this.financeEndDate = period.end;
    this.scheduleSharedStorageSave();
  };

  // Customer categories remain dynamic, but the five Golden Master categories
  // keep their original icons/header artwork whenever the stored category has
  // only the generic migration placeholder.
  p.categoryDefinitions = function () {
    const list = Array.isArray(this.registrationData?.categories) ? this.registrationData.categories : [];
    const seen = new Set();
    return list.filter(x => x && x.name).map(x => {
      const preset = CP_CATEGORY_DEFAULTS[x.name] || null;
      const rawIcon = String(x.icon || "").trim();
      const icon = preset && (!rawIcon || rawIcon === "🛠️") ? preset.icon : (rawIcon || "🛠️");
      const rawImage = x.headerImage || x.header_image || "";
      return {
        originalName: x.name, name: x.name, icon, color: x.color || "#35b9ff",
        headerImage: rawImage || preset?.image || "", id: x.id || "", _cpSource: x._cpSource || "",
      };
    }).filter(x => { const key=this.slug(x.name); if(!key||seen.has(key))return false; seen.add(key); return true; });
  };
  p.allCategoryDefinitions = function () { return this.categoryDefinitions(); };
  p.categoryHeaderImage = function (category) {
    const found=this.categoryDefinitions().find(x=>x.name===category||x.originalName===category);
    return found?.headerImage || CP_CATEGORY_DEFAULTS[category]?.image || "";
  };
  p.generalHeaderImage = function () { return `${CP_BASE}/assets/05_visao_geral.png`; };
  p.houseProfile = function () { return genericProfile(this.registrationData?.profile || {}); };

  // Keep the exact V311 cards/finance/history logic, but mark backend items as
  // history-capable so the original Recorder views request their synthetic history.
  p.items = function () {
    return originalItems.call(this).map(item => ({ ...item, source: "home_assistant" }));
  };

  // Recording a maintenance uses the encapsulated backend instead of input_datetime.
  p._setMaintenanceExecutionDate = async function (item, date, record = {}) {
    if (!this.__cpRealHass) throw new Error("Backend CloudPelizzon indisponível.");
    const id = String(item?.id || item?.entity || "").replace(/^local_maintenance\./, "");
    if (!id) throw new Error("Identificador da manutenção não encontrado.");
    // A new/edited item may still be in the debounced snapshot queue.
    // Persist it before the server tries to locate its maintenance id.
    if(this.__cpSaveSnapshot) await this.__cpSaveSnapshot();
    const result = await this.__cpRealHass.callWS({
      type: CP_API_COMPLETE,
      maintenance_id: id,
      execution_date: date,
      executor: record.executor || '', provider: record.provider || '', notes: record.notes || '',
      material_cost: Number(record.productsCost || 0), labor_cost: Number(record.laborCost || 0),
    });
    const raw = (this.registrationData?.maintenances || []).find(x => String(x.id) === id);
    if (raw) {
      raw.last = date;
      raw.updatedAt = new Date().toISOString();
    }
    if (result?.execution) {
      this.__cpExecutions = Array.isArray(this.__cpExecutions) ? this.__cpExecutions : [];
      if (!this.__cpExecutions.some(x => x.id === result.execution.id)) this.__cpExecutions.push(result.execution);
    }
    return true;
  };

  // Preserve the exact source render; only replace the legacy "Ações" slot with
  // the product's Ajustes entry after V311 binds its own handlers.
  p.render = function () {
    originalRender.call(this);
    queueMicrotask(() => {
      const button = this.shadowRoot?.querySelector("[data-quick]");
      if (!button) return;
      const icon = button.querySelector("ha-icon");
      if (icon) icon.setAttribute("icon", "mdi:cog-outline");
      const label = button.querySelector("small");
      if (label) label.textContent = "Ajustes";
      button.onclick = () => this.__cpOpenSettings?.();
    });
  };
  p.__cpOriginalOpenQuickActions = originalQuickActions;
}

class CloudPelizzonMaintenancePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._card = null;
    this._initializing = false;
    this._snapshot = null;
    this._saveTimer = null;
    this._saveRunning = false;
    this._saveAgain = false;
    this._license = null;
    this._requestResult = null;
    this._locked = false;
  }

  set panel(panel) { this._panel = panel; }

  set hass(hass) {
    this._hass = hass;
    if (!this._card && !this._initializing && !this._locked) this.initialize();
    if (this._card) {
      this._card.__cpRealHass = hass;
      this._card.hass = this.createHassProxy(hass, this._card);
    }
  }

  connectedCallback() {
    if (this._hass && !this._card && !this._initializing && !this._locked) this.initialize();
  }

  showMessage(title, detail = "") {
    this.shadowRoot.innerHTML = `
      <style>:host{display:block;min-height:100vh;background:#020d15;color:#eefaff;font-family:Inter,system-ui,sans-serif}.msg{min-height:70vh;display:grid;place-items:center}.box{max-width:680px;padding:28px;border:1px solid #17384a;border-radius:18px;background:#061a27}.box h2{margin:0 0 8px}.box p{color:#8ca6b5;line-height:1.5}</style>
      <div class="msg"><div class="box"><h2>${title}</h2><p>${detail}</p></div></div>`;
  }

  showLocked(license = {}) {
    const statusMap = {
      trial_expired: "Período de avaliação encerrado",
      revoked: "Licença revogada",
      expired: "Licença expirada",
      activation_required: "Ativação online necessária",
      lease_expired: "Validação online necessária",
      not_entitled: "Módulo não contratado",
      locked: "Módulo não licenciado",
    };
    const status = statusMap[license.status] || "Módulo não licenciado";
    const customer = license.customer || "";
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;min-height:100vh;background:#020a12;color:#eefaff;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        *{box-sizing:border-box}.showcase{position:relative;min-height:100vh;overflow:hidden;background:#020a12}.shot{position:absolute;inset:0;background-position:center top;background-size:contain;background-repeat:no-repeat;opacity:0;will-change:opacity;animation:cpShot 18s linear infinite both}.s1{background-image:url('${CP_BASE}/showcase/manutencao-casa.png')}.s2{background-image:url('${CP_BASE}/showcase/manutencao-financeiro.png');animation-delay:-9s}@keyframes cpShot{0%,44%{opacity:1}50%,94%{opacity:0}100%{opacity:1}}
        .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(1,8,13,.10),rgba(1,8,13,.24)),radial-gradient(circle at 50% 42%,rgba(1,8,13,.02) 0 22%,rgba(1,8,13,.10) 60%,rgba(1,8,13,.24) 100%);pointer-events:none}
        .lock-wrap{position:relative;z-index:2;min-height:100vh;display:grid;place-items:center;padding:28px}.lock-card{width:min(630px,90vw);padding:23px 26px;border-radius:22px;border:1px solid rgba(58,188,246,.48);background:linear-gradient(145deg,rgba(5,28,42,.92),rgba(3,16,25,.90));box-shadow:0 28px 95px rgba(0,0,0,.48),0 0 55px rgba(25,164,231,.08);text-align:center}.lock-card:before{content:"";display:block;width:84px;height:4px;border-radius:999px;background:linear-gradient(90deg,#0e7dc9,#41c8ff);margin:0 auto 16px;box-shadow:0 0 24px rgba(65,200,255,.45)}
        .badge{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:1px solid rgba(255,200,84,.45);background:rgba(76,53,7,.66);color:#ffd66d;font-size:10px;font-weight:900}.lock-card h1{margin:13px 0 6px;font-size:31px}.lock-card p{max-width:610px;margin:0 auto;color:#93adba;font-size:12px;line-height:1.6}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:17px 0}.meta>div{padding:10px;border-radius:11px;background:#04131d;border:1px solid rgba(255,255,255,.07);text-align:left}.meta span{display:block;color:#648697;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.meta code,.meta b{display:block;margin-top:4px;color:#d9f3ff;font-size:10px;word-break:break-all}.actions{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.primary,.secondary,.whatsapp{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 16px;border-radius:11px;font-weight:900;font-size:10px;cursor:pointer}.primary{border:1px solid #49c5ff;background:linear-gradient(135deg,#0869b3,#13a4f7);color:#fff}.secondary{border:1px solid rgba(95,166,197,.36);background:#0a2230;color:#d6effa}.whatsapp{border:1px solid #35cf79;background:#0c6a3c;color:#fff}.hint{display:block;margin-top:13px;color:#5e8293;font-size:8px}.dots{display:flex;justify-content:center;gap:6px;margin-top:14px}.dots i{width:22px;height:3px;border-radius:999px;background:#214657}.dots i:first-child{animation:cpDot 18s linear infinite}.dots i:last-child{animation:cpDot 18s linear -9s infinite}@keyframes cpDot{0%,44%{background:#42c7ff}50%,94%{background:#214657}100%{background:#42c7ff}}
        .modal{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:18px}.modal.show{display:flex}.backdrop{position:absolute;inset:0;background:rgba(0,5,9,.84);backdrop-filter:blur(8px)}.modal-card{position:relative;z-index:1;width:min(820px,96vw);max-height:94vh;overflow:auto;padding:22px;border-radius:22px;background:#061722;border:1px solid rgba(52,168,220,.42);box-shadow:0 40px 140px #000}.x{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:#0b2230;color:white;cursor:pointer}.modal-head{padding-right:45px}.eyebrow{display:block;color:#2db6ff;font-size:9px;font-weight:900;letter-spacing:.16em}.modal-head h2{font-size:24px;margin:6px 0}.modal-head p{font-size:10px;color:#7594a3}.context{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.context>div{padding:10px;border-radius:10px;background:#04121b;border:1px solid rgba(255,255,255,.07)}.context .wide{grid-column:1/-1}.context span{display:block;color:#607f8f;font-size:8px;font-weight:900}.context b,.context code{display:block;margin-top:3px;font-size:10px;word-break:break-all}.form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form label{color:#88a6b4;font-size:9px;font-weight:900}.form .wide{grid-column:1/-1}.form input,.form textarea{width:100%;margin-top:6px;padding:11px;border-radius:10px;background:#020f17;color:white;border:1px solid #29546a;outline:none}.form input:focus,.form textarea:focus{border-color:#2db6ff;box-shadow:0 0 0 3px rgba(45,182,255,.1)}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.success{text-align:center;padding:18px 8px}.success-orb{width:74px;height:74px;margin:0 auto 15px;border-radius:50%;display:grid;place-items:center;background:#0a3d53;border:1px solid #38c3ff;color:#64d8ff;font-size:34px}.success h2{margin:6px 0}.success p{color:#88a6b4;line-height:1.55}.statuses{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin:16px 0}.statuses span{padding:7px 9px;border-radius:999px;background:#062536;border:1px solid rgba(61,175,226,.28);font-size:8px;font-weight:900}.security-note{display:block;margin-top:11px;color:#5f8192;font-size:8px;line-height:1.45}.toast{position:fixed;right:20px;bottom:20px;z-index:30;opacity:0;transform:translateY(15px);padding:11px 14px;border-radius:10px;background:#07395f;border:1px solid #249fff;font-size:10px;font-weight:900;transition:.2s}.toast.show{opacity:1;transform:none}.toast.error{background:#4c2026;border-color:#f0606c}
        @media(prefers-reduced-motion:reduce){.shot,.dots i{animation:none}.s1{opacity:1}.s2{display:none}}@media(max-width:760px){.lock-wrap{padding:14px}.lock-card{padding:20px 15px}.lock-card h1{font-size:24px}.meta,.context,.form{grid-template-columns:1fr}.context .wide,.form .wide{grid-column:auto}.modal-actions{flex-wrap:wrap}}
      </style>
      <div class="showcase"><div class="shot s1"></div><div class="shot s2"></div><div class="veil"></div><div class="lock-wrap"><section class="lock-card"><span class="badge">🔒 ${status}</span><h1>CloudPelizzon Manutenção</h1><p>Explore a experiência real do módulo ao fundo. A licença libera manutenção preventiva, histórico operacional, financeiro, favoritos, IA preventiva e consultas por voz.</p><div class="meta"><div><span>SKU</span><b>${CP_MODULE_SKU}</b></div><div><span>Status</span><b>${status}</b></div><div style="grid-column:1/-1"><span>ID da instalação</span><code>${license.installation_id || "—"}</code></div></div><div class="actions"><button class="primary" id="request-module">Solicitar este módulo</button><button class="secondary" id="open-core">Abrir Central CloudPelizzon</button></div><div class="dots"><i></i><i></i></div><small class="hint">Os dashboards de demonstração ficam bloqueados até a ativação da licença.</small></section></div></div><div id="request-modal" class="modal"><div class="backdrop" data-close></div><section class="modal-card"><button class="x" data-close>✕</button><div id="request-body"><div class="modal-head"><span class="eyebrow">SOLICITAR MÓDULO • ${CP_MODULE_SKU}</span><h2>Fale com a CloudPelizzon</h2><p>Preencha os dados abaixo. A solicitação será vinculada automaticamente a esta instalação.</p></div><div class="context"><div><span>Módulo</span><b>Manutenção</b></div><div><span>SKU</span><code>${CP_MODULE_SKU}</code></div><div class="wide"><span>ID da instalação</span><code>${license.installation_id || "—"}</code></div></div><div class="form"><label>Nome *<input id="req-name" value="${String(customer).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}" placeholder="Seu nome"></label><label>Telefone / WhatsApp *<input id="req-phone" placeholder="(00) 00000-0000"></label><label>E-mail *<input id="req-email" type="email" placeholder="voce@email.com"></label><label>Assunto *<input id="req-subject" value="Interesse no módulo Manutenção"></label><label class="wide">Mensagem *<textarea id="req-message" rows="5">Olá, gostaria de receber informações sobre contratação do módulo Manutenção.</textarea></label></div><div class="modal-actions"><button class="secondary" data-close>Cancelar</button><button class="primary" id="send-request">Enviar solicitação</button></div><small class="security-note">A CloudPelizzon recebe junto com a solicitação o SKU, a versão do Core e o ID desta instalação. O WhatsApp será aberto somente após seu comando, com a mensagem já preenchida.</small></div></section></div><div id="cp-toast" class="toast"></div>`;
    this.shadowRoot.querySelector("#open-core")?.addEventListener("click",()=>{window.history.pushState(null,"","/cloudpelizzon");window.dispatchEvent(new PopStateEvent("popstate"));});
    const modal=this.shadowRoot.querySelector("#request-modal");
    this.shadowRoot.querySelector("#request-module")?.addEventListener("click",()=>modal?.classList.add("show"));
    this.shadowRoot.querySelectorAll("[data-close]").forEach(x=>x.addEventListener("click",()=>modal?.classList.remove("show")));
    this.shadowRoot.querySelector("#send-request")?.addEventListener("click",()=>this.submitCommercialRequest(license));
  }

  showToast(message, type="success") {
    const el=this.shadowRoot.querySelector("#cp-toast"); if(!el)return; el.textContent=message; el.className=`toast show ${type}`; clearTimeout(this.__toastTimer); this.__toastTimer=setTimeout(()=>el.className="toast",3500);
  }

  escapeHtml(value = "") {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async submitCommercialRequest(license = {}) {
    const q=id=>this.shadowRoot.querySelector(id);
    const payload={type:"cloudpelizzon/core/commercial/request",sku:CP_MODULE_SKU,name:q("#req-name")?.value?.trim()||"",phone:q("#req-phone")?.value?.trim()||"",email:q("#req-email")?.value?.trim()||"",subject:q("#req-subject")?.value?.trim()||"",message:q("#req-message")?.value?.trim()||""};
    if(!payload.name||!payload.phone||!payload.email||!payload.subject||!payload.message){this.showToast("Preencha todos os campos.","error");return}
    if(!/^\S+@\S+\.\S+$/.test(payload.email)){this.showToast("Informe um e-mail válido.","error");return}
    const btn=q("#send-request"); if(btn){btn.disabled=true;btn.textContent="Enviando..."}
    try{
      const result=await this._hass.callWS(payload); this._requestResult=result;
      const body=q("#request-body"); if(!body)return;
      const emailOk=result.email_status==="sent";
      body.innerHTML=`<div class="success"><div class="success-orb">✓</div><span class="eyebrow">SOLICITAÇÃO REGISTRADA</span><h2>Recebemos seu interesse em Manutenção.</h2><p>Protocolo <b>${result.request_id||""}</b>. ${emailOk?"Uma notificação também foi encaminhada por e-mail.":"A solicitação ficou registrada no servidor; utilize o WhatsApp abaixo como canal complementar."}</p><div class="statuses"><span>✓ Registro comercial</span><span>${emailOk?"✓":"!"} E-mail: ${result.email_status||"pendente"}</span><span>CRM: ${result.dolibarr_status||"registrado"}</span></div><div class="actions"><button class="secondary" data-close-success>Fechar</button>${result.whatsapp_url?`<button class="whatsapp" id="open-whatsapp">WhatsApp</button>`:""}</div></div>`;
      body.querySelector("[data-close-success]")?.addEventListener("click",()=>q("#request-modal")?.classList.remove("show"));
      body.querySelector("#open-whatsapp")?.addEventListener("click",()=>window.open(result.whatsapp_url,"_blank","noopener,noreferrer"));
      this.showToast("Solicitação registrada com sucesso.");
    }catch(error){this.showToast(error?.message||String(error),"error"); if(btn){btn.disabled=false;btn.textContent="Enviar solicitação"}}
  }

  async initialize() {
    if (this._initializing || !this._hass) return;
    this._initializing = true;
    this.showMessage("CloudPelizzon Manutenção", "Carregando o núcleo V311 encapsulado...");
    try {
      const license = await this._hass.callWS({type: CP_LICENSE_STATUS, sku: CP_MODULE_SKU});
      this._license = license;
      if (!license?.allowed) { this._locked = true; this.showLocked(license || {}); return; }
      this._locked = false;
      await loadLegacyCore();
      patchLegacyPrototype();
      let snapshot = await this.getSnapshot();

      // Import legacy Recorder history exactly once when a migrated pilot requests it.
      if (snapshot?.migration?.history_import_pending === true) {
        try {
          await this._hass.callWS({ type: CP_API_HISTORY_IMPORT });
          snapshot = await this.getSnapshot();
        } catch (error) {
          console.warn("CloudPelizzon: histórico legado não pôde ser importado automaticamente.", error);
        }
      }

      this._snapshot = snapshot;
      const card = document.createElement(CP_CORE_TAG);
      card.setConfig({
        title: snapshot?.settings?.title || "Manutenções Preventivas",
        subtitle: snapshot?.settings?.subtitle || "Controle residencial com ciclo, status, próxima execução e histórico",
        default_view: "geral",
        history_days: 3650,
        items: [],
      });
      this.hydrateCard(card, snapshot);
      this._card = card;
      this.shadowRoot.replaceChildren(card);
      card.hass = this.createHassProxy(this._hass, card);
    } catch (error) {
      console.error(error);
      this.showMessage("Falha ao carregar o CloudPelizzon Manutenção", error?.message || String(error));
    } finally {
      this._initializing = false;
    }
  }

  async getSnapshot() {
    return await this._hass.callWS({ type: CP_API_SNAPSHOT });
  }

  hydrateCard(card, snapshot) {
    const reg = snapshot?.registrationData && typeof snapshot.registrationData === "object"
      ? structuredClone(snapshot.registrationData)
      : { categories: [], maintenances: [], profile: genericProfile() };
    reg.categories = Array.isArray(reg.categories) ? reg.categories : [];
    reg.maintenances = Array.isArray(reg.maintenances) ? reg.maintenances : [];
    reg.profile = genericProfile(reg.profile || {});
    reg.deletedMaintenances = [];
    reg.deletedCategories = [];
    reg.maintenanceOverrides = {};
    reg.categoryOverrides = {};

    card.registrationData = reg;
    card.financeRecords = Array.isArray(snapshot?.financeRecords) ? structuredClone(snapshot.financeRecords) : [];
    const estimates = snapshot?.financeEstimates && typeof snapshot.financeEstimates === "object"
      ? structuredClone(snapshot.financeEstimates) : {};
    for (const m of reg.maintenances) {
      const id = String(m.id || "");
      if (!id) continue;
      const localKey = `local_maintenance.${id}`;
      if (estimates[localKey]) continue;
      const candidates = [id, `sensor.${id}`, `local_maintenance.${id}`];
      const sourceKey = candidates.find(key => estimates[key]);
      if (sourceKey) estimates[localKey] = structuredClone(estimates[sourceKey]);
      else if (Number(m.estimatedMaterial || 0) || Number(m.estimatedLabor || 0)) {
        estimates[localKey] = {
          material: Number(m.estimatedMaterial || 0),
          labor: Number(m.estimatedLabor || 0),
          updatedAt: m.updatedAt || new Date().toISOString(),
        };
      }
    }
    card.financeEstimates = estimates;
    const favoriteSet = new Set();
    for (const value of (Array.isArray(snapshot?.favorites) ? snapshot.favorites : [])) {
      const raw = String(value || "");
      if (!raw) continue;
      if (raw.startsWith("local_maintenance.")) favoriteSet.add(raw);
      else if (raw.startsWith("sensor.")) favoriteSet.add(`local_maintenance.${raw.slice(7)}`);
      else favoriteSet.add(`local_maintenance.${raw}`);
    }
    card.favorites = favoriteSet;
    const period = snapshot?.financePeriod && typeof snapshot.financePeriod === "object" ? snapshot.financePeriod : defaultPeriod();
    const normalized = card.normalizeFinancePeriod(period.start, period.end);
    card.financeStartDate = normalized.start;
    card.financeEndDate = normalized.end;
    card.__cpExecutions = Array.isArray(snapshot?.executions) ? structuredClone(snapshot.executions) : [];
    card.__cpSettings = snapshot?.settings || {};
    card.__cpMigration = snapshot?.migration || {};
    card.__cpRealHass = this._hass;
    card.__cpScheduleSave = () => this.scheduleSave();
    card.__cpSaveSnapshot = () => this.saveSnapshot();
    card.__cpOpenSettings = () => this.openSettings();
    card.__cpOpenNotificationSettings = () => this.openNotificationSettings();
  }

  createHassProxy(hass, card) {
    const panel = this;
    return new Proxy(hass, {
      get(target, prop, receiver) {
        if (prop === "callApi") {
          return async (method, path, parameters) => {
            if (method === "GET" && String(path || "").startsWith("history/period/")) {
              return panel.syntheticHistory(path, card);
            }
            return target.callApi(method, path, parameters);
          };
        }
        if (prop === "callService") {
          return async (domain, service, data, targetData) => {
            // V311 logs to logbook after an encapsulated completion; local synthetic
            // entity ids do not exist in HA, so the product backend is authoritative.
            if (domain === "logbook" && service === "log") return true;
            return target.callService(domain, service, data, targetData);
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }

  syntheticHistory(path, card) {
    let entities = [];
    try {
      const url = new URL(String(path), window.location.origin);
      const raw = url.searchParams.get("filter_entity_id") || "";
      entities = raw.split(",").map(x => x.trim()).filter(Boolean);
    } catch (_) {}
    const executions = Array.isArray(card.__cpExecutions) ? card.__cpExecutions : [];
    const maintenances = Array.isArray(card.registrationData?.maintenances) ? card.registrationData.maintenances : [];
    return entities.map(entityId => {
      const id = String(entityId).replace(/^local_datetime\./, "");
      const dates = executions
        .filter(x => String(x?.maintenance_id || "") === id)
        .map(x => String(x?.date || x?.execution_date || "").slice(0, 10))
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
      const raw = maintenances.find(x => String(x.id) === id);
      if (raw?.last && /^\d{4}-\d{2}-\d{2}$/.test(String(raw.last)) && !dates.includes(raw.last)) dates.push(raw.last);
      const unique = [...new Set(dates)].sort();
      const rows = [{ entity_id: entityId, state: "unknown" }];
      unique.forEach(date => rows.push({ entity_id: entityId, state: date }));
      return rows;
    });
  }

  scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveSnapshot().catch(error => { console.error("CloudPelizzon: falha ao salvar manutenção.",error); this._card?.showToast?.("Não foi possível salvar. Confira a conexão e tente novamente."); }), 350);
  }

  buildSnapshot() {
    const c = this._card;
    return {
      schemaVersion: 311,
      revision: Date.now(),
      updatedAt: new Date().toISOString(),
      financeRecords: Array.isArray(c.financeRecords) ? c.financeRecords : [],
      financeEstimates: c.financeEstimates && typeof c.financeEstimates === "object" ? c.financeEstimates : {},
      registrationData: c.registrationData && typeof c.registrationData === "object" ? c.registrationData : {},
      favorites: [...(c.favorites || [])],
      financePeriod: c.normalizeFinancePeriod(c.financeStartDate, c.financeEndDate),
    };
  }

  async saveSnapshot() {
    if (!this._card || !this._hass) throw Error("Backend CloudPelizzon indisponível.");
    clearTimeout(this._saveTimer);
    const prior=this._savePromise || Promise.resolve();
    const job=prior.catch(()=>{}).then(async()=>{
      const result=await this._hass.callWS({ type: CP_API_SAVE, snapshot: this.buildSnapshot() });
      if(result?.saved!==true) throw Error("O servidor não confirmou o salvamento da manutenção.");
      return result;
    });
    this._savePromise=job;
    return job;
  }

  async refreshBackend() {
    const snapshot = await this.getSnapshot();
    this._snapshot = snapshot;
    this.hydrateCard(this._card, snapshot);
    this._card.render();
    this._card.hass = this.createHassProxy(this._hass, this._card);
  }

  openSettings() {
    const card = this._card;
    const modal = card?.shadowRoot?.querySelector("#modal");
    if (!modal) return;
    const migration = card.__cpMigration || {};
    const execCount = Array.isArray(card.__cpExecutions) ? card.__cpExecutions.length : 0;
    modal.innerHTML = `<div class="overlay"><div class="help-modal">
      <div class="modal-head"><div><h2><ha-icon icon="mdi:cog-outline"></ha-icon> Ajustes</h2><p>Ferramentas do módulo encapsulado.</p></div><button id="close">✕</button></div>
      <div class="help-grid">
        <button data-cp-setting="refresh"><ha-icon icon="mdi:refresh"></ha-icon><b>Atualizar dados</b><p>Recarregar o storage do CloudPelizzon.</p></button>
        <button data-cp-setting="history"><ha-icon icon="mdi:history"></ha-icon><b>Histórico V311</b><p>${execCount} execução(ões) no backend • ${migration.history_import_pending === false ? "migração processada" : "migração disponível"}.</p></button>
        <button data-cp-setting="backup"><ha-icon icon="mdi:database-export-outline"></ha-icon><b>Backup JSON</b><p>Exportar os dados funcionais deste módulo.</p></button>
        <button data-cp-setting="notifications"><ha-icon icon="mdi:bell-ring-outline"></ha-icon><b>Avisos e Alexa</b><p>Políticas por prioridade, quantidade, celular, Alexa e silêncio.</p></button>
        <button data-cp-setting="actions"><ha-icon icon="mdi:lightning-bolt-circle"></ha-icon><b>Ações rápidas</b><p>Abrir as ações operacionais originais do V311.</p></button>
        <button data-cp-setting="about"><ha-icon icon="mdi:information-outline"></ha-icon><b>Sobre o módulo</b><p>R5.7 Criticality Policy UI • backend encapsulado • storage independente.</p></button>
      </div>
    </div></div>`;
    const close = () => { modal.innerHTML = ""; };
    modal.querySelector("#close").onclick = close;
    modal.querySelector(".overlay").onclick = e => { if (e.target.classList.contains("overlay")) close(); };
    modal.querySelector('[data-cp-setting="refresh"]').onclick = async () => { await this.refreshBackend(); };
    modal.querySelector('[data-cp-setting="history"]').onclick = async () => {
      try {
        const result = await this._hass.callWS({ type: CP_API_HISTORY_IMPORT });
        const snapshot = await this.getSnapshot();
        this._snapshot = snapshot;
        card.__cpExecutions = snapshot.executions || [];
        card.__cpMigration = snapshot.migration || {};
        card.healthEvolutionCache = new Map();
        card.recommendationCache = new Map();
        alert(`Histórico processado. Novas execuções importadas: ${result?.imported ?? 0}. Total: ${card.__cpExecutions.length}.`);
        this.openSettings();
      } catch (error) {
        alert(`Histórico V311: ${error?.message || error}`);
      }
    };
    modal.querySelector('[data-cp-setting="backup"]').onclick = () => {
      const payload = { ...this.buildSnapshot(), executions: card.__cpExecutions || [] };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cloudpelizzon-maintenance-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    };
    modal.querySelector('[data-cp-setting="notifications"]').onclick = () => this.openNotificationSettings();
    modal.querySelector('[data-cp-setting="actions"]').onclick = () => {
      if (typeof card.__cpOriginalOpenQuickActions === "function") card.__cpOriginalOpenQuickActions.call(card);
    };
    modal.querySelector('[data-cp-setting="about"]').onclick = () => {
      alert("CloudPelizzon Manutenção\nR5.8 Notify UX Hotfix Premium\nAPI v6\nSem localStorage/MQTT para dados do produto.");
    };
  }
  async openNotificationSettings() {
    const card = this._card;
    const modal = card?.shadowRoot?.querySelector("#modal");
    if (!modal) return;
    modal.innerHTML = `<div class="overlay"><div class="help-modal"><div class="modal-head"><div><h2><ha-icon icon="mdi:bell-ring-outline"></ha-icon> Avisos automáticos</h2><p>Carregando configuração...</p></div><button id="close">✕</button></div></div></div>`;
    const close=()=>{modal.innerHTML="";}; modal.querySelector("#close").onclick=close;
    try {
      const status = await this._hass.callWS({type:CP_API_NOTIFY_STATUS});
      const policyDefaults = {
        "Crítica": {attention_days:30,due_enabled:true,escalation_days:[7,30,90,180],escalation_count:4,mobile_enabled:true,alexa_enabled:true},
        "Importante": {attention_days:30,due_enabled:true,escalation_days:[30],escalation_count:1,mobile_enabled:true,alexa_enabled:true},
        "Baixa": {attention_days:30,due_enabled:true,escalation_days:[90,180],escalation_count:2,mobile_enabled:true,alexa_enabled:true}
      };
      const defaults = {enabled:false,prefer_existing_dispatcher:true,existing_dispatcher:"script.notificar_alexa_ou_celular",mobile_services:[],alexa_enabled:true,alexa_notify_service:"alexa_media",alexa_targets:[],quiet_start:"23:05",quiet_end:"06:00",alexa_volume:0.70,restore_volume:true,priority_policies:policyDefaults};
      const cfg = {...defaults,...(status?.settings||{})};
      cfg.priority_policies = Object.fromEntries(Object.entries(policyDefaults).map(([priority,base])=>[priority,{...base,...(cfg.priority_policies?.[priority]||{})}]));
      const services = Array.isArray(status?.notify_services)?status.notify_services:[];
      const candidates = Array.isArray(status?.alexa_candidates)?status.alexa_candidates:[];
      const targetSet = new Set(cfg.alexa_targets||[]);
      const policyCard=(priority,key,icon,caption)=>{
        const p=cfg.priority_policies[priority]||policyDefaults[priority];
        const days=Array.isArray(p.escalation_days)?p.escalation_days.join(', '):'';
        return `<article class="cp-policy-card ${key}">
          <header><span class="cp-policy-icon">${icon}</span><div><b>Criticidade ${priority}</b><small>${caption}</small></div></header>
          <div class="cp-policy-fields">
            <label>Aviso antecipado<small>Dias antes do vencimento. Use 0 para desativar o aviso antecipado.</small><div class="cp-number-unit"><input data-policy-attention="${key}" type="number" min="0" max="3650" step="1" value="${Number(p.attention_days??30)}"><span>dias</span></div></label>
            <label>Marcos após vencimento<small>Dias de atraso em que o módulo pode repetir o lembrete.</small><input data-policy-days="${key}" value="${this.escapeHtml(days)}" placeholder="Ex.: 7, 30, 90, 180"></label>
            <label class="cp-check"><input data-policy-due="${key}" type="checkbox" ${p.due_enabled!==false?'checked':''}> Avisar no vencimento</label>
            <label>Qtd. de lembretes de atraso<small>Ativa os primeiros N marcos da lista acima.</small><input data-policy-count="${key}" type="number" min="0" max="12" step="1" value="${Number(p.escalation_count??0)}"></label>
            <label class="cp-check"><input data-policy-mobile="${key}" type="checkbox" ${p.mobile_enabled!==false?'checked':''}> Enviar para celular</label>
            <label class="cp-check"><input data-policy-alexa="${key}" type="checkbox" ${p.alexa_enabled!==false?'checked':''}> Anunciar na Alexa</label>
          </div>
          <div class="cp-policy-summary" data-policy-summary="${key}"></div>
        </article>`;
      };
      modal.innerHTML = `<div class="overlay"><div class="help-modal cp-notification-settings">
        <div class="modal-head"><div><h2><ha-icon icon="mdi:bell-ring-outline"></ha-icon> Avisos automáticos e Alexa</h2><p>Um único motor interno cria e executa a política de cada manutenção conforme sua criticidade.</p></div><button id="close">✕</button></div>
        <div class="cp-notify-status ${status?.existing_dispatcher_available?'ok':'neutral'}"><b>${status?.existing_dispatcher_available?'Compatibilidade Casa Pelizzon detectada':'Modo comercial nativo'}</b><span>${status?.existing_dispatcher_available?this.escapeHtml(status.existing_dispatcher):'Configure os canais abaixo.'}</span></div>
        <section class="cp-policy-explainer">
          <div class="cp-policy-explainer-head"><ha-icon icon="mdi:information-outline"></ha-icon><div><b>Como os alertas funcionam</b><p>Cada manutenção herda automaticamente a regra da sua criticidade. O módulo envia apenas os marcos configurados e registra cada aviso para não repetir a mesma notificação.</p></div></div>
          <div class="cp-policy-flow"><span><b>1</b>Aviso antecipado</span><i>→</i><span><b>2</b>Vencimento</span><i>→</i><span><b>3</b>Lembretes de atraso</span><i>→</i><span><b>✓</b>Conclusão reinicia o ciclo</span></div>
          <p class="cp-policy-note">Exemplo: uma manutenção Crítica no padrão CloudPelizzon avisa 30 dias antes, avisa quando vence e, se continuar pendente, volta a avisar com 7, 30, 90 e 180 dias de atraso. Se o serviço for concluído antes, os próximos alertas daquele ciclo deixam de ser necessários.</p>
        </section>
        <section class="cp-priority-policy-section">
          <div class="cp-section-title"><div><h3>Criticidade × tempo × quantidade</h3><p>Personalize a rotina do cliente sem editar YAML. Alterações valem automaticamente para manutenções existentes e futuras daquela criticidade.</p></div><button type="button" data-policy-reset><ha-icon icon="mdi:restore"></ha-icon> Restaurar padrões</button></div>
          <div class="cp-priority-policy-grid">
            ${policyCard('Crítica','critical','🚨','Maior urgência e escalonamento mais próximo.')}
            ${policyCard('Importante','important','⚠️','Rotina intermediária para itens relevantes.')}
            ${policyCard('Baixa','low','🛠️','Lembretes mais espaçados para itens não críticos.')}
          </div>
          <div class="cp-policy-help"><ha-icon icon="mdi:shield-check-outline"></ha-icon><span><b>Proteção contra excesso de avisos:</b> “Atenção” e “Vencida” são enviados uma única vez por ciclo. Os lembretes de atraso também são únicos por marco. A quantidade nunca ultrapassa os marcos informados.</span></div>
        </section>
        <section class="cp-channel-section"><div class="cp-section-title"><div><h3>Canais de entrega</h3><p>Defina onde o cliente recebe os avisos.</p></div></div>
          <div class="registration-grid maintenance-fields">
            <label class="cp-check"><input id="cp-notify-enabled" type="checkbox" ${cfg.enabled?'checked':''}> Avisos automáticos ativos</label>
            <label class="cp-check"><input id="cp-prefer-dispatcher" type="checkbox" ${cfg.prefer_existing_dispatcher?'checked':''}> Preferir dispatcher existente</label>
            <label>Dispatcher existente<input id="cp-dispatcher" value="${this.escapeHtml(cfg.existing_dispatcher||'')}"></label>
            <label>Serviços de celular<small>Separe por vírgula. Ex.: mobile_app_iphone</small><input id="cp-mobile-services" value="${this.escapeHtml((cfg.mobile_services||[]).join(', '))}" list="cp-notify-services"></label>
            <datalist id="cp-notify-services">${services.map(x=>`<option value="${this.escapeHtml(x)}"></option>`).join('')}</datalist>
            <label class="cp-check"><input id="cp-alexa-enabled" type="checkbox" ${cfg.alexa_enabled?'checked':''}> Anunciar também na Alexa</label>
            <label>Serviço Alexa<input id="cp-alexa-service" value="${this.escapeHtml(cfg.alexa_notify_service||'alexa_media')}"></label>
            <label>Início do silêncio<input id="cp-quiet-start" type="time" value="${this.escapeHtml(cfg.quiet_start||'23:05')}"></label>
            <label>Fim do silêncio<input id="cp-quiet-end" type="time" value="${this.escapeHtml(cfg.quiet_end||'06:00')}"></label>
            <label>Volume do anúncio<input id="cp-alexa-volume" type="number" min="0" max="1" step="0.05" value="${Number(cfg.alexa_volume??0.7).toFixed(2)}"></label>
            <label class="cp-check"><input id="cp-restore-volume" type="checkbox" ${cfg.restore_volume?'checked':''}> Restaurar volume após o anúncio</label>
          </div>
        </section>
        <section class="cp-alexa-targets"><h3>Dispositivos Alexa</h3>${candidates.length?candidates.map(x=>`<label><input type="checkbox" data-cp-alexa-target="${this.escapeHtml(x.entity_id)}" ${targetSet.has(x.entity_id)?'checked':''}><span><b>${this.escapeHtml(x.name)}</b><small>${this.escapeHtml(x.entity_id)}</small></span></label>`).join(''):'<p>Nenhum Echo/Alexa foi identificado automaticamente. Você ainda pode usar o dispatcher existente.</p>'}</section>
        <div class="finance-entry-actions"><button data-back>Voltar</button><button data-check>Verificar agora</button><button data-test>Testar aviso</button><button class="primary" data-save>Salvar</button></div>
        <div class="cp-test-feedback" data-test-feedback aria-live="polite"></div>
      </div></div>`;
      const policyKeys={critical:'Crítica',important:'Importante',low:'Baixa'};
      const parseDays=(value)=>[...new Set(String(value||'').replaceAll(';',',').split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=1&&x<=3650))].sort((a,b)=>a-b).slice(0,12);
      const readPolicies=()=>Object.fromEntries(Object.entries(policyKeys).map(([key,priority])=>{
        const attention=Math.max(0,Math.min(3650,Number(modal.querySelector(`[data-policy-attention="${key}"]`)?.value||0)));
        const days=parseDays(modal.querySelector(`[data-policy-days="${key}"]`)?.value||'');
        const requested=Math.max(0,Math.min(12,Number(modal.querySelector(`[data-policy-count="${key}"]`)?.value||0)));
        return [priority,{attention_days:attention,due_enabled:modal.querySelector(`[data-policy-due="${key}"]`)?.checked!==false,escalation_days:days.length?days:[...policyDefaults[priority].escalation_days],escalation_count:Math.min(requested,days.length||policyDefaults[priority].escalation_days.length),mobile_enabled:modal.querySelector(`[data-policy-mobile="${key}"]`)?.checked!==false,alexa_enabled:modal.querySelector(`[data-policy-alexa="${key}"]`)?.checked!==false}];
      }));
      const updatePolicySummaries=()=>{
        const policies=readPolicies();
        Object.entries(policyKeys).forEach(([key,priority])=>{
          const p=policies[priority];
          const active=p.escalation_days.slice(0,p.escalation_count);
          const total=(p.attention_days>0?1:0)+(p.due_enabled!==false?1:0)+active.length;
          const el=modal.querySelector(`[data-policy-summary="${key}"]`);
          if(!el)return;
          const before=p.attention_days>0?`1 aviso ${p.attention_days} dia(s) antes`:'sem aviso antecipado';
          const late=active.length?`${active.length} lembrete(s) em ${active.join(', ')} dia(s) de atraso`:'sem lembretes adicionais de atraso';
          const due=p.due_enabled!==false?'1 aviso no vencimento':'sem aviso no vencimento';
          const channels=[p.mobile_enabled!==false?'celular':null,p.alexa_enabled!==false?'Alexa':null].filter(Boolean).join(' + ')||'nenhum canal';
          el.innerHTML=`<b>Regra ativa:</b> ${before} + ${due} + ${late}. <strong>Máximo: ${total} notificação(ões) por ciclo • Canais: ${channels}.</strong>`;
        });
      };
      const read=()=>({
        enabled:modal.querySelector('#cp-notify-enabled').checked,
        prefer_existing_dispatcher:modal.querySelector('#cp-prefer-dispatcher').checked,
        existing_dispatcher:modal.querySelector('#cp-dispatcher').value.trim(),
        mobile_services:modal.querySelector('#cp-mobile-services').value.split(',').map(x=>x.trim()).filter(Boolean),
        alexa_enabled:modal.querySelector('#cp-alexa-enabled').checked,
        alexa_notify_service:modal.querySelector('#cp-alexa-service').value.trim()||'alexa_media',
        alexa_targets:[...modal.querySelectorAll('[data-cp-alexa-target]:checked')].map(x=>x.dataset.cpAlexaTarget),
        quiet_start:modal.querySelector('#cp-quiet-start').value||'23:05',
        quiet_end:modal.querySelector('#cp-quiet-end').value||'06:00',
        alexa_volume:Number(modal.querySelector('#cp-alexa-volume').value||0.7),
        restore_volume:modal.querySelector('#cp-restore-volume').checked,
        priority_policies:readPolicies()
      });
      const save=async()=>{const result=await this._hass.callWS({type:CP_API_SETTINGS_UPDATE,notifications:read()}); const snap=await this.getSnapshot(); this._snapshot=snap; card.__cpSettings=snap.settings||{};return result;};
      modal.querySelectorAll('[data-policy-attention],[data-policy-days],[data-policy-count],[data-policy-due],[data-policy-mobile],[data-policy-alexa]').forEach(el=>{el.addEventListener('input',updatePolicySummaries);el.addEventListener('change',updatePolicySummaries);});
      modal.querySelector('[data-policy-reset]').onclick=()=>{
        Object.entries(policyKeys).forEach(([key,priority])=>{
          const p=policyDefaults[priority];
          modal.querySelector(`[data-policy-attention="${key}"]`).value=p.attention_days;
          modal.querySelector(`[data-policy-days="${key}"]`).value=p.escalation_days.join(', ');
          modal.querySelector(`[data-policy-count="${key}"]`).value=p.escalation_count;
          modal.querySelector(`[data-policy-due="${key}"]`).checked=p.due_enabled!==false;
          modal.querySelector(`[data-policy-mobile="${key}"]`).checked=p.mobile_enabled!==false;
          modal.querySelector(`[data-policy-alexa="${key}"]`).checked=p.alexa_enabled!==false;
        });
        updatePolicySummaries();
      };
      updatePolicySummaries();
      modal.querySelector('#close').onclick=close; modal.querySelector('[data-back]').onclick=()=>this.openSettings();
      modal.querySelector('[data-save]').onclick=async()=>{try{const r=await save();alert(r?.primed>0?`Configuração salva. ${r.primed} estado(s) atual(is) foram usados como baseline, sem alertas retroativos.`:'Configuração de avisos e políticas por criticidade salva.');this.openNotificationSettings();}catch(e){alert(`Falha ao salvar: ${e?.message||e}`);}};
      modal.querySelector('[data-test]').onclick=async()=>{
        const btn=modal.querySelector('[data-test]');
        const feedback=modal.querySelector('[data-test-feedback]');
        if(this.__cpNotifyTestRunning)return;
        this.__cpNotifyTestRunning=true;
        if(btn){btn.disabled=true;btn.dataset.originalText=btn.dataset.originalText||btn.textContent;btn.textContent='Enviando teste...';}
        if(feedback){feedback.textContent='Enviando um único teste. Aguarde a confirmação antes de clicar novamente.';feedback.className='cp-test-feedback busy';}
        try{
          await save();
          const r=await this._hass.callWS({type:CP_API_NOTIFY_TEST,criticality:'Importante'});
          if(r?.throttled){
            const wait=Math.max(1,Number(r.retry_after||10));
            if(feedback){feedback.textContent=`Teste ignorado para evitar duplicidade. Aguarde ${wait}s e tente novamente.`;feedback.className='cp-test-feedback warn';}
          }else if(r?.delivered){
            if(feedback){feedback.textContent=`✓ Teste ${r.criticality||'Importante'} aceito por: ${(r.channels||[]).join(', ')}.`;feedback.className='cp-test-feedback ok';}
          }else{
            if(feedback){feedback.textContent=`Nenhum canal entregou o teste. ${r?.result||''}`;feedback.className='cp-test-feedback warn';}
          }
        }catch(e){
          if(feedback){feedback.textContent=`Falha no teste: ${e?.message||e}`;feedback.className='cp-test-feedback error';}
        }finally{
          setTimeout(()=>{this.__cpNotifyTestRunning=false;if(btn){btn.disabled=false;btn.textContent=btn.dataset.originalText||'Testar aviso';}},10000);
        }
      };
      modal.querySelector('[data-check]').onclick=async()=>{try{await save();const r=await this._hass.callWS({type:CP_API_NOTIFY_CHECK});alert(`Verificação concluída. Avisos enviados: ${r?.sent??0}.`);}catch(e){alert(`Falha na verificação: ${e?.message||e}`);}};
    } catch(error) { alert(`Não foi possível abrir os avisos automáticos: ${error?.message||error}`); this.openSettings(); }
  }

}

if (!customElements.get("cloudpelizzon-maintenance-panel")) {
  customElements.define("cloudpelizzon-maintenance-panel", CloudPelizzonMaintenancePanel);
}
