/* ============================================================================
 * CLOUDPELIZZON // MALHA ENERGÉTICA
 * EMS residencial / Home Assistant
 * Version: 15.0.0
 * ============================================================================
 * - Novo layout operacional, menos minimalista e orientado a leitura rápida.
 * - Filtro global DE / ATÉ aplicado a todos os dados históricos de todas as abas.
 * - Fluxo em tempo real permanece sempre "AGORA" para não misturar potência com
 *   energia acumulada do período.
 * - Abas funcionais e exclusivas: Visão Geral, Geração, Consumo, Rede elétrica,
 *   Quadros, Histórico, Análises e Status.
 * - Responsivo para desktop, tablet e celular.
 * - Sem bibliotecas externas.
 * ============================================================================
 */

class CasaPelizzonEnergyOpsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._tab = "overview";
    this._rangeMode = "today";
    this._customStart = "";
    this._customEnd = "";
    this._range = this._resolveRange("today");
    this._history = {};
    this._historyLoading = false;
    this._historyError = "";
    this._historyKey = "";
    this._queued = false;
    this._clockTimer = null;
    this._summaryMode = "today";
    this._summaryHistory = {};
    this._summaryHistoryKey = "";
    this._summaryLoading = false;
    this._summaryError = "";
    this._summaryRequestSeq = 0;
    this._dateEditing = false;
  }

  static getStubConfig() { return {}; }
  getCardSize() { return 20; }
  getGridOptions() { return { rows: "auto", columns: 12, min_columns: 12 }; }

  connectedCallback() {
    if (!this._clockTimer) {
      this._clockTimer = setInterval(() => {
        const clock = this.shadowRoot?.querySelector("#energyClock");
        const date = this.shadowRoot?.querySelector("#energyDate");
        if (clock) clock.textContent = this._clockText();
        if (date) date.textContent = this._dateText();
      }, 30000);
    }
  }

  disconnectedCallback() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._clockTimer = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._historyLoading && (!this._historyKey || Date.now()-(this._lastHistoryAttempt141||0)>=60000)) this._loadHistory(Boolean(this._historyKey));

    const active=this.shadowRoot?.activeElement;
    const editingDate=this._dateEditing || active?.matches?.("#rangeStart,#rangeEnd");
    if (editingDate) {
      const clock=this.shadowRoot?.querySelector("#energyClock");
      const date=this.shadowRoot?.querySelector("#energyDate");
      if (clock) clock.textContent=this._clockText();
      if (date) date.textContent=this._dateText();
      return;
    }

    const nowMs=Date.now();
    const minRenderGap=10000;
    if (!this._lastVisualRender || (nowMs-this._lastVisualRender)>=minRenderGap) {
      if (!this._queued) {
        this._queued = true;
        requestAnimationFrame(() => {
          this._queued = false;
          const activeNow=this.shadowRoot?.activeElement;
          if (this._dateEditing || activeNow?.matches?.("#rangeStart,#rangeEnd")) return;
          this._lastVisualRender=Date.now();
          this._render();
        });
      }
    }
  }

  get hass() { return this._hass; }

  /* --------------------------------------------------------------------------
   * ENTIDADES
   * Mantidas a partir da versão fornecida pelo usuário.
   * -------------------------------------------------------------------------- */
  get entities() {
    const cp = this._config?.cloudpelizzon_entities;
    if (cp) return cp;
    return {
      solarPower: this._config.solar_power || "sensor.solar_potencia_total",
      sofarPower: this._config.sofar_power || "sensor.inverter_power",
      sofarFallback: this._config.sofar_power_fallback || "sensor.solar_potencia_inversor",
      deyePower: this._config.deye_power || "sensor.micro_power",

      sofarEnergyTotal: this._config.sofar_energy_total || "sensor.inverter_total_production",
      deyeEnergyTotal: this._config.deye_energy_total || "sensor.micro_total_production",

      qd1Power: this._config.qd1_power || "sensor.qd1_potencia_consumida",
      qd2Power: this._config.qd2_power || "sensor.qd2_potencia_consumida",
      housePower: this._config.house_power || "sensor.casa_potencia_consumida_total",

      importPower: this._config.grid_import_power || "sensor.copel_potencia_importacao",
      exportPower: this._config.grid_export_power || "sensor.copel_potencia_exportacao",

      qd1Energy: this._config.qd1_energy || "sensor.telemetria_quadro_1_energy",
      qd2Energy: this._config.qd2_energy || "sensor.telemetria_quadro_2_energy",

      solarEnergy: this._config.solar_energy || "sensor.solar_energia_gerada_oficial",
      solarEnergyFallback: this._config.solar_energy_fallback || "sensor.solar_energia_gerada_oficial_2",
      importEnergy: this._config.grid_import_energy || "sensor.copel_energia_importada_oficial",
      importEnergyFallback: this._config.grid_import_energy_fallback || "sensor.copel_energia_importada_oficial_2",
      exportEnergy: this._config.grid_export_energy || "sensor.copel_energia_exportada_oficial",
      exportEnergyFallback: this._config.grid_export_energy_fallback || "sensor.copel_energia_exportada_oficial_2",

      devices: {
        qd1: [
          { key:"escritorio", name:"Escritório", short:"ESCRITÓRIO", icon:"desktop", power:"sensor.escritorio_power", energy:"sensor.escritorio_energy" },
          { key:"geladeira", name:"Geladeira", short:"GELADEIRA", icon:"fridge", power:"sensor.tomada_geladeira_power", energy:"sensor.tomada_geladeira_energy" },
          { key:"lavadora", name:"Máquina de lavar", short:"LAVADORA", icon:"washer", power:"sensor.maquina_de_lavar_roupas_power", energy:"sensor.maquina_de_lavar_roupas_energy" },
          { key:"tv", name:"Painel TV Sala", short:"PAINEL TV", icon:"tv", power:"sensor.painel_tv_sala_power", energy:"sensor.painel_tv_sala_energy" },
          { key:"hall", name:"Hall de entrada", short:"HALL", icon:"light", power:"sensor.tomada_hall_de_entrada_power", energy:"sensor.tomada_hall_de_entrada_energy" }
        ],
        qd2: [
          { key:"roteador", name:"Roteador escada", short:"ROTEADOR", icon:"router", power:"sensor.tomada_roteador_escada_power", energy:"sensor.tomada_roteador_escada_energy" },
          { key:"casal", name:"Quarto casal", short:"QT CASAL", icon:"bedroom", power:"sensor.tomada_qt_casal_power", energy:"sensor.tomada_qt_casal_energy" },
          { key:"heloisa", name:"Quarto Heloísa", short:"QT HELOÍSA", icon:"bedroom", power:"sensor.tomada_qt_heloisa_power", energy:"sensor.tomada_qt_heloisa_energy" },
          { key:"bracket", name:"Bracket", short:"BRACKET", icon:"bracket", power:"sensor.tomada_bracket_power", energy:"sensor.tomada_bracket_energy" }
        ]
      }
    };
  }

  /* --------------------------------------------------------------------------
   * HELPERS
   * -------------------------------------------------------------------------- */
  _state(id) { return this._hass?.states?.[id]; }
  _valid(id) {
    const s = this._state(id);
    return !!s && !["unknown","unavailable","none","null",""].includes(String(s.state).toLowerCase());
  }
  _num(id, fallback=0) {
    if (!this._valid(id)) return fallback;
    const v = Number(this._state(id).state);
    return Number.isFinite(v) ? v : fallback;
  }
  _numFirst(ids, fallback=0) {
    for (const id of ids) if (this._valid(id)) return this._num(id, fallback);
    return fallback;
  }
  _fmtW(v) {
    v = Number(v) || 0;
    if (Math.abs(v) >= 1000) return `${(v/1000).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})} kW`;
    return `${Math.round(v).toLocaleString("pt-BR")} W`;
  }
  _fmtK(v, d=2) {
    if (!Number.isFinite(Number(v))) return "—";
    return `${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d})} kWh`;
  }
  _fmtPct(v, d=0) {
    return `${(Number(v)||0).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d})}%`;
  }
  _fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  }
  _clockText() {
    return new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
  }
  _dateText() {
    return new Date().toLocaleDateString("pt-BR", { weekday:"short", day:"2-digit", month:"short", year:"numeric" }).toUpperCase();
  }
  _esc(v) {
    return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  _clamp(v,min,max){ return Math.max(min,Math.min(max,Number(v)||0)); }

  _svgIcon(type) {
    const c=`viewBox="0 0 24 24" aria-hidden="true" focusable="false"`;
    const icons={
      solar:`<svg ${c} class="ico ico-solar"><circle class="icon-orbit" cx="12" cy="12" r="5.2"/><circle class="icon-core" cx="12" cy="12" r="2.5"/><path class="icon-rays" d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.35 4.35l2.1 2.1M17.55 17.55l2.1 2.1M19.65 4.35l-2.1 2.1M6.45 17.55l-2.1 2.1"/></svg>`,
      inverter:`<svg ${c} class="ico ico-inverter"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path class="icon-wave" d="M6.5 14c1.4-3.6 2.8-3.6 4.2 0s2.8 3.6 4.2 0 2.8-3.6 4.2 0"/><circle cx="8" cy="8" r="1.3"/><path d="M15.5 7.5h2.5M15.5 10h2.5"/></svg>`,
      micro:`<svg ${c} class="ico ico-micro"><rect x="5" y="5" width="14" height="14" rx="4"/><circle class="icon-orbit" cx="12" cy="12" r="4"/><circle class="icon-core" cx="12" cy="12" r="1.8"/><path class="icon-rays" d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.5 4.5l1.7 1.7M17.8 17.8l1.7 1.7M19.5 4.5l-1.7 1.7M6.2 17.8l-1.7 1.7"/></svg>`,
      house:`<svg ${c} class="ico ico-house"><path d="M2.8 11.2 12 3.5l9.2 7.7"/><path d="M5 10.5V20h14v-9.5"/><path d="M9.2 20v-6h5.6v6"/><path class="icon-window" d="M7 12h2M15 12h2"/><path class="icon-energy" d="m12.8 7-2.1 3.3h1.9l-.8 3.1 3-4.3h-2V7Z"/></svg>`,
      grid:`<svg ${c} class="ico ico-grid"><path d="M9.2 2.5h5.6L17.4 21H6.6L9.2 2.5Z"/><path d="M8.4 7.4h7.2M7.8 12.3h8.4M7.2 16.8h9.6"/><path d="m7 21 5-8 5 8M6 8.5 12 12.3l6-3.8"/><path class="icon-energy" d="m18.7 4.1-1.5 2.5h1.4l-.7 2.4 2.3-3.2h-1.5V4.1Z"/></svg>`,
      import:`<svg ${c} class="ico ico-import"><path d="M7.5 3.2h5L15 20.8H5L7.5 3.2Z"/><path d="M6.9 8.2h7M6.3 13h8.3M5.8 17h9.3"/><path d="M16.8 8.2h4.3M18.8 6.2l2.2 2-2.2 2"/><path class="icon-energy" d="M20.5 14.2H14M16.3 11.8 14 14.2l2.3 2.3"/></svg>`,
      export:`<svg ${c} class="ico ico-export"><path d="M11.5 3.2h5L19 20.8H9L11.5 3.2Z"/><path d="M10.9 8.2h7M10.3 13h8.3M9.8 17h9.3"/><path d="M7.2 8.2H2.9M5.2 6.2l-2.2 2 2.2 2"/><path class="icon-energy" d="M3.5 14.2H10M7.7 11.8l2.3 2.4-2.3 2.3"/></svg>`,
      qd:`<svg ${c} class="ico ico-qd"><rect x="3.5" y="2.5" width="17" height="19" rx="3"/><path d="M7.5 7h9M7.5 10.5h9M7.5 14h5"/><path class="icon-energy" d="m15 12-2.8 4.4h2.5L13.6 21l4.2-6h-2.7l-.1-3Z"/></svg>`,
      desktop:`<svg ${c} class="ico ico-desktop"><rect x="2.5" y="3.5" width="19" height="13" rx="2.5"/><path d="M8 21h8M12 16.5V21"/><path class="icon-wave" d="M5.5 12.5c2-3 3.5 2 5.5 0s3.5-2 5.5 0"/></svg>`,
      fridge:`<svg ${c} class="ico ico-fridge"><rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M6.5 9h11M14.2 5v2M14.2 12v3"/><path class="icon-detail" d="M9 5h2M9 13h2"/></svg>`,
      washer:`<svg ${c} class="ico ico-washer"><rect x="3.5" y="2.5" width="17" height="19" rx="2.5"/><circle class="icon-orbit" cx="12" cy="13.5" r="5.2"/><path class="icon-wave" d="M8.5 13.5c1.2-2 2.4 2 3.6 0s2.4-2 3.6 0"/><circle cx="7" cy="6.3" r=".8"/><path d="M10 6.3h5"/></svg>`,
      tv:`<svg ${c} class="ico ico-tv"><rect x="2.5" y="4" width="19" height="13.5" rx="2.5"/><path d="M8 21h8M12 17.5V21"/><path class="icon-wave" d="m6.5 13 3-3 2.3 1.8 4.2-4.3"/></svg>`,
      light:`<svg ${c} class="ico ico-light"><path d="M9 18h6M10 21h4"/><path d="M8.3 15.7A6.5 6.5 0 1 1 15.7 15.7L14.3 17H9.7l-1.4-1.3Z"/><path class="icon-rays" d="M12 1v2M3.7 4.2l1.4 1.4M20.3 4.2l-1.4 1.4"/></svg>`,
      router:`<svg ${c} class="ico ico-router"><rect x="3.5" y="13" width="17" height="7.5" rx="2.5"/><circle cx="8" cy="16.8" r=".7"/><circle cx="12" cy="16.8" r=".7"/><circle cx="16" cy="16.8" r=".7"/><path class="icon-wave" d="M7 10a7.5 7.5 0 0 1 10 0M9.4 7.4a3.8 3.8 0 0 1 5.2 0M12 3.5v2"/></svg>`,
      bedroom:`<svg ${c} class="ico ico-bedroom"><path d="M2.5 19V8.5M21.5 19v-6.5A3.5 3.5 0 0 0 18 9H9v10"/><path d="M2.5 14h19M6 9V5.5h5A3.5 3.5 0 0 1 14.5 9"/><path class="icon-detail" d="M5 18v2M19 18v2"/></svg>`,
      bracket:`<svg ${c} class="ico ico-bracket"><path d="M5 3v18M5 6h12a2 2 0 0 1 2 2v3H9v8"/><path d="M9 14h8"/><circle class="icon-core" cx="17.5" cy="8.5" r="1.2"/></svg>`,
      bolt:`<svg ${c} class="ico ico-bolt"><path class="icon-energy" d="M13.3 1.8 4.8 14h6.1l-1 8.2 9.3-13.4h-6.1l.2-7Z"/><path class="icon-detail" d="M6.5 18.5h-3M20.5 5.5h-3"/></svg>`,
      chart:`<svg ${c} class="ico ico-chart"><path d="M3 20V4M3 20h18"/><path class="icon-wave" d="m6 15 3.6-4 3 2.2 5.4-7"/><circle class="icon-core" cx="18" cy="6.2" r="1.4"/></svg>`,
      status:`<svg ${c} class="ico ico-status"><circle class="icon-orbit" cx="12" cy="12" r="8.7"/><path d="m7.8 12 2.7 2.7 5.8-6"/><path class="icon-detail" d="M12 1.8v2M12 20.2v2"/></svg>`,
      calendar:`<svg ${c} class="ico ico-calendar"><rect x="2.8" y="4.5" width="18.4" height="16.5" rx="2.5"/><path d="M7 2.5v4M17 2.5v4M2.8 9.5h18.4"/><path class="icon-detail" d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/></svg>`,
      peak:`<svg ${c} class="ico ico-peak"><path class="icon-flame" d="M12 1.8c3.4 4.4 5.5 7.1 5.5 10.5a5.5 5.5 0 1 1-11 0c0-2.2 1.1-4.3 3.2-6.5-.2 2.9 1 4.4 2.4 5.2-.2-3.6-.1-6.2-.1-9.2Z"/><path class="icon-detail" d="M12 15c1.7-1.3 2.4-2.5 2.3-4.4 1.2 1.5 1.8 2.6 1.8 4A4 4 0 0 1 8 14.6c0-1 .4-2 1.3-3 .2 1.8 1 2.7 2.7 3.4Z"/></svg>`
    };
    return icons[type] || icons.status;
  }

  /* --------------------------------------------------------------------------
   * PERÍODO GLOBAL
   * -------------------------------------------------------------------------- */
  _startOfDay(d=new Date()) { const x=new Date(d); x.setHours(0,0,0,0); return x; }
  _endOfDay(d=new Date()) { const x=new Date(d); x.setHours(23,59,59,999); return x; }
  _startOfMonth(d=new Date()) { const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }

  _resolveRange(mode) {
    const now = new Date();
    if (mode === "today") return { start:this._startOfDay(now), end:now, label:"HOJE" };
    if (mode === "yesterday") {
      const d=new Date(now); d.setDate(d.getDate()-1);
      return { start:this._startOfDay(d), end:this._endOfDay(d), label:"ONTEM" };
    }
    if (mode === "7d") {
      const d=new Date(now); d.setDate(d.getDate()-6);
      return { start:this._startOfDay(d), end:now, label:"ÚLTIMOS 7 DIAS" };
    }
    if (mode === "30d") {
      const d=new Date(now); d.setDate(d.getDate()-29);
      return { start:this._startOfDay(d), end:now, label:"ÚLTIMOS 30 DIAS" };
    }
    if (mode === "month") return { start:this._startOfMonth(now), end:now, label:"MÊS ATUAL" };
    if (mode === "custom" && this._customStart && this._customEnd) {
      const start = new Date(`${this._customStart}T00:00:00`);
      const endBase = new Date(`${this._customEnd}T23:59:59.999`);
      const end = endBase > now ? now : endBase;
      return { start, end, label:`${this._dateBR(start)} → ${this._dateBR(end)}` };
    }
    return { start:this._startOfDay(now), end:now, label:"HOJE" };
  }

  _dateBR(d) { return new Date(d).toLocaleDateString("pt-BR"); }

  _periodShortLabel() {
    if (this._rangeMode==="today") return "HOJE";
    if (this._rangeMode==="yesterday") return "ONTEM";
    if (this._rangeMode==="7d") return "7 DIAS";
    if (this._rangeMode==="30d") return "30 DIAS";
    if (this._rangeMode==="month") return "MÊS";
    if (this._rangeMode==="custom") return "PERÍODO";
    return this._range?.label || "PERÍODO";
  }

  _periodCardSuffix() {
    return this._rangeMode==="today" ? "(HOJE)" :
           this._rangeMode==="yesterday" ? "(ONTEM)" :
           `(${this._periodShortLabel()})`;
  }


  _startOfYear(d=new Date()) {
    const x=new Date(d);
    x.setMonth(0,1);
    x.setHours(0,0,0,0);
    return x;
  }

  _summaryRange(mode) {
    const now=new Date();
    if (mode==="today") return {start:this._startOfDay(now),end:now,label:"HOJE"};
    if (mode==="month") return {start:this._startOfMonth(now),end:now,label:"MÊS"};
    if (mode==="year") return {start:this._startOfYear(now),end:now,label:"ANO"};
    return null;
  }

  _summaryEnergyIds() {
    const e=this.entities;
    return [...new Set([
      e.solarEnergy,e.solarEnergyFallback,
      e.sofarEnergyTotal,e.deyeEnergyTotal,
      e.qd1Energy,e.qd2Energy,
      e.importEnergy,e.importEnergyFallback,
      e.exportEnergy,e.exportEnergyFallback
    ].filter(Boolean))];
  }

  _seriesFromHistory(history,id) {
    const raw=history?.[id];
    if (!Array.isArray(raw)) return [];
    return raw.map(p=>{
      const v=Number(p.state ?? p.s ?? NaN);
      let t=p.last_changed ?? p.last_updated ?? p.lc ?? p.lu ?? null;
      if (typeof t==="number") { if (t<1e12) t*=1000; t=new Date(t); }
      else if (typeof t==="string") t=new Date(t);
      if (!Number.isFinite(v) || !(t instanceof Date) || Number.isNaN(t.getTime())) return null;
      return {t:t.getTime(),v};
    }).filter(Boolean).sort((a,b)=>a.t-b.t);
  }

  _bestSeriesFromHistory(history,ids) {
    for (const id of (Array.isArray(ids)?ids:[ids])) {
      const s=this._seriesFromHistory(history,id);
      if (s.length) return s;
    }
    return [];
  }

  _summaryEnergyFromHistory(ids) {
    return this._delta(this._bestSeriesFromHistory(this._summaryHistory,ids));
  }

  _summaryLifetime() {
    const e=this.entities;
    const solar=this._numFirst([e.solarEnergy,e.solarEnergyFallback],0);
    const sofar=this._num(e.sofarEnergyTotal,0);
    const deye=this._num(e.deyeEnergyTotal,0);
    const qd1=this._num(e.qd1Energy,0);
    const qd2=this._num(e.qd2Energy,0);
    const imp=this._numFirst([e.importEnergy,e.importEnergyFallback],0);
    const exp=this._numFirst([e.exportEnergy,e.exportEnergyFallback],0);
    return {solar,sofar,deye,qd1,qd2,house:qd1+qd2,imp,exp,balance:exp-imp};
  }

  _summaryPeriod(fallbackPeriod) {
    if (this._summaryMode==="lifetime") return this._summaryLifetime();

    const desired=this._summaryRange(this._summaryMode);
    const desiredKey=desired?`${desired.start.toISOString()}|${desired.end.toISOString()}`:"";

    // For today's summary, reuse the already loaded global today data.
    if (this._summaryMode==="today" && this._rangeMode==="today") {
      return {
        solar:fallbackPeriod.solar,sofar:fallbackPeriod.sofar,deye:fallbackPeriod.deye,
        qd1:fallbackPeriod.qd1,qd2:fallbackPeriod.qd2,house:fallbackPeriod.house,
        imp:fallbackPeriod.imp,exp:fallbackPeriod.exp,balance:fallbackPeriod.balance
      };
    }

    if (this._summaryHistoryKey===desiredKey) {
      const e=this.entities;
      const solar=this._summaryEnergyFromHistory([e.solarEnergy,e.solarEnergyFallback]);
      const sofar=this._summaryEnergyFromHistory(e.sofarEnergyTotal);
      const deye=this._summaryEnergyFromHistory(e.deyeEnergyTotal);
      const qd1=this._summaryEnergyFromHistory(e.qd1Energy);
      const qd2=this._summaryEnergyFromHistory(e.qd2Energy);
      const imp=this._summaryEnergyFromHistory([e.importEnergy,e.importEnergyFallback]);
      const exp=this._summaryEnergyFromHistory([e.exportEnergy,e.exportEnergyFallback]);
      return {solar,sofar,deye,qd1,qd2,house:qd1+qd2,imp,exp,balance:exp-imp};
    }

    // Keep the current card populated while the selected summary period is loading.
    return {
      solar:fallbackPeriod.solar,sofar:fallbackPeriod.sofar,deye:fallbackPeriod.deye,
      qd1:fallbackPeriod.qd1,qd2:fallbackPeriod.qd2,house:fallbackPeriod.house,
      imp:fallbackPeriod.imp,exp:fallbackPeriod.exp,balance:fallbackPeriod.balance
    };
  }

  async _setSummaryMode(mode) {
    this._summaryMode=mode;
    this._render();
    if (mode==="lifetime") return;
    if (mode==="today" && this._rangeMode==="today") return;
    await this._loadSummaryHistory(mode);
  }

  async _loadSummaryHistory(mode=this._summaryMode) {
    if (!this._hass || mode==="lifetime") return;
    const range=this._summaryRange(mode);
    if (!range) return;

    const key=`${range.start.toISOString()}|${range.end.toISOString()}`;
    if (key===this._summaryHistoryKey && Object.keys(this._summaryHistory).length) return;

    const seq=++this._summaryRequestSeq;
    this._summaryLoading=true;
    this._summaryError="";
    this._render();

    const merged={};
    const merge=part=>{
      if (!part || typeof part!=="object") return;
      for (const [entity,rows] of Object.entries(part)) {
        if (!Array.isArray(rows)) continue;
        if (!merged[entity]) merged[entity]=[];
        merged[entity].push(...rows);
      }
    };

    try {
      const ids=this._summaryEnergyIds();
      const startMs=range.start.getTime();
      const endMs=range.end.getTime();
      const CHUNK=31*24*60*60*1000;
      let cursor=startMs;

      while (cursor<endMs) {
        if (seq!==this._summaryRequestSeq) return;
        const next=Math.min(endMs,cursor+CHUNK);
        const part=await this._hass.callWS({
          type:"history/history_during_period",
          start_time:new Date(cursor).toISOString(),
          end_time:new Date(next).toISOString(),
          entity_ids:ids,
          minimal_response:true,
          no_attributes:true,
          significant_changes_only:false,
          include_start_time_state:true
        }) || {};
        merge(part);
        cursor=next;
      }

      if (seq!==this._summaryRequestSeq) return;

      for (const [entity,rows] of Object.entries(merged)) {
        const seen=new Set();
        merged[entity]=rows.slice().sort((a,b)=>{
          const ta=Date.parse(a.last_changed??a.last_updated??a.lc??a.lu??0)||0;
          const tb=Date.parse(b.last_changed??b.last_updated??b.lc??b.lu??0)||0;
          return ta-tb;
        }).filter(row=>{
          const t=row.last_changed??row.last_updated??row.lc??row.lu??"";
          const k=`${t}|${row.state??row.s??""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }

      this._summaryHistory=merged;
      this._summaryHistoryKey=key;
    } catch(err) {
      console.error("[CasaPelizzon Energy V37] summary history",err);
      if (seq===this._summaryRequestSeq) this._summaryError=err?.message || String(err);
    } finally {
      if (seq===this._summaryRequestSeq) {
        this._summaryLoading=false;
        this._render();
      }
    }
  }


  async _setRange(mode) {
    this._rangeMode = mode;
    this._range = this._resolveRange(mode);
    this._historyKey = "";
    this._historyRequestSeq = (this._historyRequestSeq || 0) + 1;
    const seq = this._historyRequestSeq;
    this._historyLoading = false;
    this._render();
    await this._loadHistory(true, seq);
  }

  _historyEntityIds() {
    const e=this.entities;
    const ids=new Set([
      e.solarPower,e.sofarPower,e.sofarFallback,e.deyePower,e.sofarEnergyTotal,e.deyeEnergyTotal,
      e.qd1Power,e.qd2Power,e.housePower,e.importPower,e.exportPower,e.qd1Energy,e.qd2Energy,
      e.solarEnergy,e.solarEnergyFallback,e.importEnergy,e.importEnergyFallback,e.exportEnergy,e.exportEnergyFallback
    ]);
    for (const d of [...e.devices.qd1,...e.devices.qd2]) { ids.add(d.power); ids.add(d.energy); }
    for(const row of this._config.unassigned_loads||[]){if(row.power)ids.add(row.power);if(row.energy)ids.add(row.energy);}
    return [...ids].filter(id=>id&&id!=='sensor.cloudpelizzon_energy_not_configured');
  }

  async _loadHistory(force=false, requestedSeq=null) {
    if (!this._hass) return;
    const seq = requestedSeq ?? ((this._historyRequestSeq || 0) + 1);
    this._historyRequestSeq = Math.max(this._historyRequestSeq || 0, seq);
    this._range=this._resolveRange(this._rangeMode);
    const key=`${this._range.start.toISOString()}|${this._range.end.toISOString()}`;
    if (!force && key === this._historyKey) return;

    this._lastHistoryAttempt141=Date.now();
    this._historyLoading=true;
    this._historyError="";
    this._render();

    const merge=(target,part)=>{
      if (!part || typeof part!=="object") return;
      for (const [entity,rows] of Object.entries(part)) {
        if (!Array.isArray(rows)) continue;
        if (!target[entity]) target[entity]=[];
        target[entity].push(...rows);
      }
    };

    try {
      const ids=this._historyEntityIds();
      const startMs=this._range.start.getTime();
      const endMs=this._range.end.getTime();
      const span=endMs-startMs;
      const DAY=24*60*60*1000;
      const merged={};

      // Today/yesterday: one call. Longer ranges: daily chunks.
      if (span <= DAY*1.5) {
        const part=await this._hass.callWS({
          type:"history/history_during_period",
          start_time:this._range.start.toISOString(),
          end_time:this._range.end.toISOString(),
          entity_ids:ids,
          minimal_response:true,
          no_attributes:true,
          significant_changes_only:false,
          include_start_time_state:true
        }) || {};
        merge(merged,part);
      } else {
        let cursor=startMs;
        while (cursor < endMs) {
          if (seq !== this._historyRequestSeq) return;
          const next=Math.min(endMs,cursor+DAY);
          const part=await this._hass.callWS({
            type:"history/history_during_period",
            start_time:new Date(cursor).toISOString(),
            end_time:new Date(next).toISOString(),
            entity_ids:ids,
            minimal_response:true,
            no_attributes:true,
            significant_changes_only:false,
            include_start_time_state:true
          }) || {};
          merge(merged,part);
          cursor=next;
        }
      }

      if (seq !== this._historyRequestSeq) return;

      // Sort and deduplicate by timestamp/state to avoid seams between chunks.
      for (const [entity,rows] of Object.entries(merged)) {
        const seen=new Set();
        merged[entity]=rows
          .slice()
          .sort((a,b)=>{
            const ta=Date.parse(a.last_changed??a.last_updated??a.lc??a.lu??0)||0;
            const tb=Date.parse(b.last_changed??b.last_updated??b.lc??b.lu??0)||0;
            return ta-tb;
          })
          .filter(row=>{
            const t=row.last_changed??row.last_updated??row.lc??row.lu??"";
            const k=`${t}|${row.state??row.s??""}`;
            if (seen.has(k)) return false;
            seen.add(k); return true;
          });
      }

      this._history=merged;
      this._historyKey=key;
    } catch(err) {
      console.error("[CasaPelizzon Energy V28] history", err);
      if (seq === this._historyRequestSeq) this._historyError=err?.message || String(err);
    } finally {
      if (seq === this._historyRequestSeq) {
        this._historyLoading=false;
        this._render();
      }
    }
  }

  _series(id) {
    const raw=this._history?.[id];
    if (!Array.isArray(raw)) return [];
    return raw.map(p=>{
      const v=Number(p.state ?? p.s ?? NaN);
      let t=p.last_changed ?? p.last_updated ?? p.lc ?? p.lu ?? null;
      if (typeof t === "number") { if (t<1e12) t*=1000; t=new Date(t); }
      else if (typeof t === "string") t=new Date(t);
      if (!Number.isFinite(v) || !(t instanceof Date) || Number.isNaN(t.getTime())) return null;
      return { t:t.getTime(), v };
    }).filter(Boolean).sort((a,b)=>a.t-b.t);
  }

  _bestSeries(ids) {
    for (const id of (Array.isArray(ids)?ids:[ids])) {
      const s=this._series(id);
      if (s.length) return s;
    }
    return [];
  }

  _delta(series) {
    if (!series || series.length<2) return 0;
    let total=0, prev=series[0].v;
    for (let i=1;i<series.length;i++) {
      const cur=series[i].v, d=cur-prev;
      if (d>=0) total+=d;
      else if (cur>=0) total+=cur; // tolera reset de medidor
      prev=cur;
    }
    return Math.max(0,total);
  }


  _periodEnergy(idOrIds) {
    const ids=Array.isArray(idOrIds)?idOrIds:[idOrIds];
    if(this._rangeMode==='today'){
      for(const id of ids){
        if(!/(?:^|_)(hoje|today|daily|diaria|diario)(?:_|$)/i.test(id||''))continue;
        const row=this._hass?.states?.[id],v=Number(row?.state);
        if(row&&row.state!==''&&Number.isFinite(v)&&v>=0&&String(row.attributes?.unit_of_measurement||'').toLowerCase()==='kwh')return v;
      }
    }
    return this._delta(this._bestSeries(idOrIds));
  }

  _peak(idOrIds) {
    const s=this._bestSeries(idOrIds);
    if (!s.length) return { value:0, time:null };
    return s.reduce((best,p)=>p.v>best.value?{value:p.v,time:p.t}:best,{value:-Infinity,time:null});
  }


  _valueNear(id, timestamp, toleranceMs=180000) {
    if (!id || !timestamp) return 0;
    const s=this._series(id);
    if (!s.length) return 0;
    let best=null, bestDt=Infinity;
    for (const p of s) {
      const dt=Math.abs(p.t-timestamp);
      if (dt<bestDt) { best=p; bestDt=dt; }
    }
    return best && bestDt<=toleranceMs ? Math.max(0,Number(best.v)||0) : 0;
  }

  _peakContributors(peakTime, housePeakValue) {
    if (!peakTime) return { items:[], tracked:0, other:Math.max(0,Number(housePeakValue)||0) };
    const all=[...this.entities.devices.qd1,...this.entities.devices.qd2];
    const items=all.map(d=>({
      ...d,
      peakMomentPower:this._valueNear(d.power,peakTime,180000)
    }))
    .filter(d=>d.peakMomentPower>1)
    .sort((a,b)=>b.peakMomentPower-a.peakMomentPower);
    const tracked=items.reduce((sum,d)=>sum+d.peakMomentPower,0);
    const other=Math.max(0,(Number(housePeakValue)||0)-tracked);
    return {items,tracked,other};
  }

  _bucket(idOrIds,buckets=72) {
    const s=this._bestSeries(idOrIds);
    if (!s.length) return [];
    const start=this._range.start.getTime(), end=this._range.end.getTime();
    const span=Math.max(1,end-start), size=span/buckets;
    const data=Array.from({length:buckets},()=>[]);
    let lastRealTs=0;
    for (const p of s) {
      if (p.t<start || p.t>end) continue;
      let i=Math.floor((p.t-start)/size);
      i=Math.max(0,Math.min(buckets-1,i));
      data[i].push(p.v);
      lastRealTs=Math.max(lastRealTs,p.t);
    }
    let last=0, hasLast=false;
    return data.map((a,i)=>{
      const center=start+(i+.5)*size;
      if (a.length) { last=a.reduce((x,y)=>x+y,0)/a.length; hasLast=true; }
      const isFutureGap = lastRealTs && center > lastRealTs + size*1.35;
      return {t:center,v:(hasLast && !isFutureGap)?last:0,empty:!a.length};
    });
  }

  _live() {
    const e=this.entities;
    const sofar=this._numFirst([e.sofarPower,e.sofarFallback],0);
    const deye=this._num(e.deyePower,0);
    const solar=this._valid(e.solarPower)?this._num(e.solarPower,0):sofar+deye;
    const qd1=this._num(e.qd1Power,0);
    const qd2=this._num(e.qd2Power,0);
    const house=this._valid(e.housePower)?this._num(e.housePower,qd1+qd2):qd1+qd2;
    const balance=house-solar;
    const imp=this._valid(e.importPower)?this._num(e.importPower,0):Math.max(0,balance);
    const exp=this._valid(e.exportPower)?this._num(e.exportPower,0):Math.max(0,-balance);
    const qd1Devices=e.devices.qd1.map(d=>({...d,powerNow:this._num(d.power,0)}));
    const qd2Devices=e.devices.qd2.map(d=>({...d,powerNow:this._num(d.power,0)}));
    const qd1Tracked=qd1Devices.reduce((a,d)=>a+d.powerNow,0);
    const qd2Tracked=qd2Devices.reduce((a,d)=>a+d.powerNow,0);
    return {
      sofar,deye,solar,qd1,qd2,house,imp,exp,
      qd1Devices,qd2Devices,qd1Tracked,qd2Tracked,
      qd1Other:Math.max(0,qd1-qd1Tracked),
      qd2Other:Math.max(0,qd2-qd2Tracked)
    };
  }

  _period() {
    const e=this.entities;
    const solar=this._periodEnergy([e.solarEnergy,e.solarEnergyFallback]);
    const sofar=this._periodEnergy(e.sofarEnergyTotal);
    const deye=this._periodEnergy(e.deyeEnergyTotal);
    const qd1=this._periodEnergy(e.qd1Energy);
    const qd2=this._periodEnergy(e.qd2Energy);
    const house=qd1+qd2;
    const imp=this._periodEnergy([e.importEnergy,e.importEnergyFallback]);
    const exp=this._periodEnergy([e.exportEnergy,e.exportEnergyFallback]);
    const selfUsed=Math.max(0,solar-exp);
    const selfConsumption=solar>0?this._clamp(selfUsed/solar*100,0,100):0;
    const selfSufficiency=house>0?this._clamp(selfUsed/house*100,0,100):0;
    const qd1Devices=e.devices.qd1.map(d=>({...d,energyPeriod:this._periodEnergy(d.energy),peak:this._peak(d.power)}));
    const qd2Devices=e.devices.qd2.map(d=>({...d,energyPeriod:this._periodEnergy(d.energy),peak:this._peak(d.power)}));
    const qd1Tracked=qd1Devices.reduce((a,d)=>a+d.energyPeriod,0);
    const qd2Tracked=qd2Devices.reduce((a,d)=>a+d.energyPeriod,0);
    const housePeak=this._peak(e.housePower);
    const housePeakContributors=this._peakContributors(housePeak.time,housePeak.value);
    const solarPeak=this._peak(e.solarPower);
    const importPeak=this._peak(e.importPower);
    const exportPeak=this._peak(e.exportPower);
    return {
      solar,sofar,deye,qd1,qd2,house,imp,exp,balance:exp-imp,
      selfUsed,selfConsumption,selfSufficiency,
      qd1Devices,qd2Devices,qd1Tracked,qd2Tracked,
      qd1Other:Math.max(0,qd1-qd1Tracked),qd2Other:Math.max(0,qd2-qd2Tracked),
      housePeak,housePeakContributors,solarPeak,importPeak,exportPeak
    };
  }

  /* --------------------------------------------------------------------------
   * CHARTS
   * -------------------------------------------------------------------------- */
  _displayTimeRange() {
    const start=this._range.start.getTime();
    let end=this._range.end.getTime();
    // For today, keep the visual X axis fixed at 00:00–24:00.
    if (this._rangeMode==="today") end=this._endOfDay(this._range.start).getTime();
    return {start,end,span:Math.max(1,end-start)};
  }

  _timeTicks(count=5) {
    const {start,end,span}=this._displayTimeRange();
    const DAY=24*60*60*1000;

    if (this._rangeMode==="today" || this._rangeMode==="yesterday" || span<=DAY*1.15) {
      return [0,6,12,18,24].map((hour,i)=>({
        x:i/4,
        label:`${String(hour).padStart(2,"0")}:00`
      }));
    }

    if (this._rangeMode==="7d") {
      const ticks=[];
      for (let i=0;i<7;i++) {
        const d=new Date(this._range.start);
        d.setDate(d.getDate()+i);
        ticks.push({
          x:i/6,
          label:`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
        });
      }
      return ticks;
    }

    const tickCount=Math.max(6,Math.min(8,count));
    return Array.from({length:tickCount},(_,i)=>{
      const r=i/(tickCount-1);
      const d=new Date(start+span*r);
      return {
        x:r,
        label:`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`
      };
    });
  }

  _timePath(id,w,h,max,left=44) {
    const s=this._series(id);
    if (!s.length) return "";
    const {start,end,span}=this._displayTimeRange();
    const hi=Math.max(1,max);
    const pts=s.filter(p=>p.t>=start && p.t<=Math.min(end,this._range.end.getTime()));
    return pts.map((p,i)=>{
      const x=left+(Math.max(0,Math.min(1,(p.t-start)/span))*(w-left-20));
      const y=h-(Math.max(0,p.v)/hi*h);
      return `${i?"L":"M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  _timeBins(id,bins=48) {
    const s=this._series(id);
    const {start,end,span}=this._displayTimeRange();
    const size=span/bins;
    const cells=Array.from({length:bins},()=>[]);
    for (const p of s) {
      if (p.t<start || p.t>end || p.t>this._range.end.getTime()) continue;
      const i=Math.max(0,Math.min(bins-1,Math.floor((p.t-start)/size)));
      cells[i].push(Math.max(0,p.v));
    }
    return cells.map((arr,i)=>({
      t:start+(i+.5)*size,
      v:arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0,
      empty:!arr.length
    }));
  }

  _linePath(series,w,h,max) {
    if (!series?.length) return "";
    const hi=Math.max(1,max || Math.max(...series.map(p=>p.v)));
    return series.map((p,i)=>{
      const x=i/Math.max(1,series.length-1)*w;
      const y=h-(Math.max(0,p.v)/hi)*h;
      return `${i?"L":"M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  _chart(seriesDefs, opts={}) {
    const w=1000,h=238,left=58,right=18;
    const all=seriesDefs.map(s=>({...s,series:this._series(s.entity)}));
    const max=Math.max(1,...all.flatMap(s=>s.series.map(p=>Math.max(0,p.v))));
    const ygrid=[0,.25,.5,.75,1].map(r=>{
      const y=(1-r)*h;
      return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="gridline gridline-h"></line>
              <text x="4" y="${Math.max(14,y-5)}" class="gridtext">${this._fmtW(max*r)}</text>`;
    }).join("");
    const ticks=this._timeTicks(7);
    const xgrid=ticks.map(t=>{
      const x=left+t.x*(w-left-right);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="gridline gridline-v"></line>
              <text x="${x}" y="${h+25}" text-anchor="${t.x===0?"start":t.x===1?"end":"middle"}" class="chart-time-label">${t.label}</text>`;
    }).join("");

    return `<div class="chart-box chart-v28">
      <div class="chart-viewport">
        <svg viewBox="0 0 ${w} ${h+34}" preserveAspectRatio="none">
          ${ygrid}${xgrid}
          ${all.map(s=>`<path d="${this._timePath(s.entity,w,h,max,left)}" class="trend ${s.cls}"></path>`).join("")}
        </svg>
      </div>
      <div class="chart-legend chart-legend-v28">
        ${all.map(s=>`<span class="${s.cls}"><i></i><strong>${this._esc(s.label)}</strong></span>`).join("")}
      </div>
    </div>`;
  }


  _v26Axis(maxValue, h=190) {
    const ticks=[0,.25,.5,.75,1];
    return ticks.map(r=>{
      const y=(1-r)*h;
      return `<line x1="44" y1="${y}" x2="980" y2="${y}" class="v26-grid-h"/>
              <text x="5" y="${Math.max(12,y-4)}" class="v26-ylabel">${this._fmtW(maxValue*r)}</text>`;
    }).join("");
  }

  _v26TimeGrid(h=190) {
    return [0,6,12,18,24].map(hour=>{
      const x=44 + (936*(hour/24));
      return `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="v26-grid-v"/>
              <text x="${x}" y="${h+24}" text-anchor="${hour===0?"start":hour===24?"end":"middle"}" class="v26-xlabel">${String(hour).padStart(2,"0")}:00</text>`;
    }).join("");
  }

  _v26AreaChart(seriesDefs) {
    const w=1000,h=190,left=58,right=20;
    const prepared=seriesDefs.map(s=>({...s,series:this._series(s.entity)}));
    const max=Math.max(1,...prepared.flatMap(s=>s.series.map(p=>Math.max(0,p.v))));
    const ticks=this._timeTicks(5);
    const gridY=[0,.25,.5,.75,1].map(r=>{
      const y=(1-r)*h;
      return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="v26-grid-h"/>
              <text x="4" y="${Math.max(12,y-4)}" class="v26-ylabel">${this._fmtW(max*r)}</text>`;
    }).join("");
    const gridX=ticks.map(t=>{
      const x=left+t.x*(w-left-right);
      return `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="v26-grid-v"/>
              <text x="${x}" y="${h+24}" text-anchor="${t.x===0?"start":t.x===1?"end":"middle"}" class="v26-xlabel">${t.label}</text>`;
    }).join("");
    const line=(entity)=>this._timePath(entity,w,h,max,left);
    const area=(entity)=>{
      const p=line(entity); if(!p) return "";
      const {start,span}=this._displayTimeRange();
      const s=this._series(entity).filter(x=>x.t>=start&&x.t<=this._range.end.getTime());
      if(!s.length) return "";
      const firstX=left+((s[0].t-start)/span)*(w-left-right);
      const lastX=left+((s[s.length-1].t-start)/span)*(w-left-right);
      return `${p} L${lastX.toFixed(1)} ${h} L${firstX.toFixed(1)} ${h} Z`;
    };
    return `<div class="v26-chart v28-chart">
      <svg viewBox="0 0 ${w} 225" preserveAspectRatio="none">
        ${gridY}${gridX}
        ${prepared.map((s,i)=>`<path d="${area(s.entity)}" class="v26-area ${s.cls} area-${i}"></path>`).join("")}
        ${prepared.map(s=>`<path d="${line(s.entity)}" class="v26-line ${s.cls}"></path>`).join("")}
      </svg>
      <div class="v26-legend v28-legend">${prepared.map(s=>`<span class="${s.cls}"><i></i>${this._esc(s.label)}</span>`).join("")}</div>
    </div>`;
  }

  _v26Bars(entity, cls="red") {
    const w=1000,h=190,left=58,right=20;
    const bins=this._timeBins(entity,this._rangeMode==="today"?48:72);
    const max=Math.max(1,...bins.map(p=>p.v));
    const ticks=this._timeTicks(5);
    const plotW=w-left-right, bw=plotW/bins.length;
    return `<div class="v26-chart v28-chart">
      <svg viewBox="0 0 ${w} 225" preserveAspectRatio="none">
        ${[0,.25,.5,.75,1].map(r=>{const y=(1-r)*h;return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="v26-grid-h"/><text x="4" y="${Math.max(12,y-4)}" class="v26-ylabel">${this._fmtW(max*r)}</text>`}).join("")}
        ${ticks.map(t=>{const x=left+t.x*plotW;return `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="v26-grid-v"/><text x="${x}" y="${h+24}" text-anchor="${t.x===0?"start":t.x===1?"end":"middle"}" class="v26-xlabel">${t.label}</text>`}).join("")}
        ${bins.map((p,i)=>{const bh=(p.v/max)*h;const x=left+i*bw+bw*.17;return `<rect x="${x.toFixed(1)}" y="${(h-bh).toFixed(1)}" width="${Math.max(2,bw*.66).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.2" class="v26-bar ${cls}"></rect>`}).join("")}
      </svg>
      <div class="v26-legend v28-legend"><span class="${cls}"><i></i>Casa</span></div>
    </div>`;
  }

  _v26GridBars(importEntity, exportEntity) {
    const w=1000,h=190,left=58,right=20,mid=h/2;
    const bins=this._rangeMode==="today"?48:72;
    const imp=this._timeBins(importEntity,bins), exp=this._timeBins(exportEntity,bins);
    const max=Math.max(1,...imp.map(p=>p.v),...exp.map(p=>p.v));
    const ticks=this._timeTicks(5);
    const plotW=w-left-right,bw=plotW/bins;
    return `<div class="v26-chart v28-chart">
      <svg viewBox="0 0 ${w} 225" preserveAspectRatio="none">
        <line x1="${left}" y1="${mid}" x2="${w-right}" y2="${mid}" class="v26-zero"/>
        ${ticks.map(t=>{const x=left+t.x*plotW;return `<line x1="${x}" y1="0" x2="${x}" y2="${h}" class="v26-grid-v"/><text x="${x}" y="${h+24}" text-anchor="${t.x===0?"start":t.x===1?"end":"middle"}" class="v26-xlabel">${t.label}</text>`}).join("")}
        <line x1="${left}" y1="${mid*.18}" x2="${w-right}" y2="${mid*.18}" class="v26-grid-h"/>
        <line x1="${left}" y1="${mid*1.82}" x2="${w-right}" y2="${mid*1.82}" class="v26-grid-h"/>
        <text x="4" y="14" class="v26-ylabel">${this._fmtW(max)}</text>
        <text x="4" y="${mid-5}" class="v26-ylabel">0 W</text>
        <text x="4" y="${h-4}" class="v26-ylabel">-${this._fmtW(max)}</text>
        ${imp.map((p,i)=>{const bh=(p.v/max)*mid*.82;const x=left+i*bw+bw*.12;return `<rect x="${x.toFixed(1)}" y="${(mid-bh).toFixed(1)}" width="${Math.max(2,bw*.34).toFixed(1)}" height="${bh.toFixed(1)}" rx="1" class="v26-gridbar import"></rect>`}).join("")}
        ${exp.map((p,i)=>{const bh=(p.v/max)*mid*.82;const x=left+i*bw+bw*.54;return `<rect x="${x.toFixed(1)}" y="${mid.toFixed(1)}" width="${Math.max(2,bw*.34).toFixed(1)}" height="${bh.toFixed(1)}" rx="1" class="v26-gridbar export"></rect>`}).join("")}
      </svg>
      <div class="v26-legend v28-legend"><span class="orange"><i></i>Importação</span><span class="cyan"><i></i>Exportação</span></div>
    </div>`;
  }

  _v26Gauge(value) {
    const pct=this._clamp(value,0,100), r=50, c=2*Math.PI*r, off=c*(1-pct/100);
    return `<div class="v26-gauge">
      <svg viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="57" class="v26-gauge-orbit"/>
        <circle cx="70" cy="70" r="${r}" class="v26-gauge-bg"/>
        <circle cx="70" cy="70" r="${r}" class="v26-gauge-fg" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
      </svg>
      <div><strong>${pct.toFixed(0)}%</strong><span>AUTOSSUFICIÊNCIA</span></div>
    </div>`;
  }

  _donut(value,label,cls="cyan") {
    const pct=this._clamp(value,0,100);
    const r=44,c=2*Math.PI*r,off=c*(1-pct/100);
    return `<div class="donut ${cls}"><svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${r}" class="d-bg"></circle><circle cx="55" cy="55" r="${r}" class="d-fg" stroke-dasharray="${c}" stroke-dashoffset="${off}"></circle></svg><div><strong>${pct.toFixed(0)}%</strong><span>${this._esc(label)}</span></div></div>`;
  }

  /* --------------------------------------------------------------------------
   * COMPONENTES VISUAIS
   * -------------------------------------------------------------------------- */
  _kpi(icon,title,value,sub,cls="cyan",entity="",tag="PERÍODO") {
    return `<div class="hero-kpi ${cls} ${entity?"clickable":""}" ${entity?`data-entity="${this._esc(entity)}"`:""}>
      <div class="kpi-top"><i>${this._svgIcon(icon)}</i><span>${this._esc(title)}</span><em>${this._esc(tag)}</em></div>
      <strong>${value}</strong><small>${sub}</small><div class="kpi-glow"></div>
    </div>`;
  }

  _tabIntro(icon,eyebrow,title,subtitle,cls="cyan") {
    return `<div class="tab-intro ${cls}">
      <div class="tab-intro-icon">${this._svgIcon(icon)}</div>
      <div class="tab-intro-copy">
        <span>${this._esc(eyebrow)}</span>
        <strong>${this._esc(title)}</strong>
        <small>${this._esc(subtitle)}</small>
      </div>
      <div class="tab-intro-pulse"><i></i><i></i><i></i></div>
    </div>`;
  }

  _deviceRows(period, live, qd=null) {
    const source = qd === "QUADRO A" ? period.qd1Devices : qd === "QUADRO B / DEMAIS" ? period.qd2Devices : [...period.qd1Devices.map(x=>({...x,qd:"QUADRO A"})),...period.qd2Devices.map(x=>({...x,qd:"QUADRO B / DEMAIS"}))];
    const liveMap = Object.fromEntries([...live.qd1Devices,...live.qd2Devices].map(d=>[d.key,d.powerNow]));
    const rows=[...source].sort((a,b)=>b.energyPeriod-a.energyPeriod);
    const max=Math.max(.001,...rows.map(d=>d.energyPeriod));
    if(!rows.length){
      const pending=qd?[]:(this._config.unassigned_loads||[]);
      return `<div class="loads-empty143"><p>${pending.length?`${pending.length} medições encontradas, ainda sem vínculo com um quadro.`:'Nenhum dispositivo individual associado. Os totais dos quadros continuam disponíveis.'}</p>
        ${pending.map(row=>`<div class="pending-load143"><span>${this._esc(row.name)}</span><strong>${this._rawPower144(row.power)!==null?this._fmtW(this._rawPower144(row.power)):'Sem leitura'}</strong></div>`).join('')}
        <button class="configure-loads143">Associar tomadas e disjuntores</button><small>O consumo individual em kWh será exibido após configurar a medição de cada carga.</small></div>`;
    }
    return `<div class="device-table">${rows.map((d,i)=>`<div class="device-row clickable" data-entity="${this._esc(d.energy)}">
      <div class="device-rank">${String(i+1).padStart(2,"0")}</div>
      <div class="device-icon">${this._svgIcon(d.icon)}</div>
      <div class="device-name"><strong>${this._esc(d.name)}</strong><small>${d.qd?`${d.qd} • `:""}${this._fmtW(liveMap[d.key]||0)} agora</small></div>
      <div class="device-meter"><i style="width:${d.energyPeriod/max*100}%"></i></div>
      <div class="device-energy"><strong>${this._fmtK(d.energyPeriod)}</strong><small>Pico ${this._fmtW(d.peak?.value||0)}</small></div>
    </div>`).join("")}</div>`;
  }

  _sceneSvg() {
    const base="/cloudpelizzon-energy/frontend/assets/";
    return `<div class="scene-art scene-assets" aria-hidden="true">
      <div class="scene-atmosphere"></div>
      <img class="asset asset-solar" src="${base}solar-plant-v17.png?v=54.0.0" alt="">
      <img class="asset asset-house" src="${base}house-v17.png?v=54.0.0" alt="">
      <img class="asset asset-grid" src="${base}copel-tower-v17.png?v=54.0.0" alt="">
      <div class="ground-glow ground-glow-solar"></div>
      <div class="ground-glow ground-glow-house"></div>
      <div class="ground-glow ground-glow-grid"></div>
    </div>`;
  }

  _heroFlow(live,period) {
    const summary=this._summaryPeriod(period);
    const summarySofarShare=summary.solar>0?summary.sofar/summary.solar*100:0;
    const summaryDeyeShare=summary.solar>0?summary.deye/summary.solar*100:0;
    const importing=live.imp>5, exporting=live.exp>5, solarActive=live.solar>5;
    const mode=importing?"IMPORTANDO":exporting?"EXPORTANDO":"EQUILIBRADO";
    const sofarShare=period.solar>0?period.sofar/period.solar*100:0;
    const deyeShare=period.solar>0?period.deye/period.solar*100:0;
    const particle=(pathId,color,dur,begin,r=4)=>`
      <circle r="${r}" fill="${color}" class="v26-particle">
        <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="auto">
          <mpath href="#${pathId}"></mpath>
        </animateMotion>
      </circle>`;

    return `<section class="v26-hero-grid">
      <article class="v26-flow">
        <header class="v26-flow-head">
          <div><i>${this._svgIcon("bolt")}</i><div><strong>FLUXO DE ENERGIA EM TEMPO REAL</strong><small>Acompanhe de onde vem e para onde vai a energia da sua casa</small></div></div>
          <span><b></b>TEMPO REAL</span>
        </header>
        <div class="v26-scene">
          <div class="v26-landscape"></div>
          <svg class="flow146" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"></svg>
          ${this._sceneSvg()}
          <div class="v26-shield ${solarActive||importing||exporting?"active":""}"><i></i><i></i></div>

          <div class="v26-source v26-inverter clickable" data-entity="${this._esc(this.entities.sofarPower)}">
            <i>${this._svgIcon("inverter")}</i><div><span>INVERSOR SOLAR</span><strong>${this._fmtW(live.sofar)}</strong><small>${this._fmtK(period.sofar)} hoje</small></div>
          </div>
          <div class="v26-source v26-micro clickable" data-entity="${this._esc(this.entities.deyePower)}">
            <i>${this._svgIcon("micro")}</i><div><span>MICROINVERSOR</span><strong>${this._fmtW(live.deye)}</strong><small>${this._fmtK(period.deye)} hoje</small></div>
          </div>

          <div class="v26-solar-total clickable" data-entity="${this._esc(this.entities.solarPower)}">
            <strong>${this._fmtW(live.solar)}</strong><span>GERAÇÃO TOTAL</span>
          </div>

          <div class="v33-total-house-bridge ${live.solar>5?"active":"inactive"}" aria-hidden="true">
            <span class="v33-flow-dot d1"></span>
            <span class="v33-flow-dot d2"></span>
            <span class="v33-flow-dot d3"></span>
          </div>

          <div class="v26-house-meter clickable" data-entity="${this._esc(this.entities.housePower)}">
            <div>${this._svgIcon("house")}<span>CASA</span></div><strong>${this._fmtW(live.house)}</strong><small>CONSUMO ATUAL</small>
          </div>

          <div class="v26-grid-meter import ${importing?"active":"idle"} clickable" data-entity="${this._esc(this.entities.importPower)}">
            <strong>${this._fmtW(live.imp)}</strong><span>IMPORTANDO</span>
          </div>
          <div class="v26-grid-meter export ${exporting?"active":"idle"} clickable" data-entity="${this._esc(this.entities.exportPower)}">
            <strong>${this._fmtW(live.exp)}</strong><span>EXPORTANDO</span>
          </div>
          <div class="v26-grid-label"><strong>REDE</strong><small>${mode}</small></div>

          <svg class="v26-flow-svg" viewBox="0 0 1600 520" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="v26glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <marker id="v45ImportArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill="#ffb44d"/>
              </marker>
              <marker id="v45ExportArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 Z" fill="#4cd8ff"/>
              </marker>
            </defs>

            <!-- Placas -> inversor / micro -> união -> casa -->
            <path id="v26SolarInv" d="M55 310 C125 286 170 182 300 182" class="v26-rail solar"/>
            <path id="v26SolarMicro" d="M55 340 C130 338 175 307 300 307" class="v26-rail solar"/>
            <path id="v26InvMerge" d="M300 182 C420 182 455 235 520 252" class="v26-rail solar"/>
            <path id="v26MicroMerge" d="M300 307 C420 307 457 270 520 252" class="v26-rail solar"/>
            <path id="v26MergeHome" d="M520 252 C560 252 600 252 640 252" class="v26-rail solar"/>
            <path id="v30TotalHome" d="M690 252 C725 252 754 252 790 252" class="v26-rail solar v30-total-home"/>
            ${particle("v30TotalHome","#9bffc0",2.15,0,4.3)}
            ${particle("v30TotalHome","#e1ffec",2.15,1.05,3)}


            <!-- Copel -> importação -> casa -->
            <path id="v26Import" d="M1497 205 C1390 203 1285 202 1205 203 C1090 205 1035 225 920 255" class="v26-rail import ${importing?"active":"idle"}" ${importing?'marker-end="url(#v45ImportArrow)"':""}/>

            <!-- casa -> exportação -> Copel -->
            <path id="v26Export" d="M920 335 C1040 353 1105 371 1205 371 C1300 371 1400 352 1498 312" class="v26-rail export ${exporting?"active":"idle"}" ${exporting?'marker-end="url(#v45ExportArrow)"':""}/>

            <path pathLength="100" d="M55 310 C125 286 170 182 300 182" class="v33-pulse solar ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M55 340 C130 338 175 307 300 307" class="v33-pulse solar delay1 ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M300 182 C420 182 455 235 520 252" class="v33-pulse solar delay2 ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M300 307 C420 307 457 270 520 252" class="v33-pulse solar delay3 ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M520 252 C560 252 600 252 640 252" class="v33-pulse solar ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M1497 205 C1390 203 1285 202 1205 203 C1090 205 1035 225 920 255" class="v33-pulse import ${live.imp>5?"active":"inactive"}"/>
            <path pathLength="100" d="M920 335 C1040 353 1105 371 1205 371 C1300 371 1400 352 1498 312" class="v33-pulse export ${live.exp>5?"active":"inactive"}"/>

            ${particle("v26SolarInv","#7dffaf",3.8,0,4)}
            ${particle("v26SolarMicro","#7dffaf",4.0,1.1,4)}
            ${particle("v26InvMerge","#7dffaf",2.5,.2,3.8)}
            ${particle("v26MicroMerge","#7dffaf",2.7,1.2,3.8)}
            ${particle("v26MergeHome","#b4ffce",2.1,.7,4.4)}
            
            
            
            
            
          </svg>

          <!-- V51: malha exclusiva para MOBILE.
               O SVG desktop permanece intacto. -->
          <svg class="v51-mobile-mesh" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <!-- base solar -->
            <path d="M40 500 C95 390 120 190 190 125" class="v51-mesh-base solar"/>
            <path d="M40 500 C95 430 125 290 190 245" class="v51-mesh-base solar"/>
            <path d="M190 125 C275 125 300 160 350 182" class="v51-mesh-base solar"/>
            <path d="M190 245 C275 245 302 205 350 182" class="v51-mesh-base solar"/>
            <path d="M350 182 C415 182 455 220 500 330" class="v51-mesh-base solar"/>

            <!-- base importação: REDE -> card -> escudo -->
            <path d="M955 500 C915 360 875 182 790 125 C700 125 625 175 500 330" class="v51-mesh-base import"/>

            <!-- base exportação: escudo -> card -> REDE -->
            <path d="M500 350 C625 285 700 245 790 245 C875 300 920 390 955 500" class="v51-mesh-base export"/>

            <!-- partículas solar -->
            <path pathLength="100" d="M40 500 C95 390 120 190 190 125" class="v51-mesh-flow solar ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M40 500 C95 430 125 290 190 245" class="v51-mesh-flow solar alt ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M190 125 C275 125 300 160 350 182" class="v51-mesh-flow solar ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M190 245 C275 245 302 205 350 182" class="v51-mesh-flow solar alt ${live.solar>5?"active":"inactive"}"/>
            <path pathLength="100" d="M350 182 C415 182 455 220 500 330" class="v51-mesh-flow solar ${live.solar>5?"active":"inactive"}"/>

            <!-- partículas importação: a direção do próprio path é torre -> casa -->
            <path pathLength="100" d="M955 500 C915 360 875 182 790 125 C700 125 625 175 500 330"
                  class="v51-mesh-flow import ${live.imp>5?"active":"inactive"}"/>

            <!-- partículas exportação: a direção do próprio path é casa -> torre -->
            <path pathLength="100" d="M500 350 C625 285 700 245 790 245 C875 300 920 390 955 500"
                  class="v51-mesh-flow export ${live.exp>5?"active":"inactive"}"/>
          </svg>
        </div>

        <!-- V53: MOBILE RECONSTRUÍDO COMO UMA MALHA COMPACTA HORIZONTAL.
             A cena desktop permanece intocada. -->
        <div class="v53-mobile-scene">
          <div class="v53-mobile-atmosphere"></div>

          <img class="v53-asset v53-solar-asset"
               src="/cloudpelizzon-energy/frontend/assets/solar-plant-v17.png?v=54.0.0" alt="">
          <img class="v53-asset v53-house-asset"
               src="/cloudpelizzon-energy/frontend/assets/house-v17.png?v=54.0.0" alt="">
          <img class="v53-asset v53-grid-asset"
               src="/cloudpelizzon-energy/frontend/assets/copel-tower-v17.png?v=54.0.0" alt="">

          <div class="v53-shield ${solarActive||importing||exporting?"active":""}">
            <i></i><i></i><b></b>
          </div>

          <div class="v53-card v53-inverter clickable" data-entity="${this._esc(this.entities.sofarPower)}">
            <span>INVERSOR</span><strong>${this._fmtW(live.sofar)}</strong><small>${this._fmtK(period.sofar)} hoje</small>
          </div>
          <div class="v53-card v53-micro clickable" data-entity="${this._esc(this.entities.deyePower)}">
            <span>MICROINV.</span><strong>${this._fmtW(live.deye)}</strong><small>${this._fmtK(period.deye)} hoje</small>
          </div>
          <div class="v53-card v53-generation clickable" data-entity="${this._esc(this.entities.solarPower)}">
            <strong>${this._fmtW(live.solar)}</strong><span>GERAÇÃO TOTAL</span>
          </div>
          <div class="v53-card v53-import ${importing?"active":"idle"} clickable" data-entity="${this._esc(this.entities.importPower)}">
            <strong>${this._fmtW(live.imp)}</strong><span>IMPORTANDO</span>
          </div>
          <div class="v53-card v53-export ${exporting?"active":"idle"} clickable" data-entity="${this._esc(this.entities.exportPower)}">
            <strong>${this._fmtW(live.exp)}</strong><span>EXPORTANDO</span>
          </div>

          <div class="v53-house-meter clickable" data-entity="${this._esc(this.entities.housePower)}">
            <span>⌂ CASA</span><strong>${this._fmtW(live.house)}</strong>
          </div>
          <div class="v53-grid-label">REDE<small>${mode}</small></div>

          <svg class="v53-mobile-flow" viewBox="0 0 360 305" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="v53-soft-glow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <!-- trilhos visuais: passam por cada card, sem atravessar textos -->
            <path id="v53-solar-a" d="M23 270 C38 226 50 123 69 91 C77 79 85 79 96 91" class="v53-rail solar"/>
            <path id="v53-solar-b" d="M23 270 C40 244 52 177 69 149 C77 137 85 137 96 149" class="v53-rail solar"/>
            <path id="v53-solar-c" d="M132 91 C146 91 151 106 159 121" class="v53-rail solar"/>
            <path id="v53-solar-d" d="M132 149 C146 149 152 136 159 121" class="v53-rail solar"/>
            <path id="v53-solar-e" d="M199 121 C207 135 205 154 193 174" class="v53-rail solar"/>

            <!-- IMPORTAÇÃO: TORRE -> IMPORTADO -> ESCUDO/CASA -->
            <path id="v53-import" d="M337 270 C327 230 318 143 304 100 C296 78 285 91 270 91 C250 91 236 112 226 135 C215 153 205 165 193 174" class="v53-rail import"/>

            <!-- EXPORTAÇÃO: ESCUDO/CASA -> EXPORTADO -> TORRE -->
            <path id="v53-export" d="M193 184 C207 169 217 157 229 149 C240 141 252 149 270 149 C286 149 297 171 307 202 C320 236 329 258 337 270" class="v53-rail export"/>

            <!-- partículas contínuas: não há reinício visual do traço inteiro -->
            ${solarActive?`
              <g class="v53-particles solar" filter="url(#v53-soft-glow)">
                <circle r="2.0"><animateMotion dur="4.8s" repeatCount="indefinite" begin="0s"><mpath href="#v53-solar-a"/></animateMotion></circle>
                <circle r="2.0"><animateMotion dur="4.8s" repeatCount="indefinite" begin="-2.4s"><mpath href="#v53-solar-a"/></animateMotion></circle>
                <circle r="2.0"><animateMotion dur="4.6s" repeatCount="indefinite" begin="-.7s"><mpath href="#v53-solar-b"/></animateMotion></circle>
                <circle r="2.0"><animateMotion dur="4.6s" repeatCount="indefinite" begin="-3s"><mpath href="#v53-solar-b"/></animateMotion></circle>
                <circle r="2.0"><animateMotion dur="2.8s" repeatCount="indefinite"><mpath href="#v53-solar-c"/></animateMotion></circle>
                <circle r="2.0"><animateMotion dur="2.8s" repeatCount="indefinite" begin="-1.4s"><mpath href="#v53-solar-d"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="3.6s" repeatCount="indefinite"><mpath href="#v53-solar-e"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="3.6s" repeatCount="indefinite" begin="-1.8s"><mpath href="#v53-solar-e"/></animateMotion></circle>
              </g>`:""}

            ${importing?`
              <g class="v53-particles import" filter="url(#v53-soft-glow)">
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="0s"><mpath href="#v53-import"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="-1.45s"><mpath href="#v53-import"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="-2.9s"><mpath href="#v53-import"/></animateMotion></circle>
              </g>`:""}

            ${exporting?`
              <g class="v53-particles export" filter="url(#v53-soft-glow)">
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="0s"><mpath href="#v53-export"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="-1.45s"><mpath href="#v53-export"/></animateMotion></circle>
                <circle r="2.2"><animateMotion dur="4.4s" repeatCount="indefinite" begin="-2.9s"><mpath href="#v53-export"/></animateMotion></circle>
              </g>`:""}
          </svg>
        </div>

        <!-- V54: MOBILE REFEITO COMO DIAGRAMA DE MALHA, SEM HERDAR A GEOMETRIA DO DESKTOP. -->
        <div class="v54-mobile-scene">
          <div class="v54-mobile-atmosphere"></div>

          <img class="v54-asset v54-solar-asset" src="/cloudpelizzon-energy/frontend/assets/solar-plant-v17.png?v=54.0.0" alt="">
          <img class="v54-asset v54-house-asset" src="/cloudpelizzon-energy/frontend/assets/house-v17.png?v=54.0.0" alt="">
          <img class="v54-asset v54-grid-asset" src="/cloudpelizzon-energy/frontend/assets/copel-tower-v17.png?v=54.0.0" alt="">

          <div class="v54-shield ${solarActive||importing||exporting?"active":""}"><i></i><i></i><b></b></div>

          <div class="v54-card v54-inverter clickable" data-entity="${this._esc(this.entities.sofarPower)}">
            <span>INVERSOR SOLAR</span><strong>${this._fmtW(live.sofar)}</strong><small>${this._fmtK(period.sofar)} hoje</small>
          </div>
          <div class="v54-card v54-micro clickable" data-entity="${this._esc(this.entities.deyePower)}">
            <span>MICROINVERSOR</span><strong>${this._fmtW(live.deye)}</strong><small>${this._fmtK(period.deye)} hoje</small>
          </div>
          <div class="v54-card v54-generation clickable" data-entity="${this._esc(this.entities.solarPower)}">
            <strong>${this._fmtW(live.solar)}</strong><span>GERAÇÃO TOTAL</span>
          </div>
          <div class="v54-card v54-import ${importing?"active":"idle"} clickable" data-entity="${this._esc(this.entities.importPower)}">
            <strong>${this._fmtW(live.imp)}</strong><span>IMPORTANDO</span>
          </div>
          <div class="v54-card v54-export ${exporting?"active":"idle"} clickable" data-entity="${this._esc(this.entities.exportPower)}">
            <strong>${this._fmtW(live.exp)}</strong><span>EXPORTANDO</span>
          </div>

          <div class="v54-house-meter clickable" data-entity="${this._esc(this.entities.housePower)}"><span>⌂ CASA</span><strong>${this._fmtW(live.house)}</strong></div>
          <div class="v54-grid-label">REDE<small>${mode}</small></div>

          <svg class="v54-mobile-flow" viewBox="0 0 360 320" preserveAspectRatio="none" aria-hidden="true">
            <!-- Trilhos SOLAR: asset -> cards -> total -> escudo -->
            <path d="M28 276 C42 244 50 206 58 178" class="v54-rail solar"/>
            <path d="M58 178 C58 151 58 132 61 105" class="v54-rail solar"/>
            <path d="M58 178 C58 169 58 160 61 155" class="v54-rail solar"/>
            <path d="M105 81 C118 81 122 96 130 106" class="v54-rail solar"/>
            <path d="M105 145 C118 145 122 126 130 116" class="v54-rail solar"/>
            <path d="M220 111 C218 135 210 163 193 190" class="v54-rail solar"/>

            <!-- Importação: torre -> card importação -> escudo. -->
            <path d="M337 276 C337 230 340 165 342 104" class="v54-rail import"/>
            <path d="M252 81 C228 96 215 135 193 190" class="v54-rail import"/>

            <!-- Exportação: escudo -> card exportação -> torre. -->
            <path d="M193 203 C216 180 230 153 252 145" class="v54-rail export"/>
            <path d="M342 145 C340 185 338 232 337 276" class="v54-rail export"/>

            ${solarActive?`
              <path d="M28 276 C42 244 50 206 58 178" class="v54-flow solar a"/>
              <path d="M58 178 C58 151 58 132 61 105" class="v54-flow solar b"/>
              <path d="M58 178 C58 169 58 160 61 155" class="v54-flow solar c"/>
              <path d="M105 81 C118 81 122 96 130 106" class="v54-flow solar d"/>
              <path d="M105 145 C118 145 122 126 130 116" class="v54-flow solar e"/>
              <path d="M220 111 C218 135 210 163 193 190" class="v54-flow solar f"/>
            `:''}
            ${importing?`
              <path d="M337 276 C337 230 340 165 342 104" class="v54-flow import a"/>
              <path d="M252 81 C228 96 215 135 193 190" class="v54-flow import b"/>
            `:''}
            ${exporting?`
              <path d="M193 203 C216 180 230 153 252 145" class="v54-flow export a"/>
              <path d="M342 145 C340 185 338 232 337 276" class="v54-flow export b"/>
            `:''}
          </svg>
        </div>
      </article>

      <aside class="v26-summary">
        <header><strong>RESUMO DO DIA</strong><div>
          <button data-summary="today" class="${this._summaryMode==="today"?"active":""}">HOJE</button>
          <button data-summary="month" class="${this._summaryMode==="month"?"active":""}">MÊS</button>
          <button data-summary="year" class="${this._summaryMode==="year"?"active":""}">ANO</button>
          <button data-summary="lifetime" class="${this._summaryMode==="lifetime"?"active":""}">VIDA ÚTIL</button>
        </div></header>
        <div class="v26-summary-list">
          <div class="solar"><i>${this._svgIcon("solar")}</i><span>Geração Total</span><strong>${this._fmtK(summary.solar)}</strong></div>
          <div class="inverter"><i>${this._svgIcon("inverter")}</i><span>Inversor</span><strong>${this._fmtK(summary.sofar)} (${this._fmtPct(summarySofarShare)})</strong></div>
          <div class="micro"><i>${this._svgIcon("micro")}</i><span>Microinversor</span><strong>${this._fmtK(summary.deye)} (${this._fmtPct(summaryDeyeShare)})</strong></div>
          <div class="house"><i>${this._svgIcon("house")}</i><span>Consumo Total</span><strong>${this._fmtK(summary.house)}</strong></div>
          <div class="import"><i>${this._svgIcon("import")}</i><span>Importação Copel</span><strong>${this._fmtK(summary.imp)}</strong></div>
          <div class="export"><i>${this._svgIcon("export")}</i><span>Exportação Copel</span><strong>${this._fmtK(summary.exp)}</strong></div>
          <div class="balance"><i>${this._svgIcon("bolt")}</i><span>${this._summaryMode==="today"?"Saldo do Dia":this._summaryMode==="month"?"Saldo do Mês":this._summaryMode==="year"?"Saldo do Ano":"Saldo Vida Útil"}</span><strong>${summary.balance>=0?"+":""}${this._fmtK(summary.balance)}</strong></div>
        </div>
        <div class="v26-summary-status">${this._summaryLoading?"CARREGANDO DADOS…":this._summaryError?"ERRO AO CARREGAR":""}</div><div class="v26-summary-foot"><span>Crédito Acumulado</span><strong>${summary.balance>=0?"+":""}${this._fmtK(Math.abs(summary.balance))}</strong></div>
      </aside>
    </section>`;
  }


  _rawPower144(id){const row=this._hass?.states?.[id];if(!row||!this._valid(id))return null;const unit=String(row.attributes?.unit_of_measurement||'').toLowerCase();const factor={w:1,kw:1000,mw:1000000}[unit];return factor?Number(row.state)*factor:null;}
  _monitoredLoads144(period){
    const assigned=[...(period.qd1Devices||[]),...(period.qd2Devices||[])];
    const seen=new Set(assigned.map(d=>d.power));
    const pending=(this._config.unassigned_loads||[]).filter(d=>!seen.has(d.power)).map(d=>{
      const series=d.energy?this._series(d.energy):[];
      const daily=/(?:^|_)(hoje|today|daily|diaria|diario)(?:_|$)/.test(d.energy||'');
      const known=d.energy&&(series.length>=2||(daily&&this._valid(d.energy)));
      return {...d,icon:'flash',energyPeriod:known?this._periodEnergy(d.energy):null,powerNow:this._rawPower144(d.power),qd:'Quadro não associado'};
    });
    const rows=[...assigned,...pending].map(d=>({...d,powerNow:d.powerNow??this._rawPower144(d.power)}));
    const energy=rows.filter(d=>d.energyPeriod!==null&&Number.isFinite(d.energyPeriod));
    return (energy.length?energy:rows.filter(d=>d.powerNow!==null)).sort((a,b)=>(b.energyPeriod??b.powerNow??0)-(a.energyPeriod??a.powerNow??0));
  }

  _pie144(title,items){
    const colors=['#62e89f','#50bfff','#c093ff','#ffbf62'];
    const rows=items.map((row,index)=>({...row,value:Math.max(0,Number(row.value)||0),color:colors[index%colors.length]}));
    const total=rows.reduce((sum,row)=>sum+row.value,0);let angle=-Math.PI/2;
    const wedges=rows.map(row=>{if(!total||!row.value)return '';const start=angle,end=angle+row.value/total*Math.PI*2;angle=end;
      const point=a=>[100+84*Math.cos(a),100+84*Math.sin(a)];const a=point(start),b=point(end),mid=(start+end)/2;
      const shape=row.value===total?`<circle cx="100" cy="100" r="84" fill="${row.color}"/>`:`<path d="M100 100 L${a[0]} ${a[1]} A84 84 0 ${end-start>Math.PI?1:0} 1 ${b[0]} ${b[1]} Z" fill="${row.color}"/>`;
      const pct=Math.round(row.value/total*100);
      return shape+(pct>=8?`<text x="${100+51*Math.cos(mid)}" y="${105+51*Math.sin(mid)}" text-anchor="middle" fill="#03121b" font-size="17" font-weight="900">${pct}%</text>`:'');
    }).join('');
    return `<article class="pie-card144"><h3>${title}</h3><div class="pie-content144"><svg viewBox="0 0 200 200" role="img" aria-label="${this._esc(title)}">${total?wedges:'<circle cx="100" cy="100" r="84" fill="#173443"/><text x="100" y="104" text-anchor="middle" fill="#ecf7ff" font-size="12">Sem dados</text>'}</svg><div class="pie-legend144">${rows.map(row=>`<div><i style="background:${row.color}"></i><span>${this._esc(row.name)}</span><strong>${total?Math.round(row.value/total*100)+'%':'—'}</strong><small>${this._fmtK(row.value)}</small></div>`).join('')}</div></div></article>`;
  }

  _overview(live,period) {
    const sofarShare=period.solar>0?period.sofar/period.solar*100:0;
    const deyeShare=period.solar>0?period.deye/period.solar*100:0;
    const importShare=period.house>0?period.imp/period.house*100:0;
    const exportShare=period.solar>0?period.exp/period.solar*100:0;
    const qd1Share=period.house>0?period.qd1/period.house*100:0;
    const qd2Share=period.house>0?period.qd2/period.house*100:0;
    const all=this._monitoredLoads144(period);
    const maxDevice=Math.max(.001,...all.map(d=>d.energyPeriod??d.powerNow??0));
    const statusItems=[
      ["Inversor Solar",[this.entities.sofarPower,this.entities.sofarEnergyTotal],"inverter"],
      ["Microinversor",[this.entities.deyePower,this.entities.deyeEnergyTotal],"micro"],
      ["Medidor Copel",[this.entities.importPower,this.entities.exportPower],"grid"],
      ["Medidor QUADRO A",[this.entities.qd1Power,this.entities.qd1Energy],"qd"],
      ["Medidor QUADRO B / DEMAIS",[this.entities.qd2Power,this.entities.qd2Energy],"qd"]
    ];

    return `<section class="v26-overview">
      <section class="v26-kpis">
        <article class="solar clickable" data-entity="${this._esc(this.entities.solarEnergy)}"><i>${this._svgIcon("solar")}</i><div><span>GERAÇÃO TOTAL ${this._periodShortLabel()}</span><strong>${this._fmtK(period.solar)}</strong><small>↑ ${Math.max(0,(period.solar/Math.max(period.house,1)*100-100)).toFixed(0)}% &nbsp; Meta: 20 kWh</small></div><b><u style="width:${Math.min(100,period.solar/20*100)}%"></u></b></article>
        <article class="inverter clickable" data-entity="${this._esc(this.entities.sofarEnergyTotal)}"><i>${this._svgIcon("inverter")}</i><div><span>INVERSOR ${this._periodCardSuffix()}</span><strong>${this._fmtK(period.sofar)}</strong><small>${this._fmtPct(sofarShare)} da geração</small><em>● Online <b>${this._fmtW(live.sofar)}</b></em></div></article>
        <article class="micro clickable" data-entity="${this._esc(this.entities.deyeEnergyTotal)}"><i>${this._svgIcon("micro")}</i><div><span>MICROINVERSOR ${this._periodCardSuffix()}</span><strong>${this._fmtK(period.deye)}</strong><small>${this._fmtPct(deyeShare)} da geração</small><em>● Online <b>${this._fmtW(live.deye)}</b></em></div></article>
        <article class="house clickable" data-entity="${this._esc(this.entities.housePower)}"><i>${this._svgIcon("house")}</i><div><span>CONSUMO TOTAL ${this._periodShortLabel()}</span><strong>${this._fmtK(period.house)}</strong><small>↓ ${Math.max(0,(1-period.house/Math.max(period.imp+period.solar,1))*100).toFixed(0)}% &nbsp; Média: ${this._fmtK(Math.max(.01,period.house))}</small></div><b><u style="width:${Math.min(100,period.house/Math.max(period.housePeak.value/1000,1)*40)}%"></u></b></article>
        <article class="import clickable" data-entity="${this._esc(this.entities.importEnergy)}"><i>${this._svgIcon("grid")}</i><div><span>IMPORTAÇÃO REDE</span><strong>${this._fmtK(period.imp)}</strong><small>↓ ${this._fmtPct(importShare)} do consumo</small></div></article>
        <article class="export clickable" data-entity="${this._esc(this.entities.exportEnergy)}"><i>${this._svgIcon("grid")}</i><div><span>EXPORTAÇÃO REDE</span><strong>${this._fmtK(period.exp)}</strong><small>↑ ${this._fmtPct(exportShare)} da geração</small></div></article>
        <article class="balance"><i>${this._svgIcon("bolt")}</i><div><span>SALDO DO DIA</span><strong>${period.balance>=0?"+":""}${this._fmtK(period.balance)}</strong><small>${period.balance>=0?"Crédito acumulado":"Débito líquido"}</small><em>Mês: ${period.balance>=0?"+":""}${this._fmtK(period.balance)}</em></div></article>
        <article class="peak clickable" data-entity="${this._esc(this.entities.housePower)}"><i>${this._svgIcon("peak")}</i><div><span>PICO DE CONSUMO</span><strong>${this._fmtW(period.housePeak.value)}</strong><small>${period.housePeak.time?this._fmtTime(period.housePeak.time):"Sem histórico"}</small><em>Maior potência do período</em></div></article>
      </section>

      ${this._heroFlow(live,period)}

      <section class="v26-analytics">
        <article class="v26-chart-card generation">
          <header><div><span>${this._svgIcon("solar")} GERAÇÃO ${this._periodCardSuffix()}</span><strong>${this._fmtK(period.solar)}</strong></div><div class="v26-small-legend"><i class="green"></i>Total <i class="blue"></i>Inversor <i class="orange"></i>Microinv.</div></header>
          ${this._v26AreaChart([{entity:this.entities.solarPower,label:"Total",cls:"green"},{entity:this.entities.sofarPower,label:"Inversor",cls:"blue"},{entity:this.entities.deyePower,label:"Microinv.",cls:"orange"}])}
        </article>

        <article class="v26-chart-card consumption">
          <header><div><span>${this._svgIcon("peak")} CONSUMO ${this._periodCardSuffix()}</span><strong>${this._fmtK(period.house)}</strong></div><div class="v26-peak"><span>PICO DE CONSUMO</span><strong>${this._fmtW(period.housePeak.value)}</strong><small>${period.housePeak.time?this._fmtTime(period.housePeak.time):"—"}</small></div></header>
          ${this._v26Bars(this.entities.housePower,"red")}
        </article>

        <article class="v26-chart-card exchange">
          <header><div><span>${this._svgIcon("bolt")} IMPORTAÇÃO × EXPORTAÇÃO ${this._periodCardSuffix()}</span><strong><b>${this._fmtK(period.imp)}</b><i>${this._fmtK(period.exp)}</i></strong></div></header>
          ${this._v26GridBars(this.entities.importPower,this.entities.exportPower)}
        </article>

        <article class="v26-chart-card gauge">
          <header><div><span>${this._svgIcon("chart")} AUTOSSUFICIÊNCIA</span></div></header>
          ${this._v26Gauge(period.selfSufficiency)}
          <small>Da energia consumida<br>veio da sua geração</small>
        </article>
      </section>

      <section class="v26-lower">
        <article class="v26-lower-card consumers">
          <header><strong>MAIORES CONSUMIDORES ${this._periodCardSuffix()}</strong><button data-tab="consumption">Ver todos</button></header>
          <div>${all.slice(0,5).map(d=>`<div class="v26-consumer clickable" data-entity="${this._esc(d.energy)}"><i>${this._svgIcon(d.icon)}</i><span>${this._esc(d.name)}</span><b><u style="width:${(d.energyPeriod??d.powerNow??0)/maxDevice*100}%"></u></b><strong>${d.energyPeriod===null?this._fmtW(d.powerNow):this._fmtK(d.energyPeriod)}</strong><em>${d.energyPeriod===null?"agora":period.house>0?(d.energyPeriod/period.house*100).toFixed(0)+"%":"—"}</em></div>`).join("")||`<p class="empty-consumers144">Sem medição individual disponível. <button class="configure-loads143">Associar medições</button></p>`}</div>
        </article>

        <article class="v26-lower-card boards">
          <header><strong>CONSUMO POR QUADRO ${this._periodCardSuffix()}</strong></header>
          <div class="v26-board qd1"><i>${this._svgIcon("qd")}</i><span>QUADRO A - Inferior</span><strong>${this._fmtK(period.qd1)}</strong><em>${this._fmtPct(qd1Share)}</em><b><u style="width:${qd1Share}%"></u></b></div>
          <div class="v26-board qd2"><i>${this._svgIcon("qd")}</i><span>QUADRO B / DEMAIS - Superior</span><strong>${this._fmtK(period.qd2)}</strong><em>${this._fmtPct(qd2Share)}</em><b><u style="width:${qd2Share}%"></u></b></div>
          <div class="v26-board qgs"><i>${this._svgIcon("solar")}</i><span>QGS - Geração</span><strong>${this._fmtK(period.solar)}</strong><em>${period.solar>0?"100%":"0%"}</em><b><u class="qgs-fill" style="width:${period.solar>0?100:0}%"></u></b></div>
        </article>

        <article class="v26-lower-card status">
          <header><strong>STATUS DOS EQUIPAMENTOS</strong></header>
          ${statusItems.map(([name,ids,icon])=>{const ok=ids.some(x=>this._valid(x));return `<div class="v26-status-row"><i>${this._svgIcon(icon)}</i><span>${name}</span><b class="${ok?"ok":"bad"}"></b><strong>${ok?"Online":"Atenção"}</strong><em>›</em></div>`}).join("")}
        </article>

        <article class="v26-lower-card indicators">
          <header><strong>INDICADORES</strong></header>
          <div><i>${this._svgIcon("solar")}</i><span>Geração Atual</span><strong>${this._fmtW(live.solar)}</strong><em>›</em></div>
          <div><i>${this._svgIcon("house")}</i><span>Consumo Atual</span><strong>${this._fmtW(live.house)}</strong><em>›</em></div>
          <div><i>${this._svgIcon("grid")}</i><span>Modo da Rede</span><strong>${live.imp>5?"IMPORTANDO":live.exp>5?"EXPORTANDO":"EQUILIBRADO"}</strong><em>›</em></div>
          <div><i>${this._svgIcon("qd")}</i><span>QUADRO A</span><strong>${this._fmtW(live.qd1)}</strong><em>›</em></div>
          <div><i>${this._svgIcon("qd")}</i><span>QUADRO B / DEMAIS</span><strong>${this._fmtW(live.qd2)}</strong><em>›</em></div>
        </article>
      </section>
    </section>`;
  }

  _generation(live,period) {
    const sofarShare=period.solar>0?this._clamp(period.sofar/period.solar*100,0,100):0;
    const deyeShare=period.solar>0?this._clamp(period.deye/period.solar*100,0,100):0;
    return `<section class="screen detail-screen">${this._tabIntro("solar","GERAÇÃO SOLAR","Produção e desempenho dos geradores","Total, inversor e microinversor no período selecionado","green")}
      <div class="detail-kpis three">
        ${this._kpi("solar","GERAÇÃO TOTAL",this._fmtK(period.solar),`Pico ${this._fmtW(period.solarPeak.value)} • ${this._fmtW(live.solar)} agora`,"green",this.entities.solarEnergy)}
        ${this._kpi("inverter","INVERSOR FONTE A",this._fmtK(period.sofar),`${this._fmtPct(sofarShare)} do total • ${this._fmtW(live.sofar)} agora`,"blue",this.entities.sofarEnergyTotal)}
        ${this._kpi("micro","MICROINVERSOR FONTE B / DEMAIS",this._fmtK(period.deye),`${this._fmtPct(deyeShare)} do total • ${this._fmtW(live.deye)} agora`,"orange",this.entities.deyeEnergyTotal)}
      </div>
      <div class="two-col generation-grid">
        <article class="panel tall"><div class="section-head"><div><span>GERAÇÃO://CURVA</span><strong>PRODUÇÃO NO PERÍODO</strong><small>Potência dos dois geradores e total</small></div></div>${this._chart([
          {entity:this.entities.solarPower,label:"Total",cls:"green"},
          {entity:this.entities.sofarPower,label:"Inversor",cls:"blue"},
          {entity:this.entities.deyePower,label:"Micro",cls:"orange"}
        ],{buckets:96})}</article>
        <article class="panel tall"><div class="section-head"><div><span>GERAÇÃO://COMPOSIÇÃO</span><strong>PARTICIPAÇÃO DOS GERADORES</strong><small>${this._esc(this._range.label)}</small></div></div>
          <div class="generator-compare">
            ${this._donut(sofarShare,"INVERSOR","blue")}
            ${this._donut(deyeShare,"MICRO","orange")}
          </div>
          <div class="compare-ledger"><div><span>INVERSOR</span><strong>${this._fmtK(period.sofar)}</strong><small>${this._fmtW(live.sofar)} agora</small></div><div><span>MICROINVERSOR</span><strong>${this._fmtK(period.deye)}</strong><small>${this._fmtW(live.deye)} agora</small></div></div>
        </article>
      </div>
    </section>`;
  }

  _consumption(live,period) {
    return `<section class="screen detail-screen">${this._tabIntro("house","CONSUMO","Demanda e cargas da residência","Consumo total, quadros e dispositivos monitorados","red")}
      <div class="detail-kpis four">
        ${this._kpi("house","CONSUMO TOTAL",this._fmtK(period.house),`${this._fmtW(live.house)} agora`,"red",this.entities.housePower)}
        ${this._kpi("peak","MAIOR PICO",this._fmtW(period.housePeak.value),period.housePeak.time?this._fmtTime(period.housePeak.time):"sem histórico","pink",this.entities.housePower)}
        ${this._kpi("qd","QUADRO A • INFERIOR",this._fmtK(period.qd1),`${this._fmtW(live.qd1)} agora`,"green",this.entities.qd1Energy)}
        ${this._kpi("qd","QUADRO B / DEMAIS • SUPERIOR",this._fmtK(period.qd2),`${this._fmtW(live.qd2)} agora`,"orange",this.entities.qd2Energy)}
      </div>
      <div class="two-col consumption-grid">
        <article class="panel tall"><div class="section-head"><div><span>CONSUMO://CURVA</span><strong>CASA E QUADROS</strong><small>Potência ao longo do período</small></div></div>${this._chart([
          {entity:this.entities.housePower,label:"Casa",cls:"red"},
          {entity:this.entities.qd1Power,label:"QUADRO A",cls:"green"},
          {entity:this.entities.qd2Power,label:"QUADRO B / DEMAIS",cls:"orange"}
        ],{buckets:96})}</article>
        <article class="panel tall scroll-panel"><div class="section-head"><div><span>CONSUMO://DISPOSITIVOS</span><strong>CONSUMO INDIVIDUAL</strong><small>Ordenado pelo total do período</small></div></div>${this._deviceRows(period,live)}</article>
      </div>
    </section>`;
  }

  _grid(live,period) {
    const importing=live.imp>5, exporting=live.exp>5;
    return `<section class="screen detail-screen">${this._tabIntro("grid","REDE ELÉTRICA","Intercâmbio com a concessionária","Importação, exportação, saldo e comportamento da rede","cyan")}
      <div class="detail-kpis four">
        ${this._kpi("grid","IMPORTADO",this._fmtK(period.imp),`${this._fmtW(live.imp)} agora`,"cyan",this.entities.importEnergy)}
        ${this._kpi("grid","EXPORTADO",this._fmtK(period.exp),`${this._fmtW(live.exp)} agora`,"purple",this.entities.exportEnergy)}
        ${this._kpi("peak","PICO IMPORTAÇÃO",this._fmtW(period.importPeak.value),period.importPeak.time?this._fmtTime(period.importPeak.time):"sem histórico","blue",this.entities.importPower)}
        ${this._kpi("peak","PICO EXPORTAÇÃO",this._fmtW(period.exportPeak.value),period.exportPeak.time?this._fmtTime(period.exportPeak.time):"sem histórico","violet",this.entities.exportPower)}
      </div>
      <div class="grid-network">
        <article class="panel network-card v29-network-card">
          <div class="section-head">
            <span>REDE // INTERCÂMBIO</span>
            <strong>CASA ↔ REDE • ACUMULADO NO PERÍODO</strong>
            <small>${this._esc(this._range.label)} • energia importada e exportada acumulada</small>
          </div>

          <div class="v29-network-scene">
            <div class="v29-net-node house">
              <img src="/cloudpelizzon-energy/frontend/assets/house-v17.png?v=54.0.0" alt="Casa">
              <div><strong>CASA</strong><span>${this._fmtK(period.house)} consumidos</span></div>
            </div>

            <div class="v29-net-flow">
              <div class="v29-net-line import ${importing?"active flow-now145":"idle"}">
                <span>IMPORTADO NO PERÍODO</span>
                <strong>${this._fmtK(period.imp)}</strong>
                <small>${period.house>0?this._fmtPct(period.imp/period.house*100):"0%"} do consumo</small>
                <em class="flow-caption145">← ${importing?this._fmtW(live.imp)+" agora":"Sem fluxo agora"}</em><i aria-hidden="true"></i>
              </div>
              <div class="v29-net-line export ${exporting?"active flow-now145":"idle"}">
                <span>EXPORTADO NO PERÍODO</span>
                <strong>${this._fmtK(period.exp)}</strong>
                <small>${period.solar>0?this._fmtPct(period.exp/period.solar*100):"0%"} da geração</small>
                <em class="flow-caption145">→ ${exporting?this._fmtW(live.exp)+" agora":"Sem fluxo agora"}</em><i aria-hidden="true"></i>
              </div>
            </div>

            <div class="v29-net-node copel">
              <img src="/cloudpelizzon-energy/frontend/assets/copel-tower-v17.png?v=54.0.0" alt="Torre Copel">
              <div><strong>REDE</strong><span>${period.balance>=0?"CRÉDITO NO PERÍODO":"DÉBITO NO PERÍODO"}</span></div>
            </div>
          </div>

          <div class="v29-net-balance">
            <span>SALDO LÍQUIDO DO PERÍODO</span>
            <strong>${period.balance>=0?"+":""}${this._fmtK(period.balance)}</strong>
            <small>${period.balance>=0?"Crédito líquido":"Débito líquido"}</small>
          </div>
        </article>
        <article class="panel"><div class="section-head"><div><span>REDE://HISTÓRICO</span><strong>IMPORTAÇÃO × EXPORTAÇÃO</strong><small>${this._esc(this._range.label)}</small></div></div>${this._chart([
          {entity:this.entities.importPower,label:"Importação",cls:"cyan"},
          {entity:this.entities.exportPower,label:"Exportação",cls:"purple"}
        ],{buckets:96})}</article>
      </div>
    </section>`;
  }

  _boards(live,period) {
    const panel=(qd,devices,totalEnergy,totalPower,other,cls)=>`<article class="panel board-panel ${cls}"><div class="section-head"><div><span>QUADRO://${qd}</span><strong>${qd==="QUADRO A"?"ANDAR INFERIOR":"ANDAR SUPERIOR"}</strong><small>${this._fmtW(totalPower)} agora • ${this._fmtK(totalEnergy)} no período</small></div></div><div class="board-chart143">${this._chart([{entity:qd==="QUADRO A"?this.entities.qd1Power:this.entities.qd2Power,label:qd,cls:qd==="QUADRO A"?"green":"orange"}],{buckets:96})}</div>${this._deviceRows({qd1Devices:qd==="QUADRO A"?devices:[],qd2Devices:qd==="QUADRO B / DEMAIS"?devices:[]},live,qd)}<div class="untracked"><span>NÃO MONITORADO INDIVIDUALMENTE</span><strong>${this._fmtK(other)}</strong></div></article>`;
    return `<section class="screen boards-screen">${this._tabIntro("qd","QUADROS","Distribuição elétrica da residência","QUADRO A e QUADRO B / DEMAIS com consumo individual e cargas não monitoradas","orange")}
      ${panel("QUADRO A",period.qd1Devices,period.qd1,live.qd1,period.qd1Other,"qd1")}
      ${panel("QUADRO B / DEMAIS",period.qd2Devices,period.qd2,live.qd2,period.qd2Other,"qd2")}
    </section>`;
  }

  _historyComparisonChart() {
    const defs=[
      {entity:this.entities.solarPower,label:"Geração",cls:"green"},
      {entity:this.entities.housePower,label:"Consumo",cls:"red"},
      {entity:this.entities.importPower,label:"Importação",cls:"cyan"},
      {entity:this.entities.exportPower,label:"Exportação",cls:"purple"}
    ];

    const isDay=this._rangeMode==="today"||this._rangeMode==="yesterday";
    const startTs=this._range.start.getTime();
    const endTs=this._range.end.getTime();
    const dayMs=86400000;
    const dayCount=Math.max(1,Math.round((endTs-startTs)/dayMs)+1);
    const binsCount=isDay?24:Math.min(31,dayCount);

    const data=defs.map(d=>({...d,bins:this._timeBins(d.entity,binsCount)}));
    const max=Math.max(1,...data.flatMap(d=>d.bins.map(x=>x.v)));

    const w=1200,h=285,left=76,right=26,bottom=55;
    const plotH=h-bottom, plotW=w-left-right;
    const slot=plotW/binsCount;
    const barW=Math.max(3,Math.min(10,slot*.15));
    const colors={green:"#54df8d",red:"#ff667f",cyan:"#58c4df",purple:"#a27ac1"};
    const yTicks=[0,.25,.5,.75,1];

    const labels = isDay
      ? [0,6,12,18,24].map(hour=>({
          x:left+(plotW*(hour/24)),
          label:`${String(hour).padStart(2,"0")}:00`,
          anchor:hour===0?"start":hour===24?"end":"middle"
        }))
      : Array.from({length:binsCount},(_,i)=>{
          const t=startTs+(i+.5)*((endTs-startTs+dayMs)/binsCount);
          const d=new Date(t);
          return {
            x:left+(i+.5)*slot,
            label:`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`,
            anchor:"middle"
          };
        });

    return `<div class="history-bars-chart ${isDay?"hourly":"daily"}">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        ${yTicks.map(r=>{
          const y=plotH-(r*plotH);
          return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" class="history-grid"/>
                  <text x="8" y="${Math.max(16,y-5)}" class="history-y">${this._fmtW(max*r)}</text>`;
        }).join("")}

        ${labels.map(t=>`
          <line x1="${t.x}" y1="0" x2="${t.x}" y2="${plotH}" class="history-grid vertical"/>
          <text x="${t.x}" y="${h-17}" text-anchor="${t.anchor}" class="history-x">${this._esc(t.label)}</text>
        `).join("")}

        ${Array.from({length:binsCount},(_,i)=>data.map((d,j)=>{
          const v=d.bins[i]?.v||0;
          const bh=(v/max)*(plotH-10);
          const groupWidth=barW*4+9;
          const gx=left+i*slot+(slot-groupWidth)/2;
          const x=gx+j*(barW+3);
          return `<rect x="${x.toFixed(1)}" y="${(plotH-bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,bh).toFixed(1)}" rx="2" fill="${colors[d.cls]}" class="history-bar ${d.cls}"/>`;
        }).join("")).join("")}
      </svg>

      <div class="history-bars-legend">
        ${defs.map(d=>`<span class="${d.cls}"><i style="background:${colors[d.cls]}"></i>${d.label}</span>`).join("")}
      </div>
    </div>`;
  }

  _historyTab(live,period) {
    return `<section class="screen history-screen">${this._tabIntro("calendar","HISTÓRICO","Linha do tempo energética","Compare geração, consumo, quadros e rede no mesmo período","blue")}
      <article class="panel history-main v32-history-maincard"><div class="section-head"><div><span>HISTÓRICO://MALHA</span><strong>COMPORTAMENTO ENERGÉTICO</strong><small>${this._esc(this._range.label)} • filtro global aplicado</small></div></div>${this._historyComparisonChart()}</article>
      <aside class="history-side v32-history-side">
        ${this._kpi("solar","GERAÇÃO",this._fmtK(period.solar),`Pico ${this._fmtW(period.solarPeak.value)}`,"green")}
        ${this._kpi("house","CONSUMO",this._fmtK(period.house),`Pico ${this._fmtW(period.housePeak.value)}`,"red")}
        ${this._kpi("grid","IMPORTADO",this._fmtK(period.imp),`Pico ${this._fmtW(period.importPeak.value)}`,"cyan")}
        ${this._kpi("grid","EXPORTADO",this._fmtK(period.exp),`Pico ${this._fmtW(period.exportPeak.value)}`,"purple")}
        ${this._kpi("qd","QUADRO A",this._fmtK(period.qd1),`${this._fmtW(live.qd1)} agora`,"blue")}
        ${this._kpi("qd","QUADRO B / DEMAIS",this._fmtK(period.qd2),`${this._fmtW(live.qd2)} agora`,"orange")}
      </aside>
    </section>`;
  }


  _syncFlow146(){
    const scene=this.shadowRoot?.querySelector('.v26-scene');if(!scene)return;
    const svg=scene.querySelector('.flow146');if(!svg)return;
    const area=scene.getBoundingClientRect();if(!area.width||!area.height)return;
    const point=selector=>{const e=scene.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {x:Number(((r.x+r.width/2-area.x)/area.width*1000).toFixed(3)),y:Number(((r.y+r.height/2-area.y)/area.height*1000).toFixed(3))};};
    const inv=point('.v26-inverter'),micro=point('.v26-micro'),total=point('.v26-solar-total'),imp=point('.v26-grid-meter.import'),exp=point('.v26-grid-meter.export');
    if(!inv||!micro||!total||!imp||!exp)return;
    const house={x:550,y:520},plant={x:85,y:650},grid={x:945,y:590};
    const segment=(a,b)=>`C${(a.x+b.x)/2} ${a.y} ${(a.x+b.x)/2} ${b.y} ${b.x} ${b.y}`;
    const route=points=>`M${points[0].x} ${points[0].y} `+points.slice(1).map((b,i)=>segment(points[i],b)).join(' ');
    const live=this._live();
    const paths=[['inverter','solar',[plant,inv,total],live.sofar>5],['micro','solar',[plant,micro,total],live.deye>5],['total','solar',[total,house],live.solar>5],['import','import',[grid,imp,house],live.imp>5],['export','export',[house,exp,grid],live.exp>5]];
    svg.innerHTML=paths.map(([name,color,points,active])=>{const d=route(points);return `<path data-flow="${name}" class="rail146 ${color}" d="${d}"/><path data-motion="${name}" pathLength="100" class="motion146 ${color} ${active?'active':'idle'}" d="${d}"/>`;}).join('');
  }

  _providerText145(body){
    const provider=String(this._config.grid_provider||'Concessionária').trim().slice(0,80)||'Concessionária';
    return body.replace(/(^|>)([^<]+)/g,(all,prefix,text)=>prefix+text.replace(/\b(?:Copel|COPEL)\b/g,()=>this._esc(provider)));
  }

  _analytics(live,p) {
    const generation=Math.max(0,p.solar||0),house=Math.max(0,p.house||0),imported=Math.max(0,p.imp||0),exported=Math.max(0,p.exp||0);
    const direct=Math.max(0,generation-exported),ratio=(v,total)=>total>0?v/total*100:0;
    const selfConsumption=ratio(direct,generation),selfSufficiency=ratio(direct,house),dependency=ratio(imported,house),generationRatio=ratio(generation,house);
    const top=this._monitoredLoads144(p).find(d=>d.energyPeriod!==null);
    const metric=(title,value,detail,cls='')=>`<article class="metric144 ${cls}"><span>${title}</span><strong>${value}</strong><small>${detail}</small></article>`;
    const peak=value=>value?.time?this._fmtTime(value.time):'Histórico indisponível';
    const balance=exported-imported;
    return `<section class="analysis144">
      <header class="analysis-title144"><h2>Inteligência energética</h2><span>${this._esc(this._range.label)} · energia e potência do período selecionado</span></header>
      <div class="analysis-metrics144">
        ${metric('GERAÇÃO SOLAR',this._fmtK(generation),'Total produzido','green')}
        ${metric('CONSUMO DA CASA',this._fmtK(house),'Total consumido','red')}
        ${metric('CONSUMIDO DA COPEL',this._fmtK(imported),'Energia recebida da rede','cyan')}
        ${metric('SOLAR CONSUMIDO DIRETAMENTE',this._fmtK(direct),'Energia solar usada na casa, sem passar pela Copel','green')}
        ${metric('MAIOR PICO DE CONSUMO',p.housePeak?.time?this._fmtW(p.housePeak.value):'Sem histórico',peak(p.housePeak),'red')}
        ${metric('MAIOR PICO DE GERAÇÃO',p.solarPeak?.time?this._fmtW(p.solarPeak.value):'Sem histórico',peak(p.solarPeak),'green')}
        ${metric('SALDO COPEL',`${balance>=0?'+':''}${this._fmtK(balance)}`,balance>=0?'Exportação maior que importação':'Importação maior que exportação','purple')}
        ${metric('MAIOR CONSUMO MONITORADO',top?this._esc(top.name):'Sem medição individual',top?this._fmtK(top.energyPeriod):'Associe ou aguarde o histórico das cargas','orange')}
      </div>
      <div class="analysis-pies144">
        ${this._pie144('Origem da energia consumida',[{name:'Solar direto',value:direct},{name:'Copel',value:imported}])}
        ${this._pie144('Destino da geração solar',[{name:'Usada na casa',value:direct},{name:'Enviada à Copel',value:exported}])}
        ${this._pie144('Consumo por quadro',[{name:'Quadro A',value:p.qd1},{name:'Quadro B / demais',value:p.qd2}])}
      </div>
      <div class="analysis-ratios144">
        ${metric('AUTOSSUFICIÊNCIA',house?this._fmtPct(selfSufficiency):'—','Quanto do consumo foi coberto pelo solar','green')}
        ${metric('AUTOCONSUMO',generation?this._fmtPct(selfConsumption):'—','Quanto da geração foi usado na casa','cyan')}
        ${metric('GERAÇÃO × CONSUMO',house?this._fmtPct(generationRatio):'—','Produção solar em relação ao consumo','purple')}
        ${metric('DEPENDÊNCIA DA COPEL',house?this._fmtPct(dependency):'—','Parcela do consumo recebida da rede','orange')}
      </div>
      <p class="analysis-note144">As pizzas usam a soma das fatias como base. Os indicadores usam os totais medidos; pequenas diferenças podem ocorrer por cobertura do histórico e atualização dos medidores. O saldo é energético, em kWh.</p>
    </section>`;
  }

  _status() {
    const e=this.entities;
    const checks=[
      ["Geração total",[[e.solarPower],[e.solarEnergy,e.solarEnergyFallback]]],
      ["Inversor FONTE A",[[e.sofarPower,e.sofarFallback,e.sofarEnergyTotal]]],
      ["Microinversor FONTE B / DEMAIS",[[e.deyePower],[e.deyeEnergyTotal]]],
      ["Consumo casa",[[e.housePower]]],
      ["QUADRO A",[[e.qd1Power],[e.qd1Energy]]],
      ["QUADRO B / DEMAIS",[[e.qd2Power],[e.qd2Energy]]],
      ["Importação Copel",[[e.importPower],[e.importEnergy,e.importEnergyFallback]]],
      ["Exportação Copel",[[e.exportPower],[e.exportEnergy,e.exportEnergyFallback]]],
      ...[...e.devices.qd1,...e.devices.qd2].map(d=>[d.name,[[d.power],[d.energy]]])
    ];

    const evalCheck=(groups)=>{
      const missing=[];
      for (const group of groups) {
        const ids=(Array.isArray(group)?group:[group]).filter(Boolean);
        if (!ids.length || !ids.some(id=>this._valid(id))) missing.push(ids);
      }
      return {good:missing.length===0,missing};
    };

    return `<section class="screen status-screen">${this._tabIntro("status","CONFIG / STATUS","Saúde da telemetria","Validação das entidades e fontes de dados utilizadas pelo dashboard","cyan")}
      <article class="panel status-panel">
        <div class="section-head"><div>
          <span>STATUS://ENTIDADES</span>
          <strong>SAÚDE DA TELEMETRIA</strong>
          <small>Verifica as fontes realmente necessárias; entidades alternativas/fallback não são tratadas como falha quando outra fonte válida está disponível.</small>
        </div></div>
        <div class="status-grid">${checks.map(([name,groups])=>{
          const res=evalCheck(groups);
          const miss=res.missing.length;
          return `<div class="status-row ${res.good?"ok":"bad"}">
            <i></i><span>${this._esc(name)}</span><strong>${res.good?"ONLINE":"ATENÇÃO"}</strong>
            <small>${res.good?"telemetria necessária disponível":`${miss} fonte(s) necessária(s) sem dado`}</small>
          </div>`;
        }).join("")}</div>
      </article>
    </section>`;
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info",{bubbles:true,composed:true,detail:{entityId}}));
  }

  _bind() {
    const r=this.shadowRoot;
    r.querySelectorAll('.configure-loads143').forEach(button=>button.onclick=()=>this.dispatchEvent(new CustomEvent('energy-configure-loads',{bubbles:true,composed:true})));
    r.querySelectorAll("[data-tab]").forEach(b=>b.onclick=(ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      const tab=b.dataset.tab;
      if (!tab) return;
      this._tab=tab;
      this._scrollTabOnce=true;
      this._render();
    });
    const nav=r.querySelector(".master-tabs");
    if (nav) {
      nav.style.scrollBehavior="smooth";
      if (this._scrollTabOnce) {
        this._scrollTabOnce=false;
        const activeTab=nav.querySelector("button.active");
        if (activeTab) requestAnimationFrame(()=>{
          const target=Math.max(0,activeTab.offsetLeft-(nav.clientWidth-activeTab.offsetWidth)/2);
          nav.scrollTo({left:target,behavior:"smooth"});
        });
      }
    }
    r.querySelectorAll("[data-range]").forEach(b=>b.onclick=()=>this._setRange(b.dataset.range));
    r.querySelectorAll("[data-summary]").forEach(b=>b.onclick=()=>this._setSummaryMode(b.dataset.summary));
    r.querySelectorAll("[data-entity]").forEach(el=>el.onclick=()=>this._moreInfo(el.dataset.entity));
    const s=r.querySelector("#rangeStart"), e=r.querySelector("#rangeEnd"), a=r.querySelector("#applyRange");
    const holdDate=()=>{ this._dateEditing=true; };
    const releaseDate=()=>{ setTimeout(()=>{ this._dateEditing=false; },350); };
    if (s) {
      s.onfocus=holdDate;
      s.onpointerdown=holdDate;
      s.onchange=x=>{ this._customStart=x.target.value; releaseDate(); };
      s.onblur=releaseDate;
    }
    if (e) {
      e.onfocus=holdDate;
      e.onpointerdown=holdDate;
      e.onchange=x=>{ this._customEnd=x.target.value; releaseDate(); };
      e.onblur=releaseDate;
    }
    if (a) a.onclick=()=>{
      const msg=r.querySelector("#rangeMsg");
      if (!this._customStart || !this._customEnd) { if(msg) msg.textContent="INFORME DE E ATÉ"; return; }
      if (new Date(this._customStart)>new Date(this._customEnd)) { if(msg) msg.textContent="DATA INICIAL MAIOR QUE A FINAL"; return; }
      if(msg) msg.textContent="";
      this._setRange("custom");
    };
  }

  _render() {

    if (!this.shadowRoot || !this._hass) return;
    this._lastVisualRender=Date.now();
    const live=this._live();
    const period=this._period();
    let body="";
    try {
      switch(this._tab) {
        case "generation": body=this._generation(live,period); break;
        case "consumption": body=this._consumption(live,period); break;
        case "grid": body=this._grid(live,period); break;
        case "boards": body=this._boards(live,period); break;
        case "history": body=this._historyTab(live,period); break;
        case "analytics": body=this._analytics(live,period); break;
        case "status": body=this._status(); break;
        default: body=this._overview(live,period);
      }
    } catch(err) {
      console.error("[CasaPelizzon Energy V39] tab render",this._tab,err);
      body=`<section class="screen detail-screen">
        ${this._tabIntro("calendar","DIAGNÓSTICO","Falha ao abrir a aba","A navegação funcionou, porém ocorreu um erro ao montar o conteúdo.","red")}
        <article class="panel v39-tab-error">
          <strong>ABA: ${this._esc(this._tab)}</strong>
          <small>${this._esc(err?.message || String(err))}</small>
        </article>
      </section>`;
    }
    body=this._providerText145(body);
    const opMode=live.imp>5?"IMPORTANDO":live.exp>5?"EXPORTANDO":"EQUILIBRADO";
    const histStatus=this._historyLoading?"SINCRONIZANDO":this._historyError?"ERRO NO HISTÓRICO":"DADOS EM TEMPO REAL";
    const tabs=[
      ["overview","VISÃO GERAL","house"],
      ["generation","GERAÇÃO","solar"],
      ["consumption","CONSUMO","house"],
      ["grid","REDE ELÉTRICA","grid"],
      ["boards","QUADROS","qd"],
      ["history","HISTÓRICO","calendar"],
      ["analytics","ANÁLISES","chart"],
      ["status","CONFIG","status"]
    ];
    const maxDate=new Date().toISOString().slice(0,10);

    this.shadowRoot.innerHTML=`<style>${this._css()}</style><ha-card class="energy-v27 energy-v28 energy-v29 energy-v30 energy-v31 energy-v32 energy-v33 energy-v34 energy-v35 energy-v36 energy-v37 energy-v38 energy-v39 energy-v40 energy-v41 energy-v42 energy-v43 energy-v44 energy-v45 energy-v46 energy-v47 energy-v48 energy-v49 energy-v50 energy-v51 energy-v52 energy-v53 energy-v54">
      <div class="shell-v24">
        <header class="master-header">
          <div class="brand-v14"><div class="brand-mark">${this._svgIcon("bolt")}</div><div><strong>MALHA ENERGÉTICA</strong><small>CLOUDPELIZZON · ENERGIA INTELIGENTE</small></div></div>
          <nav class="master-tabs">${tabs.map(([id,label,icon])=>`<button type="button" data-tab="${id}" class="${this._tab===id?"active":""}"><i>${this._svgIcon(icon)}</i><span>${label}</span></button>`).join("")}</nav>
          <div class="header-meta"><div class="clock-v14"><small id="energyDate">${this._dateText()}</small><strong id="energyClock">${this._clockText()}</strong><span>Curitiba · PR</span></div><div class="system-pill"><i></i><div><strong>SISTEMA ONLINE</strong><small>${opMode} · ${histStatus}</small></div></div></div>
        </header>
        <section class="filter-v14">
          <div class="filter-label"><i>${this._svgIcon("calendar")}</i><div><strong>PERÍODO DE ANÁLISE</strong><small>Filtro global para todas as abas</small></div></div>
          <div class="quick-v14">${[["today","HOJE"],["yesterday","ONTEM"],["7d","7 DIAS"],["30d","30 DIAS"],["month","MÊS"]].map(([m,l])=>`<button data-range="${m}" class="${this._rangeMode===m?"active":""}">${l}</button>`).join("")}</div>
          <div class="dates-v14"><label><span>DE</span><input id="rangeStart" type="date" max="${maxDate}" value="${this._esc(this._customStart)}"></label><b>→</b><label><span>ATÉ</span><input id="rangeEnd" type="date" max="${maxDate}" value="${this._esc(this._customEnd)}"></label><button id="applyRange" class="apply-v14 ${this._rangeMode==="custom"?"active":""}">APLICAR</button></div>
          <div class="period-active"><span>PERÍODO ATIVO</span><strong>${this._esc(this._range.label)}</strong><small id="rangeMsg">${this._historyLoading?"Atualizando…":this._historyError?"Falha no histórico":"Atualizado"}</small></div>
        </section>
        <main>${body}</main>
      </div>
    </ha-card>`;
    this._bind();
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>this._syncFlow146());
  }

  _css() {
    return `
    :host{--bg:#020812;--panel:#061421;--panel2:#071827;--line:rgba(62,161,223,.27);--text:#f4fbff;--muted:#8daabd;--cyan:#28c9ff;--blue:#3c90ff;--green:#45ed82;--yellow:#ffd34e;--orange:#ffad45;--red:#ff5578;--purple:#b66aff;display:block;width:100%;min-width:0;color:var(--text)}
    *{box-sizing:border-box}button,input{font:inherit}button{color:inherit}svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.clickable{cursor:pointer}.clickable:hover{filter:brightness(1.08)}
    ha-card.energy-v24{width:100%;min-width:0;border:0;border-radius:18px;background:radial-gradient(circle at 50% -20%,rgba(12,88,154,.20),transparent 36%),linear-gradient(180deg,#020812,#02060d 78%);box-shadow:0 18px 60px rgba(0,0,0,.42);overflow:hidden}.shell-v24{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;padding:12px}
    .master-header{display:grid;grid-template-columns:minmax(260px,.9fr) minmax(680px,2.2fr) minmax(260px,.9fr);align-items:stretch;border:1px solid var(--line);border-radius:14px;background:linear-gradient(180deg,rgba(5,19,32,.98),rgba(3,11,20,.98));overflow:hidden;min-height:76px}.brand-v14{display:flex;align-items:center;gap:12px;padding:10px 16px}.brand-mark{width:48px;height:48px;padding:10px;color:var(--yellow);border:1px solid rgba(255,211,78,.42);border-radius:50%;box-shadow:0 0 24px rgba(255,211,78,.12)}.brand-v14 strong{display:block;font-size:clamp(18px,1.45vw,29px);letter-spacing:.2px;white-space:nowrap}.brand-v14 small{display:block;margin-top:4px;color:#a7c4d8;font-size:8px;letter-spacing:.6px}.master-tabs{display:grid;grid-template-columns:repeat(8,minmax(78px,1fr));border-left:1px solid rgba(255,255,255,.04);border-right:1px solid rgba(255,255,255,.04)}.master-tabs button{appearance:none;border:0;border-right:1px solid rgba(69,155,214,.16);background:transparent;color:#b4cad8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;font-weight:800;font-size:8px;letter-spacing:.35px}.master-tabs button i{width:21px;height:21px;color:#9cb8cc}.master-tabs button.active{color:#eafcff;background:linear-gradient(180deg,rgba(25,151,222,.25),rgba(14,92,149,.14));box-shadow:inset 0 -2px 0 var(--cyan),0 0 24px rgba(40,201,255,.09)}.master-tabs button.active i{color:var(--cyan);filter:drop-shadow(0 0 8px var(--cyan))}.header-meta{display:flex;justify-content:flex-end;align-items:center;gap:14px;padding:8px 12px}.clock-v14{text-align:right}.clock-v14 small,.clock-v14 strong,.clock-v14 span{display:block}.clock-v14 small{font-size:6px;color:#8ba7bb}.clock-v14 strong{font-size:27px;color:#d9f7ff;line-height:1;text-shadow:0 0 16px rgba(40,201,255,.22)}.clock-v14 span{margin-top:3px;font-size:7px;color:#9fb8c9}.system-pill{display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid rgba(69,237,130,.42);border-radius:10px;background:rgba(69,237,130,.055)}.system-pill>i{width:9px;height:9px;border-radius:50%;background:var(--green);box-shadow:0 0 13px var(--green);animation:sysPulse 1.5s infinite}.system-pill strong,.system-pill small{display:block}.system-pill strong{font-size:7px;color:var(--green)}.system-pill small{margin-top:3px;font-size:5px;color:#8eb5a1;white-space:nowrap}
    .filter-v14{display:grid;grid-template-columns:auto auto minmax(440px,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:7px 10px;background:linear-gradient(90deg,rgba(5,20,34,.97),rgba(3,11,20,.97))}.filter-label{display:flex;align-items:center;gap:8px;padding-right:12px;border-right:1px solid var(--line)}.filter-label>i{width:23px;height:23px;color:var(--cyan)}.filter-label strong,.filter-label small{display:block}.filter-label strong{font-size:8px}.filter-label small{font-size:5px;color:#7998ac;margin-top:2px}.quick-v14{display:flex;gap:5px}.quick-v14 button,.apply-v14{appearance:none;border:1px solid rgba(65,159,220,.30);background:#04111c;color:#9fb9c9;border-radius:7px;padding:7px 10px;font-size:6px;font-weight:800;cursor:pointer}.quick-v14 button.active,.quick-v14 button:hover,.apply-v14.active,.apply-v14:hover{color:#dff8ff;border-color:#27c7ff;background:rgba(39,199,255,.09);box-shadow:0 0 14px rgba(39,199,255,.08)}.dates-v14{display:grid;grid-template-columns:minmax(150px,1fr) auto minmax(150px,1fr) auto;gap:7px;align-items:end}.dates-v14 label span{display:block;font-size:5px;color:#90a9ba;margin-bottom:3px}.dates-v14 input{width:100%;height:32px;padding:4px 8px;border:1px solid rgba(63,154,214,.33);border-radius:7px;background:#020a12;color:#eef9ff;color-scheme:dark;font-size:7px}.dates-v14>b{align-self:center;color:var(--cyan)}.apply-v14{height:32px}.period-active{text-align:right;min-width:125px}.period-active span,.period-active strong,.period-active small{display:block}.period-active span{font-size:5px;color:#7994a5}.period-active strong{font-size:8px;color:var(--cyan);margin-top:2px}.period-active small{font-size:5px;color:#8aa5b6;margin-top:2px}
    main{min-width:0}.premium-overview{display:grid;gap:10px}.premium-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.pkpi{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center;min-height:110px;padding:12px 13px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(145deg,rgba(7,23,38,.96),rgba(3,10,18,.96));overflow:hidden}.pkpi:before{content:"";position:absolute;left:0;top:0;width:100%;height:2px;background:currentColor;opacity:.65;box-shadow:0 0 16px currentColor}.pkpi>i{width:34px;height:34px;color:currentColor;filter:drop-shadow(0 0 8px currentColor)}.pkpi span,.pkpi strong,.pkpi small{display:block}.pkpi span{font-size:7px;font-weight:900;color:#d6e7f1}.pkpi strong{font-size:clamp(19px,1.5vw,30px);margin-top:4px;color:currentColor;text-shadow:0 0 15px currentColor;white-space:nowrap}.pkpi small{font-size:6px;color:#8fa9ba;margin-top:5px}.pkpi em{grid-column:1/3;justify-self:start;display:flex;align-items:center;gap:5px;font-style:normal;font-size:6px;color:#72eb9d}.pkpi em b{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green)}.pkpi>u{grid-column:1/3;height:6px;border-radius:10px;background:#122635;overflow:hidden;text-decoration:none}.pkpi>u>b{display:block;height:100%;background:linear-gradient(90deg,currentColor,#55efa0);border-radius:inherit}.pkpi.solar{color:var(--green)}.pkpi.inverter{color:var(--blue)}.pkpi.micro{color:var(--orange)}.pkpi.house{color:var(--red)}.pkpi.import{color:var(--cyan)}.pkpi.export{color:var(--purple)}.pkpi.balance{color:var(--green)}
    .hero-grid{display:grid;grid-template-columns:minmax(0,4.25fr) minmax(290px,1.05fr);gap:10px}.premium-flow,.period-summary,.mini-panel,.lower-panel,.panel,.hero-kpi{border:1px solid rgba(54,151,213,.28);background:linear-gradient(145deg,rgba(4,16,29,.96),rgba(1,7,14,.985));border-radius:16px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 16px 40px rgba(0,0,0,.16)}.premium-flow{min-height:425px}.premium-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(67,157,214,.14)}.premium-head span{display:block;font-size:14px;font-weight:950;letter-spacing:.1px}.premium-head small{display:block;margin-top:4px;font-size:7.5px;color:#92adbd}.premium-head em{font-style:normal;display:flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid rgba(69,237,130,.38);border-radius:20px;color:var(--green);font-size:6.5px;font-weight:900;background:rgba(27,114,62,.08)}.premium-head em i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px var(--green)}.scene-wrap{position:relative;height:365px;overflow:hidden;background:#020912}.scene-art{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;pointer-events:none}
.scene-assets{background:
radial-gradient(circle at 51% 47%,rgba(21,101,137,.24),transparent 30%),
linear-gradient(180deg,#020914 0%,#04111c 48%,#02070d 100%)}
.scene-atmosphere{position:absolute;inset:0;background:
radial-gradient(ellipse at 50% 82%,rgba(33,213,124,.10),transparent 33%),
radial-gradient(ellipse at 13% 73%,rgba(35,133,255,.11),transparent 28%),
radial-gradient(ellipse at 88% 64%,rgba(52,172,255,.10),transparent 25%);
filter:blur(2px)}
.asset{position:absolute;display:block;object-fit:contain;user-select:none;-webkit-user-drag:none;will-change:filter,transform}
.asset-solar{left:-1.2%;bottom:-4%;width:38%;height:76%;object-position:left bottom;filter:drop-shadow(0 0 18px rgba(28,139,255,.28)) saturate(1.10)}
.asset-house{left:50%;bottom:-7%;width:57%;height:94%;transform:translateX(-50%);object-position:center bottom;filter:drop-shadow(0 12px 26px rgba(0,0,0,.60)) saturate(1.05)}
.asset-grid{right:-1.5%;bottom:-5%;width:31%;height:99%;object-position:right bottom;filter:drop-shadow(0 0 17px rgba(85,170,255,.24)) saturate(.96)}
.ground-glow{position:absolute;bottom:-10%;height:35%;border-radius:50%;filter:blur(28px);opacity:.35}
.ground-glow-solar{left:2%;width:32%;background:rgba(23,116,255,.22)}
.ground-glow-house{left:35%;width:34%;background:rgba(255,174,66,.15)}
.ground-glow-grid{right:1%;width:25%;background:rgba(47,161,255,.15)}.scene-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,5,10,.20),transparent 28%,transparent 70%,rgba(0,5,10,.24)),linear-gradient(0deg,rgba(0,5,10,.30),transparent 34%);pointer-events:none}.source-card{position:absolute;left:7.8%;width:18.5%;min-width:165px;display:grid;grid-template-columns:40px 1fr;gap:9px;align-items:center;padding:11px 12px;border-radius:12px;background:linear-gradient(145deg,rgba(3,14,24,.92),rgba(2,9,16,.86));backdrop-filter:blur(12px);box-shadow:0 12px 30px rgba(0,0,0,.34),inset 0 0 22px rgba(255,255,255,.018)}.source-card>i{width:34px;height:34px}.source-card span,.source-card strong,.source-card small{display:block}.source-card span{font-size:7px;font-weight:900;letter-spacing:.2px}.source-card strong{font-size:19px;margin-top:2px;text-shadow:0 0 16px currentColor}.source-card small{font-size:6.2px;color:#a6bdc9;margin-top:3px}.source-inv{top:13%;border:1px solid rgba(60,144,255,.82);color:var(--blue);box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 24px rgba(60,144,255,.09)}.source-micro{top:51%;border:1px solid rgba(255,173,69,.82);color:var(--orange);box-shadow:0 12px 30px rgba(0,0,0,.34),0 0 24px rgba(255,173,69,.08)}.solar-badge{position:absolute;left:31.5%;top:42%;text-align:center;padding:9px 14px;border:1px solid rgba(69,237,130,.78);border-radius:9px;background:rgba(2,37,21,.86);color:var(--green);box-shadow:0 0 22px rgba(69,237,130,.13),inset 0 0 16px rgba(69,237,130,.03)}.solar-badge strong,.solar-badge span{display:block}.solar-badge strong{font-size:18px;text-shadow:0 0 14px var(--green)}.solar-badge span{font-size:6px;margin-top:2px;color:#c0dfca}.home-badge{position:absolute;left:51%;bottom:4.2%;transform:translateX(-50%);min-width:158px;text-align:center;padding:10px 16px 11px;border-radius:14px;background:linear-gradient(145deg,rgba(4,18,31,.94),rgba(2,9,16,.9));border:1px solid rgba(77,166,235,.58);box-shadow:0 15px 34px rgba(0,0,0,.32),0 0 27px rgba(38,153,223,.08)}.home-badge i{display:block;width:25px;height:25px;margin:auto;color:var(--cyan)}.home-badge span,.home-badge strong,.home-badge small{display:block}.home-badge span{font-size:7px;color:#d0e3ed}.home-badge strong{font-size:24px;margin-top:2px;text-shadow:0 0 15px rgba(65,201,255,.35)}.home-badge small{font-size:6px;color:#91adbd;margin-top:2px}.grid-badge{position:absolute;right:5.2%;bottom:5%;text-align:center;color:#d6ecf8;text-shadow:0 0 12px rgba(118,191,255,.2)}.grid-badge span,.grid-badge strong{display:block}.grid-badge span{font-size:6px}.grid-badge strong{font-size:9px;margin-top:2px}.imp-badge,.exp-badge{position:absolute;right:17.5%;min-width:128px;text-align:center;padding:8px 10px;border-radius:9px;background:rgba(2,10,18,.90);box-shadow:0 10px 24px rgba(0,0,0,.30)}.imp-badge{top:27%;border:1px solid rgba(255,173,69,.82);color:var(--orange)}.exp-badge{top:59%;border:1px solid rgba(40,201,255,.82);color:var(--cyan)}.imp-badge strong,.imp-badge span,.imp-badge small,.exp-badge strong,.exp-badge span,.exp-badge small{display:block}.imp-badge strong,.exp-badge strong{font-size:16px;text-shadow:0 0 13px currentColor}.imp-badge span,.exp-badge span{font-size:6px;margin-top:2px}.imp-badge small,.exp-badge small{font-size:5px;color:#90aabb;margin-top:2px}.idle{opacity:.28}.solar-flow-line,.import-flow-line,.export-flow-line{position:absolute;height:4px;border-radius:4px;pointer-events:none}.solar-flow-line{left:24.5%;top:50%;width:31.5%;background:linear-gradient(90deg,#32d86f,var(--green),#a2ffbd);box-shadow:0 0 12px var(--green),0 0 24px rgba(80,232,141,.18)}.import-flow-line{right:18.5%;top:43%;width:25.5%;background:linear-gradient(90deg,#ffca66,var(--orange));box-shadow:0 0 11px var(--orange)}.export-flow-line{right:18.5%;top:62%;width:24.8%;background:linear-gradient(90deg,var(--cyan),#73e8ff);box-shadow:0 0 11px var(--cyan)}.solar-flow-line:before,.import-flow-line:before,.export-flow-line:before{content:"";position:absolute;inset:-4px 0;background:inherit;filter:blur(7px);opacity:.28}.solar-flow-line b,.import-flow-line b,.export-flow-line b{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor,0 0 20px currentColor;transform:translateY(-50%);animation:energyMove 2.15s linear infinite}.solar-flow-line{color:var(--green)}.import-flow-line{color:var(--orange)}.export-flow-line{color:var(--cyan)}.solar-flow-line b:nth-child(2),.import-flow-line b:nth-child(2),.export-flow-line b:nth-child(2){animation-delay:.72s}.solar-flow-line b:nth-child(3){animation-delay:1.44s}.is-importing .import-flow-line b{animation-direction:reverse}.is-importing .export-flow-line{opacity:.12}.is-exporting .import-flow-line{opacity:.12}
    .period-summary{padding:11px}.summary-title{display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid rgba(64,154,212,.16)}.summary-title span,.summary-title strong{display:block}.summary-title span{font-size:11px;font-weight:950}.summary-title strong{font-size:6px;color:var(--cyan);margin-top:3px}.summary-title em{font-style:normal;padding:4px 7px;border-radius:12px;border:1px solid rgba(40,201,255,.3);font-size:5px;color:var(--cyan)}.summary-lines{display:grid;margin-top:6px}.summary-lines>div{display:grid;grid-template-columns:20px 1fr auto;gap:7px;align-items:center;padding:9px 3px;border-bottom:1px solid rgba(74,145,190,.13)}.summary-lines i{width:18px;height:18px;color:currentColor}.summary-lines span{font-size:7px;color:#c5d9e5}.summary-lines strong{font-size:8px;color:currentColor}.summary-lines .green{color:var(--green)}.summary-lines .blue{color:var(--blue)}.summary-lines .orange{color:var(--orange)}.summary-lines .red{color:var(--red)}.summary-lines .cyan{color:var(--cyan)}.summary-lines .purple{color:var(--purple)}.summary-dual{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.summary-dual>div{padding:9px;border:1px solid rgba(67,155,211,.16);border-radius:8px}.summary-dual span,.summary-dual strong{display:block}.summary-dual span{font-size:5px;color:#8aa5b6}.summary-dual strong{font-size:14px;margin-top:3px}
    .analytics-row{display:grid;grid-template-columns:1.05fr 1.05fr 1.05fr .72fr;gap:9px}.mini-panel{min-height:245px;padding:10px}.mini-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.mini-title span,.mini-title strong,.mini-title small{display:block}.mini-title span{font-size:8px;font-weight:900}.mini-title strong{font-size:18px;margin-top:3px}.mini-title>small{font-size:5px;color:#8da7b8}.peak-pill{padding:5px 7px;border:1px solid rgba(255,85,120,.35);border-radius:7px;text-align:right}.peak-pill span{font-size:5px;color:var(--red)}.peak-pill strong{font-size:11px;color:var(--red);margin-top:1px}.peak-pill small{font-size:5px}.grid-card .mini-title strong b{color:var(--orange)}.grid-card .mini-title strong i{font-style:normal;color:var(--cyan)}.gauge-card .donut{height:190px}.gauge-card .donut svg{max-height:165px}.chart-box{display:grid;grid-template-rows:minmax(155px,1fr) auto;height:190px;margin-top:8px}.chart-box>svg{width:100%;height:100%}.gridline{stroke:rgba(91,135,165,.14);stroke-width:1}.gridtext{fill:#89a3b4;font:9px ui-monospace,monospace}.trend{fill:none;stroke-width:3;filter:drop-shadow(0 0 4px currentColor)}.trend.green{stroke:var(--green)}.trend.blue{stroke:var(--blue)}.trend.orange{stroke:var(--orange)}.trend.red{stroke:var(--red)}.trend.cyan{stroke:var(--cyan)}.trend.purple{stroke:var(--purple)}.chart-legend{display:flex;gap:10px;align-items:center}.chart-legend span{display:flex;align-items:center;gap:4px;font-size:5px;color:#93a9b8}.chart-legend span i{width:6px;height:6px;border-radius:50%;background:currentColor}.chart-legend .green{color:var(--green)}.chart-legend .blue{color:var(--blue)}.chart-legend .orange{color:var(--orange)}.chart-legend .red{color:var(--red)}.chart-legend .cyan{color:var(--cyan)}.chart-legend .purple{color:var(--purple)}.donut{position:relative;display:grid;place-items:center;min-height:150px}.donut svg{width:150px;height:150px;transform:rotate(-90deg)}.donut circle{fill:none;stroke-width:10}.donut .d-bg{stroke:rgba(115,143,160,.16)}.donut .d-fg{stroke:currentColor;stroke-linecap:round;filter:drop-shadow(0 0 6px currentColor)}.donut>div{position:absolute;text-align:center}.donut strong,.donut span{display:block}.donut strong{font-size:24px}.donut span{font-size:5px;color:#a6bdcb;margin-top:3px}.donut.green{color:var(--green)}.donut.cyan{color:var(--cyan)}.donut.purple{color:var(--purple)}.donut.blue{color:var(--blue)}.donut.orange{color:var(--orange)}
    .lower-row{display:grid;grid-template-columns:1.12fr 1fr 1fr .86fr;gap:9px}.lower-panel{min-height:180px;padding:10px}.lower-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.lower-title strong{font-size:9px}.lower-title span{font-size:5px;color:#819cab}.consumer-list{display:grid;gap:5px}.consumer{display:grid;grid-template-columns:20px minmax(90px,.85fr) minmax(70px,1fr) auto auto;gap:6px;align-items:center}.consumer>i{width:17px;height:17px;color:#b6ccda}.consumer>span{font-size:6px}.consumer>b{height:5px;border-radius:10px;background:#122432;overflow:hidden}.consumer>b>u{display:block;height:100%;background:linear-gradient(90deg,var(--red),var(--blue),var(--purple));border-radius:inherit}.consumer>strong{font-size:6px}.consumer>em{font-style:normal;font-size:5px;color:#9db4c2}.board-bars{display:grid;gap:13px}.board-bars>div{display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center}.board-bars span{font-size:7px}.board-bars strong{font-size:9px}.board-bars em{font-style:normal;font-size:6px}.board-bars b{grid-column:1/4;height:7px;background:#132431;border-radius:10px;overflow:hidden}.board-bars b u{display:block;height:100%;background:linear-gradient(90deg,#4d8dff,var(--purple));border-radius:inherit}.board-bars .qd2 b u{background:linear-gradient(90deg,var(--orange),var(--cyan))}.equip-list,.indicator-list{display:grid}.equip-list>div,.indicator-list>div{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(65,142,188,.12)}.equip-list i{width:7px;height:7px;border-radius:50%}.equip-list i.ok{background:var(--green);box-shadow:0 0 9px var(--green)}.equip-list i.bad{background:var(--red);box-shadow:0 0 9px var(--red)}.equip-list span,.indicator-list span{font-size:6px}.equip-list strong{font-size:6px;color:var(--green)}.indicator-list>div{grid-template-columns:1fr auto}.indicator-list strong{font-size:6px}
    .panel,.hero-kpi{position:relative;padding:11px}.screen{display:grid;gap:9px}.detail-kpis{display:grid;gap:7px}.detail-kpis.three{grid-template-columns:repeat(3,1fr)}.detail-kpis.four{grid-template-columns:repeat(4,1fr)}.hero-kpi{color:var(--cyan)}.hero-kpi .kpi-top{display:flex;gap:7px;align-items:center}.hero-kpi .kpi-top i{width:19px;height:19px}.hero-kpi .kpi-top span{font-size:7px}.hero-kpi .kpi-top em{margin-left:auto;font-size:5px;font-style:normal;color:#7e9aaa}.hero-kpi>strong{display:block;font-size:22px;margin-top:7px;color:currentColor}.hero-kpi>small{display:block;color:#8da8ba;font-size:6px;margin-top:4px}.hero-kpi.green{color:var(--green)}.hero-kpi.blue{color:var(--blue)}.hero-kpi.orange{color:var(--orange)}.hero-kpi.red,.hero-kpi.pink{color:var(--red)}.hero-kpi.cyan{color:var(--cyan)}.hero-kpi.purple{color:var(--purple)}.two-col{display:grid;grid-template-columns:1.25fr .75fr;gap:9px}.panel.tall{min-height:420px}.section-head{display:flex;justify-content:space-between}.section-head span{display:block;font-size:6px;color:var(--cyan)}.section-head strong{display:block;font-size:11px;margin-top:2px}.section-head small{display:block;font-size:6px;color:#8ca7b8;margin-top:2px}.generator-compare{display:grid;grid-template-columns:1fr 1fr}.compare-ledger{display:grid;grid-template-columns:1fr 1fr;gap:7px}.compare-ledger>div{padding:9px;border:1px solid rgba(75,156,207,.14);border-radius:8px}.compare-ledger span,.compare-ledger strong,.compare-ledger small{display:block}.compare-ledger span{font-size:6px}.compare-ledger strong{font-size:13px;margin-top:3px}.compare-ledger small{font-size:5px;color:#849cac;margin-top:2px}.device-table{display:grid;gap:4px;margin-top:8px}.device-row{display:grid;grid-template-columns:26px 28px minmax(120px,1fr) 1fr auto;gap:7px;align-items:center;padding:7px;border-bottom:1px solid rgba(72,145,188,.12)}.device-rank{font-size:6px;color:#7896a9}.device-icon{width:23px;height:23px;color:var(--cyan)}.device-name strong,.device-name small,.device-energy strong,.device-energy small{display:block}.device-name strong{font-size:7px}.device-name small,.device-energy small{font-size:5px;color:#849dab}.device-energy{text-align:right}.device-energy strong{font-size:7px}.device-meter{height:5px;background:#132431;border-radius:8px;overflow:hidden}.device-meter i{display:block;height:100%;background:linear-gradient(90deg,var(--cyan),var(--purple))}.boards-screen{grid-template-columns:1fr 1fr}.board-panel{min-height:520px}.untracked{display:flex;justify-content:space-between;margin-top:9px;padding:8px;border:1px dashed rgba(83,155,198,.18);font-size:6px}.history-screen{grid-template-columns:1.45fr .55fr}.history-main{min-height:520px}.history-side{display:grid;gap:7px}.analytics-screen{grid-template-columns:.7fr 1.3fr}.analytics-gauges{display:grid;gap:7px}.analysis-cards{display:grid;grid-template-columns:1fr 1fr;gap:7px}.analysis-cards>div{padding:12px;border:1px solid rgba(75,151,198,.14);border-radius:8px}.analysis-cards span,.analysis-cards strong,.analysis-cards small{display:block}.analysis-cards span{font-size:6px;color:#88a3b4}.analysis-cards strong{font-size:15px;margin-top:4px}.analysis-cards small{font-size:5px;color:#819bab;margin-top:3px}.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.status-row{display:grid;grid-template-columns:auto 1fr auto;gap:6px;padding:9px;border:1px solid rgba(75,151,198,.14);border-radius:8px}.status-row i{width:7px;height:7px;border-radius:50%}.status-row.ok i{background:var(--green)}.status-row.bad i{background:var(--red)}.status-row span{font-size:7px}.status-row strong{font-size:6px}.status-row small{grid-column:2/4;font-size:5px;color:#829cac}
    @keyframes sysPulse{0%,100%{opacity:.55;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}@keyframes energyMove{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}
    @media(max-width:1450px){.master-header{grid-template-columns:minmax(230px,.8fr) minmax(600px,2.3fr) minmax(225px,.8fr)}.master-tabs button{font-size:7px}.premium-kpis{grid-template-columns:repeat(4,1fr)}.hero-grid{grid-template-columns:minmax(0,3.6fr) minmax(245px,1fr)}.analytics-row{grid-template-columns:1fr 1fr}.lower-row{grid-template-columns:1fr 1fr}.scene-wrap{height:315px}}
    @media(max-width:1050px){.shell-v24{padding:8px}.master-header{grid-template-columns:1fr auto}.master-tabs{grid-column:1/3;grid-row:2}.header-meta{grid-column:2;grid-row:1}.filter-v14{grid-template-columns:1fr}.filter-label{border-right:0;border-bottom:1px solid var(--line);padding-bottom:6px}.quick-v14{overflow-x:auto}.period-active{text-align:left}.hero-grid{grid-template-columns:1fr}.period-summary{display:none}.premium-kpis{grid-template-columns:repeat(2,1fr)}.scene-wrap{height:300px}.source-card{width:25%;left:4%}.solar-badge{left:32%}.analytics-row,.lower-row{grid-template-columns:1fr 1fr}.two-col,.history-screen,.analytics-screen,.boards-screen{grid-template-columns:1fr}.status-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:650px){ha-card.energy-v24{border-radius:0}.shell-v24{padding:5px;gap:6px}.master-header{grid-template-columns:1fr auto;min-height:auto}.brand-v14{padding:8px}.brand-mark{width:37px;height:37px;padding:8px}.brand-v14 strong{font-size:15px}.brand-v14 small{font-size:5px}.header-meta{padding:5px}.clock-v14 small,.clock-v14 span{display:none}.clock-v14 strong{font-size:19px}.system-pill{padding:6px}.system-pill small{display:none}.master-tabs{display:flex;overflow-x:auto}.master-tabs button{min-width:78px;height:49px}.filter-v14{padding:6px}.dates-v14{grid-template-columns:1fr 1fr}.dates-v14>b{display:none}.dates-v14 .apply-v14{grid-column:1/3}.premium-kpis{grid-template-columns:1fr 1fr;gap:5px}.pkpi{min-height:88px;grid-template-columns:28px 1fr;padding:8px}.pkpi>i{width:26px;height:26px}.pkpi strong{font-size:16px}.pkpi span{font-size:5px}.pkpi small{font-size:4.5px}.premium-flow{min-height:330px}.premium-head span{font-size:9px}.premium-head small{font-size:5px}.scene-wrap{height:275px}.source-card{left:2%;width:34%;min-width:0;grid-template-columns:24px 1fr;padding:6px}.source-card>i{width:22px;height:22px}.source-card span{font-size:4.5px}.source-card strong{font-size:10px}.source-card small{font-size:4px}.solar-badge{left:30%;top:42%;padding:5px 7px}.solar-badge strong{font-size:10px}.home-badge{left:52%;min-width:100px;padding:6px}.home-badge strong{font-size:14px}.imp-badge,.exp-badge{right:13%;min-width:86px;padding:5px}.imp-badge strong,.exp-badge strong{font-size:9px}.grid-badge{right:2%}.solar-flow-line{left:24%;width:38%}.import-flow-line,.export-flow-line{right:16%;width:27%}.analytics-row,.lower-row{grid-template-columns:1fr}.mini-panel{min-height:220px}.chart-box{height:165px}.detail-kpis.three,.detail-kpis.four{grid-template-columns:1fr 1fr}.status-grid{grid-template-columns:1fr}.device-row{grid-template-columns:20px 20px 1fr auto}.device-meter{display:none}.device-energy small{display:none}}

    @media(max-width:1050px){
      .asset-solar{left:-5%;width:43%;height:69%}
      .asset-house{width:64%;height:89%}
      .asset-grid{right:-5%;width:35%;height:92%}
    }
    @media(max-width:650px){
      .asset-solar{left:-12%;bottom:-1%;width:54%;height:60%;opacity:.92}
      .asset-house{left:52%;bottom:-2%;width:76%;height:78%}
      .asset-grid{right:-13%;bottom:-1%;width:45%;height:82%;opacity:.9}
    }

    
/* ========================================================================
   V17 // HERO SCENE + PREMIUM GLASS COMPONENTS
   ======================================================================== */

/* Real asset positioning - independent objects, no cross-contamination */
.asset-solar{
  left:-1.4%!important;
  bottom:-3%!important;
  width:35%!important;
  height:72%!important;
  object-fit:contain!important;
  object-position:left bottom!important;
  filter:
    drop-shadow(0 12px 28px rgba(0,0,0,.58))
    drop-shadow(0 0 20px rgba(36,151,255,.24))
    saturate(1.12)!important;
}
.asset-house{
  left:50.5%!important;
  bottom:-5.5%!important;
  width:55%!important;
  height:91%!important;
  transform:translateX(-50%)!important;
  object-fit:contain!important;
  object-position:center bottom!important;
  filter:
    drop-shadow(0 15px 35px rgba(0,0,0,.65))
    drop-shadow(0 0 18px rgba(255,175,72,.10))
    saturate(1.06)!important;
}
.asset-grid{
  right:1.0%!important;
  bottom:-4%!important;
  width:27%!important;
  height:96%!important;
  object-fit:contain!important;
  object-position:right bottom!important;
  filter:
    drop-shadow(0 10px 30px rgba(0,0,0,.6))
    drop-shadow(0 0 19px rgba(86,180,255,.20))
    saturate(1.02)!important;
}

/* More cinematic hero canvas */
.scene-wrap{
  background:
    radial-gradient(circle at 50% 45%,rgba(21,92,126,.18),transparent 31%),
    linear-gradient(180deg,#020914 0%,#04111c 48%,#02080f 100%)!important;
}
.scene-wrap:before{
  content:"";
  position:absolute;
  inset:0;
  z-index:1;
  pointer-events:none;
  background:
    radial-gradient(ellipse at 50% 88%,rgba(42,232,137,.06),transparent 34%),
    linear-gradient(180deg,transparent 52%,rgba(0,5,10,.36));
}
.scene-art{z-index:0}
.scene-shade{z-index:2;opacity:.55}

/* Floating HUD source cards: no longer look like plain rectangles */
.source-card{
  z-index:8!important;
  border:0!important;
  border-radius:18px!important;
  padding:11px 14px 11px 12px!important;
  background:
    linear-gradient(135deg,rgba(8,25,42,.82),rgba(2,9,17,.58))!important;
  backdrop-filter:blur(18px) saturate(1.4)!important;
  -webkit-backdrop-filter:blur(18px) saturate(1.4)!important;
  box-shadow:
    0 18px 38px rgba(0,0,0,.42),
    inset 0 1px 0 rgba(255,255,255,.09),
    inset 0 -1px 0 rgba(64,180,255,.05)!important;
  overflow:visible!important;
  clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))!important;
}
.source-card:before{
  content:"";
  position:absolute;
  inset:-1px;
  z-index:-1;
  clip-path:inherit;
  border-radius:inherit;
  padding:1px;
  background:linear-gradient(135deg,currentColor,rgba(255,255,255,.06) 38%,transparent 70%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  opacity:.72;
}
.source-card:after{
  content:"";
  position:absolute;
  left:18%;
  right:18%;
  bottom:-1px;
  height:1px;
  background:linear-gradient(90deg,transparent,currentColor,transparent);
  box-shadow:0 0 14px currentColor;
  opacity:.7;
}
.source-card>i{
  position:relative;
  width:37px!important;
  height:37px!important;
  display:grid!important;
  place-items:center!important;
  padding:8px!important;
  border-radius:14px!important;
  background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.16),rgba(255,255,255,.02) 58%,transparent)!important;
  box-shadow:inset 0 0 18px rgba(255,255,255,.035),0 0 18px currentColor!important;
}
.source-card strong{letter-spacing:-.3px}
.source-inv{color:#45a5ff!important}
.source-micro{color:#ffae45!important}

/* Compact floating chips integrated into the scene */
.solar-badge,.imp-badge,.exp-badge{
  z-index:9!important;
  border:0!important;
  border-radius:999px!important;
  backdrop-filter:blur(14px) saturate(1.3)!important;
  -webkit-backdrop-filter:blur(14px) saturate(1.3)!important;
  box-shadow:
    0 10px 25px rgba(0,0,0,.36),
    inset 0 1px 0 rgba(255,255,255,.12),
    0 0 22px color-mix(in srgb,currentColor 30%,transparent)!important;
}
.solar-badge{
  padding:8px 15px!important;
  background:linear-gradient(135deg,rgba(20,93,50,.80),rgba(3,18,13,.68))!important;
}
.imp-badge{
  padding:8px 15px!important;
  background:linear-gradient(135deg,rgba(93,55,13,.80),rgba(20,11,3,.70))!important;
}
.exp-badge{
  padding:8px 15px!important;
  background:linear-gradient(135deg,rgba(4,67,89,.82),rgba(2,15,22,.70))!important;
}
.solar-badge:after,.imp-badge:after,.exp-badge:after{
  content:"";
  position:absolute;
  inset:-1px;
  border-radius:inherit;
  border:1px solid currentColor;
  opacity:.55;
  pointer-events:none;
}

/* House readout becomes a central holographic console */
.home-badge{
  z-index:9!important;
  border:0!important;
  border-radius:22px!important;
  padding:9px 21px 11px!important;
  min-width:170px!important;
  background:
    radial-gradient(circle at 50% 0,rgba(70,198,255,.16),transparent 50%),
    linear-gradient(145deg,rgba(4,22,36,.84),rgba(1,8,15,.66))!important;
  backdrop-filter:blur(17px) saturate(1.35)!important;
  -webkit-backdrop-filter:blur(17px) saturate(1.35)!important;
  box-shadow:
    0 20px 38px rgba(0,0,0,.42),
    0 0 24px rgba(54,192,255,.12),
    inset 0 1px 0 rgba(255,255,255,.11)!important;
  clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px)!important;
}
.home-badge:before{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    linear-gradient(90deg,transparent,rgba(76,208,255,.9),transparent) top/55% 1px no-repeat,
    linear-gradient(90deg,transparent,rgba(76,208,255,.55),transparent) bottom/55% 1px no-repeat;
}
.home-badge i{
  width:24px!important;height:24px!important;
  filter:drop-shadow(0 0 10px var(--cyan));
}
.home-badge strong{font-size:25px!important}

/* Smooth luminous streams instead of rigid bars */
.solar-flow-line,.import-flow-line,.export-flow-line{
  z-index:6!important;
  height:3px!important;
  border-radius:100%!important;
}
.solar-flow-line{
  transform:rotate(.2deg)!important;
  background:linear-gradient(90deg,rgba(80,232,141,.15),#50e88d 16%,#b7ffca 52%,#50e88d 84%,rgba(80,232,141,.15))!important;
}
.import-flow-line{
  transform:rotate(-.15deg)!important;
  background:linear-gradient(90deg,rgba(255,174,69,.12),#ffae45 24%,#ffe0a1 62%,#ffae45)!important;
}
.export-flow-line{
  transform:rotate(.15deg)!important;
  background:linear-gradient(90deg,#43d5ff,#a9efff 45%,#43d5ff 78%,rgba(67,213,255,.12))!important;
}
.solar-flow-line b,.import-flow-line b,.export-flow-line b{
  width:7px!important;height:7px!important;
  box-shadow:0 0 8px currentColor,0 0 20px currentColor,0 0 34px currentColor!important;
}

/* KPI row: layered futuristic cards with illuminated icon wells */
.pkpi{
  border:1px solid rgba(78,158,210,.18)!important;
  border-radius:18px!important;
  background:
    radial-gradient(circle at 12% 20%,color-mix(in srgb,currentColor 11%,transparent),transparent 28%),
    linear-gradient(145deg,rgba(7,23,38,.90),rgba(2,9,17,.96))!important;
  box-shadow:
    0 12px 32px rgba(0,0,0,.22),
    inset 0 1px 0 rgba(255,255,255,.035)!important;
  transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease!important;
}
.pkpi:hover{
  transform:translateY(-2px);
  border-color:color-mix(in srgb,currentColor 42%,transparent)!important;
  box-shadow:0 18px 38px rgba(0,0,0,.3),0 0 22px color-mix(in srgb,currentColor 9%,transparent)!important;
}
.pkpi:before{
  height:1px!important;
  width:72%!important;
  left:14%!important;
  background:linear-gradient(90deg,transparent,currentColor,transparent)!important;
  opacity:.8!important;
}
.pkpi:after{
  content:"";
  position:absolute;
  width:70px;height:70px;
  left:-25px;bottom:-36px;
  border:1px solid currentColor;
  border-radius:50%;
  opacity:.06;
  box-shadow:0 0 28px currentColor;
}
.pkpi>i{
  width:39px!important;height:39px!important;
  padding:8px;
  border-radius:14px;
  background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.14),rgba(255,255,255,.025) 56%,transparent);
  box-shadow:inset 0 0 17px rgba(255,255,255,.035),0 0 15px color-mix(in srgb,currentColor 28%,transparent);
}
.pkpi strong{letter-spacing:-.45px}

/* All lower surfaces get more dimensionality and a subtle animated edge */
.mini-panel,.lower-panel,.panel,.period-summary{
  position:relative!important;
  border:1px solid rgba(61,150,206,.18)!important;
  background:
    radial-gradient(circle at 18% 0,rgba(33,137,193,.045),transparent 29%),
    linear-gradient(145deg,rgba(5,18,31,.92),rgba(1,8,15,.98))!important;
  box-shadow:0 12px 32px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.025)!important;
}
.mini-panel:before,.lower-panel:before,.period-summary:before{
  content:"";
  position:absolute;
  z-index:2;
  left:16px;right:55%;
  top:0;height:1px;
  background:linear-gradient(90deg,var(--cyan),transparent);
  box-shadow:0 0 10px rgba(75,210,255,.4);
  opacity:.55;
}
.summary-lines>div{
  transition:background .18s ease,transform .18s ease;
  border-radius:8px;
}
.summary-lines>div:hover{
  background:rgba(255,255,255,.025);
  transform:translateX(2px);
}

/* Gentle motion */
@keyframes hudBreath{
  0%,100%{filter:brightness(1)}
  50%{filter:brightness(1.12)}
}
.source-card>i,.pkpi>i{animation:hudBreath 3.4s ease-in-out infinite}

    
@media(max-width:1050px){
  .asset-solar{left:-5%!important;width:42%!important;height:65%!important}
  .asset-house{left:51%!important;width:63%!important;height:87%!important}
  .asset-grid{right:-4%!important;width:34%!important;height:91%!important}
}
@media(max-width:650px){
  .asset-solar{left:-11%!important;bottom:0!important;width:52%!important;height:54%!important}
  .asset-house{left:52%!important;bottom:0!important;width:75%!important;height:72%!important}
  .asset-grid{right:-11%!important;bottom:0!important;width:44%!important;height:76%!important}
  .source-card{border-radius:13px!important}
  .home-badge{min-width:108px!important;padding:6px 9px 7px!important;border-radius:14px!important}
  .home-badge strong{font-size:15px!important}
}

    
/* ========================================================================
   V18 // TYPOGRAPHY + PROPORTION PASS
   Calibrated against the approved visual mockup.
   ======================================================================== */
@media(min-width:1051px){
  /* Header */
  .master-header{min-height:84px!important}
  .brand-v14 strong{font-size:clamp(22px,1.55vw,31px)!important}
  .brand-v14 small{font-size:10px!important}
  .master-tabs button{font-size:10px!important;gap:7px!important}
  .master-tabs button i{width:25px!important;height:25px!important}
  .clock-v14 small{font-size:8px!important}
  .clock-v14 strong{font-size:31px!important}
  .clock-v14 span{font-size:9px!important}
  .system-pill strong{font-size:9px!important}
  .system-pill small{font-size:7px!important}

  /* Period filter */
  .filter-v14{padding:10px 12px!important}
  .filter-label strong{font-size:10px!important}
  .filter-label small{font-size:7px!important}
  .quick-v14 button,.apply-v14{font-size:8px!important;padding:8px 12px!important}
  .dates-v14 label span{font-size:7px!important}
  .dates-v14 input{font-size:10px!important;height:36px!important}
  .apply-v14{height:36px!important}
  .period-active span,.period-active small{font-size:7px!important}
  .period-active strong{font-size:10px!important}

  /* Top KPI cards — text is now visually dominant like the mockup */
  .pkpi{
    min-height:126px!important;
    grid-template-columns:48px minmax(0,1fr)!important;
    gap:11px!important;
    padding:14px 15px!important;
  }
  .pkpi>i{width:43px!important;height:43px!important;padding:9px!important}
  .pkpi span{font-size:10px!important;line-height:1.15!important}
  .pkpi strong{font-size:clamp(26px,1.7vw,34px)!important;line-height:1.05!important;margin-top:7px!important}
  .pkpi small{font-size:9px!important;line-height:1.3!important;margin-top:7px!important}
  .pkpi em{font-size:9px!important;gap:7px!important}
  .pkpi em b{width:9px!important;height:9px!important}
  .pkpi>u{height:8px!important}

  /* Hero title */
  .premium-head{padding:14px 18px!important}
  .premium-head span{font-size:17px!important}
  .premium-head small{font-size:10px!important}
  .premium-head em{font-size:9px!important;padding:8px 13px!important}

  /* Hero source / measurement HUD */
  .source-card{
    width:20.5%!important;
    min-width:220px!important;
    grid-template-columns:46px 1fr!important;
    gap:12px!important;
    padding:14px 16px!important;
  }
  .source-card>i{width:42px!important;height:42px!important}
  .source-card span{font-size:10px!important}
  .source-card strong{font-size:25px!important;margin-top:4px!important}
  .source-card small{font-size:9px!important;line-height:1.25!important;margin-top:5px!important}

  .solar-badge{padding:10px 17px!important}
  .solar-badge strong{font-size:23px!important}
  .solar-badge span{font-size:8px!important}
  .home-badge{min-width:190px!important;padding:11px 23px 13px!important}
  .home-badge i{width:28px!important;height:28px!important}
  .home-badge span{font-size:9px!important}
  .home-badge strong{font-size:30px!important}
  .home-badge small{font-size:8px!important}
  .imp-badge,.exp-badge{min-width:150px!important;padding:10px 14px!important}
  .imp-badge strong,.exp-badge strong{font-size:21px!important}
  .imp-badge span,.exp-badge span{font-size:8px!important}
  .imp-badge small,.exp-badge small{font-size:7px!important}
  .grid-badge span{font-size:8px!important}
  .grid-badge strong{font-size:11px!important}

  /* Summary card */
  .period-summary{padding:14px!important}
  .summary-title span{font-size:14px!important}
  .summary-title strong{font-size:8px!important}
  .summary-title em{font-size:7px!important;padding:5px 9px!important}
  .summary-lines>div{grid-template-columns:25px 1fr auto!important;gap:9px!important;padding:11px 4px!important}
  .summary-lines i{width:22px!important;height:22px!important}
  .summary-lines span{font-size:10px!important}
  .summary-lines strong{font-size:11px!important}
  .summary-dual span{font-size:7px!important}
  .summary-dual strong{font-size:17px!important}

  /* Analytics */
  .mini-panel{min-height:280px!important;padding:13px!important}
  .mini-title span{font-size:11px!important}
  .mini-title strong{font-size:23px!important;margin-top:5px!important}
  .mini-title>small{font-size:7px!important}
  .peak-pill{padding:7px 10px!important}
  .peak-pill span{font-size:7px!important}
  .peak-pill strong{font-size:15px!important}
  .peak-pill small{font-size:7px!important}
  .chart-box{height:215px!important}
  .gridtext{font-size:11px!important}
  .chart-legend span{font-size:7px!important}
  .chart-legend span i{width:8px!important;height:8px!important}
  .donut strong{font-size:31px!important}
  .donut span{font-size:7px!important}

  /* Bottom cards */
  .lower-panel{min-height:205px!important;padding:13px!important}
  .lower-title{margin-bottom:10px!important}
  .lower-title strong{font-size:12px!important}
  .lower-title span{font-size:7px!important}
  .consumer-list{gap:7px!important}
  .consumer{grid-template-columns:25px minmax(110px,.85fr) minmax(80px,1fr) auto auto!important;gap:8px!important}
  .consumer>i{width:21px!important;height:21px!important}
  .consumer>span{font-size:9px!important}
  .consumer>strong{font-size:9px!important}
  .consumer>em{font-size:7px!important}
  .consumer>b{height:7px!important}
  .board-bars{gap:17px!important}
  .board-bars span{font-size:9px!important}
  .board-bars strong{font-size:12px!important}
  .board-bars em{font-size:8px!important}
  .board-bars b{height:9px!important}
  .equip-list>div,.indicator-list>div{padding:8px 0!important}
  .equip-list i{width:9px!important;height:9px!important}
  .equip-list span,.indicator-list span{font-size:9px!important}
  .equip-list strong,.indicator-list strong{font-size:9px!important}
}

/* Tablet: preserve readability instead of collapsing to micro-text */
@media(min-width:651px) and (max-width:1050px){
  .pkpi span{font-size:9px!important}
  .pkpi strong{font-size:25px!important}
  .pkpi small,.pkpi em{font-size:8px!important}
  .source-card span{font-size:8px!important}
  .source-card strong{font-size:20px!important}
  .source-card small{font-size:7px!important}
  .mini-title span{font-size:10px!important}
  .mini-title strong{font-size:21px!important}
  .lower-title strong{font-size:11px!important}
  .consumer>span,.board-bars span,.equip-list span,.indicator-list span{font-size:8px!important}
}

/* Phone: substantially larger than V17 while retaining the two-column KPI layout */
@media(max-width:650px){
  .pkpi{min-height:104px!important;grid-template-columns:34px 1fr!important;padding:9px!important}
  .pkpi>i{width:32px!important;height:32px!important;padding:6px!important}
  .pkpi span{font-size:7px!important}
  .pkpi strong{font-size:19px!important}
  .pkpi small{font-size:6.5px!important}
  .pkpi em{font-size:6.5px!important}
  .premium-head span{font-size:12px!important}
  .premium-head small{font-size:7px!important}
  .source-card span{font-size:6px!important}
  .source-card strong{font-size:13px!important}
  .source-card small{font-size:5.5px!important}
  .solar-badge strong{font-size:13px!important}
  .home-badge strong{font-size:17px!important}
  .imp-badge strong,.exp-badge strong{font-size:12px!important}
  .mini-title span{font-size:9px!important}
  .mini-title strong{font-size:19px!important}
  .lower-title strong{font-size:10px!important}
  .consumer>span,.board-bars span,.equip-list span,.indicator-list span{font-size:7.5px!important}
  .consumer>strong,.board-bars strong,.equip-list strong,.indicator-list strong{font-size:8px!important}
}

    
/* ========================================================================
   V19 // ITEM 1 - FLUXO DE ENERGIA
   ======================================================================== */
.hero-v19{
  height:390px!important;
  min-height:390px!important;
  overflow:hidden!important;
  isolation:isolate;
}

/* Assets: house is now the visual heart */
.hero-v19 .asset-solar{
  left:-1%!important;
  bottom:-5%!important;
  width:34%!important;
  height:77%!important;
  z-index:1!important;
}
.hero-v19 .asset-house{
  left:51%!important;
  bottom:-7%!important;
  width:61%!important;
  height:103%!important;
  z-index:2!important;
  filter:
    drop-shadow(0 18px 38px rgba(0,0,0,.70))
    drop-shadow(0 0 26px rgba(255,177,67,.13))
    saturate(1.08)!important;
}
.hero-v19 .asset-grid{
  right:-1%!important;
  bottom:-5%!important;
  width:29%!important;
  height:100%!important;
  z-index:2!important;
}

/* Energy shield around the house */
.energy-shield{
  position:absolute;
  z-index:4;
  left:50.8%;
  top:53%;
  width:340px;
  height:340px;
  transform:translate(-50%,-50%);
  border-radius:50%;
  pointer-events:none;
}
.energy-shield:before,
.energy-shield:after{
  content:"";
  position:absolute;
  inset:0;
  border-radius:50%;
}
.energy-shield:before{
  border:2px solid rgba(73,218,255,.70);
  box-shadow:
    0 0 18px rgba(73,218,255,.55),
    inset 0 0 28px rgba(73,218,255,.10);
}
.energy-shield:after{
  inset:11px;
  border:1px solid rgba(91,255,166,.42);
  box-shadow:
    0 0 20px rgba(91,255,166,.22),
    inset 0 0 40px rgba(91,255,166,.06);
}
.energy-shield.energized{
  animation:shieldBreath 3.4s ease-in-out infinite;
}
.shield-orbit{
  position:absolute;
  border-radius:50%;
  border:1px solid transparent;
}
.orbit-a{
  inset:-9px;
  border-top-color:rgba(91,255,166,.72);
  border-right-color:rgba(73,218,255,.40);
  animation:shieldSpin 10s linear infinite;
}
.orbit-b{
  inset:17px;
  border-bottom-color:rgba(73,218,255,.72);
  border-left-color:rgba(91,255,166,.36);
  animation:shieldSpinReverse 13s linear infinite;
}
.orbit-c{
  inset:43px;
  border-top-color:rgba(255,184,78,.24);
  animation:shieldSpin 18s linear infinite;
}
.shield-pulse{
  position:absolute;
  inset:28%;
  border-radius:50%;
  background:radial-gradient(circle,rgba(89,234,168,.13),transparent 70%);
  animation:shieldPulse 2.6s ease-in-out infinite;
}

/* Solar cards sit in the actual flow, between panel and merge */
.hero-v19 .source-card{
  width:235px!important;
  min-width:235px!important;
  min-height:79px!important;
  padding:11px 14px!important;
  border-radius:16px!important;
  clip-path:none!important;
  z-index:10!important;
}
.hero-v19 .source-inv{left:12.2%!important;top:21%!important}
.hero-v19 .source-micro{left:12.2%!important;top:53%!important}
.hero-v19 .source-card:before{
  border-radius:16px!important;
  clip-path:none!important;
}
.hero-v19 .source-card>i{
  width:36px!important;height:36px!important;padding:7px!important
}
.hero-v19 .source-card span{font-size:9px!important}
.hero-v19 .source-card strong{font-size:22px!important}
.hero-v19 .source-card small{font-size:8px!important}
.hero-v19 .source-card.idle{opacity:.70;filter:saturate(.65)}
.hero-v19 .source-card.live{opacity:1}

/* Generation merge capsule */
.hero-v19 .solar-badge{
  left:31.5%!important;
  top:48%!important;
  transform:translate(-50%,-50%)!important;
  min-width:126px!important;
  padding:9px 15px!important;
  z-index:10!important;
}
.hero-v19 .solar-badge strong{font-size:21px!important}
.hero-v19 .solar-badge span{font-size:8px!important}
.hero-v19 .solar-badge small{
  display:block;
  margin-top:3px;
  font-size:7px!important;
  color:rgba(225,255,236,.72);
}

/* House consumption: refined triangular / shield-shaped console */
.home-badge-v19{
  left:50.8%!important;
  bottom:2.5%!important;
  transform:translateX(-50%)!important;
  width:205px!important;
  min-width:205px!important;
  height:126px!important;
  padding:28px 20px 15px!important;
  border-radius:0!important;
  clip-path:polygon(50% 0,94% 27%,100% 100%,0 100%,6% 27%)!important;
  background:
    radial-gradient(circle at 50% 0,rgba(49,198,255,.28),transparent 45%),
    linear-gradient(180deg,rgba(6,43,62,.94),rgba(2,13,23,.88))!important;
  box-shadow:
    0 18px 34px rgba(0,0,0,.46),
    0 0 28px rgba(46,196,255,.18)!important;
  z-index:12!important;
}
.home-badge-v19:before{
  content:"";
  position:absolute;
  inset:2px;
  z-index:-1;
  clip-path:inherit;
  background:linear-gradient(180deg,rgba(64,215,255,.18),rgba(4,15,25,.15));
  border:0!important;
}
.home-badge-v19:after{
  content:"";
  position:absolute;
  left:20px;right:20px;bottom:8px;
  height:1px;
  background:linear-gradient(90deg,transparent,#45d5ff,transparent);
  box-shadow:0 0 12px #45d5ff;
}
.home-badge-top{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  color:#58dfff;
}
.home-badge-top svg{width:20px;height:20px}
.home-badge-top span{font-size:9px!important;font-weight:800}
.home-badge-v19 strong{
  display:block;
  margin-top:5px!important;
  font-size:28px!important;
  line-height:1!important;
}
.home-badge-v19 small{
  display:block;
  margin-top:7px!important;
  font-size:8px!important;
  letter-spacing:.9px;
}

/* Copel cards are luminous nodes on the real flow */
.hero-v19 .imp-badge,
.hero-v19 .exp-badge{
  right:14.5%!important;
  width:146px!important;
  min-width:146px!important;
  height:auto!important;
  padding:9px 13px!important;
  border-radius:18px!important;
  z-index:11!important;
  text-align:center;
}
.hero-v19 .imp-badge{top:24%!important}
.hero-v19 .exp-badge{top:62%!important}
.hero-v19 .imp-badge span,
.hero-v19 .exp-badge span{
  display:block;
  font-size:8px!important;
  font-weight:800;
  letter-spacing:.7px;
}
.hero-v19 .imp-badge strong,
.hero-v19 .exp-badge strong{
  display:block;
  font-size:21px!important;
  margin:3px 0!important;
}
.hero-v19 .imp-badge small,
.hero-v19 .exp-badge small{font-size:7px!important}
.hero-v19 .imp-badge.active{
  color:#ffb34f!important;
  box-shadow:0 10px 28px rgba(0,0,0,.34),0 0 28px rgba(255,179,79,.28)!important;
}
.hero-v19 .exp-badge.active{
  color:#49d8ff!important;
  box-shadow:0 10px 28px rgba(0,0,0,.34),0 0 28px rgba(73,216,255,.28)!important;
}
.hero-v19 .imp-badge.idle,
.hero-v19 .exp-badge.idle{
  opacity:.34!important;
  filter:saturate(.45)!important;
}

.hero-v19 .grid-badge{
  right:4.2%!important;
  bottom:4%!important;
  z-index:11!important;
  text-shadow:0 0 12px rgba(71,193,255,.8);
}
.hero-v19 .grid-badge span{font-size:8px!important}
.hero-v19 .grid-badge strong{font-size:11px!important}

/* New curved flow SVG */
.hero-flow-svg{
  position:absolute;
  inset:0;
  z-index:7;
  width:100%;
  height:100%;
  overflow:visible;
  pointer-events:none;
}
.flow-group{transition:opacity .3s ease}
.flow-group.idle{opacity:.10}
.flow-group.active{opacity:1}
.flow-halo{
  fill:none;
  stroke-width:12;
  opacity:.18;
  stroke-linecap:round;
}
.flow-line{
  fill:none;
  stroke-width:3.1;
  stroke-linecap:round;
  stroke-linejoin:round;
}
.solar-halo{stroke:#57f58e;filter:url(#lineGlowGreen)}
.solar-line{stroke:#72ffa4}
.import-halo{stroke:#ffb34f;filter:url(#lineGlowOrange)}
.import-line{stroke:#ffbd66}
.export-halo{stroke:#43d8ff;filter:url(#lineGlowBlue)}
.export-line{stroke:#5fe4ff}

/* remove old straight rails if any survive in CSS */
.hero-v19 .solar-flow-line,
.hero-v19 .import-flow-line,
.hero-v19 .export-flow-line{display:none!important}

@keyframes shieldSpin{to{transform:rotate(360deg)}}
@keyframes shieldSpinReverse{to{transform:rotate(-360deg)}}
@keyframes shieldPulse{
  0%,100%{transform:scale(.88);opacity:.35}
  50%{transform:scale(1.18);opacity:.75}
}
@keyframes shieldBreath{
  0%,100%{filter:brightness(.92)}
  50%{filter:brightness(1.15)}
}

/* Tablet */
@media(max-width:1050px){
  .hero-v19{height:360px!important;min-height:360px!important}
  .energy-shield{width:280px;height:280px}
  .hero-v19 .source-card{width:205px!important;min-width:205px!important}
  .hero-v19 .source-inv,.hero-v19 .source-micro{left:8%!important}
  .hero-v19 .imp-badge,.hero-v19 .exp-badge{right:10%!important}
}

/* Mobile: preserve concept without covering the house */
@media(max-width:650px){
  .hero-v19{height:430px!important;min-height:430px!important}
  .hero-v19 .asset-house{left:52%!important;width:88%!important;height:70%!important}
  .energy-shield{left:52%!important;top:57%!important;width:235px;height:235px}
  .hero-v19 .source-card{width:42%!important;min-width:0!important;padding:8px!important}
  .hero-v19 .source-inv{left:3%!important;top:16%!important}
  .hero-v19 .source-micro{left:3%!important;top:35%!important}
  .hero-v19 .source-card strong{font-size:15px!important}
  .hero-v19 .source-card small{font-size:6px!important}
  .hero-v19 .solar-badge{left:27%!important;top:55%!important}
  .hero-v19 .home-badge-v19{left:52%!important;bottom:2%!important;width:135px!important;min-width:135px!important;height:90px!important;padding:20px 10px 9px!important}
  .hero-v19 .home-badge-v19 strong{font-size:19px!important}
  .hero-v19 .imp-badge,.hero-v19 .exp-badge{right:2%!important;width:100px!important;min-width:100px!important;padding:6px 8px!important}
  .hero-v19 .imp-badge{top:22%!important}
  .hero-v19 .exp-badge{top:40%!important}
  .hero-v19 .grid-badge{right:4%!important;bottom:3%!important}
  .hero-flow-svg{opacity:.82}
}

    
/* ========================================================================
   V20 // RESPONSIVIDADE HERO + PICO COM DISPOSITIVOS
   ======================================================================== */

/* desktop: house slightly larger */
@media(min-width:1051px){
  .hero-v19 .asset-house{
    left:51%!important;
    bottom:-8%!important;
    width:67%!important;
    height:109%!important;
  }
  .energy-shield{
    left:51%!important;
    width:360px!important;
    height:360px!important;
  }
}

/* tablet: house also gains more visual presence */
@media(min-width:651px) and (max-width:1050px){
  .hero-v19 .asset-house{
    left:51%!important;
    bottom:-7%!important;
    width:70%!important;
    height:98%!important;
  }
  .energy-shield{
    left:51%!important;
    width:305px!important;
    height:305px!important;
  }
}

/* desktop SVG only on desktop/tablet */
.hero-flow-svg-mobile{display:none}

/* Peak contributors */
.consumption-card{
  display:flex!important;
  flex-direction:column!important;
}
.peak-pill-v20{flex:0 0 auto}
.peak-contributors{
  margin:8px 0 4px;
  padding:9px 10px;
  border:1px solid rgba(255,77,116,.18);
  border-radius:12px;
  background:
    linear-gradient(145deg,rgba(35,7,18,.52),rgba(5,12,20,.54));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025);
}
.peak-contrib-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:6px;
}
.peak-contrib-head span{
  color:#ff6687;
  font-size:7px;
  font-weight:900;
  letter-spacing:.65px;
}
.peak-contrib-head small{
  color:rgba(210,224,235,.47);
  font-size:6px;
}
.peak-contrib-list{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:4px 8px;
}
.peak-contrib-row{
  display:grid;
  grid-template-columns:17px 18px minmax(0,1fr) auto;
  align-items:center;
  gap:5px;
  min-width:0;
  padding:4px 5px;
  border-radius:7px;
  background:rgba(255,255,255,.018);
}
.peak-contrib-row>b{
  color:rgba(255,255,255,.34);
  font-size:6px;
  text-align:center;
}
.peak-contrib-row>i{
  display:grid;
  place-items:center;
  width:17px;height:17px;
  color:#ff6484;
}
.peak-contrib-row>i svg{width:100%;height:100%}
.peak-contrib-row>span{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:#b9cad6;
  font-size:7px;
}
.peak-contrib-row>strong{
  color:#fff;
  font-size:7px;
}
.peak-other{
  grid-column:1/-1;
  opacity:.75;
}
.peak-contrib-empty{
  grid-column:1/-1;
  padding:5px;
  color:rgba(220,230,238,.48);
  font-size:7px;
}

/* Phone is a distinct composition, not a compressed desktop scene */
@media(max-width:650px){
  .hero-grid{
    display:block!important;
  }
  .premium-flow{
    min-width:0!important;
    width:100%!important;
  }
  .period-summary{
    margin-top:7px!important;
  }

  .hero-v19{
    height:440px!important;
    min-height:440px!important;
    overflow:hidden!important;
  }

  /* use native mobile flow, never compressed desktop paths */
  .hero-flow-svg{display:none!important}
  .hero-flow-svg-mobile{
    display:block!important;
    position:absolute;
    inset:0;
    z-index:7;
    width:100%;
    height:100%;
    overflow:visible;
    pointer-events:none;
  }
  .hero-flow-svg-mobile .mobile-flow{
    fill:none;
    stroke-linecap:round;
    stroke-linejoin:round;
    stroke-width:2.3;
    filter:url(#mGlow);
  }
  .hero-flow-svg-mobile .mobile-flow.solar{stroke:#69ff9d}
  .hero-flow-svg-mobile .mobile-flow.import{stroke:#ffb34f}
  .hero-flow-svg-mobile .mobile-flow.export{stroke:#47d9ff}
  .hero-flow-svg-mobile .mobile-flow.idle{opacity:.10}
  .hero-flow-svg-mobile .mobile-flow.active{opacity:.95}

  /* assets form a readable bottom landscape */
  .hero-v19 .asset-solar{
    left:-8%!important;
    bottom:-1%!important;
    width:42%!important;
    height:37%!important;
    opacity:.94!important;
  }
  .hero-v19 .asset-house{
    left:52%!important;
    bottom:-2%!important;
    width:78%!important;
    height:58%!important;
    opacity:1!important;
  }
  .hero-v19 .asset-grid{
    right:-8%!important;
    bottom:-1%!important;
    width:35%!important;
    height:52%!important;
    opacity:.96!important;
  }

  /* shield centered over house, not over all cards */
  .energy-shield{
    left:52%!important;
    top:67%!important;
    width:205px!important;
    height:205px!important;
    z-index:5!important;
  }

  /* source cards: compact upper-left, no collision */
  .hero-v19 .source-card{
    left:4%!important;
    width:43%!important;
    min-width:0!important;
    min-height:58px!important;
    grid-template-columns:28px minmax(0,1fr)!important;
    gap:7px!important;
    padding:7px 8px!important;
    border-radius:12px!important;
  }
  .hero-v19 .source-inv{top:11%!important}
  .hero-v19 .source-micro{top:28%!important}
  .hero-v19 .source-card>i{width:26px!important;height:26px!important;padding:5px!important}
  .hero-v19 .source-card span{font-size:5.5px!important}
  .hero-v19 .source-card strong{font-size:13px!important}
  .hero-v19 .source-card small{
    font-size:4.8px!important;
    line-height:1.1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }

  /* generation merge placed between solar cards and house */
  .hero-v19 .solar-badge{
    left:47%!important;
    top:47%!important;
    min-width:82px!important;
    padding:5px 8px!important;
    transform:translate(-50%,-50%)!important;
  }
  .hero-v19 .solar-badge strong{font-size:12px!important}
  .hero-v19 .solar-badge span{font-size:4.8px!important}
  .hero-v19 .solar-badge small{font-size:4.4px!important}

  /* Copel nodes on right side */
  .hero-v19 .imp-badge,
  .hero-v19 .exp-badge{
    right:3%!important;
    width:31%!important;
    min-width:0!important;
    padding:7px 8px!important;
    border-radius:14px!important;
  }
  .hero-v19 .imp-badge{top:12%!important}
  .hero-v19 .exp-badge{top:31%!important}
  .hero-v19 .imp-badge span,.hero-v19 .exp-badge span{font-size:5px!important}
  .hero-v19 .imp-badge strong,.hero-v19 .exp-badge strong{font-size:14px!important}
  .hero-v19 .imp-badge small,.hero-v19 .exp-badge small{font-size:4.8px!important}

  /* house console below focal point, smaller and non-obstructive */
  .home-badge-v19{
    left:52%!important;
    bottom:1.5%!important;
    width:132px!important;
    min-width:132px!important;
    height:88px!important;
    padding:18px 9px 8px!important;
  }
  .home-badge-top svg{width:14px!important;height:14px!important}
  .home-badge-top span{font-size:5.5px!important}
  .home-badge-v19 strong{font-size:18px!important}
  .home-badge-v19 small{font-size:5px!important}

  .hero-v19 .grid-badge{
    right:2%!important;
    bottom:1%!important;
  }
  .hero-v19 .grid-badge span{font-size:4.5px!important}
  .hero-v19 .grid-badge strong{font-size:6px!important}

  /* peak contributor block is single-column on phone */
  .peak-contrib-list{grid-template-columns:1fr!important}
  .peak-contrib-head{align-items:flex-start!important;flex-direction:column!important;gap:2px!important}
  .peak-contrib-head span{font-size:6.3px!important}
  .peak-contrib-head small{font-size:5.3px!important}
  .peak-contrib-row>span,.peak-contrib-row>strong{font-size:6.3px!important}
}

    
/* ========================================================================
   V21 // MENOS CORES + MAIS LEGIBILIDADE + MOBILE REFINADO
   ======================================================================== */
.energy-v24{
  --cyan:#5fa8c2!important;
  --blue:#5d84ae!important;
  --green:#63b58d!important;
  --orange:#c99a5b!important;
  --purple:#8b76a7!important;
  --red:#c96b7b!important;
}

/* Reduce saturation/glow */
.pkpi,.source-card,.period-summary,.mini-panel,.lower-panel{filter:saturate(.78)}
.pkpi:hover{filter:saturate(.86)}
.pkpi>i,.source-card>i{
  animation:none!important;
  box-shadow:inset 0 0 10px rgba(255,255,255,.025),0 0 8px color-mix(in srgb,currentColor 14%,transparent)!important;
}
.source-card:after,.mini-panel:before,.lower-panel:before,.period-summary:before{opacity:.22!important}
.scene-wrap{
  background:
    radial-gradient(circle at 50% 45%,rgba(28,70,88,.10),transparent 33%),
    linear-gradient(180deg,#030910 0%,#071019 52%,#03080d 100%)!important;
}
.energy-shield{filter:saturate(.68)!important}
.energy-shield:before{
  border-color:rgba(88,159,181,.46)!important;
  box-shadow:0 0 9px rgba(88,159,181,.24),inset 0 0 16px rgba(88,159,181,.05)!important;
}
.energy-shield:after{
  border-color:rgba(91,167,126,.24)!important;
  box-shadow:0 0 10px rgba(91,167,126,.08)!important;
}
.orbit-a,.orbit-b,.orbit-c{opacity:.45!important}

/* General readability */
.master-tabs button span{font-size:11px!important}
.filter-label strong{font-size:11px!important}
.filter-label small{font-size:8px!important}
.quick-v14 button,.apply-v14{font-size:9px!important}
.pkpi span{font-size:11px!important}
.pkpi small,.pkpi em{font-size:9.5px!important}
.premium-head span{font-size:18px!important}
.premium-head small{font-size:11px!important}
.premium-head em{font-size:9px!important}
.source-card span{font-size:10px!important}
.source-card small{font-size:9px!important}
.solar-badge span,.imp-badge span,.exp-badge span{font-size:8.5px!important}
.solar-badge small,.imp-badge small,.exp-badge small{font-size:7.5px!important}
.home-badge-top span{font-size:9px!important}
.home-badge-v19 small{font-size:8px!important}
.grid-badge span{font-size:8px!important}
.grid-badge strong{font-size:11px!important}
.summary-title span{font-size:14px!important}
.summary-title strong{font-size:8px!important}
.summary-lines span{font-size:10px!important}
.summary-lines strong{font-size:11px!important}
.summary-dual span{font-size:8px!important}
.summary-dual strong{font-size:17px!important}
.mini-title span{font-size:11px!important}
.mini-title strong{font-size:22px!important}
.mini-title>small{font-size:8px!important}
.peak-pill span{font-size:7.5px!important}
.peak-pill small{font-size:7px!important}
.chart-legend span{font-size:8px!important}
.gridtext{font-size:10px!important}
.lower-title strong{font-size:12px!important}
.lower-title span{font-size:8px!important}
.consumer>span,.board-bars span,.equip-list span,.indicator-list span{font-size:9px!important}
.consumer>strong,.board-bars strong,.equip-list strong,.indicator-list strong{font-size:9px!important}

/* Continuous REDE lines */
.hero-flow-svg .import-line,.hero-flow-svg .export-line{stroke-width:2.4!important}
.hero-flow-svg .import-halo,.hero-flow-svg .export-halo{stroke-width:7!important;opacity:.09!important}

/* Peak only shows value/time */
.peak-pill-v21{min-width:112px!important}

/* House slightly larger desktop/tablet */
@media(min-width:1051px){
  .hero-v19 .asset-house{width:69%!important;height:111%!important;left:51%!important}
}
@media(min-width:651px) and (max-width:1050px){
  .hero-v19 .asset-house{width:72%!important;height:100%!important;left:51%!important}
}

/* Mobile: genuinely different composition */
@media(max-width:650px){
  .hero-grid{display:block!important}
  .hero-v19{height:382px!important;min-height:382px!important}

  .hero-v19 .asset-solar{
    left:-6%!important;bottom:0!important;width:29%!important;height:27%!important
  }
  .hero-v19 .asset-house{
    left:52%!important;bottom:0!important;width:57%!important;height:43%!important
  }
  .hero-v19 .asset-grid{
    right:-4%!important;bottom:0!important;width:23%!important;height:39%!important
  }

  .energy-shield{
    left:52%!important;top:69%!important;width:160px!important;height:160px!important
  }

  .hero-v19 .source-card{
    left:4%!important;width:39%!important;min-height:52px!important;
    grid-template-columns:25px minmax(0,1fr)!important;gap:6px!important;padding:6px 7px!important
  }
  .hero-v19 .source-inv{top:9%!important}
  .hero-v19 .source-micro{top:25%!important}
  .hero-v19 .source-card>i{width:24px!important;height:24px!important;padding:4px!important}
  .hero-v19 .source-card span{font-size:6.2px!important}
  .hero-v19 .source-card strong{font-size:13.5px!important}
  .hero-v19 .source-card small{font-size:5.4px!important}

  .hero-v19 .imp-badge,.hero-v19 .exp-badge{
    right:3%!important;width:28%!important;min-width:0!important;padding:6px 7px!important
  }
  .hero-v19 .imp-badge{top:10%!important}
  .hero-v19 .exp-badge{top:26%!important}
  .hero-v19 .imp-badge span,.hero-v19 .exp-badge span{font-size:5.5px!important}
  .hero-v19 .imp-badge strong,.hero-v19 .exp-badge strong{font-size:13.5px!important}
  .hero-v19 .imp-badge small,.hero-v19 .exp-badge small{font-size:5px!important}

  .hero-v19 .solar-badge{
    left:47%!important;top:48%!important;min-width:72px!important;padding:4px 7px!important
  }
  .hero-v19 .solar-badge strong{font-size:11.5px!important}
  .hero-v19 .solar-badge span{font-size:4.9px!important}
  .hero-v19 .solar-badge small{font-size:4.6px!important}

  .home-badge-v19{
    left:52%!important;bottom:.8%!important;width:108px!important;min-width:108px!important;
    height:70px!important;padding:15px 7px 6px!important
  }
  .home-badge-v19 strong{font-size:16px!important}
  .home-badge-top span{font-size:5.2px!important}
  .home-badge-v19 small{font-size:4.8px!important}

  .hero-flow-svg-mobile .mobile-flow{stroke-width:1.6!important}
  .hero-flow-svg-mobile .mobile-flow.active{opacity:.80!important}
  .hero-flow-svg-mobile .mobile-flow.idle{opacity:.05!important}

  .pkpi span{font-size:7.6px!important}
  .pkpi small,.pkpi em{font-size:6.8px!important}
  .mini-title span{font-size:9.5px!important}
  .lower-title strong{font-size:10.5px!important}
  .chart-legend span{font-size:6.8px!important}
}

    
/* ========================================================================
   V24 // NEON CONTROLADO + MONOCROMIA NO CABEÇALHO + ABAS PREMIUM
   ======================================================================== */
.energy-v24{
  --cyan:#35d6ff!important;
  --blue:#3f91ff!important;
  --green:#45ef8c!important;
  --orange:#ffae45!important;
  --purple:#b36cff!important;
  --red:#ff5d7f!important;
  --yellow:#ffd35a!important;
}

/* ---------- neon restored ---------- */
.pkpi,.hero-kpi,.panel,.mini-panel,.lower-panel,.period-summary,.tab-intro{
  filter:saturate(1)!important;
}
.panel,.mini-panel,.lower-panel,.hero-kpi{
  box-shadow:
    0 16px 34px rgba(0,0,0,.28),
    inset 0 1px 0 rgba(255,255,255,.035),
    0 0 18px rgba(53,214,255,.035)!important;
}
.clickable:hover{
  filter:brightness(1.12) saturate(1.08)!important;
}

/* ---------- HEADER KPI ROW: one single cyan color ---------- */
.premium-kpis .pkpi{
  color:#42d9ff!important;
  border-color:rgba(66,217,255,.28)!important;
  background:
    radial-gradient(circle at 13% 20%,rgba(66,217,255,.12),transparent 30%),
    linear-gradient(145deg,rgba(6,25,39,.96),rgba(2,9,17,.98))!important;
  box-shadow:
    0 13px 30px rgba(0,0,0,.30),
    inset 0 1px 0 rgba(255,255,255,.05),
    0 0 18px rgba(66,217,255,.07)!important;
}
.premium-kpis .pkpi strong,
.premium-kpis .pkpi span,
.premium-kpis .pkpi small,
.premium-kpis .pkpi em{
  color:#bdefff!important;
}
.premium-kpis .pkpi strong{color:#52ddff!important;text-shadow:0 0 14px rgba(82,221,255,.32)!important}
.premium-kpis .pkpi>i{color:#42d9ff!important}
.premium-kpis .pkpi>u b{background:linear-gradient(90deg,#2ea9cc,#58e2ff)!important}
.premium-kpis .pkpi em b{background:#49ddff!important;box-shadow:0 0 9px #49ddff!important}

/* ---------- period summary: single color ---------- */
.period-summary{
  --summary:#58d9ff;
  border-color:rgba(88,217,255,.25)!important;
  background:
    radial-gradient(circle at 20% 0,rgba(88,217,255,.08),transparent 32%),
    linear-gradient(150deg,rgba(5,23,36,.96),rgba(2,9,16,.98))!important;
}
.period-summary .summary-title span,
.period-summary .summary-title strong,
.period-summary .summary-title em,
.period-summary .summary-lines i,
.period-summary .summary-lines span,
.period-summary .summary-lines strong,
.period-summary .summary-dual span,
.period-summary .summary-dual strong{
  color:var(--summary)!important;
}
.period-summary .summary-lines>div{
  border-bottom-color:rgba(88,217,255,.12)!important;
}
.period-summary .summary-lines i{
  filter:drop-shadow(0 0 7px rgba(88,217,255,.35));
}

/* ---------- neutral house consumption console ---------- */
.home-badge-v19{
  background:
    radial-gradient(circle at 50% 0,rgba(50,195,235,.13),transparent 46%),
    linear-gradient(180deg,rgba(4,26,39,.90),rgba(2,12,20,.94))!important;
  color:#dff8ff!important;
  box-shadow:
    0 18px 34px rgba(0,0,0,.46),
    0 0 20px rgba(65,206,245,.12),
    inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.home-badge-v19 strong{color:#f4fdff!important;text-shadow:0 0 12px rgba(86,222,255,.22)!important}
.home-badge-v19:before{
  background:linear-gradient(180deg,rgba(58,194,224,.09),rgba(2,15,24,.02))!important;
}

/* ---------- elaborate icon wells + movement ---------- */
.pkpi>i,.hero-kpi .kpi-top i,.device-icon,.tab-intro-icon,.brand-mark,
.source-card>i,.summary-lines i{
  position:relative;
  filter:drop-shadow(0 0 8px currentColor);
}
.pkpi>i,.hero-kpi .kpi-top i,.device-icon,.tab-intro-icon,.source-card>i{
  background:
    radial-gradient(circle at 35% 28%,rgba(255,255,255,.16),rgba(255,255,255,.025) 52%,transparent 72%)!important;
  border:1px solid color-mix(in srgb,currentColor 34%,transparent)!important;
  box-shadow:
    inset 0 0 16px rgba(255,255,255,.035),
    0 0 14px color-mix(in srgb,currentColor 20%,transparent)!important;
}
.ico .icon-orbit{transform-origin:12px 12px;animation:icoOrbit 7s linear infinite}
.ico .icon-rays{transform-origin:12px 12px;animation:icoPulse 2.4s ease-in-out infinite}
.ico .icon-wave{animation:icoWave 2.2s ease-in-out infinite}
.ico .icon-energy{animation:icoEnergy 1.5s ease-in-out infinite}
.ico .icon-flame{animation:icoFlame 1.7s ease-in-out infinite;transform-origin:12px 16px}
.ico .icon-core{animation:icoCore 2s ease-in-out infinite}
.ico-grid{animation:icoGridSway 3.2s ease-in-out infinite}
.ico-house .icon-window{animation:icoWindow 2.3s ease-in-out infinite}
@keyframes icoOrbit{to{transform:rotate(360deg)}}
@keyframes icoPulse{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.06)}}
@keyframes icoWave{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes icoEnergy{0%,100%{opacity:.6;transform:translateY(0)}50%{opacity:1;transform:translateY(-.7px)}}
@keyframes icoFlame{0%,100%{transform:scale(.98)}50%{transform:scale(1.06)}}
@keyframes icoCore{0%,100%{opacity:.65}50%{opacity:1}}
@keyframes icoGridSway{0%,100%{transform:translateX(0)}50%{transform:translateX(.5px)}}
@keyframes icoWindow{0%,100%{opacity:.45}50%{opacity:1}}

/* ---------- chart ruler / legends ---------- */
.chart-box{
  overflow:visible!important;
}
.chart-viewport{
  position:relative;
  min-width:0;
}
.chart-viewport svg{
  display:block;
  width:100%;
  height:100%;
}
.time-ruler{
  display:grid;
  align-items:start;
  margin:3px 8px 0 8px;
  border-top:1px solid rgba(119,188,222,.28);
  min-height:30px;
}
.time-ruler.hourly{grid-template-columns:repeat(24,minmax(0,1fr))}
.time-ruler.multi{grid-template-columns:repeat(12,minmax(0,1fr))}
.time-ruler span{
  position:relative;
  min-width:0;
  text-align:center;
  color:#b9d8e9;
}
.time-ruler span b{
  display:block;
  width:1px;
  height:6px;
  margin:0 auto 3px;
  background:rgba(148,211,240,.52);
}
.time-ruler span em{
  display:block;
  font-style:normal;
  font-size:8.5px;
  font-weight:700;
  white-space:nowrap;
  transform:translateX(-50%);
  margin-left:50%;
}
.chart-legend{
  margin-top:5px!important;
  gap:15px!important;
}
.chart-legend span{
  display:inline-flex!important;
  align-items:center;
  gap:6px!important;
  font-size:10px!important;
  color:#c8e0ed!important;
}
.chart-legend span i{
  width:10px!important;
  height:10px!important;
  border-radius:50%;
  box-shadow:0 0 8px currentColor;
}
.chart-legend span strong{
  font-size:10px!important;
  font-weight:800!important;
}
.gridtext{font-size:11px!important;fill:#a8c8d9!important}

/* ---------- secondary tab hero ---------- */
.detail-screen,.boards-screen,.history-screen,.analytics-screen,.status-screen{
  display:grid!important;
  gap:12px!important;
}
.tab-intro{
  grid-column:1/-1;
  min-height:94px;
  display:grid;
  grid-template-columns:62px minmax(0,1fr) 130px;
  align-items:center;
  gap:14px;
  padding:14px 18px;
  border:1px solid color-mix(in srgb,currentColor 28%,transparent);
  border-radius:18px;
  color:var(--cyan);
  background:
    radial-gradient(circle at 7% 50%,color-mix(in srgb,currentColor 16%,transparent),transparent 20%),
    linear-gradient(145deg,rgba(6,24,39,.98),rgba(2,10,18,.98));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.04),
    0 16px 34px rgba(0,0,0,.28),
    0 0 22px color-mix(in srgb,currentColor 7%,transparent);
  overflow:hidden;
}
.tab-intro.green{color:var(--green)}
.tab-intro.red{color:var(--red)}
.tab-intro.orange{color:var(--orange)}
.tab-intro.blue{color:var(--blue)}
.tab-intro.purple{color:var(--purple)}
.tab-intro.cyan{color:var(--cyan)}
.tab-intro-icon{
  width:52px;height:52px;padding:11px;border-radius:17px;
}
.tab-intro-copy span{
  display:block;
  font-size:9px;
  font-weight:900;
  letter-spacing:1px;
  color:currentColor;
}
.tab-intro-copy strong{
  display:block;
  margin-top:3px;
  font-size:23px;
  color:#f4fbff;
}
.tab-intro-copy small{
  display:block;
  margin-top:5px;
  font-size:10px;
  color:#9ebdce;
}
.tab-intro-pulse{
  display:flex;
  justify-content:flex-end;
  align-items:center;
  gap:8px;
}
.tab-intro-pulse i{
  width:12px;height:12px;border-radius:50%;
  border:1px solid currentColor;
  box-shadow:0 0 12px currentColor;
  animation:tabPulse 2s ease-in-out infinite;
}
.tab-intro-pulse i:nth-child(2){animation-delay:.35s}
.tab-intro-pulse i:nth-child(3){animation-delay:.7s}
@keyframes tabPulse{0%,100%{opacity:.2;transform:scale(.75)}50%{opacity:1;transform:scale(1.12)}}

/* ---------- secondary cards upgraded ---------- */
.detail-kpis .hero-kpi{
  min-height:132px!important;
  padding:14px!important;
  border-radius:18px!important;
  background:
    radial-gradient(circle at 14% 8%,color-mix(in srgb,currentColor 11%,transparent),transparent 33%),
    linear-gradient(145deg,rgba(6,22,36,.97),rgba(2,9,17,.99))!important;
  border-color:color-mix(in srgb,currentColor 26%,transparent)!important;
  transition:transform .25s ease,box-shadow .25s ease!important;
}
.detail-kpis .hero-kpi:hover{
  transform:translateY(-2px);
  box-shadow:0 18px 38px rgba(0,0,0,.35),0 0 22px color-mix(in srgb,currentColor 12%,transparent)!important;
}
.detail-kpis .hero-kpi .kpi-top span{font-size:10px!important}
.detail-kpis .hero-kpi>strong{font-size:28px!important}
.detail-kpis .hero-kpi>small{font-size:9px!important;line-height:1.35!important}
.section-head{
  padding-bottom:11px!important;
  margin-bottom:10px!important;
  border-bottom:1px solid rgba(90,176,222,.15);
}
.section-head span{font-size:8px!important;letter-spacing:1px!important}
.section-head strong{font-size:16px!important}
.section-head small{font-size:9px!important}
.panel{
  border-radius:18px!important;
  background:
    radial-gradient(circle at 12% 0,rgba(46,147,197,.045),transparent 28%),
    linear-gradient(145deg,rgba(5,19,32,.97),rgba(2,9,16,.99))!important;
}
.generator-compare .donut,
.analytics-gauges .donut{
  filter:drop-shadow(0 0 14px rgba(62,203,255,.08));
}
.compare-ledger>div,.analysis-cards>div,.balance-banner,.untracked{
  border-radius:14px!important;
  background:linear-gradient(145deg,rgba(10,30,47,.80),rgba(3,12,20,.92))!important;
  border:1px solid rgba(85,172,219,.14)!important;
}
.compare-ledger span,.analysis-cards span,.balance-banner span,.untracked span{font-size:9px!important}
.compare-ledger strong,.analysis-cards strong,.balance-banner strong,.untracked strong{font-size:18px!important}
.compare-ledger small,.analysis-cards small,.balance-banner small{font-size:8px!important}
.device-row{
  border-radius:12px!important;
  transition:background .2s ease,transform .2s ease!important;
}
.device-row:hover{
  background:rgba(53,214,255,.05)!important;
  transform:translateX(2px);
}
.status-row{
  border-radius:12px!important;
  background:linear-gradient(145deg,rgba(7,23,37,.8),rgba(3,12,20,.9))!important;
  border:1px solid rgba(80,170,215,.10)!important;
}
.status-row span{font-size:9px!important}
.status-row strong{font-size:9px!important}
.status-row small{font-size:8px!important}

/* ---------- responsive chart ruler ---------- */
@media(max-width:1050px){
  .time-ruler span em{font-size:7px!important}
  .tab-intro{grid-template-columns:52px minmax(0,1fr) 90px}
  .tab-intro-copy strong{font-size:20px}
}
@media(max-width:650px){
  .time-ruler{
    min-width:690px;
  }
  .chart-viewport{
    overflow-x:auto;
    overflow-y:hidden;
    padding-bottom:3px;
  }
  .chart-viewport svg{
    min-width:690px;
  }
  .time-ruler span em{font-size:7px!important}
  .chart-legend span,.chart-legend span strong{font-size:8px!important}
  .tab-intro{
    grid-template-columns:42px minmax(0,1fr);
    min-height:82px;
    padding:11px 12px;
  }
  .tab-intro-icon{width:38px;height:38px;padding:8px;border-radius:13px}
  .tab-intro-copy span{font-size:7px}
  .tab-intro-copy strong{font-size:16px}
  .tab-intro-copy small{font-size:8px}
  .tab-intro-pulse{display:none}
  .detail-kpis .hero-kpi>strong{font-size:22px!important}
}

/* accessibility */

.loads-empty143{padding:12px;display:grid;gap:10px}.loads-empty143 p{margin:0;line-height:1.5}.loads-empty143 small{color:#95b8c9;line-height:1.5}.pending-load143{display:flex;justify-content:space-between;gap:12px;padding:8px;border-bottom:1px solid #183744}.configure-loads143{padding:10px;border:1px solid #27bbeb;border-radius:8px;background:#092b3c;color:#dff7ff;cursor:pointer}.board-chart143{min-height:160px;margin:12px 0}.analysis143{display:grid;gap:12px;grid-template-columns:1fr}.insight-grid143{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.insight143{padding:14px}.insight143 h3{margin:0 0 10px;font-size:17px}.insight143 p{line-height:1.6}.insight143 small{display:block;color:#9db8c8;line-height:1.5}.insight-split143{display:grid;grid-template-columns:1fr 1fr;gap:14px}.analysis143 .analysis-metric{padding:14px}.analysis143 .analysis-metric strong{font-size:26px}
@media(min-width:900px){:host([viewport-fit]) .analysis143{height:100%;grid-template-rows:60px 90px minmax(120px,.8fr) minmax(140px,1fr);overflow:auto}:host([viewport-fit]) .analysis143>.tab-intro{min-height:0;padding:10px}:host([viewport-fit]) .analysis143 .insight143{min-height:0;overflow:auto}:host([viewport-fit]) .boards-screen{height:100%;grid-template-rows:65px minmax(0,1fr)}:host([viewport-fit]) .boards-screen>.tab-intro{min-height:0;padding:10px}:host([viewport-fit]) .boards-screen .board-panel{min-height:0;overflow:auto}:host([viewport-fit]) .board-chart143 .chart-viewport{height:clamp(130px,28cqh,250px);min-height:130px}:host([viewport-fit]) .board-chart143 .chart-viewport svg{height:100%}}
@media(max-width:899px){.insight-grid143{grid-template-columns:repeat(2,minmax(0,1fr))}.insight-split143{grid-template-columns:1fr}}

.analysis143 .analysis-metric{display:flex;flex-direction:column;gap:6px;border:1px solid #173747;border-radius:12px;background:#04131d}.analysis143 .analysis-metric span{font-size:11px}.analysis143 .analysis-metric small{font-size:11px;color:#a6bdcc}.analysis143 .insight143:last-child{display:grid;grid-template-rows:auto minmax(0,1fr)}.analysis143 .insight143 .chart-box{min-height:0;height:100%;display:grid;grid-template-rows:minmax(0,1fr) auto}.analysis143 .insight143 .chart-viewport{height:100%;min-height:0}.analysis143 .insight143 .chart-viewport svg{height:100%}.analysis143 .insight143 p{margin:6px 0;line-height:1.35}.analysis143 .insight143 small{font-size:10px}.insight-split143 b{font-size:12px}
:host([viewport-fit]) .analysis143{grid-template-rows:60px 90px minmax(110px,.45fr) minmax(180px,1fr)}.analysis143 .tab-intro-icon{width:36px;height:36px;min-width:36px}.analysis143 .tab-intro-copy strong{font-size:19px}.analysis143 .tab-intro-copy small{font-size:10px}.analysis143 .tab-intro{gap:10px}.analysis143 .analysis-metric strong{font-size:22px}
@media(prefers-reduced-motion:reduce){
  .ico *,.tab-intro-pulse i{animation:none!important}
}

    
/* ========================================================================
   V24 // RECONSTRUÇÃO VISUAL BASEADA NO ESBOÇO APROVADO
   Objetivo: proporções, hierarquia, cores e composição do mockup aprovado.
   ======================================================================== */

/* ---- overall density / typography ---- */
.energy-v24{
  --panel-bg:linear-gradient(145deg,rgba(5,20,33,.98),rgba(2,10,17,.99));
}
.energy-v24 .shell-v24{gap:10px!important;padding:10px!important}
.energy-v24 .master-header{min-height:74px!important}
.energy-v24 .brand-v14 strong{font-size:23px!important;letter-spacing:.1px!important}
.energy-v24 .brand-v14 small{font-size:8px!important}
.energy-v24 .master-tabs button{height:72px!important;font-size:9px!important}
.energy-v24 .master-tabs button svg{width:23px!important;height:23px!important}
.energy-v24 .clock-v14 strong{font-size:30px!important}

/* ---- restore the approved multicolor KPI identity ---- */
.energy-v24 .premium-kpis{gap:10px!important}
.energy-v24 .premium-kpis .pkpi{
  min-height:126px!important;
  padding:14px 15px!important;
  grid-template-columns:48px minmax(0,1fr)!important;
  border-radius:13px!important;
  background:linear-gradient(145deg,rgba(6,24,38,.98),rgba(2,10,18,.99))!important;
}
.energy-v24 .premium-kpis .pkpi>i{
  width:42px!important;height:42px!important;padding:8px!important;border-radius:12px!important;
}
.energy-v24 .premium-kpis .pkpi span{font-size:9px!important;color:#d7e8f1!important}
.energy-v24 .premium-kpis .pkpi strong{font-size:29px!important;line-height:1.05!important;color:currentColor!important}
.energy-v24 .premium-kpis .pkpi small{font-size:8px!important;color:#a6bfcd!important}
.energy-v24 .premium-kpis .pkpi em{font-size:8px!important;color:#76f1a2!important}
.energy-v24 .premium-kpis .pkpi.solar{color:#65f39a!important}
.energy-v24 .premium-kpis .pkpi.inverter{color:#45a1ff!important}
.energy-v24 .premium-kpis .pkpi.micro{color:#ffb54d!important}
.energy-v24 .premium-kpis .pkpi.house{color:#ff6686!important}
.energy-v24 .premium-kpis .pkpi.import{color:#59b9ff!important}
.energy-v24 .premium-kpis .pkpi.export{color:#54baff!important}
.energy-v24 .premium-kpis .pkpi.balance{color:#52ef91!important}
.energy-v24 .premium-kpis .pkpi>u b{background:linear-gradient(90deg,currentColor,#53ef9c)!important}
.energy-v24 .premium-kpis .pkpi strong{text-shadow:0 0 18px color-mix(in srgb,currentColor 42%,transparent)!important}

/* ---- HERO: proportions of the approved sketch ---- */
.energy-v24 .hero-grid{
  grid-template-columns:minmax(0,4.35fr) minmax(285px,1.05fr)!important;
  gap:10px!important;
}
.energy-v24 .premium-flow{min-height:395px!important}
.energy-v24 .premium-head{padding:11px 16px!important}
.energy-v24 .premium-head span{font-size:15px!important}
.energy-v24 .premium-head small{font-size:8px!important}
.energy-v24 .scene-wrap{
  height:330px!important;
  background:
    radial-gradient(ellipse at 50% 88%,rgba(18,70,67,.16),transparent 40%),
    linear-gradient(180deg,#03101a 0%,#03111b 54%,#021019 100%)!important;
}

/* Assets: deliberately smaller and fully separated like the approved mockup */
.energy-v24 .hero-v19 .asset-solar{
  left:-1.5%!important;bottom:10%!important;width:18.5%!important;height:auto!important;
  max-height:72%!important;object-fit:contain!important;object-position:left bottom!important;
  filter:brightness(.92) saturate(.95) drop-shadow(0 0 13px rgba(52,140,255,.18))!important;
}
.energy-v24 .hero-v19 .asset-house{
  left:50%!important;bottom:2%!important;width:35%!important;height:auto!important;
  max-height:94%!important;transform:translateX(-50%)!important;
  object-fit:contain!important;object-position:center bottom!important;
  filter:brightness(.92) saturate(.92) drop-shadow(0 0 18px rgba(63,192,255,.13))!important;
}
.energy-v24 .hero-v19 .asset-grid{
  right:1.2%!important;bottom:2%!important;width:16.5%!important;height:auto!important;
  max-height:92%!important;object-fit:contain!important;object-position:right bottom!important;
  filter:brightness(.95) saturate(.82) drop-shadow(0 0 14px rgba(72,169,255,.15))!important;
}

/* Shield: one clean luminous ring around the house */
.energy-v24 .energy-shield{
  left:50%!important;top:51%!important;width:315px!important;height:315px!important;
  transform:translate(-50%,-50%)!important;
  opacity:.92!important;
}
.energy-v24 .shield-orbit{
  border-width:2px!important;
  box-shadow:0 0 15px rgba(73,226,161,.25),inset 0 0 15px rgba(61,194,255,.12)!important;
}
.energy-v24 .orbit-a{border-color:rgba(75,239,150,.72)!important}
.energy-v24 .orbit-b{border-color:rgba(63,182,255,.48)!important}
.energy-v24 .orbit-c{border-color:rgba(132,255,194,.25)!important}

/* Solar source cards: visible, compact, aligned vertically */
.energy-v24 .hero-v19 .source-card{
  left:6.2%!important;width:205px!important;min-width:205px!important;
  grid-template-columns:43px 1fr!important;
  padding:11px 13px!important;border-radius:11px!important;
  background:linear-gradient(145deg,rgba(3,18,30,.95),rgba(2,10,18,.92))!important;
  opacity:1!important;
}
.energy-v24 .hero-v19 .source-inv{top:13%!important}
.energy-v24 .hero-v19 .source-micro{top:53%!important}
.energy-v24 .hero-v19 .source-card>i{width:37px!important;height:37px!important;padding:7px!important}
.energy-v24 .hero-v19 .source-card span{font-size:8px!important}
.energy-v24 .hero-v19 .source-card strong{font-size:22px!important}
.energy-v24 .hero-v19 .source-card small{font-size:7px!important;line-height:1.25!important}
.energy-v24 .hero-v19 .source-card.idle{opacity:.58!important}

/* generation merge badge */
.energy-v24 .solar-badge{
  left:27.7%!important;top:43%!important;
  min-width:88px!important;padding:8px 12px!important;border-radius:8px!important;
}
.energy-v24 .solar-badge strong{font-size:18px!important}
.energy-v24 .solar-badge span{font-size:7px!important}
.energy-v24 .solar-badge small{font-size:6px!important}

/* House consumption badge: visually attached to house, not a block covering it */
.energy-v24 .home-badge-v19{
  left:50%!important;bottom:1.2%!important;
  width:170px!important;min-width:170px!important;height:92px!important;
  padding:24px 14px 10px!important;
  clip-path:polygon(16% 17%,50% 0,84% 17%,100% 37%,91% 100%,9% 100%,0 37%)!important;
  border:0!important;
  background:linear-gradient(180deg,rgba(4,34,47,.90),rgba(2,14,23,.96))!important;
  box-shadow:0 15px 32px rgba(0,0,0,.42),0 0 22px rgba(57,203,238,.14)!important;
}
.energy-v24 .home-badge-v19:before{
  inset:1px!important;clip-path:inherit!important;
  background:linear-gradient(180deg,rgba(39,148,174,.13),rgba(2,15,24,.03))!important;
}
.energy-v24 .home-badge-top{gap:5px!important}
.energy-v24 .home-badge-top svg{width:18px!important;height:18px!important}
.energy-v24 .home-badge-top span{font-size:8px!important}
.energy-v24 .home-badge-v19 strong{font-size:27px!important}
.energy-v24 .home-badge-v19 small{font-size:7px!important}

/* REDE import/export badges */
.energy-v24 .imp-badge,.energy-v24 .exp-badge{
  right:15.5%!important;min-width:108px!important;padding:8px 11px!important;
  border-radius:9px!important;background:rgba(3,15,24,.94)!important;
}
.energy-v24 .imp-badge{top:29%!important}
.energy-v24 .exp-badge{top:61%!important}
.energy-v24 .imp-badge strong,.energy-v24 .exp-badge strong{font-size:17px!important}
.energy-v24 .imp-badge span,.energy-v24 .exp-badge span{font-size:7px!important}
.energy-v24 .imp-badge small,.energy-v24 .exp-badge small{font-size:6px!important}
.energy-v24 .grid-badge{right:4.2%!important;bottom:4%!important}
.energy-v24 .grid-badge span{font-size:7px!important}
.energy-v24 .grid-badge strong{font-size:10px!important}

/* SVG flow is brought to foreground and scaled with the scene */
.energy-v24 .hero-flow-svg{
  display:block!important;position:absolute!important;inset:0!important;
  width:100%!important;height:100%!important;z-index:8!important;pointer-events:none!important;
}
.energy-v24 .hero-flow-svg-mobile{display:none!important}
.energy-v24 .flow-line{
  fill:none!important;stroke-width:3.2!important;stroke-linecap:round!important;
  vector-effect:non-scaling-stroke!important;
}
.energy-v24 .flow-halo{
  fill:none!important;stroke-width:9!important;opacity:.18!important;
  vector-effect:non-scaling-stroke!important;
}
.energy-v24 .solar-line{stroke:#67f59b!important}
.energy-v24 .solar-halo{stroke:#67f59b!important}
.energy-v24 .import-line{stroke:#ffb64d!important}
.energy-v24 .import-halo{stroke:#ffb64d!important}
.energy-v24 .export-line{stroke:#42cfff!important}
.energy-v24 .export-halo{stroke:#42cfff!important}
.energy-v24 .flow-group.idle{opacity:.14!important}
.energy-v24 .flow-group.active{opacity:1!important}

/* badges/cards above SVG particles */
.energy-v24 .source-card,.energy-v24 .solar-badge,.energy-v24 .home-badge,
.energy-v24 .imp-badge,.energy-v24 .exp-badge,.energy-v24 .grid-badge{
  z-index:12!important;
}

/* ---- Summary: restore approved multicolor rows ---- */
.energy-v24 .period-summary{
  padding:12px!important;
  background:linear-gradient(145deg,rgba(5,20,33,.98),rgba(2,10,17,.99))!important;
}
.energy-v24 .period-summary .summary-title span{font-size:13px!important;color:#e8f7ff!important}
.energy-v24 .period-summary .summary-title strong{font-size:7px!important;color:#55d9ff!important}
.energy-v24 .period-summary .summary-title em{color:#55d9ff!important}
.energy-v24 .period-summary .summary-lines>div{padding:9px 3px!important}
.energy-v24 .period-summary .summary-lines i{width:21px!important;height:21px!important}
.energy-v24 .period-summary .summary-lines span{font-size:8px!important;color:#d4e5ee!important}
.energy-v24 .period-summary .summary-lines strong{font-size:9px!important;color:currentColor!important}
.energy-v24 .period-summary .summary-lines .green{color:#62ee8e!important}
.energy-v24 .period-summary .summary-lines .blue{color:#4e9cff!important}
.energy-v24 .period-summary .summary-lines .orange{color:#ffb24a!important}
.energy-v24 .period-summary .summary-lines .red{color:#ff6683!important}
.energy-v24 .period-summary .summary-lines .cyan{color:#49d5ff!important}
.energy-v24 .period-summary .summary-lines .purple{color:#a66aff!important}
.energy-v24 .period-summary .summary-dual span{font-size:6px!important;color:#91adbd!important}
.energy-v24 .period-summary .summary-dual strong{font-size:15px!important;color:#f0fbff!important}

/* ---- analytical cards: match mockup proportions and readability ---- */
.energy-v24 .analytics-row{
  grid-template-columns:1.15fr 1.15fr 1.35fr .75fr!important;
  gap:10px!important;
}
.energy-v24 .mini-panel{min-height:225px!important;padding:11px!important}
.energy-v24 .mini-title span{font-size:9px!important}
.energy-v24 .mini-title strong{font-size:23px!important}
.energy-v24 .mini-title small{font-size:7px!important}
.energy-v24 .chart-box{height:158px!important}
.energy-v24 .gridtext{font-size:12px!important}
.energy-v24 .chart-legend span,.energy-v24 .chart-legend span strong{font-size:9px!important}
.energy-v24 .time-ruler span em{font-size:7.5px!important}
.energy-v24 .peak-pill{padding:8px 11px!important}
.energy-v24 .peak-pill span{font-size:7px!important}
.energy-v24 .peak-pill strong{font-size:17px!important}
.energy-v24 .peak-pill small{font-size:7px!important}

/* Lower row like approved sketch */
.energy-v24 .lower-row{
  grid-template-columns:1.25fr 1.05fr 1.1fr .9fr!important;
  gap:10px!important;
}
.energy-v24 .lower-panel{min-height:176px!important;padding:12px!important}
.energy-v24 .lower-title strong{font-size:10px!important}
.energy-v24 .lower-title span{font-size:7px!important}
.energy-v24 .consumer span,.energy-v24 .board-bars span,
.energy-v24 .equip-list span,.energy-v24 .indicator-list span{font-size:8px!important}
.energy-v24 .consumer strong,.energy-v24 .board-bars strong,
.energy-v24 .equip-list strong,.energy-v24 .indicator-list strong{font-size:8px!important}

/* Desktop reference tuning */
@media(min-width:1451px){
  .energy-v24 .premium-kpis{grid-template-columns:repeat(7,minmax(0,1fr))!important}
}

/* Tablet */
@media(max-width:1450px) and (min-width:651px){
  .energy-v24 .premium-kpis{grid-template-columns:repeat(4,1fr)!important}
  .energy-v24 .hero-grid{grid-template-columns:minmax(0,3.8fr) minmax(250px,1fr)!important}
  .energy-v24 .scene-wrap{height:315px!important}
  .energy-v24 .analytics-row,.energy-v24 .lower-row{grid-template-columns:1fr 1fr!important}
}

/* Mobile: composition rebuilt instead of shrinking desktop */
@media(max-width:650px){
  .energy-v24 .premium-kpis .pkpi{min-height:98px!important;padding:9px!important;grid-template-columns:32px 1fr!important}
  .energy-v24 .premium-kpis .pkpi>i{width:29px!important;height:29px!important;padding:5px!important}
  .energy-v24 .premium-kpis .pkpi span{font-size:6px!important}
  .energy-v24 .premium-kpis .pkpi strong{font-size:18px!important}
  .energy-v24 .premium-kpis .pkpi small,.energy-v24 .premium-kpis .pkpi em{font-size:5.5px!important}
  .energy-v24 .premium-head span{font-size:10px!important}
  .energy-v24 .premium-head small{font-size:6px!important}
  .energy-v24 .scene-wrap{height:350px!important}
  .energy-v24 .hero-v19 .asset-house{width:63%!important;left:49%!important;bottom:1%!important;max-height:65%!important}
  .energy-v24 .hero-v19 .asset-solar{width:27%!important;left:-3%!important;bottom:2%!important;max-height:38%!important}
  .energy-v24 .hero-v19 .asset-grid{width:24%!important;right:-1%!important;bottom:1%!important;max-height:55%!important}
  .energy-v24 .energy-shield{left:49%!important;top:68%!important;width:205px!important;height:205px!important}
  .energy-v24 .hero-v19 .source-card{
    left:3%!important;width:40%!important;min-width:0!important;
    grid-template-columns:29px 1fr!important;padding:7px!important;
  }
  .energy-v24 .hero-v19 .source-inv{top:10%!important}
  .energy-v24 .hero-v19 .source-micro{top:29%!important}
  .energy-v24 .hero-v19 .source-card>i{width:26px!important;height:26px!important;padding:5px!important}
  .energy-v24 .hero-v19 .source-card span{font-size:5.5px!important}
  .energy-v24 .hero-v19 .source-card strong{font-size:14px!important}
  .energy-v24 .hero-v19 .source-card small{font-size:5px!important}
  .energy-v24 .solar-badge{left:34%!important;top:46%!important;min-width:70px!important;padding:5px 7px!important}
  .energy-v24 .solar-badge strong{font-size:12px!important}
  .energy-v24 .home-badge-v19{
    left:49%!important;bottom:0!important;width:130px!important;min-width:130px!important;height:74px!important;
    padding:19px 8px 7px!important;
  }
  .energy-v24 .home-badge-v19 strong{font-size:20px!important}
  .energy-v24 .imp-badge,.energy-v24 .exp-badge{right:4%!important;min-width:92px!important;padding:6px!important}
  .energy-v24 .imp-badge{top:13%!important}
  .energy-v24 .exp-badge{top:35%!important}
  .energy-v24 .imp-badge strong,.energy-v24 .exp-badge strong{font-size:13px!important}
  .energy-v24 .grid-badge{right:2%!important;bottom:2%!important}
  .energy-v24 .hero-flow-svg{display:none!important}
  .energy-v24 .hero-flow-svg-mobile{
    display:block!important;position:absolute!important;inset:0!important;
    width:100%!important;height:100%!important;z-index:8!important;pointer-events:none!important;
  }
  .energy-v24 .hero-flow-svg-mobile path{
    fill:none!important;stroke-width:2.6!important;stroke-linecap:round!important;
    vector-effect:non-scaling-stroke!important;
  }
  .energy-v24 .hero-flow-svg-mobile .solar path{stroke:#67f59b!important;filter:drop-shadow(0 0 4px #67f59b)}
  .energy-v24 .hero-flow-svg-mobile .import path{stroke:#ffb64d!important;filter:drop-shadow(0 0 4px #ffb64d)}
  .energy-v24 .hero-flow-svg-mobile .export path{stroke:#42cfff!important;filter:drop-shadow(0 0 4px #42cfff)}
  .energy-v24 .analytics-row,.energy-v24 .lower-row{grid-template-columns:1fr!important}
  .energy-v24 .mini-panel{min-height:255px!important}
  .energy-v24 .chart-box{height:188px!important}
}


/* ==========================================================================
   V54.0.0 — APROXIMAÇÃO VISUAL DE ALTA FIDELIDADE AO ESBOÇO APROVADO
   ========================================================================== */
.energy-v24{
  --v24-glass:rgba(4,20,31,.69);
  --v24-glass2:rgba(3,14,24,.82);
  --v24-line:rgba(63,176,235,.34);
  --v24-text:#dcebf4;
}

/* estrutura compacta do mockup */
.energy-v24 .shell-v24{padding:8px!important;gap:8px!important}
.energy-v24 .master-header{
  min-height:72px!important;
  background:rgba(2,14,23,.58)!important;
  border-color:rgba(62,174,232,.28)!important;
  backdrop-filter:blur(12px)!important;
}
.energy-v24 .brand-v14{padding:9px 13px!important}
.energy-v24 .brand-mark{width:48px!important;height:48px!important}
.energy-v24 .brand-v14 strong{font-size:22px!important}
.energy-v24 .master-tabs button{height:70px!important}
.energy-v24 .master-tabs button.active{
  background:linear-gradient(180deg,rgba(0,160,235,.30),rgba(0,80,132,.18))!important;
  box-shadow:inset 0 -2px 0 #27cfff,0 0 22px rgba(0,182,255,.12)!important;
}

/* KPI: vidro translúcido + identidade de cor individual */
.energy-v24 .premium-kpis{gap:8px!important}
.energy-v24 .premium-kpis .pkpi{
  min-height:118px!important;
  padding:12px 13px!important;
  grid-template-columns:45px minmax(0,1fr)!important;
  background:
    radial-gradient(circle at 15% 35%,color-mix(in srgb,currentColor 11%,transparent),transparent 33%),
    linear-gradient(145deg,rgba(7,25,36,.76),rgba(2,11,19,.80))!important;
  border:1px solid color-mix(in srgb,currentColor 28%,rgba(50,150,205,.20))!important;
  backdrop-filter:blur(13px)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 8px 25px rgba(0,0,0,.18)!important;
}
.energy-v24 .premium-kpis .pkpi>i{
  width:40px!important;height:40px!important;padding:7px!important;border-radius:11px!important;
  color:currentColor!important;
  background:color-mix(in srgb,currentColor 10%,rgba(3,16,25,.80))!important;
  border:1px solid color-mix(in srgb,currentColor 38%,transparent)!important;
  box-shadow:0 0 18px color-mix(in srgb,currentColor 30%,transparent),inset 0 0 12px color-mix(in srgb,currentColor 9%,transparent)!important;
}
.energy-v24 .premium-kpis .pkpi.solar{color:#70ef91!important}
.energy-v24 .premium-kpis .pkpi.inverter{color:#4ea5ff!important}
.energy-v24 .premium-kpis .pkpi.micro{color:#ffb34d!important}
.energy-v24 .premium-kpis .pkpi.house{color:#ff6283!important}
.energy-v24 .premium-kpis .pkpi.import{color:#6dbbff!important}
.energy-v24 .premium-kpis .pkpi.export{color:#4eb8ff!important}
.energy-v24 .premium-kpis .pkpi.balance{color:#4de88b!important}
.energy-v24 .premium-kpis .pkpi span{font-size:8.5px!important}
.energy-v24 .premium-kpis .pkpi strong{font-size:27px!important}
.energy-v24 .premium-kpis .pkpi small{font-size:7.5px!important}
.energy-v24 .premium-kpis .pkpi em{font-size:7px!important}
.energy-v24 .premium-kpis .pkpi svg{animation:v24IconFloat 3.6s ease-in-out infinite!important}
@keyframes v24IconFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.045)}}

/* hero */
.energy-v24 .hero-grid{grid-template-columns:minmax(0,4fr) minmax(285px,1fr)!important;gap:8px!important}
.energy-v24 .premium-flow,.energy-v24 .period-summary,.energy-v24 .mini-panel,.energy-v24 .lower-panel{
  background:linear-gradient(145deg,rgba(3,17,28,.73),rgba(1,9,16,.82))!important;
  border-color:rgba(55,166,224,.34)!important;
  backdrop-filter:blur(11px)!important;
}
.energy-v24 .premium-flow{min-height:385px!important}
.energy-v24 .premium-head{padding:10px 14px!important;background:rgba(1,11,19,.36)!important}
.energy-v24 .premium-head span{font-size:14px!important}
.energy-v24 .premium-head small{font-size:8px!important}

/* paisagem escura contínua atrás dos assets: montanhas, vegetação e estrada */
.energy-v24 .scene-wrap{
  height:320px!important;
  overflow:hidden!important;
  isolation:isolate!important;
  background:
    radial-gradient(ellipse at 49% 100%,rgba(12,65,55,.42) 0 14%,transparent 40%),
    radial-gradient(ellipse at 12% 95%,rgba(10,55,47,.30),transparent 30%),
    radial-gradient(ellipse at 88% 95%,rgba(7,42,43,.26),transparent 30%),
    linear-gradient(180deg,#03101a 0%,#04131d 52%,#031219 100%)!important;
}
.energy-v24 .scene-wrap:before{
  content:""!important;position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none!important;
  background:
    linear-gradient(145deg,transparent 0 25%,rgba(4,21,31,.95) 25.2% 34%,transparent 34.2%),
    linear-gradient(215deg,transparent 0 23%,rgba(4,20,30,.92) 23.2% 34%,transparent 34.2%),
    radial-gradient(ellipse at 50% 100%,rgba(16,55,49,.55) 0 21%,transparent 22%),
    linear-gradient(180deg,transparent 0 63%,rgba(2,15,18,.65) 64% 100%)!important;
  opacity:.82!important;
}
.energy-v24 .scene-wrap:after{
  content:""!important;position:absolute!important;left:13%!important;right:12%!important;bottom:-19%!important;height:47%!important;
  z-index:1!important;pointer-events:none!important;border-radius:50% 50% 0 0!important;
  border-top:2px solid rgba(112,149,151,.14)!important;
  background:
    radial-gradient(ellipse at 50% 0,transparent 0 41%,rgba(5,19,22,.88) 42% 61%,transparent 62%),
    linear-gradient(90deg,transparent 0 48.8%,rgba(185,208,196,.11) 49.3% 50.7%,transparent 51.2%)!important;
  transform:perspective(320px) rotateX(57deg)!important;
  opacity:.72!important;
}
.energy-v24 .scene-art{z-index:2!important}
.energy-v24 .scene-shade{z-index:3!important;background:linear-gradient(90deg,rgba(0,7,13,.10),transparent 22% 78%,rgba(0,7,13,.10))!important}

/* proporções dos assets iguais à leitura do esboço */
.energy-v24 .hero-v19 .asset-solar{
  left:-1.5%!important;bottom:4%!important;width:19%!important;max-height:76%!important;
  filter:brightness(.88) saturate(.92) drop-shadow(0 0 15px rgba(46,139,255,.18))!important;
}
.energy-v24 .hero-v19 .asset-house{
  left:50%!important;bottom:-2%!important;width:38%!important;max-height:101%!important;
  transform:translateX(-50%)!important;
  filter:brightness(.88) saturate(.91) drop-shadow(0 0 18px rgba(42,188,255,.14))!important;
}
.energy-v24 .hero-v19 .asset-grid{
  right:1.2%!important;bottom:0!important;width:16%!important;max-height:94%!important;
  filter:brightness(.93) saturate(.80) drop-shadow(0 0 15px rgba(65,175,255,.18))!important;
}

/* escudo */
.energy-v24 .energy-shield{
  left:50%!important;top:54%!important;width:280px!important;height:280px!important;
  transform:translate(-50%,-50%)!important;z-index:5!important;
}
.energy-v24 .shield-orbit{border-width:1.5px!important}
.energy-v24 .orbit-a{border-color:rgba(93,244,146,.74)!important}
.energy-v24 .orbit-b{border-color:rgba(74,195,255,.52)!important}
.energy-v24 .orbit-c{border-color:rgba(112,242,188,.27)!important}

/* cards hero no mesmo estilo vidro do mockup */
.energy-v24 .hero-v19 .source-card{
  left:6.7%!important;width:190px!important;min-width:190px!important;
  grid-template-columns:39px 1fr!important;padding:9px 11px!important;border-radius:10px!important;
  background:linear-gradient(145deg,rgba(3,20,32,.84),rgba(2,11,18,.78))!important;
  backdrop-filter:blur(10px)!important;
}
.energy-v24 .hero-v19 .source-inv{top:13%!important;color:#4ca4ff!important}
.energy-v24 .hero-v19 .source-micro{top:51%!important;color:#ffb34d!important}
.energy-v24 .hero-v19 .source-card>i{width:34px!important;height:34px!important;padding:6px!important;color:currentColor!important}
.energy-v24 .hero-v19 .source-card span{font-size:8px!important}
.energy-v24 .hero-v19 .source-card strong{font-size:21px!important}
.energy-v24 .hero-v19 .source-card small{font-size:7px!important}
.energy-v24 .solar-badge{left:27.8%!important;top:43%!important;min-width:88px!important}
.energy-v24 .solar-badge strong{font-size:18px!important}
.energy-v24 .home-badge-v19{
  left:50%!important;bottom:0!important;width:165px!important;min-width:165px!important;height:87px!important;
  padding:22px 12px 8px!important;
  background:linear-gradient(180deg,rgba(5,34,45,.86),rgba(2,13,21,.92))!important;
}
.energy-v24 .home-badge-v19 strong{font-size:25px!important}
.energy-v24 .imp-badge,.energy-v24 .exp-badge{
  right:15.8%!important;min-width:102px!important;padding:7px 10px!important;
  background:rgba(3,15,23,.80)!important;backdrop-filter:blur(9px)!important;
}
.energy-v24 .imp-badge{top:27%!important}
.energy-v24 .exp-badge{top:59%!important}
.energy-v24 .imp-badge strong,.energy-v24 .exp-badge strong{font-size:16px!important}

/* fluxos contínuos e vivos */
.energy-v24 .hero-flow-svg{z-index:7!important}
.energy-v24 .flow-line{stroke-width:3.0!important}
.energy-v24 .flow-halo{stroke-width:8!important;opacity:.16!important}
.energy-v24 .flow-group.active .flow-line{stroke-dasharray:11 7!important;animation:v24Flow 1.15s linear infinite!important}
@keyframes v24Flow{to{stroke-dashoffset:-36}}
.energy-v24 .source-card,.energy-v24 .solar-badge,.energy-v24 .home-badge,
.energy-v24 .imp-badge,.energy-v24 .exp-badge,.energy-v24 .grid-badge{z-index:11!important}

/* resumo como no mockup */
.energy-v24 .period-summary{padding:10px 12px!important}
.energy-v24 .period-summary .summary-title span{font-size:13px!important}
.energy-v24 .period-summary .summary-lines>div{padding:8px 2px!important}
.energy-v24 .period-summary .summary-lines i{width:20px!important;height:20px!important}
.energy-v24 .period-summary .summary-lines span{font-size:8px!important}
.energy-v24 .period-summary .summary-lines strong{font-size:9px!important}

/* gráficos secundários: grade kW x horário, tipografia e proporções do mockup */
.energy-v24 .analytics-row{
  grid-template-columns:1.05fr 1.05fr 1.05fr .70fr!important;gap:8px!important;
}
.energy-v24 .mini-panel{min-height:215px!important;padding:10px!important;border-radius:11px!important}
.energy-v24 .mini-title span{font-size:9px!important}
.energy-v24 .mini-title strong{font-size:22px!important}
.energy-v24 .mini-title small{font-size:7.5px!important}
.energy-v24 .chart-box{height:158px!important;margin-top:5px!important}
.energy-v24 .chart-viewport{position:relative!important;min-height:0!important}
.energy-v24 .gridline-h{stroke:rgba(90,139,164,.20)!important}
.energy-v24 .gridline-v{stroke:rgba(80,130,157,.085)!important}
.energy-v24 .gridline-v.major{stroke:rgba(88,150,181,.20)!important}
.energy-v24 .gridtext{font-size:12px!important;fill:#a9c0ce!important}
.energy-v24 .trend{stroke-width:2.35!important;filter:drop-shadow(0 0 3px currentColor)!important}
.energy-v24 .time-ruler{border-top:1px solid rgba(80,141,170,.18)!important}
.energy-v24 .time-ruler span em{font-size:7px!important;color:#a9c1cf!important}
.energy-v24 .time-ruler .hour-tick:nth-child(even) em{opacity:.18!important}
.energy-v24 .time-ruler .hour-tick:nth-child(odd) em{opacity:.82!important}
.energy-v24 .chart-legend{gap:11px!important;padding-top:3px!important}
.energy-v24 .chart-legend span,.energy-v24 .chart-legend span strong{font-size:8px!important}
.energy-v24 .peak-pill{border-radius:9px!important;background:rgba(35,7,19,.52)!important}

/* barras do gráfico de consumo — aparência visual do mockup sem alterar os dados */
.energy-v24 .consumption-card .chart-viewport:before{
  content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:15%!important;height:63%!important;z-index:0!important;
  background:repeating-linear-gradient(90deg,transparent 0 2.25%,rgba(255,67,96,.13) 2.25% 3.05%)!important;
  mask-image:linear-gradient(to top,#000,transparent 88%)!important;opacity:.72!important;pointer-events:none!important;
}
.energy-v24 .chart-viewport svg{position:relative!important;z-index:1!important}

/* cards inferiores transparentes e com hierarquia igual ao esboço */
.energy-v24 .lower-row{grid-template-columns:1.15fr 1fr 1.05fr .88fr!important;gap:8px!important}
.energy-v24 .lower-panel{min-height:170px!important;padding:10px 12px!important;border-radius:11px!important}
.energy-v24 .lower-title strong{font-size:10px!important}
.energy-v24 .consumer span,.energy-v24 .board-bars span,.energy-v24 .equip-list span,.energy-v24 .indicator-list span{font-size:8.5px!important}
.energy-v24 .consumer strong,.energy-v24 .board-bars strong,.energy-v24 .equip-list strong,.energy-v24 .indicator-list strong{font-size:8.5px!important}

/* ícones dos cards inferiores mais vivos */
.energy-v24 .consumer>i,.energy-v24 .lower-panel svg{
  filter:drop-shadow(0 0 5px currentColor)!important;
}
.energy-v24 .consumer>i svg,.energy-v24 .equip-list svg,.energy-v24 .indicator-list svg{
  animation:v24IconFloat 4s ease-in-out infinite!important;
}

/* tablet */
@media(max-width:1450px) and (min-width:651px){
  .energy-v24 .premium-kpis{grid-template-columns:repeat(4,1fr)!important}
  .energy-v24 .hero-grid{grid-template-columns:minmax(0,3.65fr) minmax(250px,1fr)!important}
  .energy-v24 .scene-wrap{height:305px!important}
  .energy-v24 .hero-v19 .asset-house{width:42%!important}
  .energy-v24 .analytics-row,.energy-v24 .lower-row{grid-template-columns:1fr 1fr!important}
}

/* mobile: composição independente, limpa e sem sobreposição */
@media(max-width:650px){
  .energy-v24 .premium-kpis .pkpi{min-height:96px!important}
  .energy-v24 .hero-grid{grid-template-columns:1fr!important}
  .energy-v24 .scene-wrap{height:350px!important}
  .energy-v24 .hero-v19 .asset-house{left:50%!important;bottom:0!important;width:61%!important;max-height:64%!important}
  .energy-v24 .hero-v19 .asset-solar{left:-3%!important;bottom:2%!important;width:27%!important;max-height:36%!important}
  .energy-v24 .hero-v19 .asset-grid{right:-1%!important;bottom:0!important;width:22%!important;max-height:53%!important}
  .energy-v24 .energy-shield{left:50%!important;top:69%!important;width:198px!important;height:198px!important}
  .energy-v24 .hero-v19 .source-card{left:3%!important;width:39%!important;min-width:0!important}
  .energy-v24 .hero-v19 .source-inv{top:10%!important}
  .energy-v24 .hero-v19 .source-micro{top:29%!important}
  .energy-v24 .solar-badge{left:33%!important;top:47%!important}
  .energy-v24 .home-badge-v19{left:50%!important;bottom:0!important;width:128px!important;min-width:128px!important;height:72px!important}
  .energy-v24 .imp-badge,.energy-v24 .exp-badge{right:4%!important;min-width:88px!important}
  .energy-v24 .imp-badge{top:12%!important}
  .energy-v24 .exp-badge{top:34%!important}
  .energy-v24 .analytics-row,.energy-v24 .lower-row{grid-template-columns:1fr!important}
  .energy-v24 .mini-panel{min-height:250px!important}
  .energy-v24 .chart-box{height:188px!important}
  .energy-v24 .time-ruler .hour-tick:nth-child(even) em{display:none!important}
}


/* ==========================================================================
   V54.0.0 — CORREÇÃO VISUAL ORIENTADA PELO ESBOÇO APROVADO
   ========================================================================== */
.energy-v25{
  --panel:rgba(2,16,26,.68);
  --panel-deep:rgba(1,10,17,.80);
  --edge:rgba(47,164,224,.31);
  --txt:#d9eaf4;
  --muted:#8ca9b9;
}

/* Base: menos "card do HA", mais console gráfico integrado */
.energy-v25 .premium-flow,
.energy-v25 .period-summary,
.energy-v25 .mini-panel,
.energy-v25 .lower-panel,
.energy-v25 .panel,
.energy-v25 .hero-kpi{
  background:
    radial-gradient(circle at 14% 0,rgba(29,113,151,.08),transparent 34%),
    linear-gradient(145deg,rgba(3,18,29,.70),rgba(1,9,16,.82))!important;
  border:1px solid var(--edge)!important;
  border-radius:10px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 30px rgba(0,0,0,.16)!important;
  backdrop-filter:blur(10px)!important;
}

/* Cabeçalho KPI: desenho, brilho, iconografia e profundidade próximos do mockup */
.energy-v25 .premium-kpis{gap:8px!important}
.energy-v25 .premium-kpis .pkpi{
  min-height:122px!important;
  border-radius:10px!important;
  border:1px solid color-mix(in srgb,currentColor 30%,rgba(55,150,205,.20))!important;
  background:
    radial-gradient(circle at 14% 30%,color-mix(in srgb,currentColor 13%,transparent),transparent 31%),
    radial-gradient(circle at 95% 100%,rgba(255,255,255,.018),transparent 34%),
    linear-gradient(145deg,rgba(4,21,33,.76),rgba(1,10,17,.84))!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.035),
    inset 0 -28px 60px rgba(0,0,0,.12),
    0 8px 22px rgba(0,0,0,.17)!important;
}
.energy-v25 .premium-kpis .pkpi:before{
  height:1px!important;opacity:.78!important;
  background:linear-gradient(90deg,transparent,currentColor 18%,currentColor 72%,transparent)!important;
  box-shadow:0 0 12px currentColor!important;
}
.energy-v25 .premium-kpis .pkpi>i{
  width:45px!important;height:45px!important;padding:8px!important;border-radius:12px!important;
  background:
    radial-gradient(circle at 42% 36%,color-mix(in srgb,currentColor 20%,white),color-mix(in srgb,currentColor 7%,transparent) 48%,transparent 70%)!important;
  border:1px solid color-mix(in srgb,currentColor 38%,transparent)!important;
  box-shadow:0 0 19px color-mix(in srgb,currentColor 31%,transparent),inset 0 0 14px color-mix(in srgb,currentColor 10%,transparent)!important;
}
.energy-v25 .premium-kpis .pkpi span{font-size:9px!important;letter-spacing:.15px!important}
.energy-v25 .premium-kpis .pkpi strong{font-size:29px!important;line-height:1.03!important}
.energy-v25 .premium-kpis .pkpi small{font-size:8px!important;line-height:1.25!important}
.energy-v25 .premium-kpis .pkpi em{font-size:7.5px!important}
.energy-v25 .premium-kpis .pkpi>u{height:7px!important;background:rgba(32,58,72,.62)!important}
.energy-v25 .premium-kpis .pkpi svg{animation:v25Icon 4.2s ease-in-out infinite!important}
@keyframes v25Icon{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2px) rotate(2deg)}}

/* HERO: paisagem e assets */
.energy-v25 .premium-flow{min-height:420px!important}
.energy-v25 .scene-wrap{
  height:350px!important;
  background:
    radial-gradient(ellipse at 49% 104%,rgba(11,67,57,.42) 0 17%,transparent 41%),
    radial-gradient(ellipse at 13% 94%,rgba(7,49,43,.30),transparent 28%),
    radial-gradient(ellipse at 86% 95%,rgba(7,42,43,.25),transparent 28%),
    linear-gradient(180deg,#03111b 0%,#04141e 54%,#031116 100%)!important;
}
.energy-v25 .scene-wrap:before{
  opacity:.92!important;
  background:
    linear-gradient(149deg,transparent 0 22%,rgba(4,20,30,.97) 22.3% 34%,transparent 34.3%),
    linear-gradient(211deg,transparent 0 21%,rgba(4,20,30,.94) 21.3% 35%,transparent 35.3%),
    radial-gradient(ellipse at 50% 100%,rgba(14,57,48,.57) 0 23%,transparent 24%),
    linear-gradient(180deg,transparent 0 61%,rgba(2,15,18,.66) 62% 100%)!important;
}
.energy-v25 .scene-wrap:after{opacity:.82!important}
.energy-v25 .hero-v19 .asset-house{
  left:50%!important;bottom:-4%!important;width:43%!important;max-height:108%!important;
  transform:translateX(-50%)!important;
}
.energy-v25 .hero-v19 .asset-solar{left:-1.5%!important;bottom:3%!important;width:19%!important;max-height:75%!important}
.energy-v25 .hero-v19 .asset-grid{right:1.2%!important;bottom:0!important;width:16%!important;max-height:94%!important}

/* Escudo mais parecido com o esboço: halo luminoso, não um círculo dominante */
.energy-v25 .energy-shield{
  left:50%!important;top:55%!important;width:300px!important;height:300px!important;
  transform:translate(-50%,-50%)!important;
  filter:drop-shadow(0 0 14px rgba(77,224,150,.17))!important;
}
.energy-v25 .shield-orbit{border-width:1.25px!important;opacity:.64!important}
.energy-v25 .shield-pulse{opacity:.25!important}

/* Consumo da casa: SEM fundo laranja. Console escuro/azulado recortado. */
.energy-v25 .home-badge-v19{
  left:50%!important;bottom:0!important;width:174px!important;min-width:174px!important;height:91px!important;
  padding:23px 13px 9px!important;
  color:#e8f9ff!important;
  background:
    radial-gradient(circle at 50% 0,rgba(57,205,240,.11),transparent 48%),
    linear-gradient(180deg,rgba(3,31,43,.88),rgba(1,13,21,.95))!important;
  border:1px solid rgba(63,188,231,.43)!important;
  box-shadow:0 15px 30px rgba(0,0,0,.43),0 0 18px rgba(55,201,238,.10)!important;
}
.energy-v25 .home-badge-v19:before{
  background:linear-gradient(180deg,rgba(58,194,224,.055),rgba(2,15,24,.01))!important;
}
.energy-v25 .home-badge-v19:after{border-top-color:rgba(73,205,239,.30)!important}
.energy-v25 .home-badge-v19 strong{color:#f4fdff!important;text-shadow:0 0 13px rgba(74,211,245,.25)!important}

/* Cards solares e REDE com acabamento mais orgânico */
.energy-v25 .hero-v19 .source-card{
  left:6.6%!important;width:195px!important;min-width:195px!important;
  padding:10px 12px!important;border-radius:10px!important;
  background:linear-gradient(145deg,rgba(3,20,32,.82),rgba(1,10,17,.76))!important;
  box-shadow:0 12px 28px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.03)!important;
}
.energy-v25 .hero-v19 .source-card>i{width:38px!important;height:38px!important}
.energy-v25 .hero-v19 .source-card span{font-size:8.5px!important}
.energy-v25 .hero-v19 .source-card strong{font-size:22px!important}
.energy-v25 .hero-v19 .source-card small{font-size:7.5px!important}
.energy-v25 .solar-badge{left:27.6%!important;top:43%!important;background:rgba(2,27,19,.70)!important}
.energy-v25 .imp-badge,.energy-v25 .exp-badge{
  right:15.6%!important;min-width:105px!important;
  background:linear-gradient(145deg,rgba(4,19,28,.82),rgba(1,10,16,.77))!important;
  backdrop-filter:blur(10px)!important;
}
.energy-v25 .imp-badge{top:28%!important}
.energy-v25 .exp-badge{top:60%!important}

/* FLUXO: trilho SEM pontilhado. Partículas SVG fazem movimento contínuo. */
.energy-v25 .flow-line{
  stroke-dasharray:none!important;
  stroke-dashoffset:0!important;
  animation:none!important;
  stroke-width:2.8!important;
  opacity:.96!important;
}
.energy-v25 .flow-halo{stroke-width:7px!important;opacity:.16!important}
.energy-v25 .flow-group.active .flow-line{
  stroke-dasharray:none!important;
  animation:none!important;
}
.energy-v25 .hero-flow-svg circle{
  will-change:transform!important;
  filter:url(#heroGlow)!important;
}
.energy-v25 .mobile-flow path{
  fill:none!important;stroke-width:2.4!important;stroke-linecap:round!important;
}
.energy-v25 .mobile-flow.solar path{stroke:#68f49a!important}
.energy-v25 .mobile-flow.import path{stroke:#ffb54f!important}
.energy-v25 .mobile-flow.export path{stroke:#48d9ff!important}

/* Resumo: um único idioma visual cyan, como painel auxiliar */
.energy-v25 .period-summary{padding:11px 13px!important}
.energy-v25 .period-summary .summary-lines>div{padding:8px 2px!important}
.energy-v25 .period-summary .summary-lines i{width:21px!important;height:21px!important}
.energy-v25 .period-summary .summary-lines span{font-size:8.5px!important}
.energy-v25 .period-summary .summary-lines strong{font-size:9.5px!important}

/* Gráficos secundários iguais em linguagem: moldura, grade, títulos e escala legíveis */
.energy-v25 .analytics-row{grid-template-columns:1.05fr 1.05fr 1.05fr .72fr!important;gap:8px!important}
.energy-v25 .mini-panel{min-height:230px!important;padding:11px!important}
.energy-v25 .mini-title span{font-size:9.5px!important}
.energy-v25 .mini-title strong{font-size:23px!important}
.energy-v25 .mini-title small{font-size:8px!important}
.energy-v25 .chart-box{height:168px!important}
.energy-v25 .gridline-h{stroke:rgba(86,145,174,.22)!important}
.energy-v25 .gridline-v{stroke:rgba(77,133,160,.11)!important}
.energy-v25 .gridline-v.major{stroke:rgba(91,157,187,.23)!important}
.energy-v25 .gridtext{font-size:13px!important;fill:#a9c3d2!important}
.energy-v25 .time-ruler span em{font-size:7.5px!important;color:#b5cbd7!important}
.energy-v25 .chart-legend span,.energy-v25 .chart-legend span strong{font-size:8.5px!important}
.energy-v25 .trend{stroke-width:2.5!important}

/* inferiores: deixam de parecer linhas simples do HA */
.energy-v25 .lower-row{grid-template-columns:1.12fr 1fr 1.06fr .90fr!important;gap:8px!important}
.energy-v25 .lower-panel{min-height:178px!important;padding:11px 13px!important}
.energy-v25 .lower-title strong{font-size:10.5px!important}
.energy-v25 .consumer,
.energy-v25 .equip-list>div,
.energy-v25 .indicator-list>div{
  min-height:27px!important;
  border-bottom:1px solid rgba(83,149,178,.12)!important;
}
.energy-v25 .consumer span,.energy-v25 .board-bars span,.energy-v25 .equip-list span,.energy-v25 .indicator-list span{font-size:9px!important}
.energy-v25 .consumer strong,.energy-v25 .board-bars strong,.energy-v25 .equip-list strong,.energy-v25 .indicator-list strong{font-size:9px!important}

/* Demais abas: acabamento coerente com o mockup */
.energy-v25 .tab-intro,
.energy-v25 .detail-kpi,
.energy-v25 .device-row,
.energy-v25 .status-card{
  background:
    radial-gradient(circle at 12% 10%,rgba(40,150,197,.08),transparent 34%),
    linear-gradient(145deg,rgba(4,21,32,.72),rgba(1,10,17,.82))!important;
  border:1px solid rgba(55,164,220,.28)!important;
  border-radius:10px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 22px rgba(0,0,0,.13)!important;
}
.energy-v25 .tab-intro-icon,
.energy-v25 .device-icon{
  border-radius:11px!important;
  box-shadow:0 0 16px color-mix(in srgb,currentColor 22%,transparent)!important;
}
.energy-v25 .detail-kpi strong{font-size:24px!important}
.energy-v25 .detail-kpi span{font-size:8.5px!important}

/* TABLET */
@media(max-width:1450px) and (min-width:651px){
  .energy-v25 .premium-kpis{grid-template-columns:repeat(4,1fr)!important}
  .energy-v25 .hero-v19 .asset-house{width:47%!important}
  .energy-v25 .scene-wrap{height:330px!important}
  .energy-v25 .analytics-row,.energy-v25 .lower-row{grid-template-columns:1fr 1fr!important}
}

/* MOBILE: composição própria, sem simplesmente esmagar o desktop */
@media(max-width:650px){
  .energy-v25 .premium-kpis .pkpi{
    min-height:104px!important;padding:9px!important;
    grid-template-columns:35px minmax(0,1fr)!important;
  }
  .energy-v25 .premium-kpis .pkpi>i{width:32px!important;height:32px!important;padding:6px!important}
  .energy-v25 .premium-kpis .pkpi span{font-size:6.7px!important}
  .energy-v25 .premium-kpis .pkpi strong{font-size:18px!important}
  .energy-v25 .premium-kpis .pkpi small{font-size:5.8px!important}

  .energy-v25 .premium-flow{min-height:430px!important}
  .energy-v25 .scene-wrap{height:370px!important}
  .energy-v25 .hero-flow-svg{display:none!important}
  .energy-v25 .hero-flow-svg-mobile{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:8!important;pointer-events:none!important}

  .energy-v25 .hero-v19 .asset-house{
    left:50%!important;bottom:-1%!important;width:68%!important;max-height:60%!important;
    transform:translateX(-50%)!important;
  }
  .energy-v25 .hero-v19 .asset-solar{left:-4%!important;bottom:0!important;width:28%!important;max-height:32%!important}
  .energy-v25 .hero-v19 .asset-grid{right:-1%!important;bottom:0!important;width:22%!important;max-height:48%!important}

  .energy-v25 .energy-shield{left:50%!important;top:70%!important;width:205px!important;height:205px!important}

  .energy-v25 .hero-v19 .source-card{
    left:3%!important;width:41%!important;min-width:0!important;
    grid-template-columns:28px 1fr!important;padding:7px 8px!important;
  }
  .energy-v25 .hero-v19 .source-inv{top:9%!important}
  .energy-v25 .hero-v19 .source-micro{top:27%!important}
  .energy-v25 .hero-v19 .source-card>i{width:26px!important;height:26px!important;padding:4px!important}
  .energy-v25 .hero-v19 .source-card span{font-size:5.7px!important}
  .energy-v25 .hero-v19 .source-card strong{font-size:13px!important}
  .energy-v25 .hero-v19 .source-card small{font-size:5.1px!important}

  .energy-v25 .solar-badge{left:31%!important;top:46%!important;min-width:73px!important;padding:5px 7px!important}
  .energy-v25 .solar-badge strong{font-size:12px!important}

  .energy-v25 .imp-badge,.energy-v25 .exp-badge{
    right:3%!important;width:94px!important;min-width:94px!important;padding:6px!important;
  }
  .energy-v25 .imp-badge{top:10%!important}
  .energy-v25 .exp-badge{top:29%!important}
  .energy-v25 .imp-badge strong,.energy-v25 .exp-badge strong{font-size:12px!important}

  .energy-v25 .home-badge-v19{
    left:50%!important;bottom:0!important;width:130px!important;min-width:130px!important;height:72px!important;
    padding:19px 9px 7px!important;
  }
  .energy-v25 .home-badge-v19 strong{font-size:18px!important}
  .energy-v25 .home-badge-v19 small{font-size:5.5px!important}
  .energy-v25 .grid-badge{right:2%!important;bottom:1%!important}

  .energy-v25 .analytics-row,.energy-v25 .lower-row{grid-template-columns:1fr!important}
  .energy-v25 .mini-panel{min-height:265px!important}
  .energy-v25 .chart-box{height:198px!important}
  .energy-v25 .time-ruler .hour-tick:nth-child(even) em{display:none!important}
}


/* ==========================================================================
   V54.0.0 — VISÃO GERAL RECONSTRUÍDA DO ZERO
   Classes V26 são independentes das camadas visuais V22-V25.
   ========================================================================== */
.energy-v26{--v26bg:#020b12;--v26panel:rgba(3,18,29,.80);--v26edge:rgba(54,156,210,.32);--v26text:#edf9ff;--v26muted:#9eb8c8}
.energy-v26 .v26-overview{display:grid;gap:10px;min-width:0}

/* top KPI cards */
.v26-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px}
.v26-kpis article{position:relative;min-height:122px;display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;align-items:center;padding:13px 14px;border-radius:11px;border:1px solid color-mix(in srgb,currentColor 33%,rgba(54,156,210,.18));background:radial-gradient(circle at 12% 34%,color-mix(in srgb,currentColor 11%,transparent),transparent 33%),linear-gradient(145deg,rgba(4,21,33,.86),rgba(2,11,18,.90));box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.20);overflow:hidden}
.v26-kpis article:before{content:"";position:absolute;left:10%;right:10%;top:0;height:1px;background:linear-gradient(90deg,transparent,currentColor,transparent);box-shadow:0 0 12px currentColor;opacity:.7}
.v26-kpis article>i{width:43px;height:43px;padding:8px;border-radius:12px;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,currentColor 25%,white),color-mix(in srgb,currentColor 8%,transparent) 48%,transparent);border:1px solid color-mix(in srgb,currentColor 40%,transparent);box-shadow:0 0 18px color-mix(in srgb,currentColor 30%,transparent),inset 0 0 15px color-mix(in srgb,currentColor 10%,transparent)}
.v26-kpis article>i svg{animation:v26Icon 4s ease-in-out infinite}
@keyframes v26Icon{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-2px) scale(1.04)}}
.v26-kpis span{display:block;color:#dcecf4;font-size:9px;font-weight:800}.v26-kpis strong{display:block;margin-top:4px;color:currentColor;font-size:29px;line-height:1;text-shadow:0 0 14px color-mix(in srgb,currentColor 35%,transparent)}.v26-kpis small{display:block;margin-top:6px;color:#a8c0ce;font-size:8px}.v26-kpis em{display:flex;align-items:center;justify-content:space-between;margin-top:6px;color:#6cf29c;font-size:8px;font-style:normal}.v26-kpis em b{color:#d9e9f1}.v26-kpis article>b{position:absolute;left:13px;right:13px;bottom:11px;height:7px;border-radius:7px;background:rgba(33,59,72,.7);overflow:hidden}.v26-kpis article>b u{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,currentColor,#53efa1);box-shadow:0 0 10px currentColor}
.v26-kpis .solar{color:#6df391}.v26-kpis .inverter{color:#49a3ff}.v26-kpis .micro{color:#ffb44e}.v26-kpis .house{color:#ff6685}.v26-kpis .import{color:#68bfff}.v26-kpis .export{color:#49b8ff}.v26-kpis .balance{color:#50ed91}

/* hero */
.v26-hero-grid{display:grid;grid-template-columns:minmax(0,4.15fr) minmax(285px,1fr);gap:9px}
.v26-flow,.v26-summary{border:1px solid var(--v26edge);border-radius:10px;background:linear-gradient(145deg,rgba(3,18,29,.72),rgba(1,10,17,.84));overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.025)}
.v26-flow-head{height:58px;display:flex;align-items:center;justify-content:space-between;padding:9px 13px;border-bottom:1px solid rgba(61,147,190,.17);background:rgba(2,13,22,.46)}
.v26-flow-head>div{display:flex;align-items:center;gap:9px}.v26-flow-head>div>i{width:26px;height:26px;color:#8cfb85;filter:drop-shadow(0 0 8px rgba(140,251,133,.5))}.v26-flow-head strong{display:block;font-size:15px}.v26-flow-head small{display:block;margin-top:3px;font-size:8px;color:#a3bccc}.v26-flow-head>span{display:flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid rgba(85,239,132,.38);border-radius:8px;color:#64ed92;font-size:8px;font-weight:800;background:rgba(73,235,129,.04)}.v26-flow-head>span b{width:8px;height:8px;border-radius:50%;background:#50ec88;box-shadow:0 0 12px #50ec88}
.v26-scene{position:relative;height:330px;overflow:hidden;background:linear-gradient(180deg,#03121d 0%,#04151d 56%,#031116 100%)}
.v26-landscape{position:absolute;inset:0;z-index:0;background:
linear-gradient(147deg,transparent 0 23%,rgba(4,20,29,.96) 23.3% 34%,transparent 34.3%),
linear-gradient(213deg,transparent 0 23%,rgba(4,20,29,.94) 23.3% 35%,transparent 35.3%),
radial-gradient(ellipse at 50% 103%,rgba(15,61,49,.58) 0 23%,transparent 24%),
radial-gradient(ellipse at 11% 96%,rgba(9,48,41,.35),transparent 30%),
radial-gradient(ellipse at 89% 96%,rgba(8,42,39,.30),transparent 28%)}
.v26-landscape:after{content:"";position:absolute;left:14%;right:13%;bottom:-22%;height:46%;border-radius:50% 50% 0 0;border-top:2px solid rgba(133,166,156,.16);background:radial-gradient(ellipse at 50% 0,transparent 0 42%,rgba(4,17,20,.86) 43% 62%,transparent 63%),linear-gradient(90deg,transparent 0 49%,rgba(190,213,196,.10) 49.3% 50.7%,transparent 51%);transform:perspective(330px) rotateX(58deg);opacity:.9}
.v26-scene .scene-art{z-index:1}.v26-scene .asset-solar{left:-1%!important;bottom:1%!important;width:20%!important;height:auto!important;max-height:78%!important;filter:brightness(.90) saturate(.94) drop-shadow(0 0 14px rgba(42,143,255,.16))!important}.v26-scene .asset-house{left:50%!important;bottom:-3%!important;width:41%!important;height:auto!important;max-height:104%!important;transform:translateX(-50%)!important;filter:brightness(.90) saturate(.93) drop-shadow(0 0 18px rgba(59,193,255,.12))!important}.v26-scene .asset-grid{right:1%!important;bottom:0!important;width:16.5%!important;height:auto!important;max-height:95%!important;filter:brightness(.94) saturate(.82) drop-shadow(0 0 16px rgba(65,173,255,.16))!important}
.v26-shield{position:absolute;z-index:4;left:50%;top:53%;width:290px;height:290px;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}.v26-shield:before,.v26-shield:after,.v26-shield i{content:"";position:absolute;border-radius:50%}.v26-shield:before{inset:0;border:1.7px solid rgba(80,232,151,.68);box-shadow:0 0 17px rgba(80,232,151,.28),inset 0 0 24px rgba(80,232,151,.06)}.v26-shield:after{inset:12px;border:1px solid rgba(73,198,255,.48);box-shadow:0 0 17px rgba(73,198,255,.14)}.v26-shield i:first-child{inset:-8px;border-top:2px solid rgba(112,255,181,.70);border-right:2px solid transparent;animation:v26spin 12s linear infinite}.v26-shield i:last-child{inset:24px;border-bottom:1.5px solid rgba(74,205,255,.54);border-left:1.5px solid transparent;animation:v26spinr 16s linear infinite}@keyframes v26spin{to{transform:rotate(360deg)}}@keyframes v26spinr{to{transform:rotate(-360deg)}}
.v26-source{position:absolute;z-index:8;width:205px;display:grid;grid-template-columns:42px 1fr;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:linear-gradient(145deg,rgba(3,20,32,.88),rgba(1,10,17,.82));border:1px solid currentColor;box-shadow:0 11px 27px rgba(0,0,0,.34);backdrop-filter:blur(9px)}.v26-source>i{width:38px;height:38px;padding:7px;border-radius:10px;background:rgba(255,255,255,.025);box-shadow:0 0 15px currentColor}.v26-source span{display:block;font-size:8px;font-weight:800}.v26-source strong{display:block;margin-top:2px;font-size:22px}.v26-source small{display:block;margin-top:3px;font-size:7px;color:#b5c8d2}.v26-inverter{left:6.7%;top:14%;color:#4da4ff}.v26-micro{left:6.7%;top:53%;color:#ffb34e}.v26-solar-total{position:absolute;z-index:9;left:27.5%;top:42%;min-width:96px;padding:7px 10px;text-align:center;border:1px solid rgba(93,245,145,.66);border-radius:8px;color:#7df7a2;background:rgba(3,31,21,.74);box-shadow:0 0 17px rgba(87,237,141,.17)}.v26-solar-total strong{display:block;font-size:18px}.v26-solar-total span{display:block;margin-top:2px;font-size:7px}
.v26-house-meter{position:absolute;z-index:10;left:50%;bottom:0;transform:translateX(-50%);width:170px;height:92px;padding:24px 12px 8px;text-align:center;clip-path:polygon(50% 0,91% 25%,100% 100%,0 100%,9% 25%);background:linear-gradient(180deg,rgba(4,32,43,.92),rgba(1,13,21,.96));border:1px solid rgba(64,193,231,.40);color:#edfaff;box-shadow:0 13px 30px rgba(0,0,0,.44),0 0 19px rgba(57,201,239,.12)}.v26-house-meter>div{display:flex;align-items:center;justify-content:center;gap:5px;color:#55d8ff}.v26-house-meter svg{width:18px;height:18px}.v26-house-meter span{font-size:8px;font-weight:800}.v26-house-meter strong{display:block;margin-top:4px;font-size:27px}.v26-house-meter small{display:block;margin-top:5px;font-size:7px;color:#bcd1dc}
.v26-grid-meter{position:absolute;z-index:10;right:15.3%;min-width:108px;padding:7px 10px;text-align:center;border-radius:8px;background:rgba(3,16,25,.88);border:1px solid currentColor;box-shadow:0 0 17px color-mix(in srgb,currentColor 20%,transparent)}.v26-grid-meter.import{top:28%;color:#ffb34d}.v26-grid-meter.export{top:61%;color:#4edcff}.v26-grid-meter.idle{opacity:.38}.v26-grid-meter strong{display:block;font-size:17px}.v26-grid-meter span{display:block;margin-top:2px;font-size:7px}.v26-grid-label{position:absolute;z-index:8;right:5%;bottom:6%;text-align:center;color:#e9f8ff}.v26-grid-label strong{display:block;font-size:12px}.v26-grid-label small{display:block;margin-top:2px;font-size:6px;color:#9fb8c7}
.v26-flow-svg{position:absolute;inset:0;z-index:6;width:100%;height:100%;pointer-events:none;overflow:visible}.v26-rail{fill:none;stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:url(#v26glow)}.v26-rail.solar{stroke:#72f59c}.v26-rail.import{stroke:#ffb44d}.v26-rail.export{stroke:#4cd8ff}.v26-particle{filter:url(#v26glow)}

/* summary */
.v26-summary{padding:10px 12px}.v26-summary header>strong{display:block;font-size:13px}.v26-summary header>div{display:grid;grid-template-columns:repeat(4,1fr);margin-top:8px;border:1px solid rgba(66,157,205,.25);border-radius:8px;overflow:hidden}.v26-summary header span{padding:6px 4px;text-align:center;font-size:7px;color:#8eb1c4;border-right:1px solid rgba(66,157,205,.16)}.v26-summary header span.active{color:white;background:linear-gradient(180deg,#19b9ff,#087bb9);box-shadow:0 0 14px rgba(25,185,255,.35)}
.v26-summary-list{margin-top:8px}.v26-summary-list>div{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 2px;border-bottom:1px solid rgba(83,144,171,.13)}.v26-summary-list i{width:20px;height:20px;padding:2px;filter:drop-shadow(0 0 6px currentColor)}.v26-summary-list span{font-size:8px;color:#d5e6ef}.v26-summary-list strong{font-size:9px;color:currentColor}.v26-summary-list .solar{color:#72ed8d}.v26-summary-list .inverter{color:#4b9fff}.v26-summary-list .micro{color:#ffb34e}.v26-summary-list .house{color:#ff6685}.v26-summary-list .import{color:#61bdff}.v26-summary-list .export{color:#49cfff}.v26-summary-list .balance{color:#56ee8d}.v26-summary-foot{display:flex;justify-content:space-between;padding-top:10px}.v26-summary-foot span{font-size:8px;color:#a4bdcb}.v26-summary-foot strong{font-size:10px;color:#62ef93}

/* analytics */
.v26-analytics{display:grid;grid-template-columns:1.05fr 1.05fr 1.12fr .72fr;gap:9px}.v26-chart-card{min-width:0;padding:10px 11px;border:1px solid var(--v26edge);border-radius:10px;background:linear-gradient(145deg,rgba(3,18,29,.72),rgba(1,10,17,.84));box-shadow:0 10px 28px rgba(0,0,0,.18)}.v26-chart-card header{min-height:54px;display:flex;justify-content:space-between;align-items:flex-start}.v26-chart-card header>div>span{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:800}.v26-chart-card header svg{width:18px;height:18px}.v26-chart-card header>div>strong{display:block;margin-top:4px;font-size:23px}.v26-small-legend{display:flex!important;align-items:center;gap:6px!important;padding-top:4px;font-size:7px!important;color:#c6d9e3}.v26-small-legend i,.v26-legend i{display:inline-block;width:8px;height:8px;border-radius:50%}.v26-small-legend .green,.v26-legend .green i{background:#6df397}.v26-small-legend .blue,.v26-legend .blue i{background:#4aa1ff}.v26-small-legend .orange,.v26-legend .orange i{background:#ffb24d}
.v26-peak{min-width:105px;padding:7px 10px;text-align:center;border:1px solid rgba(255,87,119,.36);border-radius:8px;background:rgba(35,8,19,.55);color:#ff6685}.v26-peak span{display:block;font-size:7px;font-weight:900}.v26-peak strong{display:block;margin-top:2px;font-size:16px}.v26-peak small{display:block;margin-top:1px;font-size:7px;color:#d6b6bf}
.v26-chart{height:190px}.v26-chart svg{width:100%;height:166px;overflow:visible}.v26-grid-h{stroke:rgba(77,132,159,.20);stroke-width:1}.v26-grid-v{stroke:rgba(75,126,151,.14);stroke-width:1}.v26-ylabel,.v26-xlabel{fill:#a9c0cd;font-size:12px}.v26-line{fill:none;stroke-width:2.4;vector-effect:non-scaling-stroke}.v26-line.green{stroke:#6df397}.v26-line.blue{stroke:#4aa1ff}.v26-line.orange{stroke:#ffb24d}.v26-area{stroke:none;opacity:.16}.v26-area.green{fill:#6df397}.v26-area.blue{fill:#4aa1ff}.v26-area.orange{fill:#ffb24d}.v26-bar.red{fill:#ff5d79;filter:drop-shadow(0 0 3px rgba(255,93,121,.55))}.v26-zero{stroke:rgba(124,184,211,.45);stroke-width:1}.v26-gridbar.import{fill:#ffad45}.v26-gridbar.export{fill:#28c8ff}.v26-legend{display:flex;gap:12px;align-items:center;margin-top:1px;padding-left:44px;font-size:8px;color:#c4d8e3}.v26-legend span{display:flex;align-items:center;gap:5px}.v26-legend .red i{background:#ff5d79}.v26-legend .cyan i{background:#28c8ff}
.v26-chart-card.exchange header strong{display:flex!important;gap:22px}.v26-chart-card.exchange header b{color:#ffad45}.v26-chart-card.exchange header i{color:#35d1ff;font-style:normal}.v26-chart-card.gauge{text-align:center}.v26-chart-card.gauge header{min-height:35px}.v26-chart-card.gauge>small{display:block;margin-top:-3px;color:#b5cbd7;font-size:8px;line-height:1.4}.v26-gauge{position:relative;width:155px;height:155px;margin:0 auto}.v26-gauge svg{width:100%;height:100%;transform:rotate(-90deg)}.v26-gauge-orbit{fill:none;stroke:rgba(43,174,229,.36);stroke-width:1}.v26-gauge-bg{fill:none;stroke:#142531;stroke-width:11}.v26-gauge-fg{fill:none;stroke:#79f19a;stroke-width:11;stroke-linecap:round;filter:drop-shadow(0 0 7px rgba(121,241,154,.55))}.v26-gauge>div{position:absolute;inset:0;display:grid;place-content:center}.v26-gauge strong{font-size:30px}.v26-gauge span{margin-top:3px;font-size:6px;color:#91acbb}

/* lower cards */
.v26-lower{display:grid;grid-template-columns:1.12fr 1fr 1.05fr .9fr;gap:9px}.v26-lower-card{min-width:0;padding:10px 12px;border:1px solid var(--v26edge);border-radius:10px;background:linear-gradient(145deg,rgba(3,18,29,.72),rgba(1,10,17,.84));box-shadow:0 10px 26px rgba(0,0,0,.17)}.v26-lower-card header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.v26-lower-card header strong{font-size:10px}.v26-lower-card header button{appearance:none;border:1px solid rgba(43,185,245,.45);border-radius:7px;background:rgba(34,163,224,.08);color:#5bd6ff;padding:4px 9px;font-size:7px}
.v26-consumer{display:grid;grid-template-columns:22px minmax(90px,1fr) minmax(90px,1.2fr) auto 30px;gap:7px;align-items:center;min-height:27px}.v26-consumer>i{width:19px;height:19px;padding:3px;color:#dcebf3}.v26-consumer>span{font-size:8px}.v26-consumer>b,.v26-board>b{height:7px;border-radius:6px;background:#142734;overflow:hidden}.v26-consumer>b u{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff5c7d,#3caeff)}.v26-consumer>strong{font-size:8px}.v26-consumer>em{font-size:7px;color:#a8bdc8;font-style:normal;text-align:right}
.v26-board{display:grid;grid-template-columns:22px minmax(90px,1fr) auto 34px;gap:7px;align-items:center;padding:8px 0}.v26-board i{width:19px;height:19px;padding:3px}.v26-board span,.v26-board strong{font-size:8px}.v26-board em{font-size:7px;color:#a9bdc9;font-style:normal;text-align:right}.v26-board>b{grid-column:2/-1}.v26-board>b u{display:block;height:100%;border-radius:inherit}.v26-board.qd1{color:#46b9ff}.v26-board.qd1 b u{background:linear-gradient(90deg,#a44bff,#d848ef)}.v26-board.qd2{color:#45d9e8}.v26-board.qd2 b u{background:linear-gradient(90deg,#28c9ff,#47e5ca)}.v26-board.qgs{color:#ffad45}.v26-board.qgs b u{background:#ffad45}
.v26-status-row,.v26-lower-card.indicators>div{display:grid;grid-template-columns:22px minmax(0,1fr) auto 34px 14px;gap:7px;align-items:center;min-height:28px;border-bottom:1px solid rgba(82,143,170,.12)}.v26-status-row i,.v26-lower-card.indicators i{width:18px;height:18px;padding:3px;color:#66ee8d}.v26-status-row span,.v26-lower-card.indicators span{font-size:8px}.v26-status-row b{width:8px;height:8px;border-radius:50%}.v26-status-row b.ok{background:#4aec82;box-shadow:0 0 8px #4aec82}.v26-status-row b.bad{background:#ff5d79}.v26-status-row strong{font-size:8px;color:#63ef8e}.v26-status-row em,.v26-lower-card.indicators em{font-style:normal;color:#87aabc;font-size:12px}.v26-lower-card.indicators>div{grid-template-columns:22px minmax(0,1fr) auto 14px}.v26-lower-card.indicators i{color:#56cbff}.v26-lower-card.indicators strong{font-size:8px}

/* Secondary tabs: one coherent premium language without changing their logic */
.energy-v26 .tab-intro,.energy-v26 .panel,.energy-v26 .hero-kpi,.energy-v26 .device-row,.energy-v26 .status-row,.energy-v26 .analysis-cards>div,.energy-v26 .compare-ledger>div{border-radius:10px!important;background:radial-gradient(circle at 12% 0,rgba(39,142,190,.07),transparent 30%),linear-gradient(145deg,rgba(3,18,29,.74),rgba(1,10,17,.84))!important;border-color:rgba(55,158,210,.28)!important;box-shadow:0 9px 26px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.025)!important}.energy-v26 .tab-intro-copy strong{font-size:21px!important}.energy-v26 .section-head strong{font-size:15px!important}.energy-v26 .section-head span{font-size:8px!important}.energy-v26 .device-name strong{font-size:9px!important}.energy-v26 .device-name small{font-size:7px!important}.energy-v26 .device-energy strong{font-size:9px!important}

/* tablet */
@media(max-width:1450px) and (min-width:651px){
  .v26-kpis{grid-template-columns:repeat(4,1fr)}
  .v26-hero-grid{grid-template-columns:minmax(0,3.6fr) minmax(245px,1fr)}
  .v26-scene{height:315px}.v26-scene .asset-house{width:45%!important}
  .v26-analytics,.v26-lower{grid-template-columns:1fr 1fr}
}

/* mobile */
@media(max-width:650px){
  .v26-kpis{grid-template-columns:repeat(2,1fr);gap:6px}.v26-kpis article{min-height:98px;grid-template-columns:34px 1fr;padding:9px}.v26-kpis article>i{width:31px;height:31px;padding:5px}.v26-kpis span{font-size:6px}.v26-kpis strong{font-size:18px}.v26-kpis small,.v26-kpis em{font-size:5.4px}
  .v26-hero-grid{grid-template-columns:1fr}.v26-flow-head{height:52px;padding:8px 9px}.v26-flow-head strong{font-size:10px}.v26-flow-head small{font-size:5.5px}.v26-scene{height:365px}
  .v26-scene .asset-house{left:50%!important;bottom:0!important;width:63%!important;max-height:61%!important}.v26-scene .asset-solar{left:-4%!important;bottom:0!important;width:27%!important;max-height:34%!important}.v26-scene .asset-grid{right:-2%!important;bottom:0!important;width:22%!important;max-height:50%!important}
  .v26-shield{left:50%;top:70%;width:195px;height:195px}
  .v26-source{width:40%;grid-template-columns:28px 1fr;padding:7px;gap:6px}.v26-source>i{width:25px;height:25px;padding:4px}.v26-source span{font-size:5.5px}.v26-source strong{font-size:13px}.v26-source small{font-size:5px}.v26-inverter{left:3%;top:10%}.v26-micro{left:3%;top:28%}
  .v26-solar-total{left:32%;top:47%;min-width:72px;padding:5px 6px}.v26-solar-total strong{font-size:12px}.v26-solar-total span{font-size:5px}
  .v26-house-meter{left:50%;bottom:0;width:126px;height:72px;padding:19px 8px 6px}.v26-house-meter strong{font-size:19px}.v26-house-meter span{font-size:5.5px}.v26-house-meter small{font-size:5px}
  .v26-grid-meter{right:3%;min-width:88px;padding:6px}.v26-grid-meter.import{top:12%}.v26-grid-meter.export{top:31%}.v26-grid-meter strong{font-size:13px}.v26-grid-meter span{font-size:5.5px}.v26-grid-label{right:2%;bottom:2%}
  .v26-flow-svg{opacity:.88}.v26-rail{stroke-width:2.2}
  .v26-summary{display:none}
  .v26-analytics,.v26-lower{grid-template-columns:1fr}.v26-chart-card{min-height:250px}.v26-chart{height:200px}.v26-chart svg{height:178px}.v26-gauge{width:145px;height:145px}
}



/* ==========================================================================
   V54.0.0 — refinamento solicitado 08/09/2026
   ========================================================================== */
.energy-v27{--v27edge:rgba(65,156,204,.30)}
.energy-v27 .v26-kpis{grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}
.energy-v27 .v26-kpis article{min-height:116px;padding:12px 11px;grid-template-columns:42px minmax(0,1fr)}
.energy-v27 .v26-kpis .peak{color:#ff6685}
.energy-v27 .v26-kpis .peak>i{animation:v27Peak 2.4s ease-in-out infinite}
@keyframes v27Peak{50%{transform:scale(1.07);filter:drop-shadow(0 0 9px currentColor)}}

/* hero: free the solar asset, enlarge the information nodes and close visual gaps */
.energy-v27 .v26-scene{height:350px}
.energy-v27 .v26-scene .asset-solar{left:-1.5%!important;width:17.5%!important;max-height:70%!important}
.energy-v27 .v26-inverter{left:7.2%;top:10%;width:222px}
.energy-v27 .v26-micro{left:7.2%;top:57%;width:222px}
.energy-v27 .v26-source{padding:12px 13px;grid-template-columns:46px 1fr}
.energy-v27 .v26-source>i{width:42px;height:42px}
.energy-v27 .v26-source span{font-size:9px}.energy-v27 .v26-source strong{font-size:24px}.energy-v27 .v26-source small{font-size:8px}
.energy-v27 .v26-solar-total{left:27%;top:40%;min-width:132px;padding:10px 14px}
.energy-v27 .v26-solar-total strong{font-size:23px}.energy-v27 .v26-solar-total span{font-size:8px}
.energy-v27 .v26-grid-meter{right:14.5%;min-width:142px;padding:10px 13px}
.energy-v27 .v26-grid-meter strong{font-size:22px}.energy-v27 .v26-grid-meter span{font-size:8px}
.energy-v27 .v26-rail{stroke-width:3.2;filter:none}
.energy-v27 .v26-rail.solar{stroke:#6de995}.energy-v27 .v26-rail.import{stroke:#f3ad4e}.energy-v27 .v26-rail.export{stroke:#43c7eb}
.energy-v27 .v26-particle{filter:none}

/* chart readability: no neon on axes, larger labels */
.energy-v27 .v26-chart-card{padding:12px 13px}
.energy-v27 .v26-chart-card header>div>span{font-size:11px}
.energy-v27 .v26-chart-card header>div>strong{font-size:25px}
.energy-v27 .v26-small-legend{font-size:9px!important;gap:9px!important}
.energy-v27 .v26-chart{height:205px}
.energy-v27 .v26-chart svg{height:178px}
.energy-v27 .v26-grid-h{stroke:rgba(111,150,170,.17)}
.energy-v27 .v26-grid-v{stroke:rgba(111,150,170,.12)}
.energy-v27 .v26-ylabel,.energy-v27 .v26-xlabel{fill:#c2d3dc;font-size:14px;text-shadow:none;filter:none}
.energy-v27 .v26-line{stroke-width:1.8;filter:none}
.energy-v27 .v26-area{opacity:.09;filter:none}
.energy-v27 .v26-bar.red,.energy-v27 .v26-gridbar{filter:none}
.energy-v27 .v26-legend{font-size:10px;gap:16px;color:#d7e5ec}

/* lower cards: explicitly readable on desktop */
.energy-v27 .v26-lower-card{padding:13px 14px;min-height:190px}
.energy-v27 .v26-lower-card header strong{font-size:12px}
.energy-v27 .v26-lower-card header button{font-size:9px}
.energy-v27 .v26-consumer{grid-template-columns:27px minmax(120px,1fr) minmax(100px,1.2fr) auto 34px;min-height:31px}
.energy-v27 .v26-consumer>i{width:23px;height:23px}
.energy-v27 .v26-consumer>span,.energy-v27 .v26-consumer>strong{font-size:10px}
.energy-v27 .v26-consumer>em{font-size:9px}
.energy-v27 .v26-board{grid-template-columns:27px minmax(120px,1fr) auto 38px;min-height:43px}
.energy-v27 .v26-board i{width:23px;height:23px}
.energy-v27 .v26-board span,.energy-v27 .v26-board strong{font-size:10px}.energy-v27 .v26-board em{font-size:9px}
.energy-v27 .v26-status-row,.energy-v27 .v26-lower-card.indicators>div{min-height:32px}
.energy-v27 .v26-status-row i,.energy-v27 .v26-lower-card.indicators i{width:22px;height:22px}
.energy-v27 .v26-status-row span,.energy-v27 .v26-status-row strong,.energy-v27 .v26-lower-card.indicators span,.energy-v27 .v26-lower-card.indicators strong{font-size:10px}

/* Rede elétrica: stabilize layout and avoid inherited V25 positioning */
.energy-v27 .grid-network{display:grid!important;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)!important;gap:10px!important;align-items:stretch!important}
.energy-v27 .network-card{min-height:390px!important}
.energy-v27 .network-flow{display:grid!important;grid-template-columns:180px minmax(220px,1fr) 180px!important;align-items:center!important;gap:20px!important;min-height:230px!important;padding:24px!important}
.energy-v27 .network-node{position:relative!important;inset:auto!important;transform:none!important;width:auto!important;min-height:150px!important}
.energy-v27 .network-lines{position:relative!important;inset:auto!important;transform:none!important;display:grid!important;gap:26px!important}
.energy-v27 .net-line{position:relative!important;inset:auto!important;transform:none!important;width:100%!important;min-height:48px!important}
.energy-v27 .balance-banner{position:relative!important;inset:auto!important;transform:none!important;margin:8px 24px 20px!important}

/* Historic tab: remove excessive glow */
.energy-v27 .history-screen .chart-svg path,.energy-v27 .history-screen .chart-svg polyline,
.energy-v27 .history-screen .line,.energy-v27 .history-screen .area{filter:none!important;text-shadow:none!important}
.energy-v27 .history-screen .gridline{stroke:rgba(100,146,170,.16)!important}
.energy-v27 .history-screen .gridtext,.energy-v27 .history-screen .hour-ruler{filter:none!important;text-shadow:none!important}

/* global range buttons: clearer active state */
.energy-v27 .quick-v14 button{min-width:54px;font-size:9px}
.energy-v27 .quick-v14 button.active{background:linear-gradient(180deg,rgba(32,184,242,.28),rgba(12,91,132,.20));box-shadow:inset 0 0 0 1px rgba(79,214,255,.75);color:#e9fbff}

@media(max-width:1450px) and (min-width:651px){
 .energy-v27 .v26-kpis{grid-template-columns:repeat(4,1fr)}
 .energy-v27 .grid-network{grid-template-columns:1fr!important}
}
@media(max-width:650px){
 .energy-v27 .v26-kpis{grid-template-columns:repeat(2,1fr)}
 .energy-v27 .v26-scene{height:390px}
 .energy-v27 .v26-inverter{left:3%;top:7%;width:43%}
 .energy-v27 .v26-micro{left:3%;top:25%;width:43%}
 .energy-v27 .v26-solar-total{left:31%;top:45%;min-width:88px}
 .energy-v27 .v26-grid-meter{right:3%;min-width:94px}
 .energy-v27 .grid-network{grid-template-columns:1fr!important}
 .energy-v27 .network-flow{grid-template-columns:1fr!important;gap:10px!important;padding:12px!important}
 .energy-v27 .network-node{min-height:95px!important}
 .energy-v27 .v26-lower-card{min-height:unset}
}


/* ==========================================================================
   V54.0.0 — CORREÇÕES FUNCIONAIS + LEGIBILIDADE
   ========================================================================== */
.energy-v28 .v26-kpis{grid-template-columns:repeat(8,minmax(0,1fr))}
.energy-v28 .v26-kpis article{min-height:118px}
.energy-v28 .v26-kpis span{font-size:9.3px}
.energy-v28 .v26-kpis strong{font-size:29px}
.energy-v28 .v26-kpis small{font-size:8px}

/* HERO: cards out of the solar asset, larger nodes */
.energy-v28 .v26-scene{height:365px}
.energy-v28 .v26-scene .asset-solar{left:-1.5%!important;width:16.5%!important;max-height:68%!important}
.energy-v28 .v26-inverter{left:17.2%;top:10%;width:230px}
.energy-v28 .v26-micro{left:17.2%;top:57%;width:230px}
.energy-v28 .v26-source{padding:12px 14px;grid-template-columns:46px 1fr}
.energy-v28 .v26-source>i{width:42px;height:42px}
.energy-v28 .v26-source span{font-size:9px}.energy-v28 .v26-source strong{font-size:25px}.energy-v28 .v26-source small{font-size:8px}
.energy-v28 .v26-solar-total{left:35%;top:40%;min-width:152px;padding:11px 16px}
.energy-v28 .v26-solar-total strong{font-size:25px}.energy-v28 .v26-solar-total span{font-size:9px}
.energy-v28 .v26-grid-meter{right:14%;min-width:158px;padding:11px 15px}
.energy-v28 .v26-grid-meter strong{font-size:23px}.energy-v28 .v26-grid-meter span{font-size:9px}
.energy-v28 .v26-grid-meter.import{top:27%}.energy-v28 .v26-grid-meter.export{top:61%}
.energy-v28 .v26-flow-svg{z-index:7}
.energy-v28 .v26-rail{stroke-width:3.1;filter:none}
.energy-v28 .v26-particle{filter:none}

/* Main charts: readable scales, no neon */
.energy-v28 .v26-chart-card{padding:13px 14px}
.energy-v28 .v26-chart-card header>div>span{font-size:11.5px}
.energy-v28 .v26-chart-card header>div>strong{font-size:25px}
.energy-v28 .v26-small-legend{font-size:10px!important}
.energy-v28 .v26-chart{height:215px}
.energy-v28 .v26-chart svg{height:188px}
.energy-v28 .v26-ylabel,.energy-v28 .v26-xlabel{fill:#cbd9e0!important;font-size:14px!important;filter:none!important;text-shadow:none!important}
.energy-v28 .v26-grid-h{stroke:rgba(118,153,170,.16)!important}
.energy-v28 .v26-grid-v{stroke:rgba(118,153,170,.10)!important}
.energy-v28 .v26-line{stroke-width:1.7!important;filter:none!important}
.energy-v28 .v26-area{opacity:.07!important;filter:none!important}
.energy-v28 .v26-bar,.energy-v28 .v26-gridbar{filter:none!important}
.energy-v28 .v28-legend{font-size:10px!important;gap:17px!important;color:#d9e6ec!important}
.energy-v28 .v28-legend i{box-shadow:none!important}

/* Generic charts used by Consumption / Grid / History */
.energy-v28 .chart-v28{height:320px!important}
.energy-v28 .chart-v28 .chart-viewport{height:275px!important;overflow:visible!important}
.energy-v28 .chart-v28 svg{height:275px!important;min-width:0!important}
.energy-v28 .chart-v28 .gridline{filter:none!important;box-shadow:none!important}
.energy-v28 .chart-v28 .gridline-h{stroke:rgba(120,154,171,.17)!important}
.energy-v28 .chart-v28 .gridline-v{stroke:rgba(120,154,171,.11)!important}
.energy-v28 .chart-v28 .gridtext,.energy-v28 .chart-time-label{fill:#c7d8e0!important;font-size:13px!important;filter:none!important;text-shadow:none!important}
.energy-v28 .chart-v28 .trend{stroke-width:1.8!important;filter:none!important}
.energy-v28 .chart-legend-v28{margin-top:5px!important;padding-left:58px!important;gap:18px!important}
.energy-v28 .chart-legend-v28 span,.energy-v28 .chart-legend-v28 strong{font-size:10px!important}
.energy-v28 .chart-legend-v28 i{width:9px!important;height:9px!important;box-shadow:none!important}

/* Consumption tab — remove inherited glow */
.energy-v28 .consumption-grid .panel{box-shadow:0 10px 26px rgba(0,0,0,.15)!important}
.energy-v28 .consumption-grid .trend,.energy-v28 .consumption-grid .gridline{filter:none!important}
.energy-v28 .consumption-grid .chart-legend{filter:none!important}

/* REDE tab: assets + clean chart */
.energy-v28 .asset-node{overflow:hidden!important;padding:8px!important}
.energy-v28 .asset-node img{display:block;width:100%;height:105px;object-fit:contain;filter:brightness(.88) saturate(.88) drop-shadow(0 5px 12px rgba(0,0,0,.42))}
.energy-v28 .asset-node.house img{transform:scale(1.34)}
.energy-v28 .asset-node.copel img{transform:scale(1.16)}
.energy-v28 .asset-node strong{position:relative;z-index:2}
.energy-v28 .asset-node span{position:relative;z-index:2}
.energy-v28 .grid-network .trend,.energy-v28 .grid-network .gridline{filter:none!important}
.energy-v28 .grid-network .chart-legend{filter:none!important}

/* History: no glow, legend stays below time axis */
.energy-v28 .history-main .trend,.energy-v28 .history-main .gridline{filter:none!important;text-shadow:none!important}
.energy-v28 .history-main .chart-legend-v28{margin-top:10px!important;padding-top:6px!important;border-top:1px solid rgba(100,150,174,.12)!important}

/* CONFIG readability */
.energy-v28 .status-panel{padding:16px!important}
.energy-v28 .status-panel .section-head span{font-size:10px!important}
.energy-v28 .status-panel .section-head strong{font-size:19px!important}
.energy-v28 .status-panel .section-head small{font-size:10px!important}
.energy-v28 .status-grid{gap:8px!important}
.energy-v28 .status-row{min-height:52px!important;padding:10px 13px!important}
.energy-v28 .status-row span{font-size:11px!important}
.energy-v28 .status-row strong{font-size:10px!important}
.energy-v28 .status-row small{font-size:9px!important;line-height:1.3!important}
.energy-v28 .tab-intro-copy span{font-size:9px!important}
.energy-v28 .tab-intro-copy strong{font-size:23px!important}
.energy-v28 .tab-intro-copy small{font-size:10px!important}

/* Filter status */
.energy-v28 .quick-v14 button{font-size:9.5px!important;min-width:58px!important}
.energy-v28 .quick-v14 button.active{color:#effcff!important;background:linear-gradient(180deg,rgba(30,183,243,.28),rgba(8,92,137,.24))!important;border-color:#49d8ff!important}
.energy-v28 .period-active strong{font-size:10px!important}
.energy-v28 .period-active small{font-size:7px!important}

/* Lower cards remain readable */
.energy-v28 .v26-lower-card header strong{font-size:12px}
.energy-v28 .v26-consumer>span,.energy-v28 .v26-consumer>strong,.energy-v28 .v26-board span,.energy-v28 .v26-board strong,.energy-v28 .v26-status-row span,.energy-v28 .v26-status-row strong,.energy-v28 .v26-lower-card.indicators span,.energy-v28 .v26-lower-card.indicators strong{font-size:10px!important}

@media(max-width:1450px) and (min-width:651px){
  .energy-v28 .v26-kpis{grid-template-columns:repeat(4,1fr)}
  .energy-v28 .v26-inverter,.energy-v28 .v26-micro{left:15%;width:205px}
  .energy-v28 .v26-solar-total{left:35%;min-width:125px}
}
@media(max-width:650px){
  .energy-v28 .v26-kpis{grid-template-columns:repeat(2,1fr)}
  .energy-v28 .v26-scene{height:405px}
  .energy-v28 .v26-scene .asset-solar{left:-4%!important;width:24%!important;max-height:31%!important}
  .energy-v28 .v26-inverter{left:4%;top:7%;width:44%}
  .energy-v28 .v26-micro{left:4%;top:26%;width:44%}
  .energy-v28 .v26-source span{font-size:6px}.energy-v28 .v26-source strong{font-size:14px}.energy-v28 .v26-source small{font-size:5.3px}
  .energy-v28 .v26-solar-total{left:33%;top:46%;min-width:91px;padding:6px 8px}
  .energy-v28 .v26-solar-total strong{font-size:14px}.energy-v28 .v26-solar-total span{font-size:5.5px}
  .energy-v28 .v26-grid-meter{right:3%;min-width:102px;padding:7px}
  .energy-v28 .v26-grid-meter strong{font-size:14px}.energy-v28 .v26-grid-meter span{font-size:5.5px}
  .energy-v28 .v26-grid-meter.import{top:10%}.energy-v28 .v26-grid-meter.export{top:29%}
  .energy-v28 .v26-flow-svg{opacity:.80}
  .energy-v28 .v26-rail{stroke-width:2.2}
  .energy-v28 .chart-v28{height:300px!important}
  .energy-v28 .chart-v28 .chart-viewport,.energy-v28 .chart-v28 svg{height:250px!important}
  .energy-v28 .chart-legend-v28{padding-left:0!important;flex-wrap:wrap!important}
  .energy-v28 .status-row span{font-size:10px!important}
}


/* ==========================================================================
   V54.0.0 — HERO ALIGNMENT + GLOBAL GRAPH GLOW REDUCTION + REDE REBUILD
   ========================================================================== */

/* 1) HERO CARDS: same visual scale */
.energy-v29 .v26-source,
.energy-v29 .v26-solar-total,
.energy-v29 .v26-grid-meter{
  min-height:74px!important;
  box-sizing:border-box!important;
}

/* Inverter/Micro same visual footprint as Geração Total */
.energy-v29 .v26-inverter,
.energy-v29 .v26-micro{
  left:16.4%!important;
  width:205px!important;
  min-width:205px!important;
  padding:10px 12px!important;
  grid-template-columns:38px 1fr!important;
}
.energy-v29 .v26-source>i{width:34px!important;height:34px!important;padding:6px!important}
.energy-v29 .v26-source span{font-size:8.2px!important}
.energy-v29 .v26-source strong{font-size:20px!important}
.energy-v29 .v26-source small{font-size:7px!important}

/* Geração Total moved left so it no longer sits over the house */
.energy-v29 .v26-solar-total{
  left:32.3%!important;
  top:40%!important;
  min-width:138px!important;
  padding:10px 13px!important;
}
.energy-v29 .v26-solar-total strong{font-size:22px!important}
.energy-v29 .v26-solar-total span{font-size:8px!important}

/* Import / Export centered between house and tower */
.energy-v29 .v26-grid-meter{
  right:21.7%!important;
  min-width:145px!important;
  padding:10px 13px!important;
}
.energy-v29 .v26-grid-meter strong{font-size:21px!important}
.energy-v29 .v26-grid-meter span{font-size:8px!important}
.energy-v29 .v26-grid-meter.import{top:28%!important}
.energy-v29 .v26-grid-meter.export{top:61%!important}

/* 2) GLOBAL GRAPH GLOW REDUCTION — ALL TABS */
.energy-v29 .trend,
.energy-v29 .v26-line,
.energy-v29 .v26-area,
.energy-v29 .v26-bar,
.energy-v29 .v26-gridbar,
.energy-v29 .gridline,
.energy-v29 .v26-grid-h,
.energy-v29 .v26-grid-v,
.energy-v29 .chart-legend i,
.energy-v29 .v26-legend i,
.energy-v29 .chart-time-label,
.energy-v29 .gridtext,
.energy-v29 .v26-xlabel,
.energy-v29 .v26-ylabel{
  filter:none!important;
  text-shadow:none!important;
  box-shadow:none!important;
}

/* reduce saturation/glow in all chart-containing panels */
.energy-v29 .chart-box,
.energy-v29 .v26-chart,
.energy-v29 .history-main,
.energy-v29 .consumption-grid .panel,
.energy-v29 .grid-network .panel,
.energy-v29 .analytics-screen .panel,
.energy-v29 .history-screen .panel{
  filter:saturate(.86)!important;
}

/* softer graph colors */
.energy-v29 .v26-line.green{stroke:#6ccf8e!important}
.energy-v29 .v26-line.blue{stroke:#5d9ed0!important}
.energy-v29 .v26-line.orange{stroke:#d8a15b!important}
.energy-v29 .trend.red{stroke:#d86b7d!important}
.energy-v29 .trend.cyan{stroke:#5eb7cc!important}
.energy-v29 .trend.blue{stroke:#6596c8!important}
.energy-v29 .trend.orange{stroke:#cf9b5e!important}
.energy-v29 .trend.green{stroke:#71c98b!important}
.energy-v29 .trend.purple{stroke:#a17ab8!important}
.energy-v29 .v26-bar.red{fill:#d8637a!important}
.energy-v29 .v26-gridbar.import{fill:#d9a05b!important}
.energy-v29 .v26-gridbar.export{fill:#4daac6!important}

/* axes / labels more readable and less luminous */
.energy-v29 .v26-ylabel,
.energy-v29 .v26-xlabel,
.energy-v29 .gridtext,
.energy-v29 .chart-time-label{
  fill:#c8d6dd!important;
  font-size:14px!important;
  font-weight:600!important;
}
.energy-v29 .v26-grid-h,
.energy-v29 .gridline-h{stroke:rgba(132,156,169,.15)!important}
.energy-v29 .v26-grid-v,
.energy-v29 .gridline-v{stroke:rgba(132,156,169,.09)!important}
.energy-v29 .v26-zero{stroke:rgba(152,178,190,.27)!important}

/* legend sizes */
.energy-v29 .v28-legend,
.energy-v29 .chart-legend-v28,
.energy-v29 .chart-legend{
  font-size:11px!important;
  color:#d6e0e5!important;
}
.energy-v29 .v28-legend span,
.energy-v29 .chart-legend-v28 span,
.energy-v29 .chart-legend span,
.energy-v29 .chart-legend-v28 strong{
  font-size:11px!important;
}
.energy-v29 .v28-legend i,
.energy-v29 .chart-legend i{
  width:8px!important;
  height:8px!important;
  box-shadow:none!important;
}

/* all chart panels a little calmer */
.energy-v29 .v26-chart-card,
.energy-v29 .panel:has(.chart-box),
.energy-v29 .panel:has(.chart-svg){
  box-shadow:0 10px 24px rgba(0,0,0,.12)!important;
}

/* 3) REDE TAB — fully rebuilt scene */
.energy-v29 .v29-network-card{
  min-height:430px!important;
  padding:14px!important;
}
.energy-v29 .v29-network-scene{
  display:grid!important;
  grid-template-columns:minmax(240px,1fr) minmax(340px,1.35fr) minmax(220px,.95fr)!important;
  align-items:center!important;
  gap:28px!important;
  min-height:300px!important;
  padding:18px 30px 14px!important;
  border-radius:12px!important;
  background:
    radial-gradient(circle at 50% 40%,rgba(37,107,139,.08),transparent 32%),
    linear-gradient(180deg,rgba(2,13,22,.28),rgba(2,10,17,.06))!important;
}
.energy-v29 .v29-net-node{
  min-width:0!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:8px!important;
}
.energy-v29 .v29-net-node img{
  width:100%!important;
  height:180px!important;
  object-fit:contain!important;
  filter:brightness(.88) saturate(.86) drop-shadow(0 10px 16px rgba(0,0,0,.42))!important;
}
.energy-v29 .v29-net-node.house img{transform:scale(1.10)!important}
.energy-v29 .v29-net-node.copel img{transform:scale(1.02)!important}
.energy-v29 .v29-net-node>div{text-align:center!important}
.energy-v29 .v29-net-node strong{display:block!important;font-size:14px!important}
.energy-v29 .v29-net-node span{display:block!important;margin-top:3px!important;font-size:11px!important;color:#a9bfca!important}

.energy-v29 .v29-net-flow{
  display:grid!important;
  gap:34px!important;
}
.energy-v29 .v29-net-line{
  position:relative!important;
  min-height:72px!important;
  display:grid!important;
  grid-template-columns:1fr auto!important;
  align-items:center!important;
  padding:10px 18px!important;
  border-radius:12px!important;
  background:rgba(3,18,29,.66)!important;
  border:1px solid rgba(70,153,192,.20)!important;
  overflow:hidden!important;
}
.energy-v29 .v29-net-line:after{
  content:""!important;
  position:absolute!important;
  left:18px!important;
  right:18px!important;
  bottom:14px!important;
  height:2px!important;
  border-radius:2px!important;
  background:currentColor!important;
  opacity:.62!important;
}
.energy-v29 .v29-net-line.import{color:#d8a05b!important}
.energy-v29 .v29-net-line.export{color:#54b8d1!important}
.energy-v29 .v29-net-line.idle{opacity:.38!important}
.energy-v29 .v29-net-line span{font-size:10px!important;font-weight:800!important}
.energy-v29 .v29-net-line strong{font-size:20px!important}
.energy-v29 .v29-net-line i{
  position:absolute!important;
  bottom:10px!important;
  width:10px!important;
  height:10px!important;
  border-radius:50%!important;
  background:currentColor!important;
  box-shadow:none!important;
  animation:v29NetMove 3.8s linear infinite!important;
}
.energy-v29 .v29-net-line.export i{animation-direction:reverse!important}
@keyframes v29NetMove{
  from{left:18px}
  to{left:calc(100% - 28px)}
}

.energy-v29 .v29-net-balance{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto auto!important;
  gap:12px!important;
  align-items:center!important;
  margin-top:8px!important;
  padding:12px 14px!important;
  border:1px solid rgba(64,149,190,.22)!important;
  border-radius:10px!important;
  background:rgba(3,16,25,.48)!important;
}
.energy-v29 .v29-net-balance span{font-size:10px!important;color:#a8bec9!important}
.energy-v29 .v29-net-balance strong{font-size:19px!important;color:#eef8fc!important}
.energy-v29 .v29-net-balance small{font-size:9px!important;color:#8eabb9!important}

/* REDE graph: much less bright */
.energy-v29 .grid-screen .trend,
.energy-v29 .grid-screen .v26-bar,
.energy-v29 .grid-screen .v26-gridbar{
  filter:none!important;
  opacity:.86!important;
}
.energy-v29 .grid-screen .chart-legend i{box-shadow:none!important}

/* 4) HISTORY — further reduce brightness */
.energy-v29 .history-screen .trend,
.energy-v29 .history-screen .v26-line,
.energy-v29 .history-screen .v26-area,
.energy-v29 .history-screen .v26-bar{
  filter:none!important;
  opacity:.84!important;
}
.energy-v29 .history-screen .v26-area{opacity:.045!important}
.energy-v29 .history-screen .chart-legend i,
.energy-v29 .history-screen .v26-legend i{
  box-shadow:none!important;
}

/* 5) CONFIG — make everything comfortably readable */
.energy-v29 .status-screen .tab-intro{min-height:104px!important}
.energy-v29 .status-screen .tab-intro-copy span{font-size:10px!important}
.energy-v29 .status-screen .tab-intro-copy strong{font-size:25px!important}
.energy-v29 .status-screen .tab-intro-copy small{font-size:11px!important}
.energy-v29 .status-screen .status-panel{padding:18px!important}
.energy-v29 .status-screen .section-head span{font-size:11px!important}
.energy-v29 .status-screen .section-head strong{font-size:20px!important}
.energy-v29 .status-screen .section-head small{font-size:11px!important}
.energy-v29 .status-screen .status-row{
  min-height:58px!important;
  padding:11px 14px!important;
  gap:10px!important;
}
.energy-v29 .status-screen .status-row span{font-size:12px!important}
.energy-v29 .status-screen .status-row strong{font-size:11px!important}
.energy-v29 .status-screen .status-row small{font-size:10px!important;line-height:1.35!important}
.energy-v29 .status-screen .status-row i{width:26px!important;height:26px!important}

/* Tablet */
@media(max-width:1450px) and (min-width:651px){
  .energy-v29 .v26-kpis{grid-template-columns:repeat(4,1fr)!important}
  .energy-v29 .v26-inverter,.energy-v29 .v26-micro{left:14%!important;width:185px!important}
  .energy-v29 .v26-solar-total{left:33%!important;min-width:125px!important}
  .energy-v29 .v26-grid-meter{right:18%!important;min-width:125px!important}
  .energy-v29 .v29-network-scene{grid-template-columns:1fr 1.2fr 1fr!important;gap:18px!important;padding:16px!important}
}

/* Mobile */
@media(max-width:650px){
  .energy-v29 .v26-kpis{grid-template-columns:repeat(2,1fr)!important}
  .energy-v29 .v26-inverter,.energy-v29 .v26-micro{
    left:4%!important;width:42%!important;min-width:0!important
  }
  .energy-v29 .v26-solar-total{left:31%!important;top:47%!important;min-width:95px!important}
  .energy-v29 .v26-grid-meter{right:3%!important;min-width:100px!important}
  .energy-v29 .v29-network-scene{grid-template-columns:1fr!important;gap:14px!important;padding:12px!important}
  .energy-v29 .v29-net-node img{height:125px!important}
  .energy-v29 .v29-net-flow{gap:14px!important}
  .energy-v29 .v29-net-line{min-height:64px!important}
  .energy-v29 .status-screen .status-row span{font-size:11px!important}
  .energy-v29 .status-screen .status-row strong{font-size:10px!important}
  .energy-v29 .status-screen .status-row small{font-size:9px!important}
}


/* ==========================================================================
   V54.0.0 — fechamento dos ajustes recorrentes
   ========================================================================== */

.energy-v30 .v26-kpis{
  display:grid!important;
  grid-template-columns:repeat(8,minmax(0,1fr))!important;
  gap:7px!important;
}
.energy-v30 .v26-kpis article{
  min-width:0!important;
  width:auto!important;
  min-height:112px!important;
  padding:11px 10px!important;
  grid-template-columns:38px minmax(0,1fr)!important;
}
.energy-v30 .v26-kpis article>i{width:35px!important;height:35px!important;padding:6px!important}
.energy-v30 .v26-kpis span{font-size:8px!important;white-space:nowrap!important}
.energy-v30 .v26-kpis strong{font-size:24px!important;white-space:nowrap!important}
.energy-v30 .v26-kpis small{font-size:7px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.energy-v30 .v26-kpis em{font-size:6.5px!important;white-space:nowrap!important}

.energy-v30 .v26-inverter,
.energy-v30 .v26-micro,
.energy-v30 .v26-solar-total{
  width:205px!important;
  min-width:205px!important;
  height:76px!important;
  min-height:76px!important;
  box-sizing:border-box!important;
}
.energy-v30 .v26-inverter,
.energy-v30 .v26-micro{
  left:15.5%!important;
  padding:9px 11px!important;
  grid-template-columns:36px 1fr!important;
}
.energy-v30 .v26-source>i{width:32px!important;height:32px!important;padding:5px!important}
.energy-v30 .v26-source span{font-size:7.8px!important}
.energy-v30 .v26-source strong{font-size:19px!important}
.energy-v30 .v26-source small{font-size:6.8px!important}
.energy-v30 .v26-solar-total{
  left:32%!important;
  top:40%!important;
  display:grid!important;
  place-content:center!important;
  padding:8px 10px!important;
}
.energy-v30 .v26-solar-total strong{font-size:22px!important}
.energy-v30 .v26-solar-total span{font-size:7.8px!important}

.energy-v30 .v30-total-home{
  display:block!important;
  opacity:1!important;
  stroke:#6fdf91!important;
  stroke-width:3px!important;
}
.energy-v30 .v26-flow-svg .v26-particle{opacity:.92!important}
.energy-v30 .v26-solar-total:after{
  content:""!important;
  position:absolute!important;
  left:100%!important;
  top:50%!important;
  width:122px!important;
  height:2px!important;
  transform:translateY(-50%)!important;
  background:#6fdf91!important;
  opacity:.68!important;
  pointer-events:none!important;
}
.energy-v30 .v26-solar-total:before{
  content:""!important;
  position:absolute!important;
  left:100%!important;
  top:calc(50% - 4px)!important;
  width:8px!important;
  height:8px!important;
  border-radius:50%!important;
  background:#a1f7bb!important;
  animation:v30SolarReceive 2.25s linear infinite!important;
  pointer-events:none!important;
}
@keyframes v30SolarReceive{
  from{transform:translateX(0)}
  to{transform:translateX(116px)}
}

/* redução forte do neon em TODAS as abas */
.energy-v30 svg text,
.energy-v30 .gridtext,
.energy-v30 .chart-time-label,
.energy-v30 .v26-xlabel,
.energy-v30 .v26-ylabel{
  filter:none!important;
  text-shadow:none!important;
  paint-order:normal!important;
  stroke:none!important;
  fill:#aebfc8!important;
  font-weight:500!important;
  opacity:.88!important;
}
.energy-v30 .gridline,
.energy-v30 .v26-grid-h,
.energy-v30 .v26-grid-v,
.energy-v30 .v26-zero{
  filter:none!important;
  box-shadow:none!important;
}
.energy-v30 .gridline-h,
.energy-v30 .v26-grid-h{stroke:rgba(132,153,164,.12)!important}
.energy-v30 .gridline-v,
.energy-v30 .v26-grid-v{stroke:rgba(132,153,164,.065)!important}
.energy-v30 .trend,
.energy-v30 .v26-line{
  filter:none!important;
  text-shadow:none!important;
  stroke-width:1.55!important;
  opacity:.88!important;
}
.energy-v30 .v26-area{filter:none!important;opacity:.035!important}
.energy-v30 .v26-bar,
.energy-v30 .v26-gridbar{filter:none!important;opacity:.80!important}
.energy-v30 .chart-box,
.energy-v30 .v26-chart{filter:saturate(.73)!important}

.energy-v30 .v26-small-legend{font-size:10.5px!important;gap:9px!important}
.energy-v30 .v26-legend,
.energy-v30 .v28-legend,
.energy-v30 .chart-legend,
.energy-v30 .chart-legend-v28{
  font-size:11px!important;
  color:#cbd7dd!important;
  gap:16px!important;
}
.energy-v30 .v26-legend span,
.energy-v30 .v28-legend span,
.energy-v30 .chart-legend span,
.energy-v30 .chart-legend strong,
.energy-v30 .chart-legend-v28 span,
.energy-v30 .chart-legend-v28 strong{font-size:11px!important}
.energy-v30 .v26-legend i,
.energy-v30 .v28-legend i,
.energy-v30 .chart-legend i{
  width:8px!important;height:8px!important;box-shadow:none!important;filter:none!important;
}
.energy-v30 .v26-ylabel,
.energy-v30 .v26-xlabel,
.energy-v30 .gridtext,
.energy-v30 .chart-time-label{
  font-size:12px!important;
  fill:#9fb1ba!important;
}

.energy-v30 .v29-net-line.import i{
  animation:v29NetMove 3.8s linear infinite reverse!important;
}
.energy-v30 .v29-net-line.export i{
  animation:v29NetMove 3.8s linear infinite normal!important;
}
.energy-v30 .grid-screen .trend,
.energy-v30 .grid-screen .v26-bar,
.energy-v30 .grid-screen .v26-gridbar,
.energy-v30 .grid-screen .chart-box{
  filter:none!important;
  box-shadow:none!important;
}
.energy-v30 .grid-screen .v26-gridbar{opacity:.68!important}

.energy-v30 .history-screen .trend,
.energy-v30 .history-screen .v26-line,
.energy-v30 .history-screen .v26-bar,
.energy-v30 .history-screen .v26-gridbar{
  filter:none!important;
  opacity:.72!important;
}
.energy-v30 .history-screen .v26-area{opacity:.025!important}
.energy-v30 .history-screen .chart-box,
.energy-v30 .history-screen .panel:has(svg){filter:saturate(.68)!important}

.energy-v30 .consumption-grid .trend,
.energy-v30 .consumption-grid .v26-line,
.energy-v30 .consumption-grid .v26-bar{
  filter:none!important;
  opacity:.74!important;
}
.energy-v30 .consumption-grid .chart-box{filter:saturate(.68)!important}

.energy-v30 .period-active strong{font-size:10px!important}
.energy-v30 .period-active small{font-size:7px!important}
.energy-v30 .quick-v14 button.active{
  border-color:#42c7ea!important;
  box-shadow:none!important;
  background:rgba(36,143,185,.18)!important;
}

.energy-v30 .v26-lower-card{
  min-height:196px!important;
  padding:14px 15px!important;
}
.energy-v30 .v26-lower-card header strong{font-size:13px!important}
.energy-v30 .v26-lower-card header button{font-size:10px!important;padding:5px 10px!important}
.energy-v30 .v26-consumer{min-height:34px!important;grid-template-columns:27px minmax(125px,1fr) minmax(110px,1.2fr) auto 38px!important}
.energy-v30 .v26-consumer>i{width:23px!important;height:23px!important}
.energy-v30 .v26-consumer>span,
.energy-v30 .v26-consumer>strong{font-size:11px!important}
.energy-v30 .v26-consumer>em{font-size:10px!important}
.energy-v30 .v26-board{min-height:47px!important;grid-template-columns:27px minmax(125px,1fr) auto 42px!important}
.energy-v30 .v26-board i{width:23px!important;height:23px!important}
.energy-v30 .v26-board span,
.energy-v30 .v26-board strong{font-size:11px!important}
.energy-v30 .v26-board em{font-size:10px!important}
.energy-v30 .v26-status-row,
.energy-v30 .v26-lower-card.indicators>div{min-height:35px!important}
.energy-v30 .v26-status-row i,
.energy-v30 .v26-lower-card.indicators i{width:23px!important;height:23px!important}
.energy-v30 .v26-status-row span,
.energy-v30 .v26-status-row strong,
.energy-v30 .v26-lower-card.indicators span,
.energy-v30 .v26-lower-card.indicators strong{font-size:11px!important}
.energy-v30 .v26-status-row em,
.energy-v30 .v26-lower-card.indicators em{font-size:14px!important}

.energy-v30 .status-screen .status-row span{font-size:12px!important}
.energy-v30 .status-screen .status-row strong{font-size:11px!important}
.energy-v30 .status-screen .status-row small{font-size:10px!important}

@media(min-width:1451px){
  .energy-v30 .v26-kpis{grid-template-columns:repeat(8,minmax(0,1fr))!important}
}
@media(max-width:1450px) and (min-width:651px){
  .energy-v30 .v26-kpis{grid-template-columns:repeat(4,1fr)!important}
  .energy-v30 .v26-inverter,
  .energy-v30 .v26-micro{left:13.5%!important;width:175px!important;min-width:175px!important}
  .energy-v30 .v26-solar-total{left:31%!important;width:175px!important;min-width:175px!important}
}
@media(max-width:650px){
  .energy-v30 .v26-kpis{grid-template-columns:repeat(2,1fr)!important}
  .energy-v30 .v26-inverter,
  .energy-v30 .v26-micro{
    left:4%!important;width:43%!important;min-width:0!important;height:68px!important;min-height:68px!important;
  }
  .energy-v30 .v26-solar-total{
    left:31%!important;width:112px!important;min-width:112px!important;height:60px!important;min-height:60px!important;
  }
  .energy-v30 .v26-solar-total:after{width:65px!important}
}


/* ==========================================================================
   V54.0.0 — HERO POSITIONING + QGS + EQUAL-COLUMN TABS + LEGEND COLORS
   ========================================================================== */

/* =========================
   VISÃO GERAL / HERO
   ========================= */

/* Inverter / Micro / Geração Total exactly same visual size as Imported */
.energy-v31 .v26-inverter,
.energy-v31 .v26-micro,
.energy-v31 .v26-solar-total,
.energy-v31 .v26-grid-meter.import{
  width:150px!important;
  min-width:150px!important;
  height:72px!important;
  min-height:72px!important;
  box-sizing:border-box!important;
}

/* keep export same visual scale too for symmetry */
.energy-v31 .v26-grid-meter.export{
  width:150px!important;
  min-width:150px!important;
  height:72px!important;
  min-height:72px!important;
}

/* solar cards away from panels, with generation total safely left of house */
.energy-v31 .v26-inverter{
  left:14.5%!important;
  top:10%!important;
}
.energy-v31 .v26-micro{
  left:14.5%!important;
  top:57%!important;
}
.energy-v31 .v26-solar-total{
  left:28.5%!important;
  top:40%!important;
  display:grid!important;
  place-content:center!important;
  padding:8px 10px!important;
}

/* internal font sizes matched to imported card */
.energy-v31 .v26-source{
  padding:8px 10px!important;
  grid-template-columns:32px 1fr!important;
}
.energy-v31 .v26-source>i{
  width:29px!important;
  height:29px!important;
  padding:5px!important;
}
.energy-v31 .v26-source span{font-size:7px!important}
.energy-v31 .v26-source strong{font-size:17px!important}
.energy-v31 .v26-source small{font-size:6px!important}
.energy-v31 .v26-solar-total strong{font-size:18px!important}
.energy-v31 .v26-solar-total span{font-size:7px!important}

/* Import / Export centered in the free corridor between house and tower */
.energy-v31 .v26-grid-meter{
  right:24.5%!important;
  padding:9px 11px!important;
}
.energy-v31 .v26-grid-meter.import{top:28%!important}
.energy-v31 .v26-grid-meter.export{top:61%!important}
.energy-v31 .v26-grid-meter strong{font-size:18px!important}
.energy-v31 .v26-grid-meter span{font-size:7px!important}

/* Make sure solar total to house connector stays visible */
.energy-v31 .v26-solar-total:after{
  width:96px!important;
}
.energy-v31 .v26-solar-total:before{
  animation-duration:2.1s!important;
}
@keyframes v31SolarDot{
  from{transform:translateX(0)}
  to{transform:translateX(90px)}
}

/* QGS bar visibly fills */
.energy-v31 .v26-board.qgs>b{
  background:rgba(255,174,69,.12)!important;
}
.energy-v31 .v26-board.qgs>b u{
  background:linear-gradient(90deg,#d28b39,#f4b764)!important;
  box-shadow:none!important;
}

/* =========================
   ABA GERAÇÃO
   ========================= */

/* Equal pair: Produção no Período + Participação dos Geradores */
.energy-v31 .gen-layout.v31-equal-pair{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  gap:10px!important;
  align-items:stretch!important;
}
.energy-v31 .gen-layout.v31-equal-pair > *{
  min-width:0!important;
  width:auto!important;
  height:100%!important;
}

/* stop chart from feeling stretched vertically */
.energy-v31 .gen-layout .chart-box{
  height:300px!important;
}
.energy-v31 .gen-layout .chart-viewport{
  height:255px!important;
}
.energy-v31 .gen-layout .chart-viewport svg{
  height:255px!important;
}

/* generation legends must follow line colors */
.energy-v31 .generation-screen .chart-legend .green i,
.energy-v31 .generation-screen .v26-legend .green i{
  background:#6ccf8e!important;
}
.energy-v31 .generation-screen .chart-legend .blue i,
.energy-v31 .generation-screen .v26-legend .blue i{
  background:#5d9ed0!important;
}
.energy-v31 .generation-screen .chart-legend .orange i,
.energy-v31 .generation-screen .v26-legend .orange i{
  background:#d8a15b!important;
}
.energy-v31 .generation-screen .chart-legend .green{color:#6ccf8e!important}
.energy-v31 .generation-screen .chart-legend .blue{color:#5d9ed0!important}
.energy-v31 .generation-screen .chart-legend .orange{color:#d8a15b!important}

/* =========================
   ABA CONSUMO
   ========================= */

/* Equal pair: Casa e Quadros + Consumo individual */
.energy-v31 .consumption-grid.v31-equal-pair{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  gap:10px!important;
  align-items:stretch!important;
}
.energy-v31 .consumption-grid.v31-equal-pair > *{
  min-width:0!important;
  width:auto!important;
  height:100%!important;
}
.energy-v31 .consumption-grid .chart-box{
  height:300px!important;
}
.energy-v31 .consumption-grid .chart-viewport{
  height:255px!important;
}
.energy-v31 .consumption-grid .chart-viewport svg{
  height:255px!important;
}

/* Individual consumption descriptions more readable */
.energy-v31 .consumption-screen .device-name strong{
  font-size:11px!important;
}
.energy-v31 .consumption-screen .device-name small{
  font-size:9px!important;
  line-height:1.35!important;
}
.energy-v31 .consumption-screen .device-energy strong{
  font-size:11px!important;
}
.energy-v31 .consumption-screen .device-energy small{
  font-size:9px!important;
}

/* Casa e Quadros legend colors */
.energy-v31 .consumption-screen .chart-legend .red i{background:#d86b7d!important}
.energy-v31 .consumption-screen .chart-legend .cyan i{background:#5eb7cc!important}
.energy-v31 .consumption-screen .chart-legend .purple i{background:#a17ab8!important}
.energy-v31 .consumption-screen .chart-legend .red{color:#d86b7d!important}
.energy-v31 .consumption-screen .chart-legend .cyan{color:#5eb7cc!important}
.energy-v31 .consumption-screen .chart-legend .purple{color:#a17ab8!important}

/* =========================
   ABA REDE ELÉTRICA
   ========================= */

/* Assets much smaller, balanced, no giant house/tower */
.energy-v31 .v29-network-card{
  min-height:390px!important;
}
.energy-v31 .v29-network-scene{
  min-height:260px!important;
  grid-template-columns:minmax(180px,.9fr) minmax(320px,1.45fr) minmax(170px,.8fr)!important;
  gap:22px!important;
  padding:12px 24px!important;
}
.energy-v31 .v29-net-node img{
  height:118px!important;
  max-height:118px!important;
  width:100%!important;
  object-fit:contain!important;
}
.energy-v31 .v29-net-node.house img{
  transform:scale(.88)!important;
}
.energy-v31 .v29-net-node.copel img{
  transform:scale(.82)!important;
}
.energy-v31 .v29-net-node strong{font-size:12px!important}
.energy-v31 .v29-net-node span{font-size:9px!important}

/* reduce vertical dead space */
.energy-v31 .v29-net-flow{
  gap:22px!important;
}
.energy-v31 .v29-net-line{
  min-height:60px!important;
}
.energy-v31 .v29-net-line strong{font-size:17px!important}
.energy-v31 .v29-net-line span{font-size:9px!important}

/* Rede elétrica graph bar brightness reduced again */
.energy-v31 .grid-screen .v26-gridbar,
.energy-v31 .grid-screen .v26-bar{
  opacity:.58!important;
  filter:none!important;
}
.energy-v31 .grid-screen .trend{
  opacity:.68!important;
  filter:none!important;
}

/* =========================
   ABA HISTÓRICO
   ========================= */

/* Equal pair around Comportamento energético and side panel */
.energy-v31 .history-main.v31-equal-pair{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  gap:10px!important;
  align-items:stretch!important;
}
.energy-v31 .history-main.v31-equal-pair > *{
  min-width:0!important;
  width:auto!important;
  height:100%!important;
}
.energy-v31 .history-main .chart-box{
  height:300px!important;
}
.energy-v31 .history-main .chart-viewport{
  height:255px!important;
}
.energy-v31 .history-main .chart-viewport svg{
  height:255px!important;
}

/* History descriptions larger */
.energy-v31 .history-screen .section-head strong{
  font-size:16px!important;
}
.energy-v31 .history-screen .section-head span{
  font-size:9px!important;
}
.energy-v31 .history-screen .section-head small{
  font-size:9px!important;
}

/* History legend colors matching series */
.energy-v31 .history-screen .chart-legend .green i{background:#6ccf8e!important}
.energy-v31 .history-screen .chart-legend .blue i{background:#5d9ed0!important}
.energy-v31 .history-screen .chart-legend .orange i{background:#d8a15b!important}
.energy-v31 .history-screen .chart-legend .red i{background:#d86b7d!important}
.energy-v31 .history-screen .chart-legend .cyan i{background:#5eb7cc!important}
.energy-v31 .history-screen .chart-legend .purple i{background:#a17ab8!important}
.energy-v31 .history-screen .chart-legend span{
  font-size:10.5px!important;
}

/* =========================
   Responsiveness
   ========================= */
@media(max-width:1450px) and (min-width:651px){
  .energy-v31 .v26-inverter,
  .energy-v31 .v26-micro{
    left:12.5%!important;
    width:135px!important;
    min-width:135px!important;
  }
  .energy-v31 .v26-solar-total{
    left:29%!important;
    width:135px!important;
    min-width:135px!important;
  }
  .energy-v31 .v26-grid-meter{
    right:20%!important;
    width:135px!important;
    min-width:135px!important;
  }
  .energy-v31 .v29-network-scene{
    grid-template-columns:1fr 1.2fr 1fr!important;
  }
}
@media(max-width:650px){
  .energy-v31 .v26-inverter,
  .energy-v31 .v26-micro{
    left:4%!important;
    width:42%!important;
    min-width:0!important;
  }
  .energy-v31 .v26-solar-total{
    left:31%!important;
    width:105px!important;
    min-width:105px!important;
  }
  .energy-v31 .v26-grid-meter{
    right:3%!important;
    width:100px!important;
    min-width:100px!important;
  }
  .energy-v31 .gen-layout.v31-equal-pair,
  .energy-v31 .consumption-grid.v31-equal-pair,
  .energy-v31 .history-main.v31-equal-pair{
    grid-template-columns:1fr!important;
  }
  .energy-v31 .v29-network-scene{
    grid-template-columns:1fr!important;
    min-height:unset!important;
  }
  .energy-v31 .v29-net-node img{
    height:105px!important;
    max-height:105px!important;
  }
}


/* ===== V54.0.0 FINAL FIXES ===== */
.energy-v32 .v26-inverter,.energy-v32 .v26-micro,.energy-v32 .v26-solar-total,.energy-v32 .v26-grid-meter.import,.energy-v32 .v26-grid-meter.export{width:148px!important;min-width:148px!important;height:72px!important;min-height:72px!important;box-sizing:border-box!important}
.energy-v32 .v26-inverter{left:12.8%!important;top:10%!important}.energy-v32 .v26-micro{left:12.8%!important;top:57%!important}.energy-v32 .v26-solar-total{left:23.5%!important;top:39%!important;display:grid!important;place-content:center!important;padding:8px 9px!important;z-index:10!important}.energy-v32 .v26-source{padding:8px 9px!important;grid-template-columns:30px 1fr!important;gap:7px!important}.energy-v32 .v26-source>i{width:28px!important;height:28px!important;padding:4px!important}.energy-v32 .v26-source span{font-size:6.9px!important}.energy-v32 .v26-source strong{font-size:17px!important}.energy-v32 .v26-source small{font-size:5.9px!important}.energy-v32 .v26-solar-total strong{font-size:18px!important}.energy-v32 .v26-solar-total span{font-size:6.9px!important}.energy-v32 .v26-grid-meter{right:29.5%!important;padding:9px 11px!important}.energy-v32 .v26-grid-meter.import{top:27%!important}.energy-v32 .v26-grid-meter.export{top:61%!important}.energy-v32 .v26-grid-meter strong{font-size:18px!important}.energy-v32 .v26-grid-meter span{font-size:7px!important}.energy-v32 .v26-solar-total:after{width:175px!important}.energy-v32 .v26-board.qgs>b{position:relative!important;overflow:hidden!important;background:rgba(255,178,76,.12)!important}.energy-v32 .v26-board.qgs>b .qgs-fill{display:block!important;height:100%!important;max-width:100%!important;background:linear-gradient(90deg,#d98934,#f2b45b)!important;opacity:1!important;box-shadow:none!important}
.energy-v32 .gen-layout.v31-equal-pair{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:12px!important;align-items:stretch!important}.energy-v32 .v32-gen-production,.energy-v32 .v32-gen-share{min-width:0!important;width:auto!important;height:100%!important;min-height:360px!important}.energy-v32 .v32-gen-production .chart-box{height:275px!important}.energy-v32 .v32-gen-production .chart-viewport,.energy-v32 .v32-gen-production .chart-viewport svg{height:232px!important}.energy-v32 .v32-gen-production .chart-legend .green i{background:#6ccf8e!important}.energy-v32 .v32-gen-production .chart-legend .blue i{background:#5d9ed0!important}.energy-v32 .v32-gen-production .chart-legend .orange i{background:#d8a15b!important}.energy-v32 .v32-gen-production .chart-legend .green{color:#6ccf8e!important}.energy-v32 .v32-gen-production .chart-legend .blue{color:#5d9ed0!important}.energy-v32 .v32-gen-production .chart-legend .orange{color:#d8a15b!important}
.energy-v32 .consumption-grid.v31-equal-pair{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:12px!important;align-items:stretch!important}.energy-v32 .v32-cons-house,.energy-v32 .v32-cons-individual{min-width:0!important;width:auto!important;height:100%!important;min-height:390px!important}.energy-v32 .v32-cons-house .chart-box{height:285px!important}.energy-v32 .v32-cons-house .chart-viewport,.energy-v32 .v32-cons-house .chart-viewport svg{height:240px!important}.energy-v32 .v32-cons-individual .device-name strong{font-size:12px!important}.energy-v32 .v32-cons-individual .device-name small{font-size:10px!important;line-height:1.4!important}.energy-v32 .v32-cons-individual .device-energy strong{font-size:12px!important}.energy-v32 .v32-cons-individual .device-energy small{font-size:10px!important}.energy-v32 .v32-cons-house .chart-legend .red i{background:#d86b7d!important}.energy-v32 .v32-cons-house .chart-legend .cyan i{background:#5eb7cc!important}.energy-v32 .v32-cons-house .chart-legend .purple i{background:#a17ab8!important}.energy-v32 .v32-cons-house .chart-legend .orange i{background:#cf9b5e!important}
.energy-v32 .v29-network-card{min-height:350px!important}.energy-v32 .v29-network-scene{min-height:220px!important;grid-template-columns:minmax(155px,.8fr) minmax(300px,1.45fr) minmax(150px,.78fr)!important;gap:18px!important;padding:10px 20px!important}.energy-v32 .v29-net-node img{height:92px!important;max-height:92px!important;width:100%!important;object-fit:contain!important}.energy-v32 .v29-net-node.house img{transform:scale(.78)!important}.energy-v32 .v29-net-node.copel img{transform:scale(.70)!important}.energy-v32 .v29-net-node strong{font-size:11px!important}.energy-v32 .v29-net-node span{font-size:8px!important}.energy-v32 .v29-net-flow{gap:18px!important}.energy-v32 .v29-net-line{min-height:56px!important;padding:8px 14px!important}
.energy-v32 .history-screen{grid-template-columns:1fr 1fr!important;gap:12px!important}.energy-v32 .v32-history-maincard,.energy-v32 .v32-history-side{min-width:0!important;width:auto!important;height:100%!important;min-height:390px!important}.energy-v32 .v32-history-maincard .chart-box{height:285px!important}.energy-v32 .v32-history-maincard .chart-viewport,.energy-v32 .v32-history-maincard .chart-viewport svg{height:240px!important}.energy-v32 .history-screen .section-head strong{font-size:17px!important}.energy-v32 .history-screen .section-head span{font-size:10px!important}.energy-v32 .history-screen .section-head small{font-size:10px!important}.energy-v32 .v32-history-side .hero-kpi span{font-size:10px!important}.energy-v32 .v32-history-side .hero-kpi strong{font-size:22px!important}.energy-v32 .v32-history-side .hero-kpi small{font-size:9px!important}.energy-v32 .v32-history-maincard .chart-legend .green i{background:#6ccf8e!important}.energy-v32 .v32-history-maincard .chart-legend .red i{background:#d86b7d!important}.energy-v32 .v32-history-maincard .chart-legend .blue i{background:#5d9ed0!important}.energy-v32 .v32-history-maincard .chart-legend .orange i{background:#d8a15b!important}.energy-v32 .v32-history-maincard .chart-legend .cyan i{background:#5eb7cc!important}.energy-v32 .v32-history-maincard .chart-legend .purple i{background:#a17ab8!important}
@media(max-width:650px){.energy-v32 .gen-layout.v31-equal-pair,.energy-v32 .consumption-grid.v31-equal-pair,.energy-v32 .history-screen{grid-template-columns:1fr!important}.energy-v32 .v29-network-scene{grid-template-columns:1fr!important}.energy-v32 .v29-net-node img{height:82px!important;max-height:82px!important}}


/* ==========================================================================
   V54.0.0 — hard layout locks + continuous energy flow + low-glow charts
   ========================================================================== */

/* 1 — FORCE ALL 8 HEADER KPIs IN ONE ROW ON DESKTOP/LANDSCAPE TABLET */
.energy-v33 .v26-kpis{
  display:grid!important;
  grid-template-columns:repeat(8,minmax(0,1fr))!important;
  grid-auto-flow:column!important;
  grid-auto-columns:minmax(0,1fr)!important;
  gap:6px!important;
  width:100%!important;
  min-width:0!important;
  overflow:visible!important;
}
.energy-v33 .v26-kpis article{
  min-width:0!important;
  width:auto!important;
  max-width:none!important;
  min-height:108px!important;
  padding:9px 8px!important;
  grid-template-columns:31px minmax(0,1fr)!important;
  gap:7px!important;
}
.energy-v33 .v26-kpis article>i{width:29px!important;height:29px!important;padding:5px!important}
.energy-v33 .v26-kpis span{font-size:7.2px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.energy-v33 .v26-kpis strong{font-size:21px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.energy-v33 .v26-kpis small{font-size:6.1px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.energy-v33 .v26-kpis em{font-size:5.8px!important;white-space:nowrap!important;overflow:hidden!important}
.energy-v33 .v26-kpis .peak{grid-column:auto!important;grid-row:1!important}

/* 2 — GERAÇÃO TOTAL -> CASA: dedicated solid bridge, always reaching shield */
.energy-v33 .v33-total-house-bridge{
  position:absolute!important;
  z-index:8!important;
  left:calc(23.5% + 148px)!important;
  right:46.3%!important;
  top:calc(39% + 36px)!important;
  height:3px!important;
  border-radius:3px!important;
  background:rgba(103,220,143,.78)!important;
  box-shadow:0 0 5px rgba(103,220,143,.18)!important;
  overflow:visible!important;
  pointer-events:none!important;
}
.energy-v33 .v33-total-house-bridge:after{
  content:""!important;
  position:absolute!important;
  right:-4px!important;
  top:-3px!important;
  width:9px!important;height:9px!important;border-radius:50%!important;
  background:#8be9a8!important;
  box-shadow:0 0 8px rgba(139,233,168,.45)!important;
}

/* Smooth particles on bridge — no stop/restart visual */
.energy-v33 .v33-flow-dot{
  position:absolute!important;
  top:-2px!important;
  left:-4px!important;
  width:7px!important;height:7px!important;border-radius:50%!important;
  background:#b8ffd0!important;
  box-shadow:0 0 7px rgba(184,255,208,.55)!important;
  animation:v33BridgeFlow 4.8s linear infinite!important;
}
.energy-v33 .v33-flow-dot.d2{animation-delay:-1.6s!important}
.energy-v33 .v33-flow-dot.d3{animation-delay:-3.2s!important}
@keyframes v33BridgeFlow{
  0%{left:-4px;opacity:.20}
  8%{opacity:1}
  92%{opacity:1}
  100%{left:calc(100% - 3px);opacity:.20}
}

/* 3 — smooth continuous flow on all main lines.
   Solid rail remains underneath; short pulse segments move continuously. */
.energy-v33 .v26-particle{display:none!important}
.energy-v33 .v33-pulse{
  fill:none!important;
  stroke-width:4!important;
  stroke-linecap:round!important;
  path-length:100!important;
  stroke-dasharray:2 13!important;
  animation:v33PulseFlow 5.2s linear infinite!important;
  opacity:.78!important;
  filter:none!important;
  pointer-events:none!important;
}
.energy-v33 .v33-pulse.solar{stroke:#b6ffd0!important}
.energy-v33 .v33-pulse.import{stroke:#ffd089!important;animation-direction:reverse!important}
.energy-v33 .v33-pulse.export{stroke:#9cecff!important}
.energy-v33 .v33-pulse.delay1{animation-delay:-1.3s!important}
.energy-v33 .v33-pulse.delay2{animation-delay:-2.6s!important}
.energy-v33 .v33-pulse.delay3{animation-delay:-3.9s!important}
@keyframes v33PulseFlow{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-100}
}
.energy-v33 .v26-rail{
  filter:none!important;
  stroke-width:2.4!important;
  opacity:.72!important;
}

/* Keep hero cards where they belong */
.energy-v33 .v26-solar-total{left:23.5%!important;top:39%!important}
.energy-v33 .v26-grid-meter{right:29.5%!important}

/* 4 + 5 — GLOBAL GRAPH GLOW REDUCTION, INCLUDING OVERVIEW FOOTER */
.energy-v33 .chart-box,
.energy-v33 .v26-chart,
.energy-v33 .chart-viewport,
.energy-v33 .panel:has(svg){
  filter:none!important;
}
.energy-v33 .trend,
.energy-v33 .v26-line,
.energy-v33 .v26-area,
.energy-v33 .v26-bar,
.energy-v33 .v26-gridbar,
.energy-v33 .gridline,
.energy-v33 .v26-grid-h,
.energy-v33 .v26-grid-v,
.energy-v33 .v26-zero,
.energy-v33 .chart-legend i,
.energy-v33 .v26-legend i,
.energy-v33 svg text{
  filter:none!important;
  text-shadow:none!important;
  box-shadow:none!important;
}
.energy-v33 .trend,.energy-v33 .v26-line{
  stroke-width:1.35!important;
  opacity:.72!important;
}
.energy-v33 .v26-area{opacity:.022!important}
.energy-v33 .v26-bar,.energy-v33 .v26-gridbar{opacity:.64!important}
.energy-v33 .gridline-h,.energy-v33 .v26-grid-h{stroke:rgba(136,155,165,.075)!important}
.energy-v33 .gridline-v,.energy-v33 .v26-grid-v{stroke:rgba(136,155,165,.045)!important}
.energy-v33 .v26-zero{stroke:rgba(150,170,180,.16)!important}
.energy-v33 .gridtext,
.energy-v33 .chart-time-label,
.energy-v33 .v26-xlabel,
.energy-v33 .v26-ylabel{
  fill:#8fa4ae!important;
  font-size:11px!important;
  font-weight:500!important;
  opacity:.82!important;
}

/* Footer/secondary graph labels larger */
.energy-v33 .v26-small-legend{font-size:10px!important;gap:10px!important}
.energy-v33 .v26-legend,
.energy-v33 .v28-legend,
.energy-v33 .chart-legend,
.energy-v33 .chart-legend-v28{
  font-size:10.5px!important;
  gap:14px!important;
  color:#c4d0d6!important;
}
.energy-v33 .v26-legend span,
.energy-v33 .v28-legend span,
.energy-v33 .chart-legend span,
.energy-v33 .chart-legend strong,
.energy-v33 .chart-legend-v28 span,
.energy-v33 .chart-legend-v28 strong{
  font-size:10.5px!important;
}
.energy-v33 .v26-legend i,
.energy-v33 .v28-legend i,
.energy-v33 .chart-legend i{
  width:7px!important;height:7px!important;box-shadow:none!important;
}

/* Lower four cards: readable */
.energy-v33 .v26-lower-card{padding:14px 15px!important}
.energy-v33 .v26-lower-card header strong{font-size:13px!important}
.energy-v33 .v26-consumer>span,
.energy-v33 .v26-consumer>strong,
.energy-v33 .v26-board span,
.energy-v33 .v26-board strong,
.energy-v33 .v26-status-row span,
.energy-v33 .v26-status-row strong,
.energy-v33 .v26-lower-card.indicators span,
.energy-v33 .v26-lower-card.indicators strong{
  font-size:11px!important;
}
.energy-v33 .v26-consumer>em,.energy-v33 .v26-board em{font-size:9.5px!important}

/* 6 — REDE ELÉTRICA ASSETS: absolute caps so they can never explode */
.energy-v33 .v29-network-card{
  min-height:340px!important;
}
.energy-v33 .v29-network-scene{
  display:grid!important;
  grid-template-columns:220px minmax(320px,1fr) 180px!important;
  align-items:center!important;
  justify-content:center!important;
  gap:24px!important;
  min-height:215px!important;
  padding:12px 28px!important;
}
.energy-v33 .v29-net-node{
  width:100%!important;
  max-width:220px!important;
  justify-self:center!important;
}
.energy-v33 .v29-net-node.house{max-width:220px!important}
.energy-v33 .v29-net-node.copel{max-width:150px!important}
.energy-v33 .v29-net-node img{
  display:block!important;
  margin:0 auto!important;
  width:auto!important;
  max-width:100%!important;
  height:auto!important;
  max-height:105px!important;
  object-fit:contain!important;
  transform:none!important;
  filter:brightness(.82) saturate(.78) drop-shadow(0 5px 8px rgba(0,0,0,.30))!important;
}
.energy-v33 .v29-net-node.house img{max-width:205px!important;max-height:105px!important}
.energy-v33 .v29-net-node.copel img{max-width:92px!important;max-height:112px!important}
.energy-v33 .v29-net-flow{gap:18px!important}
.energy-v33 .v29-net-line{min-height:56px!important}

/* Copel, history, generation, consumption — no residual glow from old rules */
.energy-v33 .grid-screen *,
.energy-v33 .history-screen *,
.energy-v33 .generation-screen *,
.energy-v33 .consumption-screen *{
  text-shadow:none!important;
}
.energy-v33 .grid-screen .trend,
.energy-v33 .history-screen .trend,
.energy-v33 .generation-screen .trend,
.energy-v33 .consumption-screen .trend{
  filter:none!important;
  opacity:.68!important;
}
.energy-v33 .grid-screen .chart-box,
.energy-v33 .history-screen .chart-box,
.energy-v33 .generation-screen .chart-box,
.energy-v33 .consumption-screen .chart-box{
  filter:saturate(.68)!important;
}

/* Desktop/landscape: keep 8 KPIs even below 1450 CSS px */
@media(min-width:760px){
  .energy-v33 .v26-kpis{
    grid-template-columns:repeat(8,minmax(0,1fr))!important;
    grid-auto-flow:column!important;
  }
}
/* Mobile: 2 columns only */
@media(max-width:759px){
  .energy-v33 .v26-kpis{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-flow:row!important;
  }
  .energy-v33 .v33-total-house-bridge{
    left:calc(30% + 104px)!important;
    right:46%!important;
  }
  .energy-v33 .v29-network-scene{
    grid-template-columns:1fr!important;
  }
  .energy-v33 .v29-net-node.house,
  .energy-v33 .v29-net-node.copel{
    max-width:160px!important;
  }
}


/* ==========================================================================
   V54.0.0 — targeted fixes
   ========================================================================== */

/* 1 — FLOW CARDS: same size as Geração Total and centered in the corridors */
.energy-v34 .v26-inverter,
.energy-v34 .v26-micro,
.energy-v34 .v26-solar-total{
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
  box-sizing:border-box!important;
}
.energy-v34 .v26-inverter{left:17.2%!important;top:15%!important}
.energy-v34 .v26-micro{left:17.2%!important;top:58%!important}
.energy-v34 .v26-solar-total{
  left:29.0%!important;
  top:39%!important;
  display:grid!important;
  place-content:center!important;
  padding:7px 8px!important;
}
.energy-v34 .v26-source{
  padding:7px 8px!important;
  grid-template-columns:27px 1fr!important;
  gap:6px!important;
}
.energy-v34 .v26-source>i{
  width:25px!important;
  height:25px!important;
  padding:4px!important;
}
.energy-v34 .v26-source span{font-size:6.5px!important}
.energy-v34 .v26-source strong{font-size:15px!important}
.energy-v34 .v26-source small{font-size:5.5px!important}
.energy-v34 .v26-solar-total strong{font-size:16px!important}
.energy-v34 .v26-solar-total span{font-size:6.4px!important}

/* Import/export centered between house and tower */
.energy-v34 .v26-grid-meter{
  right:31.0%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
  padding:7px 9px!important;
}
.energy-v34 .v26-grid-meter.import{top:25%!important}
.energy-v34 .v26-grid-meter.export{top:60%!important}
.energy-v34 .v26-grid-meter strong{font-size:16px!important}
.energy-v34 .v26-grid-meter span{font-size:6.4px!important}

/* 2 — flow animation follows real direction/state only */
.energy-v34 .v33-pulse.inactive{
  display:none!important;
  animation:none!important;
}
.energy-v34 .v33-pulse.active{
  display:block!important;
}
.energy-v34 .v33-total-house-bridge.inactive{
  opacity:.18!important;
}
.energy-v34 .v33-total-house-bridge.inactive .v33-flow-dot{
  display:none!important;
}
.energy-v34 .v33-total-house-bridge.active{
  opacity:1!important;
}
.energy-v34 .v33-pulse.solar.active{
  animation-direction:normal!important;
}
.energy-v34 .v33-pulse.import.active{
  animation-direction:reverse!important; /* tower -> house */
}
.energy-v34 .v33-pulse.export.active{
  animation-direction:normal!important;  /* house -> tower */
}

/* 3 — solar lines lower so they do not cross over the house */
.energy-v34 .v26-flow-svg{
  transform:translateY(18px)!important;
}
.energy-v34 .v33-total-house-bridge{
  top:calc(39% + 44px)!important;
}
.energy-v34 .v26-solar-total:after{
  top:58%!important;
}
.energy-v34 .v26-solar-total:before{
  top:calc(58% - 4px)!important;
}

/* 4 — Autossuficiência description readable */
.energy-v34 .v26-gauge-card header strong{
  font-size:12px!important;
}
.energy-v34 .v26-gauge-card header span,
.energy-v34 .v26-gauge-card header small{
  font-size:10px!important;
  line-height:1.35!important;
}
.energy-v34 .v26-gauge-card .v26-gauge-copy,
.energy-v34 .v26-gauge-card p,
.energy-v34 .v26-gauge-card .subtitle{
  font-size:11px!important;
  line-height:1.35!important;
}

/* 5 — ABSOLUTELY NO NEON ON ANY GRAPH SCALE, ANY TAB */
.energy-v34 svg text,
.energy-v34 .gridtext,
.energy-v34 .chart-time-label,
.energy-v34 .v26-xlabel,
.energy-v34 .v26-ylabel,
.energy-v34 .axis-label,
.energy-v34 .tick-label,
.energy-v34 .hour-ruler,
.energy-v34 .chart-axis,
.energy-v34 .chart-axis *{
  filter:none!important;
  text-shadow:none!important;
  box-shadow:none!important;
  stroke:none!important;
  paint-order:normal!important;
  opacity:.82!important;
  color:#9fb0b8!important;
  fill:#9fb0b8!important;
}
.energy-v34 .gridline,
.energy-v34 .v26-grid-h,
.energy-v34 .v26-grid-v,
.energy-v34 .v26-zero,
.energy-v34 .axis-line,
.energy-v34 .tick-line{
  filter:none!important;
  box-shadow:none!important;
  stroke:rgba(130,151,160,.055)!important;
}
.energy-v34 .trend,
.energy-v34 .v26-line,
.energy-v34 .v26-area,
.energy-v34 .v26-bar,
.energy-v34 .v26-gridbar,
.energy-v34 .chart-legend i,
.energy-v34 .v26-legend i{
  filter:none!important;
  box-shadow:none!important;
  text-shadow:none!important;
}
.energy-v34 .trend,
.energy-v34 .v26-line{opacity:.70!important}
.energy-v34 .v26-area{opacity:.018!important}
.energy-v34 .v26-bar,
.energy-v34 .v26-gridbar{opacity:.60!important}

/* Remove inherited filter from graph containers too */
.energy-v34 .chart-box,
.energy-v34 .chart-viewport,
.energy-v34 .v26-chart,
.energy-v34 .history-screen .chart-box,
.energy-v34 .generation-screen .chart-box,
.energy-v34 .consumption-screen .chart-box,
.energy-v34 .grid-screen .chart-box,
.energy-v34 .analytics-screen .chart-box{
  filter:none!important;
  box-shadow:none!important;
}

/* 6 — CONFIG: increase ALL text sizes */
.energy-v34 .status-screen{
  font-size:12px!important;
}
.energy-v34 .status-screen .tab-intro{
  min-height:112px!important;
}
.energy-v34 .status-screen .tab-intro-copy span{
  font-size:11px!important;
}
.energy-v34 .status-screen .tab-intro-copy strong{
  font-size:27px!important;
}
.energy-v34 .status-screen .tab-intro-copy small{
  font-size:12px!important;
  line-height:1.4!important;
}
.energy-v34 .status-screen .status-panel{
  padding:20px!important;
}
.energy-v34 .status-screen .section-head span{
  font-size:12px!important;
}
.energy-v34 .status-screen .section-head strong{
  font-size:21px!important;
}
.energy-v34 .status-screen .section-head small{
  font-size:12px!important;
}
.energy-v34 .status-screen .status-row{
  min-height:62px!important;
  padding:12px 15px!important;
  gap:12px!important;
}
.energy-v34 .status-screen .status-row span{
  font-size:13px!important;
}
.energy-v34 .status-screen .status-row strong{
  font-size:12px!important;
}
.energy-v34 .status-screen .status-row small{
  font-size:11px!important;
  line-height:1.4!important;
}
.energy-v34 .status-screen .status-row i{
  width:28px!important;
  height:28px!important;
}

/* keep desktop cards proportional */
@media(min-width:760px){
  .energy-v34 .v26-inverter,
  .energy-v34 .v26-micro,
  .energy-v34 .v26-solar-total,
  .energy-v34 .v26-grid-meter{
    transform:none!important;
  }
}

/* mobile */
@media(max-width:759px){
  .energy-v34 .v26-inverter,
  .energy-v34 .v26-micro{
    left:4%!important;
    width:40%!important;
    min-width:0!important;
  }
  .energy-v34 .v26-solar-total{
    left:31%!important;
    width:104px!important;
    min-width:104px!important;
  }
  .energy-v34 .v26-grid-meter{
    right:3%!important;
    width:98px!important;
    min-width:98px!important;
  }
  .energy-v34 .v26-flow-svg{
    transform:translateY(8px)!important;
  }
}


/* ==========================================================================
   V54.0.0 — VISÃO GERAL ONLY
   Preserves prior version classes to stop CSS regressions.
   ========================================================================== */

/* 1) FLOW INFO CARDS: geometrically centered on their SVG rails */
.energy-v35 .v26-flow-svg{
  transform:none!important;
}

/* SVG y=182/520 => 35%; card 66px high => top ~26% */
.energy-v35 .v26-inverter{
  left:17.0%!important;
  top:26.0%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
}
/* SVG y=307/520 => 59%; card top ~50% */
.energy-v35 .v26-micro{
  left:17.0%!important;
  top:50.0%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
}
/* Merge line y=252/520 => 48.5%; card top ~39.5% */
.energy-v35 .v26-solar-total{
  left:29.0%!important;
  top:39.5%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
}

/* Import path y~205/520 => 39%; export y~335/520 => 64% */
.energy-v35 .v26-grid-meter{
  right:31.0%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
}
.energy-v35 .v26-grid-meter.import{top:30.0%!important}
.energy-v35 .v26-grid-meter.export{top:55.0%!important}

/* Larger descriptions inside the four flow cards */
.energy-v35 .v26-source{
  padding:8px 9px!important;
  grid-template-columns:28px minmax(0,1fr)!important;
  gap:7px!important;
}
.energy-v35 .v26-source>i{
  width:27px!important;
  height:27px!important;
  padding:4px!important;
}
.energy-v35 .v26-source span{
  font-size:8.2px!important;
  line-height:1.15!important;
  letter-spacing:.02em!important;
}
.energy-v35 .v26-source strong{
  font-size:18px!important;
  line-height:1.05!important;
}
.energy-v35 .v26-source small{
  font-size:7.2px!important;
  line-height:1.2!important;
}
.energy-v35 .v26-solar-total strong,
.energy-v35 .v26-grid-meter strong{
  font-size:18px!important;
}
.energy-v35 .v26-solar-total span,
.energy-v35 .v26-grid-meter span{
  font-size:7.8px!important;
  line-height:1.2!important;
}

/* Bridge follows the real centered Geração Total card */
.energy-v35 .v33-total-house-bridge{
  left:calc(29% + 136px)!important;
  right:46.0%!important;
  top:48.5%!important;
}
.energy-v35 .v26-solar-total:after,
.energy-v35 .v26-solar-total:before{
  display:none!important;
}

/* 2) HEADER: HARD LOCK 8 KPI CARDS ON ONE ROW
   Use flex instead of grid to defeat all older 4-col media rules. */
@media(min-width:900px){
  .energy-v35 .v26-kpis{
    display:flex!important;
    flex-flow:row nowrap!important;
    align-items:stretch!important;
    gap:7px!important;
    width:100%!important;
    overflow:visible!important;
  }
  .energy-v35 .v26-kpis article{
    flex:1 1 0!important;
    width:0!important;
    min-width:0!important;
    max-width:none!important;
    grid-column:auto!important;
    grid-row:auto!important;
    min-height:108px!important;
    padding:10px 9px!important;
    grid-template-columns:34px minmax(0,1fr)!important;
  }
  .energy-v35 .v26-kpis .peak{
    flex:1 1 0!important;
    width:0!important;
    min-width:0!important;
    grid-column:auto!important;
    grid-row:auto!important;
  }
}
.energy-v35 .v26-kpis article>i{
  width:32px!important;
  height:32px!important;
  padding:5px!important;
}
.energy-v35 .v26-kpis span{
  font-size:8.4px!important;
  line-height:1.15!important;
}
.energy-v35 .v26-kpis strong{
  font-size:23px!important;
  line-height:1.05!important;
}
.energy-v35 .v26-kpis small{
  font-size:7.2px!important;
  line-height:1.25!important;
}
.energy-v35 .v26-kpis em{
  font-size:7px!important;
}

/* 3) OVERVIEW TYPOGRAPHY: increase the whole visible tab without enlarging boxes */
.energy-v35 .v26-flow-head strong{font-size:14px!important}
.energy-v35 .v26-flow-head small{font-size:8.5px!important}
.energy-v35 .v26-flow-head>span{font-size:8px!important}

.energy-v35 .v26-summary header strong{font-size:14px!important}
.energy-v35 .v26-summary header span{font-size:8px!important}
.energy-v35 .v26-summary-row span,
.energy-v35 .v26-summary-row strong{font-size:9.5px!important}
.energy-v35 .v26-summary-row small{font-size:8px!important}

.energy-v35 .v26-chart-card header>div>span{font-size:12px!important}
.energy-v35 .v26-chart-card header>div>strong{font-size:25px!important}
.energy-v35 .v26-small-legend{font-size:10.5px!important}
.energy-v35 .v26-legend,
.energy-v35 .v28-legend{font-size:11px!important}
.energy-v35 .v26-legend span,
.energy-v35 .v28-legend span{font-size:11px!important}

.energy-v35 .v26-gauge-card header strong{font-size:13px!important}
.energy-v35 .v26-gauge-card header span,
.energy-v35 .v26-gauge-card header small{font-size:10.5px!important}
.energy-v35 .v26-gauge-card p,
.energy-v35 .v26-gauge-card .subtitle{font-size:11.5px!important}

.energy-v35 .v26-lower-card header strong{font-size:14px!important}
.energy-v35 .v26-consumer>span,
.energy-v35 .v26-consumer>strong,
.energy-v35 .v26-board span,
.energy-v35 .v26-board strong,
.energy-v35 .v26-status-row span,
.energy-v35 .v26-status-row strong,
.energy-v35 .v26-lower-card.indicators span,
.energy-v35 .v26-lower-card.indicators strong{
  font-size:11.5px!important;
}
.energy-v35 .v26-consumer>em,
.energy-v35 .v26-board em{font-size:10px!important}

/* Keep mobile layout separate */
@media(max-width:899px){
  .energy-v35 .v26-kpis{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    grid-auto-flow:row!important;
  }
}


/* ==========================================================================
   V54.0.0 — VISÃO GERAL: escudo, legibilidade KPI/resumo/autossuficiência
   ========================================================================== */

/* 1 — Geração Total -> Casa: STOP AT SHIELD, NEVER CROSS THE HOUSE */
.energy-v36 .v33-total-house-bridge{
  left:calc(29% + 136px)!important;
  right:auto!important;
  width:clamp(44px,4.2vw,72px)!important;
  top:48.5%!important;
  height:3px!important;
  overflow:visible!important;
}
.energy-v36 .v33-total-house-bridge:after{
  right:-3px!important;
  width:9px!important;
  height:9px!important;
}
/* make sure no old duplicate solar connector can continue through the house */
.energy-v36 .v30-total-home{
  display:none!important;
}
.energy-v36 .v26-solar-total:after,
.energy-v36 .v26-solar-total:before{
  display:none!important;
}

/* 2 — KPI secondary texts: substantially larger */
.energy-v36 .v26-kpis article{
  padding:10px 9px!important;
}
.energy-v36 .v26-kpis span{
  font-size:9.2px!important;
  line-height:1.22!important;
  letter-spacing:.01em!important;
}
.energy-v36 .v26-kpis strong{
  font-size:23px!important;
}
.energy-v36 .v26-kpis small{
  font-size:8.4px!important;
  line-height:1.30!important;
  color:#ffffff!important;
  opacity:.94!important;
}
.energy-v36 .v26-kpis em{
  font-size:8.1px!important;
  line-height:1.28!important;
  opacity:1!important;
}
.energy-v36 .v26-kpis .balance em,
.energy-v36 .v26-kpis .peak em,
.energy-v36 .v26-kpis article em{
  font-weight:650!important;
}

/* Keep 8 cards on one row even with larger supporting text */
@media(min-width:900px){
  .energy-v36 .v26-kpis{
    display:flex!important;
    flex-flow:row nowrap!important;
    gap:6px!important;
  }
  .energy-v36 .v26-kpis article{
    flex:1 1 0!important;
    width:0!important;
    min-width:0!important;
  }
}

/* 3 — AUTOSSUFICIÊNCIA: all descriptions readable */
.energy-v36 .v26-gauge-card header strong{
  font-size:14px!important;
  line-height:1.2!important;
  color:#ffffff!important;
}
.energy-v36 .v26-gauge-card header span,
.energy-v36 .v26-gauge-card header small{
  font-size:11.5px!important;
  line-height:1.4!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v36 .v26-gauge-card p,
.energy-v36 .v26-gauge-card .subtitle,
.energy-v36 .v26-gauge-card .v26-gauge-copy{
  font-size:12px!important;
  line-height:1.45!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v36 .v26-gauge-card text{
  fill:#ffffff!important;
}

/* 4 — GRAPH SCALE NUMBERS: white, no glow */
.energy-v36 .v26-ylabel,
.energy-v36 .v26-xlabel,
.energy-v36 .gridtext,
.energy-v36 .chart-time-label,
.energy-v36 .axis-label,
.energy-v36 .tick-label{
  fill:#ffffff!important;
  color:#ffffff!important;
  opacity:.92!important;
  filter:none!important;
  text-shadow:none!important;
  stroke:none!important;
  font-size:11.5px!important;
  font-weight:600!important;
}

/* 5 — RESUMO DO DIA: larger and white descriptions */
.energy-v36 .v26-summary{
  padding:12px 13px!important;
}
.energy-v36 .v26-summary header strong{
  font-size:15px!important;
  color:#ffffff!important;
}
.energy-v36 .v26-summary header span,
.energy-v36 .v26-summary header small{
  font-size:9px!important;
  color:#ffffff!important;
}
.energy-v36 .v26-summary-row{
  min-height:32px!important;
  padding:5px 0!important;
}
.energy-v36 .v26-summary-row i{
  width:23px!important;
  height:23px!important;
}
.energy-v36 .v26-summary-row span{
  font-size:10.5px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v36 .v26-summary-row strong{
  font-size:10.5px!important;
  line-height:1.25!important;
}
.energy-v36 .v26-summary-row small{
  font-size:9.2px!important;
  color:#ffffff!important;
  opacity:.94!important;
}
.energy-v36 .v26-summary footer,
.energy-v36 .v26-summary footer span,
.energy-v36 .v26-summary footer strong,
.energy-v36 .v26-summary footer small{
  font-size:9.5px!important;
  color:#ffffff!important;
}

/* Mobile keeps readability without overflowing */
@media(max-width:899px){
  .energy-v36 .v26-kpis span{font-size:8.4px!important}
  .energy-v36 .v26-kpis small{font-size:7.7px!important}
  .energy-v36 .v26-kpis em{font-size:7.3px!important}
  .energy-v36 .v26-summary-row span,
  .energy-v36 .v26-summary-row strong{font-size:9.6px!important}
  .energy-v36 .v33-total-house-bridge{
    width:clamp(28px,8vw,48px)!important;
  }
}


/* ==========================================================================
   V54.0.0 — VISÃO GERAL FINAL ALIGNMENT / READABILITY / SUMMARY ACTIONS
   ========================================================================== */

/* 1 — Solar rail ends at the LEFT EDGE of the energy shield.
   Disable every legacy parallel connector so there is only one visible rail. */
.energy-v37 .v30-total-home,
.energy-v37 .v33-total-house-bridge,
.energy-v37 .v26-solar-total:after,
.energy-v37 .v26-solar-total:before{
  display:none!important;
}
.energy-v37 .v26-rail.solar{
  stroke-width:2.5px!important;
}
.energy-v37 .v33-pulse.solar{
  stroke-width:3.4px!important;
}

/* 2 — KPI supporting information: large enough to read, all 8 stay in one row */
@media(min-width:900px){
  .energy-v37 .v26-kpis{
    display:flex!important;
    flex-flow:row nowrap!important;
    align-items:stretch!important;
    gap:6px!important;
    width:100%!important;
  }
  .energy-v37 .v26-kpis article{
    flex:1 1 0!important;
    width:0!important;
    min-width:0!important;
    max-width:none!important;
    min-height:116px!important;
    padding:11px 9px!important;
    grid-template-columns:34px minmax(0,1fr)!important;
  }
}
.energy-v37 .v26-kpis article>i{
  width:32px!important;
  height:32px!important;
}
.energy-v37 .v26-kpis span{
  font-size:9.2px!important;
  line-height:1.25!important;
  font-weight:800!important;
  color:#f4fbff!important;
}
.energy-v37 .v26-kpis strong{
  font-size:23px!important;
  line-height:1.06!important;
}
.energy-v37 .v26-kpis small{
  font-size:8.3px!important;
  line-height:1.32!important;
  font-weight:650!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v37 .v26-kpis em{
  font-size:8.1px!important;
  line-height:1.32!important;
  font-weight:750!important;
  opacity:1!important;
}
.energy-v37 .v26-kpis em b{
  font-size:8.1px!important;
  color:#ffffff!important;
}

/* 3 — AUTOSSUFICIÊNCIA: target the real markup */
.energy-v37 .v26-chart-card.gauge header span{
  font-size:12.5px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  font-weight:850!important;
}
.energy-v37 .v26-chart-card.gauge > small{
  display:block!important;
  margin-top:7px!important;
  font-size:12px!important;
  line-height:1.42!important;
  color:#ffffff!important;
  opacity:1!important;
  font-weight:600!important;
  text-align:center!important;
}
.energy-v37 .v26-gauge>div strong{
  font-size:28px!important;
}
.energy-v37 .v26-gauge>div span{
  font-size:9px!important;
  color:#ffffff!important;
  opacity:1!important;
}

/* 4 — ALL OVERVIEW GRAPH SCALE NUMBERS PURE WHITE / NO GLOW */
.energy-v37 .v26-analytics .v26-ylabel,
.energy-v37 .v26-analytics .v26-xlabel,
.energy-v37 .v26-analytics svg text{
  fill:#ffffff!important;
  color:#ffffff!important;
  opacity:1!important;
  font-size:12px!important;
  font-weight:650!important;
  filter:none!important;
  text-shadow:none!important;
  stroke:none!important;
  paint-order:normal!important;
}
.energy-v37 .v26-analytics .v26-grid-h,
.energy-v37 .v26-analytics .v26-grid-v,
.energy-v37 .v26-analytics .v26-zero{
  filter:none!important;
  box-shadow:none!important;
  stroke:rgba(180,205,216,.10)!important;
}

/* 5 — RESUMO DO DIA: target actual list selectors, descriptions WHITE */
.energy-v37 .v26-summary{
  padding:12px 14px!important;
}
.energy-v37 .v26-summary header>strong{
  font-size:15px!important;
  color:#ffffff!important;
  line-height:1.2!important;
}
.energy-v37 .v26-summary header>div{
  margin-top:9px!important;
  display:grid!important;
  grid-template-columns:repeat(4,1fr)!important;
}
.energy-v37 .v26-summary header button{
  appearance:none!important;
  border:0!important;
  border-right:1px solid rgba(66,157,205,.18)!important;
  background:transparent!important;
  padding:7px 3px!important;
  color:#ffffff!important;
  font:inherit!important;
  font-size:8.5px!important;
  font-weight:800!important;
  cursor:pointer!important;
}
.energy-v37 .v26-summary header button.active{
  color:#ffffff!important;
  background:linear-gradient(180deg,#19b9ff,#087bb9)!important;
  box-shadow:none!important;
}
.energy-v37 .v26-summary-list{
  margin-top:8px!important;
}
.energy-v37 .v26-summary-list>div{
  grid-template-columns:25px minmax(0,1fr) auto!important;
  gap:9px!important;
  min-height:32px!important;
  padding:7px 2px!important;
}
.energy-v37 .v26-summary-list i{
  width:21px!important;
  height:21px!important;
  filter:none!important;
}
.energy-v37 .v26-summary-list span{
  font-size:10.4px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  opacity:1!important;
  font-weight:650!important;
}
.energy-v37 .v26-summary-list strong{
  font-size:10.4px!important;
  line-height:1.25!important;
  font-weight:800!important;
}
.energy-v37 .v26-summary-foot{
  padding-top:9px!important;
}
.energy-v37 .v26-summary-foot span{
  font-size:9.7px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v37 .v26-summary-foot strong{
  font-size:11px!important;
}
.energy-v37 .v26-summary-status{
  min-height:10px!important;
  margin-top:4px!important;
  font-size:7.5px!important;
  font-weight:750!important;
  color:#78dfff!important;
  text-align:right!important;
}

/* 7 — Import / Export centered in the geometric corridor HOUSE <-> REDE,
   vertically centered over their corresponding flow lines. */
.energy-v37 .v26-grid-meter{
  right:22.5%!important;
  width:136px!important;
  min-width:136px!important;
  height:66px!important;
  min-height:66px!important;
  z-index:12!important;
}
.energy-v37 .v26-grid-meter.import{
  top:30.0%!important;
}
.energy-v37 .v26-grid-meter.export{
  top:55.0%!important;
}
.energy-v37 .v26-grid-meter strong{
  font-size:17px!important;
}
.energy-v37 .v26-grid-meter span{
  font-size:7.8px!important;
  color:#ffffff!important;
}

/* Preserve mobile behavior */
@media(max-width:899px){
  .energy-v37 .v26-kpis{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
  .energy-v37 .v26-summary-list span,
  .energy-v37 .v26-summary-list strong{
    font-size:9.5px!important;
  }
  .energy-v37 .v26-grid-meter{
    right:3%!important;
    width:98px!important;
    min-width:98px!important;
  }
}


/* ==========================================================================
   V54.0.0 — VISÃO GERAL: legibilidade, alinhamento e acabamento visual
   ========================================================================== */

/* 1 — KPI secondary texts even larger, preserving 8 cards in one row */
@media(min-width:900px){
  .energy-v38 .v26-kpis{
    display:flex!important;
    flex-flow:row nowrap!important;
    gap:6px!important;
    width:100%!important;
  }
  .energy-v38 .v26-kpis article{
    flex:1 1 0!important;
    width:0!important;
    min-width:0!important;
    min-height:122px!important;
    padding:12px 10px!important;
    grid-template-columns:39px minmax(0,1fr)!important;
    gap:8px!important;
  }
}
.energy-v38 .v26-kpis span{
  font-size:10.2px!important;
  line-height:1.25!important;
  font-weight:850!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v38 .v26-kpis small{
  font-size:9.2px!important;
  line-height:1.34!important;
  font-weight:700!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v38 .v26-kpis em,
.energy-v38 .v26-kpis em b{
  font-size:9px!important;
  line-height:1.30!important;
  font-weight:800!important;
  opacity:1!important;
}
.energy-v38 .v26-kpis strong{
  font-size:23px!important;
}

/* 10 — modern KPI icon treatment */
.energy-v38 .v26-kpis article>i{
  position:relative!important;
  width:38px!important;
  height:38px!important;
  padding:7px!important;
  border-radius:13px!important;
  background:
    radial-gradient(circle at 30% 25%,rgba(255,255,255,.22),transparent 28%),
    radial-gradient(circle at 50% 55%,color-mix(in srgb,currentColor 18%,transparent),rgba(3,14,24,.88) 72%)!important;
  border:1px solid color-mix(in srgb,currentColor 48%,rgba(255,255,255,.10))!important;
  box-shadow:
    inset 0 0 13px color-mix(in srgb,currentColor 14%,transparent),
    0 0 10px color-mix(in srgb,currentColor 18%,transparent)!important;
  overflow:visible!important;
}
.energy-v38 .v26-kpis article>i:before{
  content:""!important;
  position:absolute!important;
  inset:-5px!important;
  border-radius:16px!important;
  border:1px solid color-mix(in srgb,currentColor 24%,transparent)!important;
  border-left-color:transparent!important;
  border-bottom-color:transparent!important;
  animation:v38KpiOrbit 7s linear infinite!important;
  pointer-events:none!important;
}
.energy-v38 .v26-kpis article>i:after{
  content:""!important;
  position:absolute!important;
  width:5px!important;
  height:5px!important;
  right:-3px!important;
  top:7px!important;
  border-radius:50%!important;
  background:currentColor!important;
  box-shadow:0 0 9px currentColor!important;
  animation:v38KpiDot 2.4s ease-in-out infinite!important;
}
.energy-v38 .v26-kpis article>i svg{
  animation:v38KpiFloat 3.8s ease-in-out infinite!important;
  filter:none!important;
}
@keyframes v38KpiOrbit{to{transform:rotate(360deg)}}
@keyframes v38KpiFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-1.5px) scale(1.04)}}
@keyframes v38KpiDot{0%,100%{opacity:.45;transform:scale(.8)}50%{opacity:1;transform:scale(1.18)}}

/* 2 — Move REDE status label OUTSIDE, to the left of tower */
.energy-v38 .v26-grid-label{
  right:14.0%!important;
  bottom:5.0%!important;
  width:110px!important;
  text-align:right!important;
  transform:none!important;
  z-index:14!important;
  pointer-events:none!important;
}
.energy-v38 .v26-grid-label strong{
  font-size:11px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-grid-label small{
  margin-top:3px!important;
  font-size:8.5px!important;
  line-height:1.2!important;
  color:#ffffff!important;
  font-weight:800!important;
  opacity:1!important;
}

/* 3 — IMPORTANDO / EXPORTANDO cards: vertically center ALL information */
.energy-v38 .v26-grid-meter{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  padding:8px 10px!important;
  line-height:1.15!important;
}
.energy-v38 .v26-grid-meter strong{
  display:block!important;
  margin:0!important;
  font-size:18px!important;
  line-height:1.05!important;
}
.energy-v38 .v26-grid-meter span{
  display:block!important;
  margin:5px 0 0!important;
  font-size:9px!important;
  line-height:1.1!important;
  color:#ffffff!important;
  font-weight:800!important;
}

/* 4 — Hero source cards: make every WHITE supporting text clearly readable */
.energy-v38 .v26-source span{
  font-size:8.8px!important;
  line-height:1.18!important;
  color:#ffffff!important;
  font-weight:850!important;
}
.energy-v38 .v26-source small{
  font-size:8px!important;
  line-height:1.22!important;
  color:#ffffff!important;
  font-weight:700!important;
  opacity:1!important;
}
.energy-v38 .v26-solar-total span{
  font-size:8.4px!important;
  line-height:1.15!important;
  color:#ffffff!important;
  font-weight:850!important;
}
.energy-v38 .v26-grid-meter span{
  font-size:9px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-house-meter span{
  font-size:8.5px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-house-meter small{
  font-size:8px!important;
  color:#ffffff!important;
  opacity:1!important;
}

/* 5 — RESUMO DO DIA larger, better icons, ALL result numbers white */
.energy-v38 .v26-summary{
  padding:13px 15px!important;
}
.energy-v38 .v26-summary header>strong{
  font-size:16px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-summary header button{
  font-size:9.5px!important;
  padding:8px 4px!important;
}
.energy-v38 .v26-summary-list>div{
  min-height:37px!important;
  grid-template-columns:29px minmax(0,1fr) auto!important;
  gap:10px!important;
  padding:8px 2px!important;
}
.energy-v38 .v26-summary-list i{
  position:relative!important;
  width:25px!important;
  height:25px!important;
  padding:4px!important;
  border-radius:9px!important;
  background:radial-gradient(circle at 35% 30%,color-mix(in srgb,currentColor 20%,white),rgba(4,18,29,.72) 72%)!important;
  border:1px solid color-mix(in srgb,currentColor 36%,transparent)!important;
  box-shadow:inset 0 0 9px color-mix(in srgb,currentColor 11%,transparent)!important;
  filter:none!important;
}
.energy-v38 .v26-summary-list i svg{
  animation:v38SummaryIcon 4.2s ease-in-out infinite!important;
}
@keyframes v38SummaryIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}
.energy-v38 .v26-summary-list span{
  font-size:11.5px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  font-weight:700!important;
}
.energy-v38 .v26-summary-list strong{
  font-size:11.5px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  font-weight:850!important;
}
.energy-v38 .v26-summary-foot span{
  font-size:10.5px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-summary-foot strong{
  font-size:12px!important;
  color:#ffffff!important;
}
.energy-v38 .v26-summary-status{
  font-size:8.5px!important;
}

/* 6 — make DE / ATÉ date fields shorter */
.energy-v38 .filter-v14{
  grid-template-columns:auto auto minmax(360px,1fr) auto!important;
}
.energy-v38 .dates-v14{
  grid-template-columns:180px auto 180px auto!important;
  justify-content:start!important;
}
.energy-v38 .dates-v14 input{
  width:180px!important;
  max-width:180px!important;
}
.energy-v38 .dates-v14 label{
  width:180px!important;
}

/* 7 — Period subtitle much more readable */
.energy-v38 .filter-label strong{
  font-size:9px!important;
  line-height:1.2!important;
}
.energy-v38 .filter-label small{
  margin-top:3px!important;
  font-size:8.5px!important;
  line-height:1.25!important;
  color:#ffffff!important;
  opacity:.96!important;
  font-weight:650!important;
}
.energy-v38 .filter-label>i{
  width:26px!important;
  height:26px!important;
}

/* 8 — enhanced energy shield animation */
.energy-v38 .v26-shield{
  width:300px!important;
  height:300px!important;
  filter:none!important;
}
.energy-v38 .v26-shield:before{
  border:2px solid rgba(81,239,154,.72)!important;
  box-shadow:
    0 0 14px rgba(81,239,154,.30),
    inset 0 0 22px rgba(81,239,154,.08)!important;
  animation:v38ShieldBreath 3.2s ease-in-out infinite!important;
}
.energy-v38 .v26-shield:after{
  inset:14px!important;
  border:1.4px solid rgba(72,201,255,.60)!important;
  border-left-color:rgba(72,201,255,.18)!important;
  border-bottom-color:rgba(72,201,255,.18)!important;
  box-shadow:0 0 12px rgba(72,201,255,.17)!important;
  animation:v38ShieldCounter 9s linear infinite!important;
}
.energy-v38 .v26-shield i:first-child{
  inset:-10px!important;
  border-top:2.4px solid rgba(114,255,181,.92)!important;
  border-right:2.4px solid rgba(114,255,181,.18)!important;
  animation:v38ShieldSpin 6.5s linear infinite!important;
}
.energy-v38 .v26-shield i:last-child{
  inset:29px!important;
  border-bottom:2px solid rgba(74,205,255,.72)!important;
  border-left:2px solid rgba(74,205,255,.14)!important;
  animation:v38ShieldSpinReverse 8.5s linear infinite!important;
}
.energy-v38 .v26-shield.active{
  animation:v38ShieldAura 2.8s ease-in-out infinite!important;
}
@keyframes v38ShieldSpin{to{transform:rotate(360deg)}}
@keyframes v38ShieldSpinReverse{to{transform:rotate(-360deg)}}
@keyframes v38ShieldCounter{to{transform:rotate(-360deg)}}
@keyframes v38ShieldBreath{
  0%,100%{transform:scale(1);opacity:.70}
  50%{transform:scale(1.035);opacity:1}
}
@keyframes v38ShieldAura{
  0%,100%{filter:drop-shadow(0 0 4px rgba(87,240,158,.14))}
  50%{filter:drop-shadow(0 0 13px rgba(87,240,158,.34))}
}

/* 9 — remove AUTOSSUFICIÊNCIA text from center: percentage only */
.energy-v38 .v26-gauge>div span{
  display:none!important;
}
.energy-v38 .v26-gauge>div strong{
  font-size:31px!important;
}

/* Preserve readable axes from V37 */
.energy-v38 .v26-analytics .v26-ylabel,
.energy-v38 .v26-analytics .v26-xlabel,
.energy-v38 .v26-analytics svg text{
  fill:#ffffff!important;
  color:#ffffff!important;
  opacity:1!important;
}

/* Responsive safeguards */
@media(max-width:1250px) and (min-width:900px){
  .energy-v38 .v26-kpis span{font-size:9.2px!important}
  .energy-v38 .v26-kpis small{font-size:8.2px!important}
  .energy-v38 .v26-kpis em,.energy-v38 .v26-kpis em b{font-size:8px!important}
  .energy-v38 .dates-v14{grid-template-columns:150px auto 150px auto!important}
  .energy-v38 .dates-v14 input,.energy-v38 .dates-v14 label{width:150px!important;max-width:150px!important}
}
@media(max-width:899px){
  .energy-v38 .v26-shield{width:205px!important;height:205px!important}
  .energy-v38 .v26-grid-label{right:7%!important;width:85px!important}
  .energy-v38 .dates-v14{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto!important}
  .energy-v38 .dates-v14 input,.energy-v38 .dates-v14 label{width:100%!important;max-width:none!important}
}


/* ==========================================================================
   V54.0.0 — filtro estável + legibilidade das abas + Rede elétrica por período
   ========================================================================== */

/* 1 — Date picker must stay open: no visual animation/transform on inputs */
.energy-v39 .dates-v14,
.energy-v39 .dates-v14 label,
.energy-v39 .dates-v14 input{
  animation:none!important;
  transform:none!important;
  transition:border-color .15s ease,background .15s ease!important;
}
.energy-v39 .dates-v14 input:focus{
  outline:2px solid rgba(43,199,255,.55)!important;
  outline-offset:1px!important;
  box-shadow:none!important;
}

/* 2 — Overview graph scales significantly larger and white */
.energy-v39 .v26-analytics .v26-ylabel,
.energy-v39 .v26-analytics .v26-xlabel,
.energy-v39 .v26-analytics svg text{
  fill:#ffffff!important;
  color:#ffffff!important;
  opacity:1!important;
  font-size:14px!important;
  font-weight:750!important;
  filter:none!important;
  text-shadow:none!important;
}
.energy-v39 .v26-analytics .v26-legend,
.energy-v39 .v26-analytics .v26-small-legend,
.energy-v39 .v26-analytics .v26-legend span,
.energy-v39 .v26-analytics .v26-small-legend span{
  font-size:12px!important;
}

/* 3 — CONSUMO / Consumo Individual */
.energy-v39 .consumption-grid .scroll-panel .section-head span{
  font-size:11px!important;
}
.energy-v39 .consumption-grid .scroll-panel .section-head strong{
  font-size:18px!important;
}
.energy-v39 .consumption-grid .scroll-panel .section-head small{
  font-size:11px!important;
  line-height:1.4!important;
}
.energy-v39 .consumption-grid .device-row{
  min-height:54px!important;
  grid-template-columns:30px 32px minmax(150px,1.25fr) minmax(130px,1fr) minmax(92px,.6fr)!important;
  gap:10px!important;
  padding:8px 9px!important;
}
.energy-v39 .consumption-grid .device-rank{font-size:10px!important}
.energy-v39 .consumption-grid .device-name strong{
  font-size:12.5px!important;
  line-height:1.25!important;
}
.energy-v39 .consumption-grid .device-name small{
  font-size:10.5px!important;
  line-height:1.35!important;
}
.energy-v39 .consumption-grid .device-energy strong{
  font-size:12px!important;
}
.energy-v39 .consumption-grid .device-energy small{
  font-size:10px!important;
}

/* 4 + 5 — REDE ELÉTRICA accumulated-period card readability */
.energy-v39 .grid-screen .network-card .section-head span{
  font-size:11px!important;
}
.energy-v39 .grid-screen .network-card .section-head strong{
  font-size:19px!important;
  line-height:1.2!important;
}
.energy-v39 .grid-screen .network-card .section-head small{
  font-size:11px!important;
  line-height:1.4!important;
}
.energy-v39 .v29-net-node strong{
  font-size:13px!important;
}
.energy-v39 .v29-net-node span{
  font-size:10.5px!important;
  line-height:1.35!important;
}
.energy-v39 .v29-net-line{
  min-height:74px!important;
  padding:10px 14px!important;
}
.energy-v39 .v29-net-line span{
  font-size:10.5px!important;
  font-weight:800!important;
}
.energy-v39 .v29-net-line strong{
  font-size:20px!important;
}
.energy-v39 .v29-net-line small{
  display:block!important;
  margin-top:3px!important;
  font-size:9.5px!important;
  color:#ffffff!important;
  opacity:.92!important;
}
.energy-v39 .v29-net-balance span{font-size:10.5px!important}
.energy-v39 .v29-net-balance strong{font-size:19px!important}
.energy-v39 .v29-net-balance small{font-size:10px!important}

/* 6 — QUADROS: both cards, all descriptions larger */
.energy-v39 .boards-screen .board-panel{
  padding:17px!important;
}
.energy-v39 .boards-screen .section-head span{
  font-size:11px!important;
}
.energy-v39 .boards-screen .section-head strong{
  font-size:19px!important;
}
.energy-v39 .boards-screen .section-head small{
  font-size:11px!important;
  line-height:1.4!important;
}
.energy-v39 .boards-screen .device-row{
  min-height:54px!important;
  grid-template-columns:30px 32px minmax(160px,1.25fr) minmax(130px,1fr) minmax(96px,.6fr)!important;
  gap:10px!important;
  padding:8px 9px!important;
}
.energy-v39 .boards-screen .device-rank{font-size:10px!important}
.energy-v39 .boards-screen .device-name strong{font-size:12.5px!important}
.energy-v39 .boards-screen .device-name small{font-size:10.5px!important}
.energy-v39 .boards-screen .device-energy strong{font-size:12px!important}
.energy-v39 .boards-screen .device-energy small{font-size:10px!important}
.energy-v39 .boards-screen .untracked span{
  font-size:11px!important;
}
.energy-v39 .boards-screen .untracked strong{
  font-size:15px!important;
}

/* 7 — HISTÓRICO explicitly accessible and properly laid out */
.energy-v39 .master-tabs button[data-tab="history"]{
  pointer-events:auto!important;
  opacity:1!important;
  visibility:visible!important;
  display:flex!important;
  position:relative!important;
  z-index:4!important;
}
.energy-v39 .history-screen{
  display:grid!important;
  grid-template-columns:minmax(0,2.2fr) minmax(260px,.8fr)!important;
  gap:12px!important;
  align-items:stretch!important;
}
.energy-v39 .history-screen>.tab-intro{
  grid-column:1/-1!important;
}
.energy-v39 .history-screen>.history-main{
  grid-column:1!important;
  min-width:0!important;
}
.energy-v39 .history-screen>.history-side{
  grid-column:2!important;
  min-width:0!important;
}
.energy-v39 .v39-tab-error{
  padding:24px!important;
}
.energy-v39 .v39-tab-error strong{
  display:block!important;
  font-size:18px!important;
}
.energy-v39 .v39-tab-error small{
  display:block!important;
  margin-top:8px!important;
  font-size:12px!important;
  color:#ffffff!important;
}

@media(max-width:899px){
  .energy-v39 .v26-analytics .v26-ylabel,
  .energy-v39 .v26-analytics .v26-xlabel,
  .energy-v39 .v26-analytics svg text{
    font-size:11px!important;
  }
  .energy-v39 .history-screen{
    grid-template-columns:1fr!important;
  }
  .energy-v39 .history-screen>.history-main,
  .energy-v39 .history-screen>.history-side{
    grid-column:1!important;
  }
}


/* ==========================================================================
   V54.0.0 — legibilidade global + ajustes por aba
   ========================================================================== */

/* ---------- GLOBAL: subtitles and secondary text WHITE + larger ---------- */
.energy-v40 .tab-intro-copy small{
  font-size:12px!important;
  line-height:1.45!important;
  color:#ffffff!important;
  opacity:.98!important;
  font-weight:650!important;
}
.energy-v40 .section-head small{
  font-size:11px!important;
  line-height:1.4!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v40 .section-head span{
  font-size:10px!important;
}
.energy-v40 .section-head strong{
  font-size:18px!important;
}

/* all detail KPI descriptions */
.energy-v40 .hero-kpi small{
  font-size:10.5px!important;
  line-height:1.38!important;
  color:#ffffff!important;
  opacity:.98!important;
  font-weight:650!important;
}
.energy-v40 .hero-kpi .kpi-top span{
  font-size:9.5px!important;
}
.energy-v40 .hero-kpi .kpi-top em{
  font-size:8px!important;
  color:#ffffff!important;
}
.energy-v40 .hero-kpi>strong{
  font-size:24px!important;
}

/* chart axes + legends across ALL tabs */
.energy-v40 .chart-box svg text,
.energy-v40 .chart-viewport svg text,
.energy-v40 .gridtext,
.energy-v40 .chart-time-label,
.energy-v40 .axis-label,
.energy-v40 .tick-label,
.energy-v40 .v26-ylabel,
.energy-v40 .v26-xlabel{
  fill:#ffffff!important;
  color:#ffffff!important;
  opacity:1!important;
  font-size:13px!important;
  font-weight:700!important;
  filter:none!important;
  text-shadow:none!important;
  stroke:none!important;
}
.energy-v40 .chart-legend,
.energy-v40 .chart-legend span,
.energy-v40 .chart-legend strong,
.energy-v40 .chart-legend-v28,
.energy-v40 .chart-legend-v28 span,
.energy-v40 .chart-legend-v28 strong{
  font-size:11.5px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .chart-legend i,
.energy-v40 .chart-legend-v28 i{
  width:8px!important;
  height:8px!important;
  box-shadow:none!important;
  filter:none!important;
}

/* ---------- VISÃO GERAL ---------- */
/* hide flow line completely beneath cards - opaque tactical masks */
.energy-v40 .v26-source,
.energy-v40 .v26-solar-total,
.energy-v40 .v26-grid-meter{
  background:linear-gradient(145deg,#061723,#04111a)!important;
  backdrop-filter:none!important;
  box-shadow:0 0 0 5px #04111a,0 5px 14px rgba(0,0,0,.32)!important;
  z-index:20!important;
}
.energy-v40 .v26-source:before,
.energy-v40 .v26-source:after,
.energy-v40 .v26-solar-total:before,
.energy-v40 .v26-solar-total:after,
.energy-v40 .v26-grid-meter:before,
.energy-v40 .v26-grid-meter:after{
  pointer-events:none!important;
}

/* subtitle Fluxo de energia */
.energy-v40 .v26-flow-head small{
  font-size:10.5px!important;
  line-height:1.35!important;
  color:#ffffff!important;
  opacity:.98!important;
  font-weight:650!important;
}

/* Period subtitle */
.energy-v40 .filter-label small{
  font-size:10px!important;
  line-height:1.3!important;
  color:#ffffff!important;
  opacity:1!important;
  font-weight:700!important;
}

/* Shield: richer but smoother, no harsh flash */
.energy-v40 .v26-shield{
  width:310px!important;
  height:310px!important;
  animation:v40ShieldAura 4s ease-in-out infinite!important;
}
.energy-v40 .v26-shield:before{
  border:2px solid rgba(81,239,154,.76)!important;
  box-shadow:
    0 0 16px rgba(81,239,154,.24),
    inset 0 0 26px rgba(81,239,154,.07)!important;
  animation:v40ShieldBreath 3.8s ease-in-out infinite!important;
}
.energy-v40 .v26-shield:after{
  inset:14px!important;
  border:1.5px solid rgba(76,202,255,.64)!important;
  border-left-color:rgba(76,202,255,.12)!important;
  border-bottom-color:rgba(76,202,255,.12)!important;
  animation:v40ShieldCounter 12s linear infinite!important;
}
.energy-v40 .v26-shield i:first-child{
  inset:-11px!important;
  border-top:2.4px solid rgba(123,255,188,.95)!important;
  border-right:2.4px solid rgba(123,255,188,.14)!important;
  animation:v40ShieldSpin 7.5s linear infinite!important;
}
.energy-v40 .v26-shield i:last-child{
  inset:31px!important;
  border-bottom:2px solid rgba(77,209,255,.78)!important;
  border-left:2px solid rgba(77,209,255,.10)!important;
  animation:v40ShieldSpinR 10s linear infinite!important;
}
@keyframes v40ShieldSpin{to{transform:rotate(360deg)}}
@keyframes v40ShieldSpinR{to{transform:rotate(-360deg)}}
@keyframes v40ShieldCounter{to{transform:rotate(-360deg)}}
@keyframes v40ShieldBreath{
  0%,100%{transform:scale(1);opacity:.68}
  50%{transform:scale(1.025);opacity:1}
}
@keyframes v40ShieldAura{
  0%,100%{filter:drop-shadow(0 0 5px rgba(70,235,151,.12))}
  50%{filter:drop-shadow(0 0 15px rgba(70,235,151,.30))}
}

/* ---------- GERAÇÃO ---------- */
.energy-v40 .generation-grid .compare-ledger span{
  font-size:10.5px!important;
  color:#ffffff!important;
}
.energy-v40 .generation-grid .compare-ledger strong{
  font-size:16px!important;
}
.energy-v40 .generation-grid .compare-ledger small{
  font-size:10px!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v40 .generation-grid .donut span{
  font-size:10px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .generation-grid .donut strong{
  font-size:25px!important;
}

/* ---------- CONSUMO ---------- */
.energy-v40 .consumption-grid .device-name strong{
  font-size:13.5px!important;
  color:#ffffff!important;
}
.energy-v40 .consumption-grid .device-name small{
  font-size:11.5px!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v40 .consumption-grid .device-energy strong{
  font-size:13px!important;
  color:#ffffff!important;
}
.energy-v40 .consumption-grid .device-energy small{
  font-size:10.5px!important;
  color:#ffffff!important;
  opacity:.95!important;
}
.energy-v40 .consumption-grid .device-rank{
  font-size:10.5px!important;
  color:#ffffff!important;
}

/* ---------- REDE ELÉTRICA ---------- */
/* give animation its own reserved track area, never cover percentages */
.energy-v40 .v29-net-line{
  min-height:88px!important;
  padding:11px 14px 29px!important;
}
.energy-v40 .v29-net-line span,
.energy-v40 .v29-net-line strong,
.energy-v40 .v29-net-line small{
  position:relative!important;
  z-index:3!important;
}
.energy-v40 .v29-net-line span{
  font-size:11px!important;
  color:#ffffff!important;
}
.energy-v40 .v29-net-line strong{
  font-size:21px!important;
}
.energy-v40 .v29-net-line small{
  font-size:10.5px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .v29-net-line i{
  bottom:7px!important;
  top:auto!important;
  z-index:1!important;
  width:9px!important;
  height:9px!important;
  opacity:.78!important;
  box-shadow:none!important;
}

/* Copel top cards/support text */
.energy-v40 .grid-screen .detail-kpis .hero-kpi small{
  font-size:11px!important;
  color:#ffffff!important;
}

/* Force legend colors to match graph */
.energy-v40 .grid-screen .chart-legend .cyan,
.energy-v40 .grid-screen .chart-legend .cyan strong{
  color:#54b8d1!important;
}
.energy-v40 .grid-screen .chart-legend .cyan i{
  background:#54b8d1!important;
}
.energy-v40 .grid-screen .chart-legend .purple,
.energy-v40 .grid-screen .chart-legend .purple strong{
  color:#9c79bc!important;
}
.energy-v40 .grid-screen .chart-legend .purple i{
  background:#9c79bc!important;
}
.energy-v40 .grid-screen .v29-net-node span,
.energy-v40 .grid-screen .v29-net-balance span,
.energy-v40 .grid-screen .v29-net-balance small{
  font-size:11px!important;
  color:#ffffff!important;
  opacity:1!important;
}

/* ---------- QUADROS ---------- */
.energy-v40 .boards-screen .device-name strong{
  font-size:13.5px!important;
  color:#ffffff!important;
}
.energy-v40 .boards-screen .device-name small{
  font-size:11.5px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .boards-screen .device-energy strong{
  font-size:13px!important;
  color:#ffffff!important;
}
.energy-v40 .boards-screen .device-energy small{
  font-size:10.5px!important;
  color:#ffffff!important;
  opacity:.95!important;
}
.energy-v40 .boards-screen .device-rank{
  font-size:10.5px!important;
  color:#ffffff!important;
}
.energy-v40 .boards-screen .untracked span{
  font-size:11.5px!important;
  color:#ffffff!important;
}
.energy-v40 .boards-screen .untracked strong{
  font-size:15px!important;
  color:#ffffff!important;
}

/* ---------- HISTÓRICO ---------- */
.energy-v40 .history-screen .hero-kpi small{
  font-size:11px!important;
  color:#ffffff!important;
}
.energy-v40 .history-screen .hero-kpi .kpi-top span{
  font-size:10px!important;
}
.energy-v40 .history-screen .section-head small{
  font-size:11px!important;
  color:#ffffff!important;
}
.energy-v40 .history-screen .chart-legend span,
.energy-v40 .history-screen .chart-legend strong{
  font-size:11px!important;
}

/* ---------- ANÁLISES ---------- */
.energy-v40 .analytics-screen .donut span{
  font-size:10.5px!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .analytics-screen .donut strong{
  font-size:25px!important;
}
.energy-v40 .analytics-screen .analysis-cards span{
  font-size:11px!important;
  line-height:1.3!important;
  color:#ffffff!important;
  opacity:1!important;
}
.energy-v40 .analytics-screen .analysis-cards strong{
  font-size:17px!important;
  line-height:1.15!important;
}
.energy-v40 .analytics-screen .analysis-cards small{
  font-size:10.5px!important;
  line-height:1.35!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v40 .analytics-screen .section-head small{
  font-size:11px!important;
  color:#ffffff!important;
}

/* ---------- CONFIG ---------- */
.energy-v40 .status-screen .status-row span{
  font-size:12px!important;
  color:#ffffff!important;
}
.energy-v40 .status-screen .status-row strong{
  font-size:11px!important;
}
.energy-v40 .status-screen .status-row small{
  font-size:10.5px!important;
  line-height:1.35!important;
  color:#ffffff!important;
  opacity:.96!important;
}
.energy-v40 .status-screen .status-row.bad{
  border-color:rgba(255,83,111,.42)!important;
}
.energy-v40 .status-screen .status-row.ok{
  border-color:rgba(69,232,143,.20)!important;
}
.energy-v40 .status-screen .section-head small{
  font-size:11.5px!important;
  color:#ffffff!important;
}

/* responsive */
@media(max-width:899px){
  .energy-v40 .tab-intro-copy small{font-size:10.5px!important}
  .energy-v40 .section-head small{font-size:10px!important}
  .energy-v40 .chart-box svg text,
  .energy-v40 .chart-viewport svg text{font-size:10.5px!important}
  .energy-v40 .v26-shield{width:215px!important;height:215px!important}
}


/* ==========================================================================
   V54.0.0 — fluxo correto + legendas fiéis + análise + responsividade
   ========================================================================== */

/* 1 — VISÃO GERAL: IMPORTAÇÃO precisa vir da REDE -> CASA.
   Mantém exportação no sentido CASA -> REDE. */
.energy-v41 .v33-pulse.import.active,
.energy-v41 .v26-pulse.import.active,
.energy-v41 .flow-pulse.import.active,
.energy-v41 .energy-particle.import.active{
  animation-direction:reverse!important;
}
.energy-v41 .v33-pulse.export.active,
.energy-v41 .v26-pulse.export.active,
.energy-v41 .flow-pulse.export.active,
.energy-v41 .energy-particle.export.active{
  animation-direction:normal!important;
}

/* Para animações baseadas em offset-path/motion-path */
.energy-v41 .import-dot,
.energy-v41 .flow-dot.import,
.energy-v41 .particle.import{
  animation-direction:reverse!important;
}
.energy-v41 .export-dot,
.energy-v41 .flow-dot.export,
.energy-v41 .particle.export{
  animation-direction:normal!important;
}

/* 2 — ABA GERAÇÃO: legenda exatamente nas cores das séries */
.energy-v41 .generation-grid .chart-legend span:nth-child(1) i,
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(1) i{
  background:#50e58a!important;
}
.energy-v41 .generation-grid .chart-legend span:nth-child(2) i,
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(2) i{
  background:#4ca7ff!important;
}
.energy-v41 .generation-grid .chart-legend span:nth-child(3) i,
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(3) i{
  background:#f6a23a!important;
}
.energy-v41 .generation-grid .chart-legend span:nth-child(1),
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(1){color:#50e58a!important}
.energy-v41 .generation-grid .chart-legend span:nth-child(2),
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(2){color:#4ca7ff!important}
.energy-v41 .generation-grid .chart-legend span:nth-child(3),
.energy-v41 .generation-grid .chart-legend-v28 span:nth-child(3){color:#f6a23a!important}

/* 3 — ABA CONSUMO: Casa/QUADRO A/QUADRO B / DEMAIS nas mesmas cores das séries */
.energy-v41 .consumption-grid .chart-legend span:nth-child(1) i,
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(1) i{
  background:#ff5f7f!important;
}
.energy-v41 .consumption-grid .chart-legend span:nth-child(2) i,
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(2) i{
  background:#4fe18a!important;
}
.energy-v41 .consumption-grid .chart-legend span:nth-child(3) i,
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(3) i{
  background:#f3aa43!important;
}
.energy-v41 .consumption-grid .chart-legend span:nth-child(1),
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(1){color:#ff5f7f!important}
.energy-v41 .consumption-grid .chart-legend span:nth-child(2),
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(2){color:#4fe18a!important}
.energy-v41 .consumption-grid .chart-legend span:nth-child(3),
.energy-v41 .consumption-grid .chart-legend-v28 span:nth-child(3){color:#f3aa43!important}

/* 4 — ABA REDE ELÉTRICA: Importação cyan, Exportação roxo, iguais ao gráfico */
.energy-v41 .grid-screen .chart-legend span:nth-child(1) i,
.energy-v41 .grid-screen .chart-legend-v28 span:nth-child(1) i{
  background:#55b7cf!important;
}
.energy-v41 .grid-screen .chart-legend span:nth-child(2) i,
.energy-v41 .grid-screen .chart-legend-v28 span:nth-child(2) i{
  background:#9b78ba!important;
}
.energy-v41 .grid-screen .chart-legend span:nth-child(1),
.energy-v41 .grid-screen .chart-legend-v28 span:nth-child(1){color:#55b7cf!important}
.energy-v41 .grid-screen .chart-legend span:nth-child(2),
.energy-v41 .grid-screen .chart-legend-v28 span:nth-child(2){color:#9b78ba!important}

/* 5 — ABA ANÁLISES: gauges maiores para o texto caber sem sobreposição */
.energy-v41 .analytics-screen .donut,
.energy-v41 .analytics-screen .analysis-donut,
.energy-v41 .analytics-screen .gauge,
.energy-v41 .analytics-screen .ring{
  width:148px!important;
  height:148px!important;
  min-width:148px!important;
  min-height:148px!important;
}
.energy-v41 .analytics-screen .donut strong,
.energy-v41 .analytics-screen .analysis-donut strong,
.energy-v41 .analytics-screen .gauge strong,
.energy-v41 .analytics-screen .ring strong{
  font-size:29px!important;
  line-height:1!important;
}
.energy-v41 .analytics-screen .donut span,
.energy-v41 .analytics-screen .analysis-donut span,
.energy-v41 .analytics-screen .gauge span,
.energy-v41 .analytics-screen .ring span{
  font-size:10.5px!important;
  line-height:1.15!important;
  max-width:100px!important;
  white-space:normal!important;
  text-align:center!important;
}

/* ==========================================================================
   RESPONSIVIDADE REAL — TABLET
   ========================================================================== */
@media (max-width:1180px) and (min-width:700px){

  .energy-v41{
    font-size:1rem!important;
  }

  .energy-v41 .master-tabs{
    overflow-x:auto!important;
    scrollbar-width:none!important;
  }
  .energy-v41 .master-tabs::-webkit-scrollbar{display:none!important}
  .energy-v41 .master-tabs button{
    min-width:110px!important;
    flex:0 0 auto!important;
    padding:11px 12px!important;
  }

  .energy-v41 .filter-v14{
    grid-template-columns:1fr!important;
    gap:10px!important;
  }
  .energy-v41 .quick-v14{
    flex-wrap:wrap!important;
  }
  .energy-v41 .dates-v14{
    grid-template-columns:minmax(160px,1fr) auto minmax(160px,1fr) auto!important;
    width:100%!important;
  }
  .energy-v41 .dates-v14 input,
  .energy-v41 .dates-v14 label{
    width:100%!important;
    max-width:none!important;
  }

  .energy-v41 .v26-kpis{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:8px!important;
  }
  .energy-v41 .v26-kpis article{
    width:auto!important;
    min-width:0!important;
  }

  .energy-v41 .v26-overview-grid{
    grid-template-columns:minmax(0,1fr)!important;
  }
  .energy-v41 .v26-summary{
    width:100%!important;
  }

  .energy-v41 .v26-analytics{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
  .energy-v41 .v26-lower{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }

  .energy-v41 .generation-grid,
  .energy-v41 .consumption-grid,
  .energy-v41 .grid-screen .content-grid,
  .energy-v41 .history-screen,
  .energy-v41 .analytics-screen .analysis-layout{
    grid-template-columns:1fr!important;
  }

  .energy-v41 .generation-grid .compare-ledger,
  .energy-v41 .consumption-grid .scroll-panel,
  .energy-v41 .grid-screen .network-card,
  .energy-v41 .history-screen>.history-main,
  .energy-v41 .history-screen>.history-side{
    grid-column:1!important;
  }

  .energy-v41 .boards-screen .boards-grid{
    grid-template-columns:1fr 1fr!important;
  }
}

/* ==========================================================================
   RESPONSIVIDADE REAL — MOBILE
   ========================================================================== */
@media (max-width:699px){

  .energy-v41{
    width:100%!important;
    min-width:0!important;
    overflow-x:hidden!important;
  }

  .energy-v41 .top-shell,
  .energy-v41 .main-shell,
  .energy-v41 .screen{
    padding-left:8px!important;
    padding-right:8px!important;
  }

  .energy-v41 .brand{
    min-width:0!important;
  }
  .energy-v41 .brand strong{
    font-size:19px!important;
  }
  .energy-v41 .brand small{
    font-size:8px!important;
  }

  .energy-v41 .master-tabs{
    display:flex!important;
    overflow-x:auto!important;
    scroll-snap-type:x proximity!important;
    scrollbar-width:none!important;
  }
  .energy-v41 .master-tabs::-webkit-scrollbar{display:none!important}
  .energy-v41 .master-tabs button{
    flex:0 0 104px!important;
    min-width:104px!important;
    scroll-snap-align:start!important;
    padding:10px 8px!important;
  }

  .energy-v41 .filter-v14{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
  }
  .energy-v41 .filter-label{
    width:100%!important;
  }
  .energy-v41 .quick-v14{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:5px!important;
    width:100%!important;
  }
  .energy-v41 .quick-v14 button{
    min-width:0!important;
    padding:7px 3px!important;
    font-size:8px!important;
  }
  .energy-v41 .dates-v14{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }
  .energy-v41 .dates-v14 label,
  .energy-v41 .dates-v14 input{
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
  }
  .energy-v41 #applyRange{
    grid-column:1/-1!important;
    width:100%!important;
  }

  /* KPI: 2 por linha */
  .energy-v41 .v26-kpis{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:7px!important;
  }
  .energy-v41 .v26-kpis article{
    width:auto!important;
    min-width:0!important;
    min-height:104px!important;
  }

  /* fluxo principal mobile: maintain visual order */
  .energy-v41 .v26-flow-wrap{
    min-height:460px!important;
    overflow:hidden!important;
  }
  .energy-v41 .v26-flow-canvas{
    min-width:0!important;
    width:100%!important;
    transform:none!important;
  }
  .energy-v41 .v26-shield{
    width:190px!important;
    height:190px!important;
  }
  .energy-v41 .v26-house{
    transform:scale(.80)!important;
    transform-origin:center bottom!important;
  }
  .energy-v41 .v26-solar-asset{
    transform:scale(.72)!important;
    transform-origin:left bottom!important;
  }
  .energy-v41 .v26-grid-asset{
    transform:scale(.72)!important;
    transform-origin:right bottom!important;
  }

  /* secondary overview cards */
  .energy-v41 .v26-overview-grid,
  .energy-v41 .v26-analytics,
  .energy-v41 .v26-lower{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
  }

  .energy-v41 .v26-summary{
    width:100%!important;
    order:2!important;
  }

  .energy-v41 .v26-chart-card{
    min-width:0!important;
    width:100%!important;
  }

  /* all detail tabs stack vertically */
  .energy-v41 .generation-grid,
  .energy-v41 .consumption-grid,
  .energy-v41 .grid-screen .content-grid,
  .energy-v41 .boards-screen .boards-grid,
  .energy-v41 .history-screen,
  .energy-v41 .analytics-screen .analysis-layout{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:9px!important;
  }

  .energy-v41 .detail-kpis{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }

  /* legends wrap instead of clipping */
  .energy-v41 .chart-legend,
  .energy-v41 .chart-legend-v28{
    display:flex!important;
    flex-wrap:wrap!important;
    gap:8px 12px!important;
    line-height:1.4!important;
    padding-bottom:6px!important;
  }

  /* device lists */
  .energy-v41 .device-row{
    grid-template-columns:24px 28px minmax(0,1fr) auto!important;
    gap:7px!important;
  }
  .energy-v41 .device-row .device-bar{
    grid-column:3/-1!important;
    width:100%!important;
  }
  .energy-v41 .device-energy{
    min-width:76px!important;
  }

  /* Copel accumulated card */
  .energy-v41 .v29-net{
    grid-template-columns:1fr!important;
    gap:10px!important;
  }
  .energy-v41 .v29-net-node{
    justify-self:center!important;
  }
  .energy-v41 .v29-net-line{
    width:100%!important;
  }

  /* Analysis gauges */
  .energy-v41 .analytics-screen .donut,
  .energy-v41 .analytics-screen .analysis-donut,
  .energy-v41 .analytics-screen .gauge,
  .energy-v41 .analytics-screen .ring{
    width:132px!important;
    height:132px!important;
    min-width:132px!important;
    min-height:132px!important;
  }
  .energy-v41 .analytics-screen .analysis-cards{
    grid-template-columns:1fr!important;
  }

  /* tables/rows readable on narrow screens */
  .energy-v41 .status-grid{
    grid-template-columns:1fr!important;
  }
  .energy-v41 .status-row{
    min-width:0!important;
  }
}


/* ==========================================================================
   V54.0.0 — correções pontuais: FONTE A, importação, legendas, análise, resumo
   ========================================================================== */

/* 1 — IMPORTAÇÃO: o path SVG já foi desenhado TORRE -> CASA.
   Portanto o dash-offset deve correr no sentido NORMAL do próprio path.
   V41 invertia novamente o sentido e provocava o movimento errado. */
.energy-v42 .v33-pulse.import.active,
.energy-v42 .v26-pulse.import.active,
.energy-v42 .flow-pulse.import.active,
.energy-v42 .energy-particle.import.active,
.energy-v42 .import-dot,
.energy-v42 .flow-dot.import,
.energy-v42 .particle.import{
  animation-direction:normal!important;
}
.energy-v42 .v33-pulse.export.active,
.energy-v42 .v26-pulse.export.active,
.energy-v42 .flow-pulse.export.active,
.energy-v42 .energy-particle.export.active,
.energy-v42 .export-dot,
.energy-v42 .flow-dot.export,
.energy-v42 .particle.export{
  animation-direction:normal!important;
}

/* 2 — RESUMO DO DIA: ícones mais elegantes, leves e técnicos */
.energy-v42 .v26-summary-list i{
  width:26px!important;
  height:26px!important;
  padding:4px!important;
  border-radius:8px!important;
  background:linear-gradient(145deg,rgba(8,27,40,.76),rgba(2,12,20,.92))!important;
  border:1px solid color-mix(in srgb,currentColor 42%,rgba(255,255,255,.05))!important;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.025),
    0 3px 9px rgba(0,0,0,.28)!important;
  filter:none!important;
}
.energy-v42 .v26-summary-list i svg{
  width:100%!important;
  height:100%!important;
  fill:none!important;
  stroke:currentColor!important;
  stroke-width:1.55!important;
  stroke-linecap:round!important;
  stroke-linejoin:round!important;
  animation:none!important;
  filter:none!important;
}
.energy-v42 .v26-summary-list>div{
  grid-template-columns:28px minmax(0,1fr) auto!important;
}
.energy-v42 .v26-summary-list .solar i{color:#63e991!important}
.energy-v42 .v26-summary-list .inverter i{color:#64aaff!important}
.energy-v42 .v26-summary-list .micro i{color:#ffb454!important}
.energy-v42 .v26-summary-list .house i{color:#ff6e8b!important}
.energy-v42 .v26-summary-list .import i{color:#62c7e6!important}
.energy-v42 .v26-summary-list .export i{color:#9a83dc!important}
.energy-v42 .v26-summary-list .balance i{color:#65e994!important}

/* 3 — LEGENDA GERAÇÃO: força cor também no texto interno */
.energy-v42 .generation-grid .chart-legend span.green i{background:#50e58a!important;color:#50e58a!important}
.energy-v42 .generation-grid .chart-legend span.blue i{background:#4ca7ff!important;color:#4ca7ff!important}
.energy-v42 .generation-grid .chart-legend span.orange i{background:#f6a23a!important;color:#f6a23a!important}
.energy-v42 .generation-grid .chart-legend span.green strong{color:#50e58a!important}
.energy-v42 .generation-grid .chart-legend span.blue strong{color:#4ca7ff!important}
.energy-v42 .generation-grid .chart-legend span.orange strong{color:#f6a23a!important}

/* 4 — LEGENDA CONSUMO */
.energy-v42 .consumption-grid .chart-legend span.red i{background:#ff5f7f!important;color:#ff5f7f!important}
.energy-v42 .consumption-grid .chart-legend span.green i{background:#4fe18a!important;color:#4fe18a!important}
.energy-v42 .consumption-grid .chart-legend span.orange i{background:#f3aa43!important;color:#f3aa43!important}
.energy-v42 .consumption-grid .chart-legend span.red strong{color:#ff5f7f!important}
.energy-v42 .consumption-grid .chart-legend span.green strong{color:#4fe18a!important}
.energy-v42 .consumption-grid .chart-legend span.orange strong{color:#f3aa43!important}

/* 5 — REDE ELÉTRICA: seletor correto é .grid-network, não .grid-screen */
.energy-v42 .grid-network .chart-legend span.cyan i{
  background:#55b7cf!important;
  color:#55b7cf!important;
}
.energy-v42 .grid-network .chart-legend span.purple i{
  background:#9b78ba!important;
  color:#9b78ba!important;
}
.energy-v42 .grid-network .chart-legend span.cyan strong{
  color:#55b7cf!important;
}
.energy-v42 .grid-network .chart-legend span.purple strong{
  color:#9b78ba!important;
}

/* 6 — ABA ANÁLISES: 3 gauges em uma linha horizontal centralizada */
.energy-v42 .analytics-screen{
  grid-template-columns:minmax(560px,.85fr) minmax(0,1.55fr)!important;
  align-items:stretch!important;
}
.energy-v42 .analytics-screen>.tab-intro{
  grid-column:1/-1!important;
}
.energy-v42 .analytics-gauges{
  display:flex!important;
  flex-direction:row!important;
  flex-wrap:nowrap!important;
  justify-content:center!important;
  align-items:center!important;
  gap:22px!important;
  min-width:0!important;
  padding:26px 18px!important;
}
.energy-v42 .analytics-gauges .donut{
  flex:0 0 150px!important;
  width:150px!important;
  height:150px!important;
  min-width:150px!important;
  min-height:150px!important;
}
.energy-v42 .analytics-ledger{
  min-width:0!important;
}

/* Tablet: horizontal but slightly smaller */
@media(max-width:1180px) and (min-width:700px){
  .energy-v42 .analytics-screen{
    grid-template-columns:1fr!important;
  }
  .energy-v42 .analytics-gauges{
    grid-column:1!important;
    gap:28px!important;
  }
  .energy-v42 .analytics-gauges .donut{
    flex-basis:142px!important;
    width:142px!important;
    height:142px!important;
    min-width:142px!important;
    min-height:142px!important;
  }
}

/* Mobile: preserve horizontal centralization without clipping */
@media(max-width:699px){
  .energy-v42 .analytics-screen{
    grid-template-columns:1fr!important;
  }
  .energy-v42 .analytics-gauges{
    display:flex!important;
    flex-direction:row!important;
    flex-wrap:wrap!important;
    justify-content:center!important;
    gap:12px!important;
    padding:16px 6px!important;
  }
  .energy-v42 .analytics-gauges .donut{
    flex:0 0 122px!important;
    width:122px!important;
    height:122px!important;
    min-width:122px!important;
    min-height:122px!important;
  }
}


/* ==========================================================================
   V54.0.0 — Rede elétrica dupla ativa + Análises expandidas
   ========================================================================== */

/* Rede elétrica: importação e exportação podem ficar ativas ao mesmo tempo */
.energy-v43 .v29-net-line.import.active,
.energy-v43 .v29-net-line.export.active{
  opacity:1!important;
  filter:none!important;
}
.energy-v43 .v29-net-line.import.active{
  border-color:rgba(85,183,207,.55)!important;
  background:linear-gradient(90deg,rgba(85,183,207,.08),rgba(4,17,25,.92))!important;
}
.energy-v43 .v29-net-line.export.active{
  border-color:rgba(155,120,186,.58)!important;
  background:linear-gradient(90deg,rgba(155,120,186,.09),rgba(4,17,25,.92))!important;
}
.energy-v43 .v29-net-line.import.active i{
  background:#55b7cf!important;
}
.energy-v43 .v29-net-line.export.active i{
  background:#9b78ba!important;
}

/* Analytics layout */
.energy-v43 .analytics-screen{
  display:grid!important;
  grid-template-columns:minmax(430px,.72fr) minmax(0,1.28fr)!important;
  gap:12px!important;
  align-items:start!important;
}
.energy-v43 .analytics-screen>.tab-intro{
  grid-column:1/-1!important;
}
.energy-v43 .analytics-gauges{
  grid-column:1!important;
  grid-row:2!important;
  min-height:260px!important;
  align-self:stretch!important;
}
.energy-v43 .analytics-ledger{
  grid-column:2!important;
  grid-row:2!important;
}
.energy-v43 .analytics-performance{
  grid-column:1!important;
  grid-row:3!important;
}
.energy-v43 .analytics-balance{
  grid-column:2!important;
  grid-row:3!important;
}

/* gauges */
.energy-v43 .analytics-gauges .donut{
  position:relative!important;
}
.energy-v43 .analytics-gauges .donut small{
  position:absolute!important;
  left:50%!important;
  top:calc(50% + 32px)!important;
  transform:translateX(-50%)!important;
  width:128px!important;
  font-size:8.5px!important;
  line-height:1.2!important;
  color:#fff!important;
  opacity:.82!important;
  text-align:center!important;
}

/* analytical cards */
.energy-v43 .analysis-cards{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:8px!important;
}
.energy-v43 .analysis-metric{
  border:1px solid rgba(90,165,205,.22)!important;
  background:linear-gradient(145deg,rgba(8,25,36,.82),rgba(3,13,21,.92))!important;
  border-radius:12px!important;
  padding:13px 14px!important;
  min-height:80px!important;
}
.energy-v43 .analysis-metric span{
  display:block!important;
  color:#fff!important;
  font-size:10.5px!important;
  font-weight:800!important;
  opacity:.92!important;
}
.energy-v43 .analysis-metric strong{
  display:block!important;
  margin-top:5px!important;
  color:#fff!important;
  font-size:20px!important;
  line-height:1.05!important;
}
.energy-v43 .analysis-metric small{
  display:block!important;
  margin-top:4px!important;
  color:#fff!important;
  font-size:10px!important;
  opacity:.82!important;
}
.energy-v43 .analysis-metric.green strong{color:#51e791!important}
.energy-v43 .analysis-metric.red strong{color:#ff627f!important}
.energy-v43 .analysis-metric.cyan strong{color:#59c7e4!important}
.energy-v43 .analysis-metric.purple strong{color:#aa79e9!important}

/* efficiency bars */
.energy-v43 .analysis-bars{
  display:grid!important;
  gap:16px!important;
}
.energy-v43 .analysis-bars>div{
  display:grid!important;
  gap:6px!important;
}
.energy-v43 .bar-label{
  display:flex!important;
  justify-content:space-between!important;
  gap:12px!important;
  color:#fff!important;
}
.energy-v43 .bar-label span{
  font-size:12px!important;
  font-weight:750!important;
}
.energy-v43 .bar-label strong{
  font-size:15px!important;
}
.energy-v43 .bar-track{
  height:10px!important;
  border-radius:999px!important;
  overflow:hidden!important;
  background:rgba(70,120,150,.15)!important;
  border:1px solid rgba(80,150,190,.16)!important;
}
.energy-v43 .bar-track i{
  display:block!important;
  height:100%!important;
  border-radius:inherit!important;
  background:linear-gradient(90deg,#3eb8d8,#69d7ef)!important;
}
.energy-v43 .bar-track.green i{
  background:linear-gradient(90deg,#36cb78,#72efa6)!important;
}
.energy-v43 .bar-track.purple i{
  background:linear-gradient(90deg,#8f5be1,#bc83ff)!important;
}
.energy-v43 .analysis-bars small{
  font-size:10px!important;
  color:#fff!important;
  opacity:.78!important;
}

/* balance */
.energy-v43 .balance-grid{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:8px!important;
}
.energy-v43 .balance-summary{
  margin-top:12px!important;
  border-radius:13px!important;
  padding:14px 16px!important;
  border:1px solid rgba(76,188,227,.24)!important;
  background:linear-gradient(135deg,rgba(6,24,35,.94),rgba(4,14,22,.98))!important;
}
.energy-v43 .balance-summary span{
  display:block!important;
  font-size:10.5px!important;
  font-weight:800!important;
  color:#fff!important;
}
.energy-v43 .balance-summary strong{
  display:block!important;
  margin-top:4px!important;
  font-size:27px!important;
}
.energy-v43 .balance-summary small{
  display:block!important;
  margin-top:4px!important;
  font-size:10.5px!important;
  color:#fff!important;
  opacity:.82!important;
}
.energy-v43 .balance-summary.positive strong{color:#56e995!important}
.energy-v43 .balance-summary.negative strong{color:#ff657f!important}

/* Tablet */
@media(max-width:1180px){
  .energy-v43 .analytics-screen{
    grid-template-columns:1fr!important;
  }
  .energy-v43 .analytics-gauges,
  .energy-v43 .analytics-ledger,
  .energy-v43 .analytics-performance,
  .energy-v43 .analytics-balance{
    grid-column:1!important;
    grid-row:auto!important;
  }
  .energy-v43 .balance-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
}

/* Mobile */
@media(max-width:699px){
  .energy-v43 .analysis-cards,
  .energy-v43 .balance-grid{
    grid-template-columns:1fr!important;
  }
  .energy-v43 .analytics-performance,
  .energy-v43 .analytics-balance{
    padding:12px!important;
  }
  .energy-v43 .bar-label span{font-size:11px!important}
  .energy-v43 .analysis-metric strong{font-size:18px!important}
}


/* ==========================================================================
   V54.0.0 — assets Copel, histórico legível, análise reparada, mobile rebuilt
   ========================================================================== */

/* 1 — REDE ELÉTRICA: assets discretamente maiores sem quebrar o card */
.energy-v44 .v29-net-node.house img{
  max-width:245px!important;
  max-height:126px!important;
}
.energy-v44 .v29-net-node.copel img{
  max-width:112px!important;
  max-height:134px!important;
}
.energy-v44 .v29-network-scene{
  grid-template-columns:minmax(145px,.75fr) minmax(320px,2.7fr) minmax(125px,.65fr)!important;
  align-items:center!important;
  gap:22px!important;
}

/* 2 — HISTÓRICO: gráfico de colunas comparativas, sem sobreposição de 6 linhas */
.energy-v44 .history-bars-chart{
  position:relative!important;
  min-height:355px!important;
  padding:8px 4px 0!important;
}
.energy-v44 .history-bars-chart svg{
  width:100%!important;
  height:300px!important;
  overflow:visible!important;
}
.energy-v44 .history-grid{
  stroke:rgba(150,190,210,.13)!important;
  stroke-width:1!important;
  vector-effect:non-scaling-stroke!important;
}
.energy-v44 .history-grid.vertical{
  stroke:rgba(150,190,210,.08)!important;
}
.energy-v44 .history-y,
.energy-v44 .history-x{
  fill:#fff!important;
  font-size:14px!important;
  font-weight:700!important;
}
.energy-v44 .history-bar{
  opacity:.82!important;
  filter:none!important;
}
.energy-v44 .history-bars-legend{
  display:flex!important;
  flex-wrap:wrap!important;
  gap:11px 20px!important;
  padding:10px 20px 4px!important;
  color:#fff!important;
  font-size:12px!important;
  font-weight:700!important;
}
.energy-v44 .history-bars-legend span{
  display:flex!important;
  align-items:center!important;
  gap:7px!important;
  color:#fff!important;
}
.energy-v44 .history-bars-legend i{
  width:9px!important;
  height:9px!important;
  border-radius:50%!important;
  flex:0 0 auto!important;
}
.energy-v44 .history-side{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:8px!important;
}

/* 3 — ANÁLISES: gauges reais e alinhamento sólido */
.energy-v44 .analytics-gauges{
  display:flex!important;
  justify-content:center!important;
  align-items:center!important;
  gap:28px!important;
  min-height:270px!important;
  padding:24px!important;
}
.energy-v44 .analytics-gauges .analysis-donut{
  position:relative!important;
  width:150px!important;
  height:172px!important;
  min-width:150px!important;
  min-height:172px!important;
  display:flex!important;
  align-items:flex-start!important;
  justify-content:center!important;
}
.energy-v44 .analytics-gauges .analysis-donut svg{
  position:absolute!important;
  top:0!important;
  left:50%!important;
  transform:translateX(-50%) rotate(-90deg)!important;
  width:150px!important;
  height:150px!important;
}
.energy-v44 .analytics-gauges .analysis-donut>div{
  position:absolute!important;
  top:48px!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  width:116px!important;
  text-align:center!important;
}
.energy-v44 .analytics-gauges .analysis-donut>div strong{
  display:block!important;
  font-size:27px!important;
  line-height:1!important;
  color:#fff!important;
}
.energy-v44 .analytics-gauges .analysis-donut>div span{
  display:block!important;
  margin-top:7px!important;
  font-size:9px!important;
  line-height:1.15!important;
  color:#fff!important;
  font-weight:800!important;
  white-space:normal!important;
}
.energy-v44 .analytics-gauges .analysis-donut>small{
  position:absolute!important;
  left:50%!important;
  bottom:0!important;
  transform:translateX(-50%)!important;
  width:145px!important;
  text-align:center!important;
  color:#fff!important;
  opacity:.82!important;
  font-size:9.5px!important;
  line-height:1.2!important;
}
.energy-v44 .analytics-gauges .analysis-donut.cyan .d-fg{stroke:#35cfff!important}
.energy-v44 .analytics-gauges .analysis-donut.purple .d-fg{stroke:#a960ff!important}
.energy-v44 .analytics-gauges .analysis-donut.green .d-fg{stroke:#42ec7a!important}
.energy-v44 .analytics-gauges .analysis-donut .d-bg{stroke:rgba(100,140,160,.16)!important}

/* ==========================================================================
   MOBILE — reconstrução do layout em vez de apenas reduzir o desktop
   ========================================================================== */
@media(max-width:699px){

  .energy-v44{
    width:100%!important;
    max-width:100vw!important;
    overflow-x:hidden!important;
    font-size:14px!important;
  }

  /* Header/navigation */
  .energy-v44 .top-shell{
    width:100%!important;
    min-width:0!important;
    overflow:hidden!important;
  }
  .energy-v44 .master-tabs{
    display:flex!important;
    overflow-x:auto!important;
    gap:0!important;
    scrollbar-width:none!important;
    -webkit-overflow-scrolling:touch!important;
  }
  .energy-v44 .master-tabs::-webkit-scrollbar{display:none!important}
  .energy-v44 .master-tabs button{
    flex:0 0 92px!important;
    min-width:92px!important;
    height:58px!important;
    padding:7px 4px!important;
  }

  /* Filter */
  .energy-v44 .filter-v14{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
    padding:9px!important;
  }
  .energy-v44 .quick-v14{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:4px!important;
  }
  .energy-v44 .dates-v14{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:6px!important;
  }
  .energy-v44 #applyRange{
    grid-column:1/-1!important;
    width:100%!important;
  }

  /* KPI overview */
  .energy-v44 .v26-kpis{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:7px!important;
    padding:7px!important;
  }
  .energy-v44 .v26-kpis article{
    width:auto!important;
    min-width:0!important;
    min-height:102px!important;
    padding:10px!important;
  }
  .energy-v44 .v26-kpis article>i{
    width:30px!important;
    height:30px!important;
  }
  .energy-v44 .v26-kpis article span{font-size:8px!important}
  .energy-v44 .v26-kpis article strong{font-size:20px!important}
  .energy-v44 .v26-kpis article small,
  .energy-v44 .v26-kpis article em{font-size:8px!important}

  /* Main flow gets its own purpose-built mobile geometry */
  .energy-v44 .v26-hero-grid{
    display:block!important;
    width:100%!important;
  }
  .energy-v44 .v26-flow{
    width:100%!important;
    min-width:0!important;
  }
  .energy-v44 .v26-flow-head{
    height:auto!important;
    min-height:62px!important;
    padding:10px 9px!important;
  }
  .energy-v44 .v26-flow-head strong{font-size:13px!important}
  .energy-v44 .v26-flow-head small{
    font-size:9px!important;
    line-height:1.25!important;
    max-width:230px!important;
  }
  .energy-v44 .v26-scene{
    height:500px!important;
    min-height:500px!important;
    overflow:hidden!important;
    position:relative!important;
  }

  .energy-v44 .v26-scene .asset-house{
    left:50%!important;
    bottom:4px!important;
    width:58%!important;
    max-width:none!important;
    max-height:46%!important;
    transform:translateX(-50%)!important;
  }
  .energy-v44 .v26-scene .asset-solar{
    left:-3%!important;
    bottom:0!important;
    width:29%!important;
    max-height:23%!important;
    transform:none!important;
  }
  .energy-v44 .v26-scene .asset-grid{
    right:-1%!important;
    bottom:0!important;
    width:23%!important;
    max-height:34%!important;
    transform:none!important;
  }

  .energy-v44 .v26-shield{
    left:50%!important;
    top:auto!important;
    bottom:47px!important;
    width:205px!important;
    height:205px!important;
    transform:translateX(-50%)!important;
  }

  /* Cards are placed in clear lanes; no overlap with house */
  .energy-v44 .v26-source{
    width:128px!important;
    min-width:128px!important;
    height:66px!important;
    min-height:66px!important;
    padding:7px!important;
  }
  .energy-v44 .v26-inverter{
    left:6%!important;
    top:11%!important;
  }
  .energy-v44 .v26-micro{
    left:6%!important;
    top:29%!important;
  }
  .energy-v44 .v26-solar-total{
    left:50%!important;
    top:26%!important;
    transform:translateX(-50%)!important;
    width:116px!important;
    min-width:116px!important;
    height:58px!important;
    min-height:58px!important;
    padding:7px!important;
  }
  .energy-v44 .v26-grid-meter{
    right:4%!important;
    width:122px!important;
    min-width:122px!important;
    height:62px!important;
    min-height:62px!important;
    padding:7px!important;
  }
  .energy-v44 .v26-grid-meter.import{top:12%!important}
  .energy-v44 .v26-grid-meter.export{top:31%!important}
  .energy-v44 .v26-house-meter{
    left:50%!important;
    bottom:3px!important;
    top:auto!important;
    transform:translateX(-50%)!important;
    width:142px!important;
    min-width:142px!important;
    z-index:12!important;
  }
  .energy-v44 .v26-grid-label{
    right:4%!important;
    bottom:8px!important;
    width:88px!important;
  }

  /* SVG stays behind cards/assets. Scale path field as one unit. */
  .energy-v44 .v26-flow-svg{
    position:absolute!important;
    inset:0!important;
    width:100%!important;
    height:100%!important;
    z-index:4!important;
    pointer-events:none!important;
  }
  .energy-v44 .scene-art{z-index:3!important}
  .energy-v44 .v26-shield{z-index:5!important}
  .energy-v44 .v26-source,
  .energy-v44 .v26-solar-total,
  .energy-v44 .v26-grid-meter,
  .energy-v44 .v26-house-meter,
  .energy-v44 .v26-grid-label{z-index:9!important}

  /* Summary moves under the flow instead of beside/over it */
  .energy-v44 .v26-summary{
    width:100%!important;
    margin-top:8px!important;
    padding:12px!important;
  }
  .energy-v44 .v26-summary header>strong{font-size:15px!important}
  .energy-v44 .v26-summary-list span,
  .energy-v44 .v26-summary-list strong{font-size:11px!important}

  /* Overview charts/lower cards */
  .energy-v44 .v26-analytics,
  .energy-v44 .v26-lower{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
  }
  .energy-v44 .v26-chart-card,
  .energy-v44 .v26-lower-card{
    min-width:0!important;
    width:100%!important;
  }

  /* Detail pages */
  .energy-v44 .detail-kpis{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
  }
  .energy-v44 .two-col,
  .energy-v44 .grid-network,
  .energy-v44 .history-screen,
  .energy-v44 .analytics-screen,
  .energy-v44 .boards-screen{
    grid-template-columns:1fr!important;
  }

  /* Copel mobile */
  .energy-v44 .v29-network-scene{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:14px!important;
  }
  .energy-v44 .v29-net-node.house img{
    max-width:210px!important;
    max-height:108px!important;
  }
  .energy-v44 .v29-net-node.copel img{
    max-width:96px!important;
    max-height:116px!important;
  }

  /* History mobile */
  .energy-v44 .history-bars-chart{
    min-height:325px!important;
  }
  .energy-v44 .history-bars-chart svg{
    height:265px!important;
  }
  .energy-v44 .history-y,
  .energy-v44 .history-x{
    font-size:11px!important;
  }
  .energy-v44 .history-bars-legend{
    font-size:10px!important;
    gap:8px 12px!important;
    padding-left:8px!important;
  }
  .energy-v44 .history-side{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
  }

  /* Analytics mobile */
  .energy-v44 .analytics-screen{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:9px!important;
  }
  .energy-v44 .analytics-gauges{
    display:flex!important;
    flex-wrap:wrap!important;
    justify-content:center!important;
    gap:8px!important;
    min-height:0!important;
    padding:12px 4px!important;
  }
  .energy-v44 .analytics-gauges .analysis-donut{
    width:118px!important;
    min-width:118px!important;
    height:148px!important;
    min-height:148px!important;
  }
  .energy-v44 .analytics-gauges .analysis-donut svg{
    width:118px!important;
    height:118px!important;
  }
  .energy-v44 .analytics-gauges .analysis-donut>div{
    top:38px!important;
    width:92px!important;
  }
  .energy-v44 .analytics-gauges .analysis-donut>div strong{font-size:22px!important}
  .energy-v44 .analytics-gauges .analysis-donut>div span{font-size:7.5px!important}
  .energy-v44 .analytics-gauges .analysis-donut>small{
    width:115px!important;
    font-size:8px!important;
  }
  .energy-v44 .analysis-cards,
  .energy-v44 .balance-grid{
    grid-template-columns:1fr!important;
  }
}

/* Tablet refinement */
@media(min-width:700px) and (max-width:1180px){
  .energy-v44 .v29-net-node.house img{
    max-width:225px!important;
    max-height:116px!important;
  }
  .energy-v44 .v29-net-node.copel img{
    max-width:102px!important;
    max-height:124px!important;
  }
  .energy-v44 .analytics-gauges{
    justify-content:center!important;
    gap:22px!important;
  }
  .energy-v44 .analytics-gauges .analysis-donut{
    width:140px!important;
    min-width:140px!important;
  }
}


/* ==========================================================================
   V54.0.0 — direção de importação validada + Histórico alinhado + Análises
   orbitais + mobile compacto + assets Copel maiores
   ========================================================================== */

/* VISÃO GERAL — o path de importação nasce na torre (x1497) e termina na casa
   (x920). O dash animado antigo é ocultado para não criar ilusão de sentido
   contrário. As partículas animateMotion seguem exclusivamente torre -> casa. */
.energy-v45 .v33-pulse.import{
  display:none!important;
}
.energy-v45 .v26-rail.import.active{
  opacity:1!important;
  stroke:#ffb44d!important;
}
.energy-v45 .v26-rail.export.active{
  opacity:1!important;
}
.energy-v45 .v26-rail.import.idle,
.energy-v45 .v26-rail.export.idle{
  opacity:.12!important;
}
.energy-v45 .v26-particle{
  filter:drop-shadow(0 0 6px currentColor)!important;
}

/* REDE ELÉTRICA — aumentar mais os assets, mantendo proporção e centralização */
.energy-v45 .v29-net-node.house img{
  width:300px!important;
  max-width:300px!important;
  max-height:158px!important;
  object-fit:contain!important;
}
.energy-v45 .v29-net-node.copel img{
  width:142px!important;
  max-width:142px!important;
  max-height:172px!important;
  object-fit:contain!important;
}
.energy-v45 .v29-network-scene{
  grid-template-columns:minmax(210px,.88fr) minmax(340px,2.55fr) minmax(160px,.72fr)!important;
  align-items:center!important;
}

/* HISTÓRICO — rótulos centralizados no centro do grupo */
.energy-v45 .history-bars-chart.daily svg{
  overflow:visible!important;
}
.energy-v45 .history-bars-chart .history-x{
  fill:#fff!important;
  font-size:14px!important;
  font-weight:800!important;
  dominant-baseline:middle!important;
}
.energy-v45 .history-bars-chart.daily .history-x{
  letter-spacing:.1px!important;
}
.energy-v45 .history-bars-chart .history-y{
  fill:#fff!important;
  font-size:13px!important;
}
.energy-v45 .history-bars-chart .history-bar{
  opacity:.88!important;
  filter:none!important;
}

/* ANÁLISES — cartões orbitais modernos */
.energy-v45 .analytics-gauges{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:10px!important;
  min-height:0!important;
  padding:0!important;
  align-content:start!important;
}
.energy-v45 .analysis-orb-card{
  min-height:120px!important;
  display:grid!important;
  grid-template-columns:112px minmax(0,1fr)!important;
  align-items:center!important;
  gap:15px!important;
  padding:10px 14px!important;
  border:1px solid rgba(103,169,205,.22)!important;
  border-radius:15px!important;
  background:
    radial-gradient(circle at 15% 20%,rgba(56,159,206,.10),transparent 34%),
    linear-gradient(145deg,rgba(5,23,34,.92),rgba(2,12,19,.96))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 12px 28px rgba(0,0,0,.18)!important;
  overflow:hidden!important;
}
.energy-v45 .analysis-orb{
  width:106px!important;
  height:106px!important;
  position:relative!important;
}
.energy-v45 .analysis-orb svg{
  position:absolute!important;
  inset:0!important;
  width:106px!important;
  height:106px!important;
  transform:rotate(-90deg)!important;
}
.energy-v45 .analysis-orb .orbit-outer{
  fill:none!important;
  stroke:rgba(134,194,224,.10)!important;
  stroke-width:1!important;
  stroke-dasharray:2 6!important;
}
.energy-v45 .analysis-orb .d-bg{
  fill:none!important;
  stroke:rgba(85,120,140,.18)!important;
  stroke-width:9!important;
}
.energy-v45 .analysis-orb .d-fg{
  fill:none!important;
  stroke-width:9!important;
  stroke-linecap:round!important;
  transition:stroke-dashoffset .6s ease!important;
}
.energy-v45 .analysis-orb-card.cyan .d-fg{stroke:#38caf2!important;filter:drop-shadow(0 0 5px rgba(56,202,242,.35))}
.energy-v45 .analysis-orb-card.purple .d-fg{stroke:#a968ff!important;filter:drop-shadow(0 0 5px rgba(169,104,255,.35))}
.energy-v45 .analysis-orb-card.green .d-fg{stroke:#53e88a!important;filter:drop-shadow(0 0 5px rgba(83,232,138,.35))}
.energy-v45 .analysis-orb i{
  position:absolute!important;
  left:50%!important;
  top:24px!important;
  transform:translateX(-50%)!important;
  font-style:normal!important;
  color:#fff!important;
  font-size:15px!important;
  opacity:.72!important;
}
.energy-v45 .analysis-orb strong{
  position:absolute!important;
  left:50%!important;
  top:51px!important;
  transform:translateX(-50%)!important;
  color:#fff!important;
  font-size:24px!important;
  line-height:1!important;
}
.energy-v45 .analysis-orb-copy span{
  display:block!important;
  color:#fff!important;
  font-size:12px!important;
  font-weight:900!important;
  letter-spacing:.25px!important;
}
.energy-v45 .analysis-orb-copy small{
  display:block!important;
  margin-top:7px!important;
  color:#d5e5ed!important;
  font-size:10px!important;
  line-height:1.35!important;
}
.energy-v45 .analysis-orb-copy b{
  display:block!important;
  height:5px!important;
  margin-top:11px!important;
  border-radius:999px!important;
  background:rgba(95,135,155,.15)!important;
  overflow:hidden!important;
}
.energy-v45 .analysis-orb-copy b u{
  display:block!important;
  height:100%!important;
  border-radius:inherit!important;
  background:linear-gradient(90deg,#39c8ef,#79e4ff)!important;
}
.energy-v45 .analysis-orb-card.purple .analysis-orb-copy b u{
  background:linear-gradient(90deg,#8657df,#bd8cff)!important;
}
.energy-v45 .analysis-orb-card.green .analysis-orb-copy b u{
  background:linear-gradient(90deg,#35cb75,#74ef9f)!important;
}

/* MOBILE — reduzir os cards do fluxo para caber de verdade na largura */
@media(max-width:699px){
  .energy-v45 .v26-scene{
    height:470px!important;
    min-height:470px!important;
  }

  .energy-v45 .v26-source{
    width:100px!important;
    min-width:100px!important;
    height:52px!important;
    min-height:52px!important;
    grid-template-columns:22px 1fr!important;
    gap:5px!important;
    padding:5px 6px!important;
    border-radius:8px!important;
  }
  .energy-v45 .v26-source>i{
    width:21px!important;
    height:21px!important;
    padding:4px!important;
  }
  .energy-v45 .v26-source span{
    font-size:5.4px!important;
    line-height:1.05!important;
  }
  .energy-v45 .v26-source strong{
    font-size:12px!important;
    line-height:1!important;
  }
  .energy-v45 .v26-source small{
    font-size:5px!important;
    line-height:1.05!important;
  }

  .energy-v45 .v26-inverter{
    left:5%!important;
    top:14%!important;
  }
  .energy-v45 .v26-micro{
    left:5%!important;
    top:31%!important;
  }

  .energy-v45 .v26-solar-total{
    left:50%!important;
    top:25%!important;
    width:91px!important;
    min-width:91px!important;
    height:46px!important;
    min-height:46px!important;
    padding:5px!important;
    transform:translateX(-50%)!important;
  }
  .energy-v45 .v26-solar-total strong{font-size:12px!important}
  .energy-v45 .v26-solar-total span{font-size:5px!important}

  .energy-v45 .v26-grid-meter{
    right:4%!important;
    width:101px!important;
    min-width:101px!important;
    height:52px!important;
    min-height:52px!important;
    padding:5px 6px!important;
  }
  .energy-v45 .v26-grid-meter.import{top:14%!important}
  .energy-v45 .v26-grid-meter.export{top:31%!important}
  .energy-v45 .v26-grid-meter strong{font-size:12px!important}
  .energy-v45 .v26-grid-meter span{font-size:5.4px!important}

  .energy-v45 .v26-scene .asset-house{
    width:50%!important;
    max-height:42%!important;
    bottom:5px!important;
  }
  .energy-v45 .v26-scene .asset-solar{
    width:24%!important;
    max-height:19%!important;
    bottom:2px!important;
  }
  .energy-v45 .v26-scene .asset-grid{
    width:19%!important;
    max-height:29%!important;
    bottom:2px!important;
  }
  .energy-v45 .v26-shield{
    width:174px!important;
    height:174px!important;
    bottom:46px!important;
  }
  .energy-v45 .v26-house-meter{
    width:122px!important;
    min-width:122px!important;
    height:72px!important;
    padding:19px 8px 6px!important;
  }
  .energy-v45 .v26-house-meter strong{font-size:18px!important}
  .energy-v45 .v26-house-meter span,
  .energy-v45 .v26-house-meter small{font-size:5.8px!important}

  /* Reduzir visualmente as linhas no mobile para não cruzarem os cards */
  .energy-v45 .v26-flow-svg{
    opacity:.72!important;
  }
  .energy-v45 .v26-rail{
    stroke-width:1.7!important;
  }

  /* Rede elétrica mobile */
  .energy-v45 .v29-net-node.house img{
    width:220px!important;
    max-width:220px!important;
    max-height:118px!important;
  }
  .energy-v45 .v29-net-node.copel img{
    width:108px!important;
    max-width:108px!important;
    max-height:128px!important;
  }

  /* Histórico mobile */
  .energy-v45 .history-bars-chart .history-x{
    font-size:10px!important;
  }
  .energy-v45 .history-bars-chart .history-y{
    font-size:10px!important;
  }

  /* Análise mobile */
  .energy-v45 .analytics-gauges{
    grid-template-columns:1fr!important;
  }
  .energy-v45 .analysis-orb-card{
    grid-template-columns:92px minmax(0,1fr)!important;
    min-height:104px!important;
    gap:10px!important;
    padding:8px 10px!important;
  }
  .energy-v45 .analysis-orb{
    width:88px!important;
    height:88px!important;
  }
  .energy-v45 .analysis-orb svg{
    width:88px!important;
    height:88px!important;
  }
  .energy-v45 .analysis-orb i{top:19px!important;font-size:12px!important}
  .energy-v45 .analysis-orb strong{top:41px!important;font-size:19px!important}
  .energy-v45 .analysis-orb-copy span{font-size:10px!important}
  .energy-v45 .analysis-orb-copy small{font-size:8.5px!important}
}

/* TABLET */
@media(min-width:700px) and (max-width:1180px){
  .energy-v45 .v29-net-node.house img{
    width:260px!important;
    max-width:260px!important;
    max-height:140px!important;
  }
  .energy-v45 .v29-net-node.copel img{
    width:126px!important;
    max-width:126px!important;
    max-height:150px!important;
  }
  .energy-v45 .analytics-gauges{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
  }
  .energy-v45 .analysis-orb-card{
    grid-template-columns:1fr!important;
    text-align:center!important;
  }
  .energy-v45 .analysis-orb{
    margin:auto!important;
  }
}


/* ==========================================================================
   V54.0.0 — mobile rebuild, swipe tabs, stable continuous flow animations
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. MAIN NAV — swipe/drag on mobile/tablet and keep selected tab visible
   -------------------------------------------------------------------------- */
.energy-v46 .master-tabs{
  overflow-x:auto!important;
  overflow-y:hidden!important;
  overscroll-behavior-x:contain!important;
  touch-action:pan-x!important;
  -webkit-overflow-scrolling:touch!important;
  scrollbar-width:none!important;
  scroll-behavior:smooth!important;
}
.energy-v46 .master-tabs::-webkit-scrollbar{display:none!important}
.energy-v46 .master-tabs button{
  flex-shrink:0!important;
}

/* --------------------------------------------------------------------------
   2. OVERVIEW FLOW — stable dotted animation using CSS dash offset
   No SMIL particles for grid import/export, so sensor refreshes do not blink.
   Import path itself is tower -> house, and forward dash movement follows it.
   -------------------------------------------------------------------------- */
.energy-v46 .v26-particle{display:none!important}

.energy-v46 .v33-pulse{
  display:block!important;
  fill:none!important;
  stroke-linecap:round!important;
  stroke-width:4!important;
  stroke-dasharray:2 12!important;
  opacity:.90!important;
  filter:none!important;
  animation:v46FlowForward 2.8s linear infinite!important;
}
.energy-v46 .v33-pulse.inactive{
  opacity:0!important;
  animation:none!important;
}
.energy-v46 .v33-pulse.solar.active{
  stroke:#8df5b1!important;
}
.energy-v46 .v33-pulse.import.active{
  stroke:#ffb44d!important;
  animation-direction:normal!important; /* path is REDE -> CASA */
}
.energy-v46 .v33-pulse.export.active{
  stroke:#4cd8ff!important;
  animation-direction:normal!important; /* path is CASA -> REDE */
}
@keyframes v46FlowForward{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-100}
}

/* Base rail stays calm underneath the moving dots */
.energy-v46 .v26-rail{
  stroke-width:2.1!important;
  opacity:.48!important;
  filter:none!important;
}
.energy-v46 .v26-rail.import.active{
  stroke:#a97129!important;
  opacity:.46!important;
  marker-end:none!important;
}
.energy-v46 .v26-rail.export.active{
  stroke:#286b82!important;
  opacity:.46!important;
  marker-end:none!important;
}

/* --------------------------------------------------------------------------
   3. REDE TAB — stop restart/blink; stable tracks, no moving indicator dot.
   -------------------------------------------------------------------------- */
.energy-v46 .v29-net-line i{
  animation:none!important;
  display:none!important;
}
.energy-v46 .v29-net-line:after{
  opacity:.72!important;
  filter:none!important;
}
.energy-v46 .v29-net-line.import:after{
  background:linear-gradient(90deg,#d8a05b,#f3c67b)!important;
}
.energy-v46 .v29-net-line.export:after{
  background:linear-gradient(90deg,#54b8d1,#7addf4)!important;
}

/* --------------------------------------------------------------------------
   4. MOBILE — actual independent geometry
   -------------------------------------------------------------------------- */
@media(max-width:699px){
  .energy-v46{
    overflow-x:hidden!important;
  }

  /* tabs must remain draggable all the way to CONFIG */
  .energy-v46 .master-header{
    overflow:visible!important;
  }
  .energy-v46 .master-tabs{
    width:100%!important;
    max-width:100vw!important;
    display:flex!important;
    grid-column:1/-1!important;
    gap:0!important;
    padding-bottom:2px!important;
  }
  .energy-v46 .master-tabs button{
    flex:0 0 96px!important;
    min-width:96px!important;
    height:58px!important;
  }

  /* main flow becomes a clean 3-zone mobile diagram */
  .energy-v46 .v26-scene{
    height:510px!important;
    min-height:510px!important;
  }

  .energy-v46 .v26-source{
    width:92px!important;
    min-width:92px!important;
    height:50px!important;
    min-height:50px!important;
    padding:5px 6px!important;
    grid-template-columns:20px 1fr!important;
    gap:5px!important;
  }
  .energy-v46 .v26-source>i{
    width:19px!important;
    height:19px!important;
    padding:3px!important;
  }
  .energy-v46 .v26-source span{font-size:5.1px!important}
  .energy-v46 .v26-source strong{font-size:11px!important}
  .energy-v46 .v26-source small{font-size:4.7px!important}

  .energy-v46 .v26-inverter{
    left:5%!important;
    top:14%!important;
  }
  .energy-v46 .v26-micro{
    left:5%!important;
    top:29%!important;
  }

  .energy-v46 .v26-solar-total{
    left:50%!important;
    top:23%!important;
    width:84px!important;
    min-width:84px!important;
    height:44px!important;
    min-height:44px!important;
    padding:4px 5px!important;
    transform:translateX(-50%)!important;
  }
  .energy-v46 .v26-solar-total strong{font-size:11px!important}
  .energy-v46 .v26-solar-total span{font-size:4.8px!important}

  .energy-v46 .v26-grid-meter{
    right:4%!important;
    width:94px!important;
    min-width:94px!important;
    height:52px!important;
    min-height:52px!important;
    padding:5px 6px!important;
  }
  .energy-v46 .v26-grid-meter.import{top:14%!important}
  .energy-v46 .v26-grid-meter.export{top:29%!important}
  .energy-v46 .v26-grid-meter strong{font-size:11px!important}
  .energy-v46 .v26-grid-meter span{font-size:5px!important}

  /* assets pushed into lower third, no collision with metric cards */
  .energy-v46 .v26-scene .asset-house{
    width:48%!important;
    max-height:39%!important;
    bottom:8px!important;
  }
  .energy-v46 .v26-scene .asset-solar{
    width:22%!important;
    max-height:17%!important;
    left:-2%!important;
    bottom:5px!important;
  }
  .energy-v46 .v26-scene .asset-grid{
    width:17%!important;
    max-height:25%!important;
    right:1%!important;
    bottom:5px!important;
  }

  .energy-v46 .v26-shield{
    width:158px!important;
    height:158px!important;
    bottom:53px!important;
  }

  .energy-v46 .v26-house-meter{
    width:112px!important;
    min-width:112px!important;
    height:67px!important;
    bottom:2px!important;
    padding:18px 7px 6px!important;
  }
  .energy-v46 .v26-house-meter strong{font-size:17px!important}
  .energy-v46 .v26-house-meter span,
  .energy-v46 .v26-house-meter small{font-size:5.3px!important}

  .energy-v46 .v26-grid-label{
    right:2%!important;
    bottom:7px!important;
    width:68px!important;
  }

  /* Re-map the SVG to upper-middle area so flow does not cover house */
  .energy-v46 .v26-flow-svg{
    height:72%!important;
    top:2%!important;
    bottom:auto!important;
    opacity:.9!important;
  }

  /* Copel tab: compact, centered, no clipped assets */
  .energy-v46 .v29-network-scene{
    grid-template-columns:1fr!important;
    gap:12px!important;
    padding:12px 10px!important;
  }
  .energy-v46 .v29-net-node.house{
    order:1!important;
  }
  .energy-v46 .v29-net-flow{
    order:2!important;
    width:100%!important;
    gap:10px!important;
  }
  .energy-v46 .v29-net-node.copel{
    order:3!important;
  }
  .energy-v46 .v29-net-node.house img{
    width:185px!important;
    max-width:185px!important;
    max-height:105px!important;
  }
  .energy-v46 .v29-net-node.copel img{
    width:88px!important;
    max-width:88px!important;
    max-height:108px!important;
  }
  .energy-v46 .v29-net-line{
    min-height:66px!important;
    padding:9px 12px!important;
  }
  .energy-v46 .v29-net-line span{font-size:9px!important}
  .energy-v46 .v29-net-line strong{font-size:17px!important}
  .energy-v46 .v29-net-balance{
    grid-template-columns:1fr!important;
    gap:5px!important;
    text-align:left!important;
  }
}

/* --------------------------------------------------------------------------
   5. TABLET
   -------------------------------------------------------------------------- */
@media(min-width:700px) and (max-width:1100px){
  .energy-v46 .master-tabs{
    display:flex!important;
    width:100%!important;
  }
  .energy-v46 .master-tabs button{
    flex:0 0 104px!important;
    min-width:104px!important;
  }
  .energy-v46 .v26-source{
    transform:scale(.92)!important;
    transform-origin:center!important;
  }
  .energy-v46 .v26-grid-meter{
    transform:scale(.92)!important;
    transform-origin:center!important;
  }
}


/* ========================================================================== V54.0.0 */
.energy-v47,.energy-v47 .shell-v24{overflow-x:clip!important;overflow-y:visible!important;touch-action:pan-y pinch-zoom!important}
.energy-v47 .master-tabs{display:flex!important;width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-x:auto!important;touch-action:auto!important;scrollbar-width:none!important;scroll-snap-type:x proximity!important}
.energy-v47 .master-tabs::-webkit-scrollbar{display:none!important}
.energy-v47 .master-tabs button{flex:0 0 92px!important;min-width:92px!important;scroll-snap-align:center!important}
.energy-v47 .v26-rail.import.active{opacity:.14!important;stroke:#8f692e!important;stroke-width:1.6!important;marker-end:none!important}
.energy-v47 .v26-rail.export.active{opacity:.18!important;stroke:#286f87!important;stroke-width:1.6!important;marker-end:none!important}
.energy-v47 .v26-rail.import.idle,.energy-v47 .v26-rail.export.idle{opacity:.07!important}
.energy-v47 .v33-pulse{display:block!important;fill:none!important;stroke-width:4.6!important;stroke-linecap:round!important;stroke-dasharray:8 15!important;opacity:.98!important;filter:drop-shadow(0 0 2px currentColor)!important;animation:v47DashFlow 2.1s linear infinite!important}
.energy-v47 .v33-pulse.inactive{opacity:0!important;animation:none!important}
.energy-v47 .v33-pulse.solar.active{stroke:#82f3a8!important}
.energy-v47 .v33-pulse.export.active{stroke:#54dcff!important;animation-direction:normal!important}
.energy-v47 .v33-pulse.import.active{stroke:#ffb64f!important;animation-direction:normal!important}
@keyframes v47DashFlow{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.energy-v47 .v26-shield:before,.energy-v47 .v26-shield:after{animation-duration:8s!important;animation-timing-function:linear!important;opacity:.68!important}
.energy-v47 .v29-net-line i{display:none!important;animation:none!important}
.energy-v47 .v29-net-line:after{filter:none!important;box-shadow:none!important;opacity:.76!important}
@media(max-width:699px){
.energy-v47,.energy-v47 .shell-v24,.energy-v47 ha-card{max-height:none!important;height:auto!important;min-height:0!important;overflow-y:visible!important;touch-action:pan-y pinch-zoom!important}
.energy-v47 .master-header{overflow:visible!important}.energy-v47 .master-tabs{grid-column:1/-1!important;max-width:100%!important;touch-action:auto!important;overscroll-behavior:auto!important}.energy-v47 .master-tabs button{flex:0 0 84px!important;min-width:84px!important;height:54px!important}
.energy-v47 .v26-scene{height:420px!important;min-height:420px!important;overflow:hidden!important}
.energy-v47 .v26-source{width:76px!important;min-width:76px!important;height:42px!important;min-height:42px!important;padding:4px 5px!important;grid-template-columns:16px 1fr!important;gap:4px!important}
.energy-v47 .v26-source>i{width:15px!important;height:15px!important;padding:2px!important}.energy-v47 .v26-source span{font-size:4.6px!important}.energy-v47 .v26-source strong{font-size:9.4px!important}.energy-v47 .v26-source small{font-size:4.1px!important}
.energy-v47 .v26-inverter{left:6%!important;top:12%!important}.energy-v47 .v26-micro{left:6%!important;top:26%!important}
.energy-v47 .v26-solar-total{left:43%!important;top:19%!important;width:70px!important;min-width:70px!important;height:38px!important;min-height:38px!important;transform:translateX(-50%)!important;padding:3px 4px!important}.energy-v47 .v26-solar-total strong{font-size:9.3px!important}.energy-v47 .v26-solar-total span{font-size:4.1px!important}
.energy-v47 .v26-grid-meter{right:auto!important;left:67%!important;width:80px!important;min-width:80px!important;height:44px!important;min-height:44px!important;padding:4px 5px!important}.energy-v47 .v26-grid-meter.import{top:12%!important}.energy-v47 .v26-grid-meter.export{top:26%!important}.energy-v47 .v26-grid-meter strong{font-size:9.8px!important}.energy-v47 .v26-grid-meter span{font-size:4.4px!important}
.energy-v47 .v26-scene .asset-house{width:48%!important;max-height:39%!important;left:50%!important;bottom:1px!important;transform:translateX(-50%)!important}.energy-v47 .v26-scene .asset-solar{width:18%!important;max-height:15%!important;left:-1%!important;bottom:2px!important}.energy-v47 .v26-scene .asset-grid{width:12.5%!important;max-height:23%!important;right:1%!important;bottom:2px!important}
.energy-v47 .v26-shield{width:142px!important;height:142px!important;left:50%!important;bottom:45px!important;transform:translateX(-50%)!important}.energy-v47 .v26-house-meter{width:98px!important;min-width:98px!important;height:56px!important;bottom:0!important;padding:15px 6px 5px!important}.energy-v47 .v26-house-meter strong{font-size:14px!important}.energy-v47 .v26-house-meter span,.energy-v47 .v26-house-meter small{font-size:4.8px!important}.energy-v47 .v26-grid-label{width:52px!important;right:0!important;bottom:2px!important;font-size:5px!important}
.energy-v47 .v26-flow-svg{inset:0!important;width:100%!important;height:100%!important;opacity:.96!important;overflow:visible!important}.energy-v47 .v33-pulse{stroke-width:3.5!important;stroke-dasharray:6 12!important}
.energy-v47 .v29-network-card{min-height:0!important}.energy-v47 .v29-network-scene{display:grid!important;grid-template-columns:68px minmax(0,1fr) 54px!important;align-items:center!important;gap:7px!important;padding:10px 7px!important;min-height:240px!important}.energy-v47 .v29-net-node.house{order:initial!important}.energy-v47 .v29-net-flow{order:initial!important;width:100%!important;gap:8px!important}.energy-v47 .v29-net-node.copel{order:initial!important}.energy-v47 .v29-net-node.house img{width:72px!important;max-width:72px!important;max-height:72px!important}.energy-v47 .v29-net-node.copel img{width:44px!important;max-width:44px!important;max-height:84px!important}.energy-v47 .v29-net-node strong{font-size:7.5px!important}.energy-v47 .v29-net-node span{font-size:4.8px!important}.energy-v47 .v29-net-line{min-height:56px!important;padding:7px 8px!important}.energy-v47 .v29-net-line span{font-size:6.8px!important}.energy-v47 .v29-net-line strong{font-size:12.5px!important}.energy-v47 .v29-net-balance{grid-template-columns:1fr!important;gap:5px!important}
}
@media(min-width:700px) and (max-width:1100px){.energy-v47,.energy-v47 .shell-v24{overflow-y:visible!important;touch-action:pan-y pinch-zoom!important}.energy-v47 .master-tabs{touch-action:auto!important}.energy-v47 .master-tabs button{flex:0 0 98px!important;min-width:98px!important}}


/* ==========================================================================
   V54.0.0 — DESKTOP E MOBILE SEPARADOS
   Objetivo:
   - desktop preserva proporções e navegação originais;
   - mobile recebe somente ajustes dentro de media query;
   - fluxo ativo é desenhado no próprio trilho para nunca "sumir";
   - importação anima REDE -> CASA; exportação CASA -> REDE.
   ========================================================================== */

/* ===== DESKTOP (>1100px): NÃO HERDAR MINIATURIZAÇÃO MOBILE ================= */
@media(min-width:1101px){
  .energy-v48 .master-tabs{
    display:grid!important;
    grid-template-columns:repeat(8,minmax(78px,1fr))!important;
    width:auto!important;
    min-width:0!important;
    overflow:visible!important;
    scroll-snap-type:none!important;
    touch-action:auto!important;
  }
  .energy-v48 .master-tabs button{
    flex:initial!important;
    min-width:0!important;
    width:auto!important;
    height:70px!important;
    scroll-snap-align:none!important;
  }

  /* fluxo desktop: trilho ativo pontilhado + animação contínua */
  .energy-v48 .v26-rail.import.active{
    stroke:#ffb44d!important;
    stroke-width:3.3!important;
    stroke-dasharray:7 14!important;
    opacity:.96!important;
    filter:drop-shadow(0 0 3px rgba(255,180,77,.60))!important;
    animation:v48ImportFlow 1.9s linear infinite!important;
    marker-end:none!important;
  }
  .energy-v48 .v26-rail.export.active{
    stroke:#4cd8ff!important;
    stroke-width:3.3!important;
    stroke-dasharray:7 14!important;
    opacity:.96!important;
    filter:drop-shadow(0 0 3px rgba(76,216,255,.55))!important;
    animation:v48ExportFlow 1.9s linear infinite!important;
    marker-end:none!important;
  }
  .energy-v48 .v26-rail.import.idle,
  .energy-v48 .v26-rail.export.idle{
    stroke-dasharray:none!important;
    animation:none!important;
    opacity:.10!important;
    filter:none!important;
  }

  /* pulse secundário fica sutil para não duplicar visualmente o trilho */
  .energy-v48 .v33-pulse.import.active,
  .energy-v48 .v33-pulse.export.active{
    stroke-width:2.0!important;
    stroke-dasharray:2 18!important;
    opacity:.56!important;
    animation:v48PulseFlow 2.5s linear infinite!important;
  }
  .energy-v48 .v33-pulse.import.active{animation-direction:normal!important}
  .energy-v48 .v33-pulse.export.active{animation-direction:normal!important}
}

/* path IMPORTAÇÃO foi desenhado da torre (direita) para a casa (esquerda).
   Offset negativo percorre o path no sentido REDE -> CASA. */
@keyframes v48ImportFlow{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-84}
}
/* path EXPORTAÇÃO foi desenhado da casa (esquerda) para a torre (direita). */
@keyframes v48ExportFlow{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-84}
}
@keyframes v48PulseFlow{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-100}
}

/* ===== TABLET ============================================================= */
@media(min-width:700px) and (max-width:1100px){
  .energy-v48 .master-tabs{
    display:flex!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    -webkit-overflow-scrolling:touch!important;
    touch-action:pan-x pan-y!important;
  }
  .energy-v48 .master-tabs button{
    flex:0 0 102px!important;
    min-width:102px!important;
    height:62px!important;
  }

  .energy-v48 .v26-rail.import.active,
  .energy-v48 .v26-rail.export.active{
    stroke-width:3!important;
    stroke-dasharray:6 13!important;
    opacity:.95!important;
    animation-duration:2s!important;
    marker-end:none!important;
  }
  .energy-v48 .v26-rail.import.active{
    stroke:#ffb44d!important;
    animation:v48ImportFlow 2s linear infinite!important;
  }
  .energy-v48 .v26-rail.export.active{
    stroke:#4cd8ff!important;
    animation:v48ExportFlow 2s linear infinite!important;
  }
}

/* ===== MOBILE ============================================================= */
@media(max-width:699px){
  /* A página inteira continua com scroll vertical normal. */
  .energy-v48,
  .energy-v48 ha-card,
  .energy-v48 .shell-v24{
    width:100%!important;
    max-width:100%!important;
    height:auto!important;
    max-height:none!important;
    overflow-x:hidden!important;
    overflow-y:visible!important;
    touch-action:pan-y pinch-zoom!important;
  }

  /* Somente a faixa das abas é horizontalmente rolável. */
  .energy-v48 .master-header{
    overflow:visible!important;
  }
  .energy-v48 .master-tabs{
    display:flex!important;
    width:100%!important;
    max-width:100%!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    -webkit-overflow-scrolling:touch!important;
    overscroll-behavior-x:contain!important;
    touch-action:pan-x pan-y!important;
    scroll-snap-type:x proximity!important;
  }
  .energy-v48 .master-tabs button{
    flex:0 0 88px!important;
    min-width:88px!important;
    height:56px!important;
    scroll-snap-align:center!important;
  }

  /* -------- Visão Geral: cena compacta e sem "buraco" no topo ------------ */
  .energy-v48 .v26-scene{
    position:relative!important;
    height:350px!important;
    min-height:350px!important;
    overflow:hidden!important;
  }

  /* cards de geração */
  .energy-v48 .v26-source{
    width:74px!important;
    min-width:74px!important;
    height:39px!important;
    min-height:39px!important;
    padding:3px 4px!important;
    grid-template-columns:15px 1fr!important;
    gap:3px!important;
    border-radius:8px!important;
  }
  .energy-v48 .v26-source>i{
    width:14px!important;
    height:14px!important;
    padding:2px!important;
  }
  .energy-v48 .v26-source span{font-size:4.25px!important}
  .energy-v48 .v26-source strong{font-size:9.2px!important}
  .energy-v48 .v26-source small{font-size:3.8px!important}

  .energy-v48 .v26-inverter{left:4%!important;top:11%!important}
  .energy-v48 .v26-micro{left:4%!important;top:27%!important}

  .energy-v48 .v26-solar-total{
    left:40%!important;
    top:19%!important;
    width:66px!important;
    min-width:66px!important;
    height:36px!important;
    min-height:36px!important;
    padding:3px!important;
    transform:translateX(-50%)!important;
  }
  .energy-v48 .v26-solar-total strong{font-size:9px!important}
  .energy-v48 .v26-solar-total span{font-size:3.9px!important}

  /* cards Copel alinhados no lado direito, sem sair da tela */
  .energy-v48 .v26-grid-meter{
    right:3%!important;
    left:auto!important;
    width:77px!important;
    min-width:77px!important;
    height:43px!important;
    min-height:43px!important;
    padding:4px!important;
    border-radius:8px!important;
  }
  .energy-v48 .v26-grid-meter.import{top:11%!important}
  .energy-v48 .v26-grid-meter.export{top:27%!important}
  .energy-v48 .v26-grid-meter strong{font-size:9.5px!important}
  .energy-v48 .v26-grid-meter span{font-size:4.1px!important}

  /* assets - formam uma única composição na metade inferior */
  .energy-v48 .v26-scene .asset-house{
    width:46%!important;
    max-height:42%!important;
    left:50%!important;
    bottom:0!important;
    transform:translateX(-50%)!important;
  }
  .energy-v48 .v26-scene .asset-solar{
    width:21%!important;
    max-height:19%!important;
    left:-2%!important;
    bottom:2px!important;
  }
  .energy-v48 .v26-scene .asset-grid{
    width:15%!important;
    max-height:29%!important;
    right:0!important;
    bottom:1px!important;
  }

  .energy-v48 .v26-shield{
    width:132px!important;
    height:132px!important;
    left:50%!important;
    bottom:36px!important;
    transform:translateX(-50%)!important;
  }
  .energy-v48 .v26-house-meter{
    width:92px!important;
    min-width:92px!important;
    height:52px!important;
    bottom:0!important;
    padding:14px 5px 4px!important;
  }
  .energy-v48 .v26-house-meter strong{font-size:13px!important}
  .energy-v48 .v26-house-meter span,
  .energy-v48 .v26-house-meter small{font-size:4.5px!important}

  .energy-v48 .v26-grid-label{
    right:1%!important;
    bottom:2px!important;
    width:54px!important;
    font-size:4.7px!important;
  }

  /* SVG inteiro dentro da cena. Sem crop / remapeamento vertical. */
  .energy-v48 .v26-flow-svg{
    inset:0!important;
    top:0!important;
    width:100%!important;
    height:100%!important;
    opacity:1!important;
    overflow:visible!important;
  }

  /* fluxo ativo visível também no mobile */
  .energy-v48 .v26-rail.import.active{
    stroke:#ffb44d!important;
    stroke-width:3!important;
    stroke-dasharray:6 12!important;
    opacity:.98!important;
    filter:none!important;
    animation:v48ImportFlow 1.9s linear infinite!important;
    marker-end:none!important;
  }
  .energy-v48 .v26-rail.export.active{
    stroke:#4cd8ff!important;
    stroke-width:3!important;
    stroke-dasharray:6 12!important;
    opacity:.98!important;
    filter:none!important;
    animation:v48ExportFlow 1.9s linear infinite!important;
    marker-end:none!important;
  }
  .energy-v48 .v26-rail.import.idle,
  .energy-v48 .v26-rail.export.idle{
    stroke-dasharray:none!important;
    animation:none!important;
    opacity:.08!important;
  }
  .energy-v48 .v33-pulse{
    stroke-width:1.8!important;
    stroke-dasharray:2 16!important;
    opacity:.42!important;
  }

  /* -------- Rede elétrica: proporção mobile refeita ------------------------- */
  .energy-v48 .v29-network-card{
    min-height:0!important;
    overflow:hidden!important;
  }
  .energy-v48 .v29-network-scene{
    display:grid!important;
    grid-template-columns:82px minmax(0,1fr) 62px!important;
    align-items:center!important;
    gap:8px!important;
    padding:12px 8px!important;
    min-height:230px!important;
    overflow:hidden!important;
  }
  .energy-v48 .v29-net-node.house,
  .energy-v48 .v29-net-node.copel{
    min-width:0!important;
  }
  .energy-v48 .v29-net-node.house img{
    width:88px!important;
    max-width:88px!important;
    max-height:82px!important;
    object-fit:contain!important;
  }
  .energy-v48 .v29-net-node.copel img{
    width:56px!important;
    max-width:56px!important;
    max-height:94px!important;
    object-fit:contain!important;
  }
  .energy-v48 .v29-net-flow{
    width:100%!important;
    min-width:0!important;
    gap:8px!important;
  }
  .energy-v48 .v29-net-line{
    min-height:58px!important;
    padding:7px 8px!important;
    overflow:hidden!important;
  }
  .energy-v48 .v29-net-line span{font-size:6.8px!important}
  .energy-v48 .v29-net-line strong{font-size:12px!important}
  .energy-v48 .v29-net-node strong{font-size:7.5px!important}
  .energy-v48 .v29-net-node span{font-size:4.8px!important}
  .energy-v48 .v29-net-balance{
    grid-template-columns:1fr!important;
    gap:5px!important;
    text-align:left!important;
  }

  /* Rede elétrica fica estável: sem elementos que "reiniciam" visualmente */
  .energy-v48 .v29-net-line i{
    display:none!important;
    animation:none!important;
  }
}


/* ==========================================================================
   V54.0.0 — FLUXO UNIFICADO + MOBILE COMPACTO + REDE ELÉTRICA CORRIGIDA
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. VISÃO GERAL — o efeito IMPORTAÇÃO/EXPORTAÇÃO usa a MESMA linguagem
      visual da geração solar: trilho contínuo sutil + pequenos segmentos
      luminosos correndo sobre a linha. Não usar a linha inteira pontilhada.
   -------------------------------------------------------------------------- */
.energy-v49 .v26-rail.import.active,
.energy-v49 .v26-rail.export.active{
  stroke-width:2.35!important;
  stroke-dasharray:none!important;
  animation:none!important;
  opacity:.58!important;
  filter:none!important;
  marker-end:none!important;
}
.energy-v49 .v26-rail.import.active{stroke:#a8732d!important}
.energy-v49 .v26-rail.export.active{stroke:#2d7b93!important}

.energy-v49 .v33-pulse.import.active,
.energy-v49 .v33-pulse.export.active{
  display:block!important;
  fill:none!important;
  stroke-width:4!important;
  stroke-linecap:round!important;
  stroke-dasharray:2 13!important;
  opacity:.82!important;
  filter:none!important;
  animation:v49FlowPulse 5.2s linear infinite!important;
}
.energy-v49 .v33-pulse.import.active{
  stroke:#ffd089!important;
  animation-direction:normal!important; /* path já é REDE -> CASA */
}
.energy-v49 .v33-pulse.export.active{
  stroke:#9cecff!important;
  animation-direction:normal!important; /* path já é CASA -> REDE */
}
.energy-v49 .v33-pulse.import.inactive,
.energy-v49 .v33-pulse.export.inactive{
  display:none!important;
  animation:none!important;
}
@keyframes v49FlowPulse{
  from{stroke-dashoffset:0}
  to{stroke-dashoffset:-100}
}

/* Não deixar o SVG "piscar" por filtros/glow */
.energy-v49 .v26-flow-svg,
.energy-v49 .v26-flow-svg path{
  backface-visibility:hidden!important;
  transform-style:preserve-3d!important;
}

/* --------------------------------------------------------------------------
   2. REDE ELÉTRICA — a régua fica abaixo dos textos, nunca sobre a descrição.
   -------------------------------------------------------------------------- */
.energy-v49 .v29-net-line{
  position:relative!important;
  padding-bottom:16px!important;
}
.energy-v49 .v29-net-line:after{
  left:12px!important;
  right:12px!important;
  bottom:5px!important;
  height:2px!important;
  opacity:.72!important;
  z-index:0!important;
  pointer-events:none!important;
}
.energy-v49 .v29-net-line span,
.energy-v49 .v29-net-line strong,
.energy-v49 .v29-net-line small{
  position:relative!important;
  z-index:2!important;
}
.energy-v49 .v29-net-line small{
  display:block!important;
  margin-top:3px!important;
  line-height:1.2!important;
}

/* --------------------------------------------------------------------------
   3. DESKTOP — preservar cabeçalho e geometria ampla.
   -------------------------------------------------------------------------- */
@media(min-width:1101px){
  .energy-v49 .master-tabs{
    display:grid!important;
    grid-template-columns:repeat(8,minmax(78px,1fr))!important;
    overflow:visible!important;
  }
  .energy-v49 .master-tabs button{
    width:auto!important;
    min-width:0!important;
    height:70px!important;
  }

  /* Somente pulse animado; trilho sólido como na geração solar */
  .energy-v49 .v26-rail.import.active,
  .energy-v49 .v26-rail.export.active{
    stroke-dasharray:none!important;
    animation:none!important;
  }
}

/* --------------------------------------------------------------------------
   4. TABLET — compacto sem herdar medidas de celular.
   -------------------------------------------------------------------------- */
@media(min-width:700px) and (max-width:1100px){
  .energy-v49 .v26-scene{
    min-height:390px!important;
    height:390px!important;
  }
  .energy-v49 .v26-source,
  .energy-v49 .v26-solar-total,
  .energy-v49 .v26-grid-meter{
    transform:none;
  }
}

/* --------------------------------------------------------------------------
   5. MOBILE — reconstrução compacta do card principal.
      Cards realmente menores e separados do conjunto casa/escudo.
   -------------------------------------------------------------------------- */
@media(max-width:699px){
  .energy-v49,
  .energy-v49 ha-card,
  .energy-v49 .shell-v24{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    max-height:none!important;
    overflow-x:hidden!important;
    overflow-y:visible!important;
    touch-action:pan-y pinch-zoom!important;
  }

  /* As abas seguem com swipe horizontal; a página continua rolando vertical. */
  .energy-v49 .master-tabs{
    display:flex!important;
    width:100%!important;
    max-width:100%!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    -webkit-overflow-scrolling:touch!important;
    overscroll-behavior-x:contain!important;
    touch-action:pan-x pan-y!important;
    scroll-snap-type:x proximity!important;
  }
  .energy-v49 .master-tabs button{
    flex:0 0 88px!important;
    min-width:88px!important;
    height:56px!important;
  }

  /* Hero menor: remove o grande espaço vazio e mantém tudo dentro da tela. */
  .energy-v49 .v26-scene{
    height:300px!important;
    min-height:300px!important;
    max-height:300px!important;
    overflow:hidden!important;
  }

  /* Inversor / Micro — aproximadamente 25% menores que V48 */
  .energy-v49 .v26-source{
    width:58px!important;
    min-width:58px!important;
    height:32px!important;
    min-height:32px!important;
    padding:2px 3px!important;
    grid-template-columns:11px 1fr!important;
    gap:2px!important;
    border-radius:7px!important;
  }
  .energy-v49 .v26-source>i{
    width:11px!important;
    height:11px!important;
    padding:1.5px!important;
    border-radius:5px!important;
  }
  .energy-v49 .v26-source span{
    font-size:3.5px!important;
    line-height:1.05!important;
  }
  .energy-v49 .v26-source strong{
    font-size:7.5px!important;
    line-height:1!important;
    margin-top:1px!important;
  }
  .energy-v49 .v26-source small{
    font-size:3px!important;
    line-height:1.05!important;
    margin-top:1px!important;
  }
  .energy-v49 .v26-inverter{
    left:5%!important;
    top:9%!important;
  }
  .energy-v49 .v26-micro{
    left:5%!important;
    top:22%!important;
  }

  /* Geração total — também menor e central entre fontes/casa */
  .energy-v49 .v26-solar-total{
    left:39%!important;
    top:15%!important;
    width:56px!important;
    min-width:56px!important;
    height:30px!important;
    min-height:30px!important;
    padding:2px 3px!important;
    transform:translateX(-50%)!important;
    border-radius:7px!important;
  }
  .energy-v49 .v26-solar-total strong{
    font-size:7.6px!important;
    line-height:1!important;
  }
  .energy-v49 .v26-solar-total span{
    font-size:3.1px!important;
    line-height:1.05!important;
  }

  /* Importação / Exportação — significativamente menores */
  .energy-v49 .v26-grid-meter{
    right:4%!important;
    left:auto!important;
    width:64px!important;
    min-width:64px!important;
    height:34px!important;
    min-height:34px!important;
    padding:2px 3px!important;
    border-radius:7px!important;
  }
  .energy-v49 .v26-grid-meter.import{top:9%!important}
  .energy-v49 .v26-grid-meter.export{top:22%!important}
  .energy-v49 .v26-grid-meter strong{
    font-size:8px!important;
    line-height:1!important;
  }
  .energy-v49 .v26-grid-meter span{
    font-size:3.2px!important;
    line-height:1.05!important;
  }

  /* Assets ocupam apenas a metade inferior da composição */
  .energy-v49 .v26-scene .asset-house{
    width:40%!important;
    max-width:40%!important;
    max-height:39%!important;
    left:50%!important;
    bottom:0!important;
    transform:translateX(-50%)!important;
  }
  .energy-v49 .v26-scene .asset-solar{
    width:16%!important;
    max-width:16%!important;
    max-height:16%!important;
    left:-1%!important;
    bottom:1px!important;
  }
  .energy-v49 .v26-scene .asset-grid{
    width:10.5%!important;
    max-width:10.5%!important;
    max-height:25%!important;
    right:1%!important;
    bottom:1px!important;
  }

  .energy-v49 .v26-shield{
    width:112px!important;
    height:112px!important;
    left:50%!important;
    bottom:31px!important;
    transform:translateX(-50%)!important;
  }
  .energy-v49 .v26-house-meter{
    width:78px!important;
    min-width:78px!important;
    height:43px!important;
    bottom:0!important;
    padding:11px 4px 3px!important;
  }
  .energy-v49 .v26-house-meter strong{
    font-size:11px!important;
  }
  .energy-v49 .v26-house-meter span,
  .energy-v49 .v26-house-meter small{
    font-size:3.8px!important;
  }
  .energy-v49 .v26-grid-label{
    right:0!important;
    bottom:1px!important;
    width:44px!important;
    font-size:4px!important;
    line-height:1.05!important;
  }

  /* O SVG acompanha a cena inteira sem crop. */
  .energy-v49 .v26-flow-svg{
    inset:0!important;
    width:100%!important;
    height:100%!important;
    opacity:.96!important;
    overflow:visible!important;
  }

  /* Mobile usa exatamente o mesmo estilo de pulse da geração solar. */
  .energy-v49 .v33-pulse.import.active,
  .energy-v49 .v33-pulse.export.active{
    stroke-width:3.1!important;
    stroke-dasharray:2 13!important;
    opacity:.80!important;
    animation:v49FlowPulse 5.2s linear infinite!important;
  }
  .energy-v49 .v26-rail.import.active,
  .energy-v49 .v26-rail.export.active{
    stroke-width:1.8!important;
    stroke-dasharray:none!important;
    animation:none!important;
    opacity:.46!important;
  }

  /* -------- Rede elétrica mobile: composição limpa ------------------------ */
  .energy-v49 .v29-network-card{
    min-height:0!important;
    overflow:hidden!important;
  }
  .energy-v49 .v29-network-scene{
    display:grid!important;
    grid-template-columns:68px minmax(0,1fr) 48px!important;
    align-items:center!important;
    gap:6px!important;
    min-height:205px!important;
    padding:10px 6px!important;
    overflow:hidden!important;
  }
  .energy-v49 .v29-net-node.house img{
    width:70px!important;
    max-width:70px!important;
    max-height:68px!important;
  }
  .energy-v49 .v29-net-node.copel img{
    width:42px!important;
    max-width:42px!important;
    max-height:78px!important;
  }
  .energy-v49 .v29-net-flow{
    width:100%!important;
    min-width:0!important;
    gap:7px!important;
  }
  .energy-v49 .v29-net-line{
    min-height:54px!important;
    padding:7px 7px 16px!important;
    overflow:hidden!important;
  }
  .energy-v49 .v29-net-line:after{
    left:7px!important;
    right:7px!important;
    bottom:5px!important;
  }
  .energy-v49 .v29-net-line span{
    font-size:6.2px!important;
  }
  .energy-v49 .v29-net-line strong{
    font-size:11px!important;
  }
  .energy-v49 .v29-net-line small{
    font-size:5.3px!important;
    margin-top:3px!important;
    padding-bottom:1px!important;
  }
  .energy-v49 .v29-net-node strong{
    font-size:7px!important;
  }
  .energy-v49 .v29-net-node span{
    font-size:4.5px!important;
  }
  .energy-v49 .v29-net-balance{
    grid-template-columns:1fr!important;
    gap:4px!important;
  }
}


/* ==========================================================================
   V54.0.0 — MOBILE: CARDS SOBRE A MALHA DE FLUXO, COMO NO DESKTOP
   ========================================================================== */

@media(max-width:699px){

  /* Cena um pouco mais alta para acomodar a malha completa sem sobreposição. */
  .energy-v50 .v26-scene{
    height:332px!important;
    min-height:332px!important;
    max-height:332px!important;
    position:relative!important;
  }

  /* Layout dos cards passa a seguir as próprias rotas de energia.
     ESQUERDA: placas -> inversor/micro -> geração total -> escudo/casa
     DIREITA: torre -> importação -> escudo/casa
              escudo/casa -> exportação -> torre
  */

  .energy-v50 .v26-inverter{
    left:6%!important;
    top:10%!important;
  }

  .energy-v50 .v26-micro{
    left:6%!important;
    top:24%!important;
  }

  .energy-v50 .v26-solar-total{
    left:40%!important;
    top:18%!important;
    transform:translateX(-50%)!important;
  }

  .energy-v50 .v26-grid-meter.import{
    right:7%!important;
    top:10%!important;
  }

  .energy-v50 .v26-grid-meter.export{
    right:7%!important;
    top:25%!important;
  }

  /* Ajuste fino dos tamanhos para manter todos os cards dentro da linha visual */
  .energy-v50 .v26-source{
    width:62px!important;
    min-width:62px!important;
    height:34px!important;
    min-height:34px!important;
  }

  .energy-v50 .v26-solar-total{
    width:60px!important;
    min-width:60px!important;
    height:32px!important;
    min-height:32px!important;
  }

  .energy-v50 .v26-grid-meter{
    width:68px!important;
    min-width:68px!important;
    height:36px!important;
    min-height:36px!important;
  }

  /* SVG da malha reposicionado para cruzar os cards, e não flutuar fora deles. */
  .energy-v50 .v26-flow-svg{
    inset:0!important;
    width:100%!important;
    height:100%!important;
    z-index:2!important;
    pointer-events:none!important;
    overflow:visible!important;
  }

  /* Cards acima do asset, mas visualmente integrados à malha. */
  .energy-v50 .v26-source,
  .energy-v50 .v26-solar-total,
  .energy-v50 .v26-grid-meter{
    z-index:6!important;
  }

  /* Casa/escudo permanecem o ponto central da malha. */
  .energy-v50 .v26-scene .asset-house{
    width:42%!important;
    max-width:42%!important;
    max-height:42%!important;
    left:50%!important;
    bottom:0!important;
    transform:translateX(-50%)!important;
    z-index:3!important;
  }

  .energy-v50 .v26-shield{
    width:124px!important;
    height:124px!important;
    left:50%!important;
    bottom:34px!important;
    transform:translateX(-50%)!important;
    z-index:4!important;
  }

  .energy-v50 .v26-scene .asset-solar{
    width:17%!important;
    max-width:17%!important;
    left:-1%!important;
    bottom:3px!important;
    z-index:3!important;
  }

  .energy-v50 .v26-scene .asset-grid{
    width:11.5%!important;
    max-width:11.5%!important;
    right:1%!important;
    bottom:3px!important;
    z-index:3!important;
  }

  /* Pontos luminosos de conexão para criar sensação de malha/rede */
  .energy-v50 .v26-scene:before,
  .energy-v50 .v26-scene:after{
    content:""!important;
    position:absolute!important;
    width:5px!important;
    height:5px!important;
    border-radius:50%!important;
    background:#8fffc2!important;
    box-shadow:0 0 8px rgba(143,255,194,.9)!important;
    z-index:5!important;
    pointer-events:none!important;
    animation:v50NodePulse 1.8s ease-in-out infinite!important;
  }
  .energy-v50 .v26-scene:before{
    left:38.5%!important;
    top:28.8%!important;
  }
  .energy-v50 .v26-scene:after{
    right:26.5%!important;
    top:29.8%!important;
    background:#7fdcff!important;
    box-shadow:0 0 8px rgba(127,220,255,.9)!important;
    animation-delay:.6s!important;
  }

  @keyframes v50NodePulse{
    0%,100%{transform:scale(.75);opacity:.45}
    50%{transform:scale(1.35);opacity:1}
  }

  /* Trilhos mais visíveis no mobile, mas sem neon exagerado. */
  .energy-v50 .v26-rail{
    stroke-width:2.15!important;
    opacity:.7!important;
  }

  .energy-v50 .v33-pulse{
    stroke-width:3.4!important;
    stroke-linecap:round!important;
    opacity:.9!important;
  }

  /* Geração: placas -> cards -> total -> escudo.
     Mantém o mesmo padrão de pontos correndo. */
  .energy-v50 .v26-rail.solar.active{
    stroke:#5fe99a!important;
    stroke-dasharray:none!important;
    opacity:.68!important;
  }

  .energy-v50 .v33-pulse.solar.active{
    stroke:#c1ffd7!important;
    stroke-dasharray:2 12!important;
    animation:v50FlowPulse 4.8s linear infinite!important;
  }

  /* Importação: torre -> card -> escudo/casa */
  .energy-v50 .v26-rail.import.active{
    stroke:#b47a35!important;
    stroke-dasharray:none!important;
    opacity:.62!important;
  }

  .energy-v50 .v33-pulse.import.active{
    stroke:#ffd391!important;
    stroke-dasharray:2 12!important;
    animation:v50FlowPulse 4.8s linear infinite!important;
  }

  /* Exportação: escudo/casa -> card -> torre */
  .energy-v50 .v26-rail.export.active{
    stroke:#3588a7!important;
    stroke-dasharray:none!important;
    opacity:.62!important;
  }

  .energy-v50 .v33-pulse.export.active{
    stroke:#a9ecff!important;
    stroke-dasharray:2 12!important;
    animation:v50FlowPulse 4.8s linear infinite!important;
  }

  @keyframes v50FlowPulse{
    from{stroke-dashoffset:0}
    to{stroke-dashoffset:-96}
  }

  /* Sem fluxo = sem animação. */
  .energy-v50 .v33-pulse.import.inactive,
  .energy-v50 .v33-pulse.export.inactive,
  .energy-v50 .v33-pulse.solar.inactive{
    display:none!important;
    animation:none!important;
  }

  /* Textos continuam legíveis apesar dos cards menores. */
  .energy-v50 .v26-source span,
  .energy-v50 .v26-grid-meter span,
  .energy-v50 .v26-solar-total span{
    font-size:3.6px!important;
  }

  .energy-v50 .v26-source strong,
  .energy-v50 .v26-grid-meter strong,
  .energy-v50 .v26-solar-total strong{
    font-size:8.4px!important;
  }
}


/* ==========================================================================
   V54.0.0 — MOBILE REBUILD DO CARD PRINCIPAL
   Desktop NÃO é alterado.
   ========================================================================== */

/* A malha mobile nunca aparece fora do mobile. */
.v51-mobile-mesh{display:none}

@media(max-width:699px){

  /* Remove somente o SVG desktop no mobile; ele era a origem do desalinhamento. */
  .energy-v51 .v26-flow-svg{display:none!important}
  .energy-v51 .v51-mobile-mesh{
    display:block!important;
    position:absolute!important;
    inset:0!important;
    width:100%!important;
    height:100%!important;
    z-index:2!important;
    pointer-events:none!important;
    overflow:visible!important;
  }

  /* Card principal com geometria fixa e previsível no celular. */
  .energy-v51 .v26-scene{
    height:350px!important;
    min-height:350px!important;
    max-height:350px!important;
    overflow:hidden!important;
    position:relative!important;
  }

  /* Os cinco cards ficam exatamente sobre os ramos da malha. */
  .energy-v51 .v26-inverter{
    left:11.5%!important;
    top:13%!important;
  }
  .energy-v51 .v26-micro{
    left:11.5%!important;
    top:33%!important;
  }
  .energy-v51 .v26-solar-total{
    left:35%!important;
    top:23%!important;
    transform:translate(-50%,-50%)!important;
  }
  .energy-v51 .v26-grid-meter.import{
    right:10%!important;
    top:13%!important;
  }
  .energy-v51 .v26-grid-meter.export{
    right:10%!important;
    top:33%!important;
  }

  /* Compactos, mas legíveis, e sem "caixão" grande no lado REDE. */
  .energy-v51 .v26-source{
    width:68px!important;
    min-width:68px!important;
    height:40px!important;
    min-height:40px!important;
    padding:4px 5px!important;
  }
  .energy-v51 .v26-solar-total{
    width:70px!important;
    min-width:70px!important;
    height:38px!important;
    min-height:38px!important;
    padding:4px 5px!important;
  }
  .energy-v51 .v26-grid-meter{
    width:82px!important;
    min-width:82px!important;
    height:42px!important;
    min-height:42px!important;
    padding:4px 6px!important;
  }

  /* Assets separados da faixa de cards. */
  .energy-v51 .v26-scene .asset-house{
    width:42%!important;
    max-width:42%!important;
    max-height:42%!important;
    left:50%!important;
    bottom:2px!important;
    transform:translateX(-50%)!important;
    z-index:3!important;
  }
  .energy-v51 .v26-shield{
    width:132px!important;
    height:132px!important;
    left:50%!important;
    bottom:31px!important;
    transform:translateX(-50%)!important;
    z-index:4!important;
  }
  .energy-v51 .v26-scene .asset-solar{
    width:18%!important;
    max-width:18%!important;
    left:-1%!important;
    bottom:5px!important;
    z-index:3!important;
  }
  .energy-v51 .v26-scene .asset-grid{
    width:12%!important;
    max-width:12%!important;
    right:1%!important;
    bottom:5px!important;
    z-index:3!important;
  }

  .energy-v51 .v26-source,
  .energy-v51 .v26-solar-total,
  .energy-v51 .v26-grid-meter{
    z-index:6!important;
  }

  /* Linha-base discreta; as partículas dão a sensação de fluxo. */
  .energy-v51 .v51-mesh-base{
    fill:none!important;
    stroke-width:2.0!important;
    stroke-linecap:round!important;
    opacity:.48!important;
  }
  .energy-v51 .v51-mesh-base.solar{stroke:#4cbd79!important}
  .energy-v51 .v51-mesh-base.import{stroke:#9e6a2d!important}
  .energy-v51 .v51-mesh-base.export{stroke:#2f7691!important}

  /* Mesmo padrão visual para TODOS os fluxos. */
  .energy-v51 .v51-mesh-flow{
    fill:none!important;
    stroke-width:3.6!important;
    stroke-linecap:round!important;
    stroke-dasharray:1.5 11!important;
    opacity:.95!important;
    animation:v51MeshFlow 4.2s linear infinite!important;
  }
  .energy-v51 .v51-mesh-flow.solar{stroke:#c4ffda!important}
  .energy-v51 .v51-mesh-flow.import{stroke:#ffd494!important}
  .energy-v51 .v51-mesh-flow.export{stroke:#a9edff!important}
  .energy-v51 .v51-mesh-flow.alt{animation-delay:-1.9s!important}

  /* IMPORTAÇÃO: o path foi desenhado da torre para a casa.
     EXPORTAÇÃO: o path foi desenhado da casa para a torre. */
  @keyframes v51MeshFlow{
    from{stroke-dashoffset:0}
    to{stroke-dashoffset:-100}
  }

  .energy-v51 .v51-mesh-flow.inactive{
    display:none!important;
    animation:none!important;
  }

  /* Evita resíduos das animações V33/V50 no mobile. */
  .energy-v51 .v33-total-house-bridge,
  .energy-v51 .v26-scene:before,
  .energy-v51 .v26-scene:after{
    display:none!important;
  }

  /* Textos dos cards compactos sem ficar microscópicos. */
  .energy-v51 .v26-source span,
  .energy-v51 .v26-grid-meter span,
  .energy-v51 .v26-solar-total span{
    font-size:4.3px!important;
    line-height:1.1!important;
  }
  .energy-v51 .v26-source strong,
  .energy-v51 .v26-grid-meter strong,
  .energy-v51 .v26-solar-total strong{
    font-size:9.2px!important;
    line-height:1.0!important;
  }
  .energy-v51 .v26-source small{
    font-size:3.6px!important;
    line-height:1!important;
  }

  /* Casa: leitura não encobre o asset. */
  .energy-v51 .v26-house-meter{
    bottom:0!important;
    min-width:92px!important;
    padding:5px 10px 6px!important;
    z-index:7!important;
  }
}

/* Tablet mantém o layout desktop; nenhuma regra da V51 mexe nele. */


/* ==========================================================================
   V54.0.0 — MOBILE ISOLADO DO DESKTOP
   Estratégia nova: o mobile tem cena, cards e SVG próprios.
   ========================================================================== */

.v52-mobile-scene{display:none}

@media(max-width:699px){

  /* O desktop não é recalculado no mobile: simplesmente sai da renderização. */
  .energy-v52 .v26-flow > .v26-scene{
    display:none!important;
  }

  .energy-v52 .v52-mobile-scene{
    display:block!important;
    position:relative!important;
    height:390px!important;
    min-height:390px!important;
    width:100%!important;
    overflow:hidden!important;
    isolation:isolate!important;
    background:
      radial-gradient(circle at 50% 74%,rgba(40,155,116,.10),transparent 31%),
      linear-gradient(180deg,#03101c 0%,#041522 54%,#03101a 100%)!important;
  }

  .energy-v52 .v52-mobile-atmosphere{
    position:absolute!important;
    inset:0!important;
    z-index:0!important;
    background:
      radial-gradient(circle at 50% 60%,rgba(35,193,150,.07),transparent 34%),
      radial-gradient(circle at 86% 54%,rgba(40,160,220,.045),transparent 30%)!important;
    pointer-events:none!important;
  }

  /* Assets */
  .energy-v52 .v52-asset{
    position:absolute!important;
    display:block!important;
    object-fit:contain!important;
    pointer-events:none!important;
    user-select:none!important;
    z-index:2!important;
  }

  .energy-v52 .v52-solar-asset{
    left:-2%!important;
    bottom:7px!important;
    width:19%!important;
    max-height:75px!important;
  }

  .energy-v52 .v52-house-asset{
    left:50%!important;
    bottom:3px!important;
    width:43%!important;
    max-height:145px!important;
    transform:translateX(-50%)!important;
  }

  .energy-v52 .v52-grid-asset{
    right:1.5%!important;
    bottom:6px!important;
    width:13%!important;
    max-height:90px!important;
  }

  /* Cards mobile - todos pequenos e separados */
  .energy-v52 .v52-card{
    position:absolute!important;
    z-index:6!important;
    box-sizing:border-box!important;
    display:flex!important;
    flex-direction:column!important;
    justify-content:center!important;
    align-items:center!important;
    text-align:center!important;
    border-radius:8px!important;
    background:rgba(3,17,28,.86)!important;
    backdrop-filter:blur(8px)!important;
    -webkit-backdrop-filter:blur(8px)!important;
    min-width:0!important;
    box-shadow:0 4px 14px rgba(0,0,0,.26)!important;
  }

  .energy-v52 .v52-inverter,
  .energy-v52 .v52-micro{
    left:11%!important;
    width:22%!important;
    height:47px!important;
  }
  .energy-v52 .v52-inverter{
    top:47px!important;
    border:1px solid rgba(70,173,255,.82)!important;
  }
  .energy-v52 .v52-micro{
    top:121px!important;
    border:1px solid rgba(255,176,64,.84)!important;
  }

  .energy-v52 .v52-generation{
    left:42%!important;
    top:83px!important;
    width:22%!important;
    height:48px!important;
    transform:translateX(-50%)!important;
    border:1px solid rgba(73,225,137,.82)!important;
  }

  .energy-v52 .v52-import,
  .energy-v52 .v52-export{
    right:9%!important;
    width:25%!important;
    height:54px!important;
  }
  .energy-v52 .v52-import{
    top:46px!important;
    border:1px solid rgba(255,178,65,.82)!important;
  }
  .energy-v52 .v52-export{
    top:120px!important;
    border:1px solid rgba(67,202,255,.82)!important;
  }

  .energy-v52 .v52-card span{
    font-size:6px!important;
    line-height:1.05!important;
    font-weight:750!important;
    letter-spacing:.02em!important;
    color:#dce9f3!important;
  }
  .energy-v52 .v52-card strong{
    font-size:13px!important;
    line-height:1.05!important;
    font-weight:850!important;
    margin:2px 0!important;
  }
  .energy-v52 .v52-card small{
    font-size:5px!important;
    line-height:1!important;
    color:#d7e3ec!important;
  }
  .energy-v52 .v52-inverter strong{color:#5cb7ff!important}
  .energy-v52 .v52-micro strong{color:#ffb548!important}
  .energy-v52 .v52-generation strong{color:#63ed9d!important}
  .energy-v52 .v52-import strong{color:#ffbd5b!important}
  .energy-v52 .v52-export strong{color:#5bd8ff!important}

  /* Casa */
  .energy-v52 .v52-house-meter{
    position:absolute!important;
    left:50%!important;
    bottom:1px!important;
    transform:translateX(-50%)!important;
    z-index:8!important;
    width:100px!important;
    min-height:42px!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    background:rgba(3,19,30,.90)!important;
    border:1px solid rgba(53,173,214,.55)!important;
    clip-path:polygon(15% 0,85% 0,100% 100%,0 100%)!important;
    text-align:center!important;
  }
  .energy-v52 .v52-house-meter span{
    font-size:6px!important;
    font-weight:800!important;
    color:#dfeef5!important;
  }
  .energy-v52 .v52-house-meter strong{
    font-size:16px!important;
    line-height:1!important;
    color:#fff!important;
    margin-top:2px!important;
  }

  .energy-v52 .v52-grid-label{
    position:absolute!important;
    right:0.5%!important;
    bottom:0!important;
    z-index:7!important;
    width:18%!important;
    text-align:center!important;
    font-size:9px!important;
    line-height:1!important;
    font-weight:850!important;
    color:#fff!important;
    text-shadow:0 0 7px rgba(255,255,255,.26)!important;
  }
  .energy-v52 .v52-grid-label small{
    display:block!important;
    margin-top:2px!important;
    font-size:5.5px!important;
    color:#fff!important;
  }

  /* Escudo da casa */
  .energy-v52 .v52-shield{
    position:absolute!important;
    left:50%!important;
    bottom:47px!important;
    width:126px!important;
    height:126px!important;
    transform:translateX(-50%)!important;
    border:2px solid rgba(65,226,142,.58)!important;
    border-radius:50%!important;
    z-index:4!important;
    box-shadow:
      0 0 13px rgba(67,226,145,.15),
      inset 0 0 15px rgba(72,206,255,.08)!important;
  }
  .energy-v52 .v52-shield i,
  .energy-v52 .v52-shield b{
    position:absolute!important;
    border-radius:50%!important;
    inset:8px!important;
    border:1px solid rgba(70,201,255,.52)!important;
    animation:v52ShieldSpin 11s linear infinite!important;
  }
  .energy-v52 .v52-shield i:nth-child(2){
    inset:20px!important;
    border-color:rgba(75,237,144,.44)!important;
    animation-direction:reverse!important;
    animation-duration:8s!important;
  }
  .energy-v52 .v52-shield b{
    inset:-7px!important;
    border:1px solid transparent!important;
    border-top-color:rgba(94,255,167,.75)!important;
    border-right-color:rgba(94,255,167,.20)!important;
    animation-duration:6.5s!important;
  }
  @keyframes v52ShieldSpin{
    to{transform:rotate(360deg)}
  }

  /* SVG mobile */
  .energy-v52 .v52-mobile-flow{
    position:absolute!important;
    inset:0!important;
    z-index:5!important;
    width:100%!important;
    height:100%!important;
    overflow:visible!important;
    pointer-events:none!important;
  }

  .energy-v52 .v52-rail{
    fill:none!important;
    stroke-width:1.35!important;
    stroke-linecap:round!important;
    opacity:.42!important;
  }
  .energy-v52 .v52-rail.solar{stroke:#50d88d!important}
  .energy-v52 .v52-rail.import{stroke:#ad7733!important}
  .energy-v52 .v52-rail.export{stroke:#317c9c!important}

  /* O efeito agora é exatamente o mesmo em solar/import/export. */
  .energy-v52 .v52-flow{
    fill:none!important;
    stroke-width:3.1!important;
    stroke-linecap:round!important;
    stroke-dasharray:1.8 10!important;
    opacity:.96!important;
    animation:v52FlowMove 4.4s linear infinite!important;
  }
  .energy-v52 .v52-flow.solar{stroke:#bdffd6!important}
  .energy-v52 .v52-flow.import{stroke:#ffd18b!important}
  .energy-v52 .v52-flow.export{stroke:#a9ecff!important}
  .energy-v52 .v52-flow.alt{animation-delay:-2.1s!important}

  @keyframes v52FlowMove{
    from{stroke-dashoffset:0}
    to{stroke-dashoffset:-100}
  }

  .energy-v52 .v52-flow.inactive{
    display:none!important;
    animation:none!important;
  }

  /* Mantém scrolling vertical normal no mobile. */
  .energy-v52,
  .energy-v52 .v26-overview,
  .energy-v52 .v26-flow,
  .energy-v52 .v52-mobile-scene{
    touch-action:pan-y!important;
  }
}


/* ==========================================================================\n   V54.0.0 — MOBILE: CENA COMPACTA E REALMENTE INDEPENDENTE DO DESKTOP\n   ========================================================================== */
.v53-mobile-scene{display:none}

@media(max-width:699px){
  /* Desktop preservado: apenas oculto na faixa mobile. */
  .energy-v53 .v26-flow > .v26-scene,
  .energy-v53 .v52-mobile-scene{display:none!important}

  .energy-v53 .v53-mobile-scene{
    display:block!important;
    position:relative!important;
    width:100%!important;
    height:305px!important;
    min-height:305px!important;
    overflow:hidden!important;
    isolation:isolate!important;
    touch-action:pan-y!important;
    background:
      radial-gradient(circle at 50% 76%,rgba(47,198,144,.09),transparent 28%),
      linear-gradient(180deg,#03101b 0%,#041625 58%,#03111c 100%)!important;
  }
  .energy-v53 .v53-mobile-atmosphere{
    position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none!important;
    background:
      radial-gradient(circle at 50% 66%,rgba(43,197,159,.06),transparent 31%),
      radial-gradient(circle at 86% 63%,rgba(55,179,228,.04),transparent 22%)!important;
  }

  .energy-v53 .v53-asset{position:absolute!important;display:block!important;object-fit:contain!important;z-index:2!important;pointer-events:none!important}
  .energy-v53 .v53-solar-asset{left:-1%!important;bottom:3px!important;width:18%!important;max-height:58px!important}
  .energy-v53 .v53-house-asset{left:50%!important;bottom:0!important;width:38%!important;max-height:108px!important;transform:translateX(-50%)!important}
  .energy-v53 .v53-grid-asset{right:1.5%!important;bottom:2px!important;width:11.5%!important;max-height:66px!important}

  .energy-v53 .v53-card{
    position:absolute!important;z-index:7!important;box-sizing:border-box!important;
    display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;
    border-radius:7px!important;background:rgba(3,17,29,.92)!important;
    backdrop-filter:blur(7px)!important;-webkit-backdrop-filter:blur(7px)!important;
    box-shadow:0 4px 13px rgba(0,0,0,.25)!important;
  }
  .energy-v53 .v53-inverter,.energy-v53 .v53-micro{left:19%!important;width:18%!important;height:43px!important}
  .energy-v53 .v53-inverter{top:70px!important;border:1px solid rgba(65,171,255,.85)!important}
  .energy-v53 .v53-micro{top:128px!important;border:1px solid rgba(255,176,61,.88)!important}
  .energy-v53 .v53-generation{left:50%!important;top:99px!important;width:20%!important;height:45px!important;transform:translateX(-50%)!important;border:1px solid rgba(73,226,139,.84)!important}
  .energy-v53 .v53-import,.energy-v53 .v53-export{right:18%!important;width:20%!important;height:47px!important}
  .energy-v53 .v53-import{top:69px!important;border:1px solid rgba(255,180,63,.85)!important}
  .energy-v53 .v53-export{top:127px!important;border:1px solid rgba(72,203,255,.83)!important}

  .energy-v53 .v53-card span{font-size:5.4px!important;line-height:1.05!important;font-weight:820!important;letter-spacing:.015em!important;color:#f1f7fb!important}
  .energy-v53 .v53-card strong{font-size:11.5px!important;line-height:1!important;font-weight:900!important;margin:2px 0!important}
  .energy-v53 .v53-card small{font-size:4.7px!important;line-height:1!important;color:#dbe7ee!important}
  .energy-v53 .v53-inverter strong{color:#59b8ff!important}.energy-v53 .v53-micro strong{color:#ffb64d!important}.energy-v53 .v53-generation strong{color:#63ed9c!important}.energy-v53 .v53-import strong{color:#ffc064!important}.energy-v53 .v53-export strong{color:#5bd9ff!important}

  .energy-v53 .v53-house-meter{
    position:absolute!important;left:50%!important;bottom:0!important;transform:translateX(-50%)!important;z-index:9!important;
    width:88px!important;min-height:38px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;
    clip-path:polygon(15% 0,85% 0,100% 100%,0 100%)!important;background:rgba(3,19,30,.92)!important;border:1px solid rgba(63,183,219,.5)!important;text-align:center!important;
  }
  .energy-v53 .v53-house-meter span{font-size:5.5px!important;font-weight:820!important;color:#eef7fb!important}
  .energy-v53 .v53-house-meter strong{font-size:15px!important;line-height:1!important;color:#fff!important;margin-top:2px!important}
  .energy-v53 .v53-grid-label{position:absolute!important;right:.5%!important;bottom:0!important;z-index:8!important;width:16%!important;text-align:center!important;font-size:8.5px!important;font-weight:900!important;color:#fff!important;line-height:1!important}
  .energy-v53 .v53-grid-label small{display:block!important;margin-top:2px!important;font-size:5.2px!important;color:#fff!important}

  .energy-v53 .v53-shield{position:absolute!important;left:50%!important;bottom:31px!important;width:108px!important;height:108px!important;transform:translateX(-50%)!important;border-radius:50%!important;border:2px solid rgba(74,232,151,.55)!important;z-index:4!important;box-shadow:0 0 14px rgba(65,228,146,.13),inset 0 0 14px rgba(65,192,255,.07)!important}
  .energy-v53 .v53-shield i,.energy-v53 .v53-shield b{position:absolute!important;border-radius:50%!important;inset:9px!important;border:1px solid rgba(72,202,255,.48)!important;animation:v53Shield 10.5s linear infinite!important}
  .energy-v53 .v53-shield i:nth-child(2){inset:21px!important;border-color:rgba(79,235,149,.43)!important;animation-direction:reverse!important;animation-duration:7.7s!important}
  .energy-v53 .v53-shield b{inset:-6px!important;border:1px solid transparent!important;border-top-color:rgba(98,255,171,.74)!important;border-right-color:rgba(98,255,171,.18)!important;animation-duration:6.2s!important}
  @keyframes v53Shield{to{transform:rotate(360deg)}}

  .energy-v53 .v53-mobile-flow{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:5!important;overflow:visible!important;pointer-events:none!important}
  .energy-v53 .v53-rail{fill:none!important;stroke-width:1.25!important;stroke-linecap:round!important;opacity:.47!important}
  .energy-v53 .v53-rail.solar{stroke:#47d587!important}.energy-v53 .v53-rail.import{stroke:#c08737!important}.energy-v53 .v53-rail.export{stroke:#3b92b8!important}
  .energy-v53 .v53-particles circle{opacity:.98!important}
  .energy-v53 .v53-particles.solar circle{fill:#c9ffdc!important}.energy-v53 .v53-particles.import circle{fill:#ffd28e!important}.energy-v53 .v53-particles.export circle{fill:#a9efff!important}

  /* A cena mobile tem seus próprios elementos; as regras antigas não interferem. */
  .energy-v53,.energy-v53 .v26-overview,.energy-v53 .v26-flow,.energy-v53 .v53-mobile-scene{touch-action:pan-y!important}
}


/* ==========================================================================\n   V54.0.0 — MOBILE REALMENTE ISOLADO: MALHA EM 3 NÓS (SOLAR / CASA / REDE)\n   ========================================================================== */
.v54-mobile-scene{display:none}

@media(max-width:699px){
  /* Só no mobile: desliga qualquer cena herdada. Desktop permanece intocado. */
  .energy-v54 .v26-flow > .v26-scene,
  .energy-v54 .v52-mobile-scene,
  .energy-v54 .v53-mobile-scene{display:none!important}

  .energy-v54 .v54-mobile-scene{
    display:block!important;position:relative!important;width:100%!important;height:320px!important;min-height:320px!important;
    overflow:hidden!important;isolation:isolate!important;touch-action:pan-y!important;
    background:linear-gradient(180deg,#03101b 0%,#041523 58%,#03111b 100%)!important;
  }
  .energy-v54 .v54-mobile-atmosphere{position:absolute!important;inset:0!important;z-index:0!important;pointer-events:none!important;background:radial-gradient(circle at 50% 69%,rgba(40,190,146,.075),transparent 31%),radial-gradient(circle at 86% 63%,rgba(48,171,224,.035),transparent 24%)!important}

  .energy-v54 .v54-asset{position:absolute!important;display:block!important;object-fit:contain!important;pointer-events:none!important;user-select:none!important;z-index:2!important}
  .energy-v54 .v54-solar-asset{left:-1%!important;bottom:8px!important;width:18%!important;max-height:62px!important}
  .energy-v54 .v54-house-asset{left:50%!important;bottom:2px!important;width:40%!important;max-height:118px!important;transform:translateX(-50%)!important}
  .energy-v54 .v54-grid-asset{right:1%!important;bottom:6px!important;width:12%!important;max-height:72px!important}

  .energy-v54 .v54-card{position:absolute!important;z-index:7!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;border-radius:8px!important;background:rgba(3,17,28,.91)!important;backdrop-filter:blur(7px)!important;-webkit-backdrop-filter:blur(7px)!important;box-shadow:0 4px 12px rgba(0,0,0,.22)!important}
  .energy-v54 .v54-inverter,.energy-v54 .v54-micro{left:5%!important;width:25%!important;height:46px!important}
  .energy-v54 .v54-inverter{top:58px!important;border:1px solid rgba(67,173,255,.86)!important}
  .energy-v54 .v54-micro{top:122px!important;border:1px solid rgba(255,177,61,.88)!important}
  .energy-v54 .v54-generation{left:36%!important;top:88px!important;width:25%!important;height:50px!important;border:1px solid rgba(74,226,140,.85)!important}
  .energy-v54 .v54-import,.energy-v54 .v54-export{right:5%!important;width:25%!important;height:46px!important}
  .energy-v54 .v54-import{top:58px!important;border:1px solid rgba(255,182,66,.86)!important}
  .energy-v54 .v54-export{top:122px!important;border:1px solid rgba(71,203,255,.84)!important}

  .energy-v54 .v54-card span{font-size:6.1px!important;line-height:1.05!important;font-weight:850!important;letter-spacing:.015em!important;color:#f5f9fc!important}
  .energy-v54 .v54-card strong{font-size:13.2px!important;line-height:1!important;font-weight:900!important;margin:2px 0!important}
  .energy-v54 .v54-card small{font-size:5px!important;line-height:1!important;color:#dce8ee!important}
  .energy-v54 .v54-inverter strong{color:#60bcff!important}.energy-v54 .v54-micro strong{color:#ffb94f!important}.energy-v54 .v54-generation strong{color:#67eda0!important}.energy-v54 .v54-import strong{color:#ffc15f!important}.energy-v54 .v54-export strong{color:#5bdcff!important}

  .energy-v54 .v54-house-meter{position:absolute!important;left:50%!important;bottom:0!important;transform:translateX(-50%)!important;z-index:9!important;width:94px!important;min-height:39px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;clip-path:polygon(15% 0,85% 0,100% 100%,0 100%)!important;background:rgba(3,18,29,.94)!important;border:1px solid rgba(68,186,222,.53)!important}
  .energy-v54 .v54-house-meter span{font-size:5.7px!important;font-weight:850!important;color:#f4f8fb!important}.energy-v54 .v54-house-meter strong{font-size:15.5px!important;line-height:1!important;color:#fff!important;margin-top:2px!important}
  .energy-v54 .v54-grid-label{position:absolute!important;right:0!important;bottom:0!important;z-index:8!important;width:15%!important;text-align:center!important;font-size:8.5px!important;line-height:1!important;font-weight:900!important;color:#fff!important}.energy-v54 .v54-grid-label small{display:block!important;margin-top:2px!important;font-size:5.2px!important;color:#fff!important}

  .energy-v54 .v54-shield{position:absolute!important;left:50%!important;bottom:34px!important;width:118px!important;height:118px!important;transform:translateX(-50%)!important;border-radius:50%!important;border:2px solid rgba(76,230,151,.56)!important;z-index:4!important;box-shadow:0 0 12px rgba(65,227,147,.12),inset 0 0 13px rgba(63,190,255,.07)!important}
  .energy-v54 .v54-shield i,.energy-v54 .v54-shield b{position:absolute!important;border-radius:50%!important;inset:10px!important;border:1px solid rgba(72,202,255,.47)!important;animation:v54Shield 12s linear infinite!important}.energy-v54 .v54-shield i:nth-child(2){inset:23px!important;border-color:rgba(79,235,149,.42)!important;animation-direction:reverse!important;animation-duration:8.5s!important}.energy-v54 .v54-shield b{inset:-5px!important;border:1px solid transparent!important;border-top-color:rgba(98,255,171,.72)!important;border-right-color:rgba(98,255,171,.16)!important;animation-duration:7s!important}@keyframes v54Shield{to{transform:rotate(360deg)}}

  .energy-v54 .v54-mobile-flow{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:5!important;overflow:visible!important;pointer-events:none!important}
  .energy-v54 .v54-rail{fill:none!important;stroke-width:1.35!important;stroke-linecap:round!important;opacity:.36!important}.energy-v54 .v54-rail.solar{stroke:#52d88e!important}.energy-v54 .v54-rail.import{stroke:#b4823d!important}.energy-v54 .v54-rail.export{stroke:#3982a5!important}

  /* mesmo efeito em TODOS os fluxos: trilho sutil + pequenos segmentos luminosos. */
  .energy-v54 .v54-flow{fill:none!important;stroke-width:2.6!important;stroke-linecap:round!important;stroke-dasharray:3 11!important;animation:v54Flow 3.2s linear infinite!important;opacity:.92!important}.energy-v54 .v54-flow.solar{stroke:#c8ffdc!important}.energy-v54 .v54-flow.import{stroke:#ffd18a!important}.energy-v54 .v54-flow.export{stroke:#a9efff!important}.energy-v54 .v54-flow.b,.energy-v54 .v54-flow.d,.energy-v54 .v54-flow.f{animation-delay:-1.6s!important}@keyframes v54Flow{to{stroke-dashoffset:-28}}

  .energy-v54,.energy-v54 .v26-overview,.energy-v54 .v26-flow,.energy-v54 .v54-mobile-scene{touch-action:pan-y!important}
}

:host([viewport-fit]){height:100%;min-height:0;display:block;overflow:hidden}
:host([viewport-fit]) .energy-v54{display:block!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;container-type:size}
:host([viewport-fit]) .energy-v54 .shell-v24{box-sizing:border-box!important;width:100%!important;height:100%!important;min-width:0!important;padding:6px!important;display:grid!important;grid-template-rows:clamp(40px,7cqh,64px) clamp(35px,6cqh,50px) minmax(0,1fr)!important;gap:6px!important}
:host([viewport-fit]) .energy-v54 .master-header{min-width:0!important;min-height:0!important;height:100%!important;grid-template-columns:minmax(150px,1.05fr) minmax(0,2.8fr) minmax(145px,.8fr)!important}
:host([viewport-fit]) .energy-v54 .brand-v14{padding:5px 8px!important;gap:7px!important;min-width:0!important}
:host([viewport-fit]) .energy-v54 .brand-mark{width:28px!important;height:28px!important;padding:5px!important;flex-shrink:0}
:host([viewport-fit]) .energy-v54 .brand-v14 strong{font-size:clamp(12px,2.5cqh,23px)!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .brand-v14 small{font-size:6px!important}
:host([viewport-fit]) .energy-v54 .master-tabs{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-column:auto!important;grid-row:auto!important;min-width:0!important;height:100%!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .master-tabs button{min-width:0!important;width:100%!important;height:100%!important;padding:3px!important;font-size:clamp(5px,1cqh,9px)!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .master-tabs button i{width:19px!important;height:19px!important}
:host([viewport-fit]) .energy-v54 .header-meta{min-width:0!important;grid-column:auto!important;grid-row:auto!important;padding:4px!important;gap:7px!important}
:host([viewport-fit]) .energy-v54 .clock-v14 strong{font-size:clamp(15px,3.2cqh,28px)!important}
:host([viewport-fit]) .energy-v54 .clock-v14 small,:host([viewport-fit]) .energy-v54 .clock-v14 span{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .system-pill{min-width:0!important;padding:5px!important;font-size:6px!important}
:host([viewport-fit]) .energy-v54 .system-pill strong,:host([viewport-fit]) .energy-v54 .system-pill small{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .filter-v14{grid-template-columns:minmax(100px,.8fr) minmax(175px,1.2fr) minmax(260px,2fr) minmax(70px,.4fr)!important;min-width:0!important;gap:6px!important;padding:4px 7px!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .filter-label{padding:0!important;border:0!important;min-width:0!important}
:host([viewport-fit]) .energy-v54 .filter-label strong{font-size:7px!important}
:host([viewport-fit]) .energy-v54 .filter-label small{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .quick-v14{min-width:0!important;gap:3px!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .quick-v14 button{min-width:0!important;flex:1!important;padding:5px 2px!important;font-size:6px!important}
:host([viewport-fit]) .energy-v54 .dates-v14{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto!important;min-width:0!important;gap:4px!important}
:host([viewport-fit]) .energy-v54 .dates-v14 input{min-width:0!important;height:25px!important;font-size:7px!important}
:host([viewport-fit]) .energy-v54 .dates-v14 .apply-v14{height:25px!important;padding:4px!important;font-size:6px!important;grid-column:auto!important}
:host([viewport-fit]) .energy-v54 .period-active{min-width:0!important;text-align:right!important}
:host([viewport-fit]) .energy-v54 main{height:100%!important;min-height:0!important;min-width:0!important;overflow:auto}
:host([viewport-fit]) .energy-v54 .v26-overview{display:grid!important;height:100%!important;min-height:0!important;grid-template-rows:minmax(0,.13fr) minmax(0,.43fr) minmax(0,.23fr) minmax(0,.21fr)!important;gap:6px!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .v26-overview>section{min-height:0!important;min-width:0!important;max-height:100%!important;gap:6px!important}
:host([viewport-fit]) .energy-v54 .v26-kpis{grid-template-columns:repeat(8,minmax(0,1fr))!important}
:host([viewport-fit]) .energy-v54 .v26-kpis article{min-height:0!important;min-width:0!important;height:100%!important;padding:5px 7px!important;grid-template-columns:22px minmax(0,1fr)!important;gap:5px!important}
:host([viewport-fit]) .energy-v54 .v26-kpis article>i{width:22px!important;height:22px!important;padding:3px!important}
:host([viewport-fit]) .energy-v54 .v26-kpis span{font-size:clamp(5px,1cqh,8px)!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .v26-kpis strong{font-size:clamp(10px,2.6cqh,25px)!important;margin-top:2px!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .v26-kpis small,:host([viewport-fit]) .energy-v54 .v26-kpis em{font-size:clamp(4px,.85cqh,7px)!important;margin-top:2px!important}
:host([viewport-fit]) .energy-v54 .v26-kpis article>b{bottom:3px!important;height:3px!important}
:host([viewport-fit]) .energy-v54 .v26-hero-grid{grid-template-columns:minmax(0,3.8fr) minmax(180px,1fr)!important}
:host([viewport-fit]) .energy-v54 .v26-flow{display:grid!important;grid-template-rows:clamp(23px,4cqh,35px) minmax(0,1fr)!important;min-height:0!important}
:host([viewport-fit]) .energy-v54 .v26-flow-head{height:100%!important;min-height:0!important;padding:4px 8px!important}
:host([viewport-fit]) .energy-v54 .v26-flow-head strong{font-size:clamp(7px,1.35cqh,12px)!important}
:host([viewport-fit]) .energy-v54 .v26-flow-head small{font-size:5px!important;margin-top:1px!important}
:host([viewport-fit]) .energy-v54 .v26-flow-head>span{font-size:6px!important;padding:3px 6px!important}
:host([viewport-fit]) .energy-v54 .v26-scene{display:block!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .v53-mobile-scene,:host([viewport-fit]) .energy-v54 .v54-mobile-scene{display:none!important}
:host([viewport-fit]) .energy-v54 .v26-source{width:15%!important;min-width:75px!important;height:auto!important;padding:4px 5px!important;gap:4px!important}
:host([viewport-fit]) .energy-v54 .v26-source>i{width:18px!important;height:18px!important}
:host([viewport-fit]) .energy-v54 .v26-source span{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .v26-source strong{font-size:clamp(10px,2cqh,18px)!important}
:host([viewport-fit]) .energy-v54 .v26-source small{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .v26-inverter{top:18%!important;left:16%!important}
:host([viewport-fit]) .energy-v54 .v26-micro{top:57%!important;left:16%!important}
:host([viewport-fit]) .energy-v54 .v26-solar-total{left:33%!important;top:37%!important;min-width:75px!important;padding:5px!important}
:host([viewport-fit]) .energy-v54 .v26-solar-total strong{font-size:clamp(12px,2.3cqh,22px)!important}
:host([viewport-fit]) .energy-v54 .v26-solar-total span{font-size:6px!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter{min-width:85px!important;padding:5px!important;right:14%!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter strong{font-size:clamp(10px,2.1cqh,19px)!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter span{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter{left:51%!important;bottom:0!important;min-width:90px!important;width:15%!important;height:auto!important;padding:7px!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter strong{font-size:clamp(12px,2.5cqh,24px)!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter small{display:none!important}
:host([viewport-fit]) .energy-v54 .v26-shield{width:22%!important;height:80%!important;max-width:240px!important;max-height:240px!important;left:51%!important;top:50%!important;transform:translate(-50%,-50%)!important}
:host([viewport-fit]) .energy-v54 .v26-summary{padding:6px 8px!important;min-height:0!important;overflow:auto!important}
:host([viewport-fit]) .energy-v54 .v26-summary header>strong{font-size:clamp(8px,1.4cqh,13px)!important}
:host([viewport-fit]) .energy-v54 .v26-summary header>div{margin-top:4px!important}
:host([viewport-fit]) .energy-v54 .v26-summary header span{padding:4px!important;font-size:6px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list{margin-top:3px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list>div{grid-template-columns:16px minmax(0,1fr) auto!important;padding:clamp(1px,.6cqh,5px) 0!important;gap:4px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list i{width:14px!important;height:14px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list span,:host([viewport-fit]) .energy-v54 .v26-summary-list strong{font-size:clamp(5px,1cqh,9px)!important}
:host([viewport-fit]) .energy-v54 .v26-summary-foot{padding-top:3px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-foot span,:host([viewport-fit]) .energy-v54 .v26-summary-foot strong{font-size:7px!important}
:host([viewport-fit]) .energy-v54 .v26-analytics,:host([viewport-fit]) .energy-v54 .v26-lower{grid-template-columns:repeat(4,minmax(0,1fr))!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card{height:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important;padding:5px 7px!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card header{min-height:0!important;flex:0 0 auto!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card header>div>span{font-size:clamp(5px,1cqh,9px)!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card header>div>strong{font-size:clamp(11px,2cqh,20px)!important;margin-top:1px!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card header svg{width:12px!important;height:12px!important}
:host([viewport-fit]) .energy-v54 .v26-small-legend{font-size:5px!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .v26-chart{flex:1!important;height:0!important;min-height:0!important;padding-bottom:10px!important}
:host([viewport-fit]) .energy-v54 .v26-chart>svg{height:100%!important;max-height:100%!important}
:host([viewport-fit]) .energy-v54 .v26-legend{font-size:5px!important;bottom:1px!important}
:host([viewport-fit]) .energy-v54 .v26-peak{padding:4px!important;min-width:60px!important}
:host([viewport-fit]) .energy-v54 .v26-peak strong{font-size:clamp(10px,2cqh,18px)!important}
:host([viewport-fit]) .energy-v54 .v26-peak span,:host([viewport-fit]) .energy-v54 .v26-peak small{font-size:5px!important}
:host([viewport-fit]) .energy-v54 .v26-gauge{height:calc(100% - 30px)!important;width:auto!important;min-height:0!important;aspect-ratio:1!important}
:host([viewport-fit]) .energy-v54 .v26-gauge strong{font-size:clamp(14px,3cqh,28px)!important}
:host([viewport-fit]) .energy-v54 .v26-chart-card.gauge>small{font-size:5px!important;margin-top:0!important}
:host([viewport-fit]) .energy-v54 .v26-lower-card{min-height:0!important;height:100%!important;padding:5px 7px!important;overflow:auto!important}
:host([viewport-fit]) .energy-v54 .v26-lower-card header{margin-bottom:3px!important}
:host([viewport-fit]) .energy-v54 .v26-lower-card header strong{font-size:clamp(6px,1.1cqh,10px)!important}
:host([viewport-fit]) .energy-v54 .v26-consumer{grid-template-columns:15px minmax(0,1fr) minmax(15px,.8fr) auto 22px!important;min-height:18px!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .v26-board{grid-template-columns:15px minmax(0,1fr) auto 24px!important;padding:3px 0!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .v26-status-row,:host([viewport-fit]) .energy-v54 .v26-lower-card.indicators>div{padding:3px 0!important;gap:3px!important;grid-template-columns:14px minmax(0,1fr) auto 10px!important}
:host([viewport-fit]) .energy-v54 .v26-lower-card span,:host([viewport-fit]) .energy-v54 .v26-lower-card strong,:host([viewport-fit]) .energy-v54 .v26-lower-card em{font-size:clamp(5px,.95cqh,8px)!important}


:host([viewport-fit]) .energy-v54 .v26-scene .asset-solar{left:2%!important;right:auto!important;top:auto!important;bottom:4%!important;width:20%!important;height:65%!important;max-height:65%!important;object-fit:contain!important;transform:none!important}
:host([viewport-fit]) .energy-v54 .v26-scene .asset-house{left:51%!important;right:auto!important;top:auto!important;bottom:4%!important;width:40%!important;height:86%!important;max-height:86%!important;object-fit:contain!important;transform:translateX(-50%)!important}
:host([viewport-fit]) .energy-v54 .v26-scene .asset-grid{left:auto!important;right:2%!important;top:auto!important;bottom:4%!important;width:17%!important;height:80%!important;max-height:80%!important;object-fit:contain!important;transform:none!important}
:host([viewport-fit]) .energy-v54 .v26-summary{display:grid!important;grid-template-rows:auto minmax(0,1fr) 12px!important;gap:3px!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list{display:grid!important;grid-template-rows:repeat(7,minmax(0,1fr))!important;min-height:0!important;height:100%!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list>div{height:100%!important;min-height:0!important;padding:1px 0!important;box-sizing:border-box!important}
:host([viewport-fit]) .energy-v54 .v26-lower-card.status,:host([viewport-fit]) .energy-v54 .v26-lower-card.indicators{display:grid!important;grid-template-rows:16px repeat(5,minmax(0,1fr))!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .v26-status-row,:host([viewport-fit]) .energy-v54 .v26-lower-card.indicators>div{min-height:0!important;height:100%!important;padding:1px 0!important;box-sizing:border-box!important}
:host([viewport-fit]) .energy-v54 .v26-board{min-height:0!important;padding:2px 0!important;margin:0!important;gap:2px!important}
:host([viewport-fit]) .energy-v54 .filter-v14{align-items:center!important;box-sizing:border-box!important}
:host([viewport-fit]) .energy-v54 .dates-v14 input{min-height:0!important;height:23px!important;padding:2px!important}
:host([viewport-fit]) .energy-v54 .dates-v14 label{min-height:0!important;margin:0!important}

/* Final viewport layer: prevent the legacy fixed minimums and root rem scale
   from determining scene geometry on high-DPI Windows displays. */
:host([viewport-fit]) .energy-v54 .master-header,:host([viewport-fit]) .energy-v54 .filter-v14{box-sizing:border-box!important;overflow:hidden!important}
:host([viewport-fit]) .energy-v54 .master-tabs button{box-sizing:border-box!important;min-height:0!important;font-size:9px!important;line-height:1.1!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;padding:3px!important}
:host([viewport-fit]) .energy-v54 .master-tabs button i{width:16px!important;height:16px!important;min-height:0!important}
:host([viewport-fit]) .energy-v54 .master-tabs button svg{width:16px!important;height:16px!important}
:host([viewport-fit]) .energy-v54 .filter-v14 label{font-size:8px!important;line-height:1!important;min-height:0!important}
:host([viewport-fit]) .energy-v54 .filter-v14 input,:host([viewport-fit]) .energy-v54 .filter-v14 button{box-sizing:border-box!important;min-height:0!important;height:23px!important;line-height:1!important;padding:2px 5px!important}
:host([viewport-fit]) .energy-v54 .v26-source,:host([viewport-fit]) .energy-v54 .v26-grid-meter,:host([viewport-fit]) .energy-v54 .v26-solar-total{box-sizing:border-box!important;min-height:0!important;min-width:0!important;max-width:155px!important;width:14%!important;height:27%!important;max-height:62px!important;margin:0!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;padding:4px 6px!important;transform:none!important}
:host([viewport-fit]) .energy-v54 .v26-source>i{width:17px!important;height:17px!important;flex:0 0 17px!important;padding:0!important}
:host([viewport-fit]) .energy-v54 .v26-source>div{min-width:0!important}
:host([viewport-fit]) .energy-v54 .v26-source span,:host([viewport-fit]) .energy-v54 .v26-grid-meter span{font-size:8px!important;line-height:1.15!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .v26-source small{font-size:8px!important;line-height:1.15!important}
:host([viewport-fit]) .energy-v54 .v26-source strong,:host([viewport-fit]) .energy-v54 .v26-grid-meter strong{font-size:clamp(13px,2.3cqh,20px)!important;line-height:1.1!important;margin:1px 0!important}
:host([viewport-fit]) .energy-v54 .v26-inverter{top:13%!important;left:17%!important}
:host([viewport-fit]) .energy-v54 .v26-micro{top:57%!important;left:17%!important}
:host([viewport-fit]) .energy-v54 .v26-solar-total{left:33%!important;top:36%!important;width:12%!important;flex-direction:column!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter{right:14%!important;flex-direction:column!important;gap:2px!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter.import{top:18%!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter.export{top:58%!important}
:host([viewport-fit]) .energy-v54 .v26-grid-label{bottom:1%!important;right:3%!important;font-size:8px!important;width:12%!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter{box-sizing:border-box!important;min-height:0!important;max-height:30%!important;height:27%!important;min-width:0!important;width:17%!important;padding:3px!important;display:flex!important;flex-direction:column!important;justify-content:center!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter div{font-size:8px!important;line-height:1!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter svg{width:12px!important;height:12px!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter strong{font-size:clamp(14px,2.6cqh,23px)!important;line-height:1.1!important}
:host([viewport-fit]) .energy-v54 .v26-summary header button{font-size:9px!important;min-height:0!important;line-height:1!important;padding:4px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list>div>i{display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important;width:12px!important;height:12px!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list>div>i svg{width:12px!important;height:12px!important;max-width:100%!important;max-height:100%!important;position:static!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list>div{font-size:8px!important;line-height:1!important;min-height:0!important;gap:3px!important;grid-template-columns:12px minmax(0,1fr) auto!important}
:host([viewport-fit]) .energy-v54 .v26-summary-list span,:host([viewport-fit]) .energy-v54 .v26-summary-list strong{font-size:8px!important;line-height:1.2!important}
:host([viewport-fit]) .energy-v54 .v26-peak small,:host([viewport-fit]) .energy-v54 .v26-kpis article.peak small{font-size:10px!important;color:#fff!important;line-height:1.2!important;font-weight:700!important;background:#281a24!important;opacity:1!important;padding:1px 3px!important;border-radius:3px!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .v26-legend{font-size:8px!important;line-height:1!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .v26-status-row i,:host([viewport-fit]) .energy-v54 .v26-lower-card.indicators i{height:12px!important;width:12px!important;display:flex!important;align-items:center!important;padding:0!important}
:host([viewport-fit]) .energy-v54 .v26-status-row svg,:host([viewport-fit]) .energy-v54 .v26-lower-card.indicators svg{height:12px!important;width:12px!important}
.empty-consumers144{font-size:10px;line-height:1.4;margin:5px}.empty-consumers144 button{font-size:10px;padding:4px}
.analysis144{height:100%;min-height:0;display:grid;grid-template-rows:30px minmax(105px,.8fr) minmax(155px,1.3fr) minmax(65px,.45fr) 25px;gap:8px;overflow:hidden}
.analysis-title144{display:flex;align-items:center;justify-content:space-between;gap:12px}.analysis-title144 h2{margin:0;font-size:19px}.analysis-title144 span{font-size:10px;color:#b9d4e2}
.analysis-metrics144{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:1fr 1fr;gap:7px;min-height:0}.metric144{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:7px 10px;background:#04141f;border:1px solid #235066;border-radius:10px;min-width:0;min-height:0}.metric144>span{font-size:10px;font-weight:800;color:#e5f4fd;line-height:1.1}.metric144>strong{font-size:clamp(16px,2.7cqh,25px);line-height:1.1;color:#f5fbff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.metric144.green>strong{color:#69eba6}.metric144.cyan>strong{color:#62d6ff}.metric144.red>strong{color:#ff819b}.metric144.purple>strong{color:#cba9ff}.metric144.orange>strong{color:#ffcb80}.metric144>small{font-size:10px;line-height:1.2;color:#dfebf3}
.analysis-pies144{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-height:0}.pie-card144{padding:10px;background:#04141f;border:1px solid #235066;border-radius:12px;display:grid;grid-template-rows:22px minmax(0,1fr);gap:5px;min-height:0;overflow:hidden}.pie-card144 h3{font-size:13px;margin:0}.pie-content144{display:grid;grid-template-columns:minmax(90px,1fr) minmax(100px,1fr);align-items:center;gap:9px;min-height:0}.pie-content144>svg{width:100%;height:100%;min-height:0;max-height:220px}.pie-legend144{display:grid;gap:12px}.pie-legend144>div{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:4px;align-items:center}.pie-legend144 i{height:8px;width:8px;border-radius:3px}.pie-legend144 span{font-size:11px;line-height:1.2}.pie-legend144 strong{font-size:14px}.pie-legend144 small{grid-column:2/4;font-size:12px;color:#d5eaf7}.analysis-ratios144{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;min-height:0}.analysis-note144{font-size:9px;line-height:1.2;color:#b6ccd9;margin:0}
@media(max-width:900px){.pie-content144{grid-template-columns:1fr}.pie-legend144{gap:4px}.analysis144{grid-template-rows:30px minmax(120px,.8fr) minmax(220px,1.3fr) minmax(80px,.5fr) auto;overflow:auto}.analysis-metrics144{grid-template-columns:repeat(4,minmax(0,1fr))}}

.analysis144{grid-template-rows:24px minmax(124px,.85fr) minmax(135px,1.15fr) minmax(56px,.4fr) 20px;gap:6px}.analysis144 .metric144{padding:5px 8px;gap:2px}.analysis144 .metric144>span{font-size:9px;line-height:11px;flex-shrink:0}.analysis144 .metric144>strong{font-size:17px;line-height:20px;flex-shrink:0;min-height:20px}.analysis144 .metric144>small{font-size:9px;line-height:11px;flex-shrink:0}.pie-card144 svg text{fill:#042334!important;font-size:17px!important;font-weight:900!important}.analysis-note144{font-size:8px}.analysis-title144 h2{font-size:17px}.analysis-metrics144{gap:5px}.analysis-pies144{gap:6px}.analysis144 .pie-card144{padding:7px}.analysis-ratios144{gap:6px}
/* Compact geometry at normal zoom, independent of Home Assistant rem scaling. */
:host([viewport-fit]) .energy-v54 .shell-v24{grid-template-rows:44px 44px minmax(0,1fr)!important}
:host([viewport-fit]) .energy-v54 .master-header{grid-template-columns:minmax(180px,1.9fr) minmax(0,5fr) minmax(140px,1.3fr)!important}
:host([viewport-fit]) .energy-v54 .brand-v14 strong{font-size:16px!important}
:host([viewport-fit]) .energy-v54 .brand-mark{width:28px!important;height:28px!important}
:host([viewport-fit]) .energy-v54 .filter-v14{display:grid!important;grid-template-columns:160px minmax(220px,.85fr) minmax(320px,1.4fr) 100px!important;grid-template-rows:1fr!important;align-items:center!important;gap:8px!important;padding:4px 8px!important;min-height:44px!important;max-height:none!important;overflow:visible!important}
:host([viewport-fit]) .energy-v54 .filter-label{grid-column:auto!important;grid-row:auto!important;align-items:center!important;padding:0!important;border:0!important;min-width:0!important}
:host([viewport-fit]) .energy-v54 .filter-label strong{font-size:9px!important;line-height:12px!important}
:host([viewport-fit]) .energy-v54 .filter-label small{font-size:8px!important;line-height:11px!important;margin:0!important;white-space:normal!important}
:host([viewport-fit]) .energy-v54 .quick-v14{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:3px!important;min-width:0!important;overflow:visible!important}
:host([viewport-fit]) .energy-v54 .filter-v14 button{font-size:9px!important;height:25px!important;min-width:0!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .dates-v14{display:grid!important;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr) 57px!important;align-items:end!important;gap:5px!important;min-width:0!important}
:host([viewport-fit]) .energy-v54 .dates-v14 label{display:grid!important;grid-template-rows:10px 23px!important;gap:0!important;margin:0!important;padding:0!important;min-width:0!important;height:33px!important}
:host([viewport-fit]) .energy-v54 .dates-v14 label span{font-size:8px!important;line-height:10px!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .dates-v14 input{height:23px!important;min-width:0!important;width:100%!important;font-size:10px!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .period-active{min-width:0!important;text-align:right!important;display:flex!important;flex-direction:column!important;gap:0!important;justify-content:center!important;height:33px!important;overflow:visible!important}
:host([viewport-fit]) .energy-v54 .period-active span,:host([viewport-fit]) .energy-v54 .period-active small{font-size:8px!important;line-height:10px!important;margin:0!important;white-space:nowrap!important}
:host([viewport-fit]) .energy-v54 .period-active strong{font-size:11px!important;line-height:13px!important;margin:0!important}
:host([viewport-fit]) .energy-v54 .v26-source,:host([viewport-fit]) .energy-v54 .v26-grid-meter,:host([viewport-fit]) .energy-v54 .v26-solar-total{width:11%!important;max-width:140px!important;height:clamp(46px,23%,54px)!important;max-height:54px!important;padding:3px 5px!important;gap:3px!important}
:host([viewport-fit]) .energy-v54 .v26-inverter,:host([viewport-fit]) .energy-v54 .v26-micro{left:14%!important}
:host([viewport-fit]) .energy-v54 .v26-solar-total{left:27%!important;top:36%!important}
:host([viewport-fit]) .energy-v54 .v26-grid-meter{right:15%!important}
:host([viewport-fit]) .energy-v54 .v26-scene .asset-house{left:53%!important;width:28%!important;height:82%!important;max-height:82%!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter{left:53%!important}
:host([viewport-fit]) .energy-v54 .v26-source span,:host([viewport-fit]) .energy-v54 .v26-grid-meter span{font-size:8px!important;white-space:normal!important}
:host([viewport-fit]) .energy-v54 .v26-source small{font-size:8px!important}
:host([viewport-fit]) .energy-v54 .v29-net-line{padding:10px 14px 23px!important;min-height:90px!important;opacity:1!important}
:host([viewport-fit]) .energy-v54 .v29-net-line .flow-caption145{font-size:11px!important;font-style:normal!important;grid-column:1/-1!important;line-height:15px!important}
:host([viewport-fit]) .energy-v54 .v29-net-line i{display:none!important;animation:none!important}
:host([viewport-fit]) .energy-v54 .v29-net-line.flow-now145 i{display:block!important;width:18px!important;height:7px!important;border-radius:2px!important;bottom:11px!important;clip-path:polygon(0 0,65% 0,100% 50%,65% 100%,0 100%,35% 50%)!important;animation:flowExport145 2.4s linear infinite!important}
:host([viewport-fit]) .energy-v54 .v29-net-line.import.flow-now145 i{clip-path:polygon(35% 0,100% 0,65% 50%,100% 100%,35% 100%,0 50%)!important;animation:flowImport145 2.4s linear infinite!important}
@keyframes flowExport145{from{left:14px}to{left:calc(100% - 32px)}}
@keyframes flowImport145{from{left:calc(100% - 32px)}to{left:14px}}
@media(prefers-reduced-motion:reduce){:host([viewport-fit]) .energy-v54 .v29-net-line.flow-now145 i{animation:none!important;left:calc(50% - 9px)!important}}
@media(max-width:900px){:host([viewport-fit]) .energy-v54 .filter-v14{grid-template-columns:120px minmax(180px,1fr) minmax(250px,1.2fr) 85px!important;gap:4px!important}}


:host([viewport-fit]) .energy-v54 .v26-scene .asset-house{z-index:3!important;left:55%!important;width:32%!important;height:94%!important;max-height:94%!important;bottom:1%!important}
:host([viewport-fit]) .energy-v54 .v26-house-meter,:host([viewport-fit]) .energy-v54 .v26-shield{left:55%!important}
:host([viewport-fit]) .energy-v54 .v26-flow-svg,:host([viewport-fit]) .energy-v54 .v51-mobile-mesh{display:none!important}
:host([viewport-fit]) .energy-v54 .flow146{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:2!important;pointer-events:none!important;overflow:visible!important}
.flow146 path{fill:none;vector-effect:non-scaling-stroke;stroke-linecap:round}.flow146 .solar{stroke:#60d997}.flow146 .import{stroke:#e9b45d}.flow146 .export{stroke:#58c9eb}.flow146 .rail146{stroke-width:2;opacity:.4}.flow146 .motion146{stroke-width:3;stroke-dasharray:2 7;animation:flow146Move 2.8s linear infinite;opacity:.95}.flow146 .motion146.idle{display:none}.flow146 .motion146.solar{stroke:#d4ffe5}.flow146 .motion146.import{stroke:#ffe1a4}.flow146 .motion146.export{stroke:#c9f6ff}
@keyframes flow146Move{to{stroke-dashoffset:-18}}
@media(prefers-reduced-motion:reduce){.flow146 .motion146{animation:none!important}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
    `;
  }

}

if (!customElements.get("casa-pelizzon-energy-ops-card")) {
  customElements.define("casa-pelizzon-energy-ops-card", CasaPelizzonEnergyOpsCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c=>c.type === "casa-pelizzon-energy-ops-card")) {
  window.customCards.push({
    type:"casa-pelizzon-energy-ops-card",
    name:"CloudPelizzon - Malha Energética V22",
    description:"Dashboard EMS responsivo com filtro global, fluxo em tempo real e abas operacionais.",
    preview:false
  });
}

console.info("%c MALHA ENERGÉTICA V54.0.0 ","background:#020914;color:#35c8ff;padding:5px 8px;border:1px solid #1d6aa5;border-radius:4px;font-weight:bold;");


