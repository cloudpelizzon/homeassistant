import "/cloudpelizzon/frontend/date-format-r51.js?v=20260928-r51";
import "/cloudpelizzon-core/frontend/panel.js?v=7f1492e1498474d1d37dc0a8ffc7b0411d79c37ec71e64ecbe9369f8cd901b2a";
import "/cloudpelizzon/frontend/optional-modules.js?v=ffd124945e1e1cd235919a8a8f23b0fc647269b7ee8e92a98609ccd1bc2c70b8";
import "/cloudpelizzon-updater/frontend/panel.js?v=fe05dc5a139a541060f383d7462c57c443f4786285cc0417345a910300259bd4";


class CloudPelizzonPanel extends HTMLElement {

  constructor() {
    super();

    this.attachShadow({
      mode: "open"
    });

    this._hass = null;

    this._view = "core";

    this._operatorChecked = false;

    this._operatorAllowed = false;

    this._licensing = null;

    this._licensingLoading = false;

    this._licensingError = "";

    this._moduleRights = {};
    this._paidModules162 = {};
    this._moduleRightsLoading = false;
    this._moduleRightsLoaded = false;
    this._lastCommercialRefresh = 0;
  }


  set hass(value) {

    this._hass = value;
    if(this._requestHost161)this._requestHost161.hass=value;

    this.propagateHass();

    // Hidden security updates are handled by the actor-aware propagation path.

    if (
      value
      && !this._operatorChecked
    ) {
      this.checkOperator();
    }

    if (value && !this._moduleRightsLoaded && !this._moduleRightsLoading) {
      this.loadModuleRights();
    }
    // Revalidate the currently visible commercial panel (existing browser tab).
    if (value && ["maintenance", "energy", "security", "automation", "lighting"].includes(this._view)
        && !this._moduleRightsLoading
        && Date.now() - this._lastCommercialRefresh > 30000) {
      this._lastCommercialRefresh = Date.now();
      this.loadModuleRights(true);
    }
  }


  get hass() {
    return this._hass;
  }


  connectedCallback() {

    this.render();

    this.addEventListener(
      "cloudpelizzon-module-rights-changed",
      event => {

        this.updatePaidModules162(event?.detail?.modules || []);
        const rights = {};

        for (
          const item
          of (event?.detail?.modules || [])
        ) {
          // CP-TRIAL-ROOT-NAV-BRIDGE-V2: no cached or unsigned trial grant.
          rights[item.sku] = Boolean(
            (item?.license?.allowed===true ? item?.local_installed===true : false) || (
              item?.trial?.verified === true &&
              item?.trial?.phase === "trial_active" &&
              item?.trial?.paid_confirmed === false
            )
          );
        }

        const anterior =
          JSON.stringify(
            this._moduleRights || {}
          );

        const novo =
          JSON.stringify(
            rights
          );

        if (
          this._moduleRightsLoaded
          && anterior === novo
        ) {
          return;
        }

        this._moduleRights = rights;
        this._moduleRightsLoaded = true;

        if (
          this._view === "maintenance"
          && !this.isModuleAllowed(
            "CP-MAINTENANCE"
          )
        ) {
          this._view = "core";
        }

        if (
          this._view === "energy"
          && !this.isModuleAllowed(
            "CP-SOLAR"
          )
        ) {
          this._view = "core";
        }

        if (
          this._view === "security"
          && !this.isModuleAllowed(
            "CP-SECURITY"
          )
        ) {
          this._view = "core";
        }

        if (this._view === "automation" && !this.isModuleAllowed("CP-AUTOMATION")) {
          this._view = "core";
        }
        if (this._view === "lighting" && !this.isModuleAllowed("CP-LIGHTING")) this._view = "core";

        this.render();
        this.propagateHass();
      }
    );

    this.addEventListener(
      "cloudpelizzon-open-module",
      event => {

        const path =
          event?.detail?.path
          || "";

        if (path.includes("maintenance")) {
          this.showProtectedView("maintenance");
        }

        else if (path.includes("solar") || path.includes("energy") || path.includes("energia")) {
          if (this.isModuleAllowed("CP-SOLAR")) {
            this.show("energy");
          } else {
            this.loadModuleRights(true).then(() => {
              this.show(this.isModuleAllowed("CP-SOLAR") ? "energy" : "core");
            });
          }
        }

        else if (
          path.includes("security")
          || path.includes("seguranca")
          || path.includes("segurança")
        ) {

          if (
            this.isModuleAllowed(
              "CP-SECURITY"
            )
          ) {

            this.show(
              "security"
            );

          }

          else {

            this.loadModuleRights(
              true
            ).then(() => {

              this.show(
                this.isModuleAllowed(
                  "CP-SECURITY"
                )
                  ? "security"
                  : "core"
              );

            });

          }

        }


        else if (path.includes("lighting") || path.includes("iluminacao") || path.includes("iluminação")) {
          this.showProtectedView("lighting");
        }

        else if (path.includes("automation") || path.includes("automacoes")) {
          if (this.isModuleAllowed("CP-AUTOMATION")) {
            this.show("automation");
          } else {
            this.loadModuleRights(true).then(() =>
              this.show(this.isModuleAllowed("CP-AUTOMATION") ? "automation" : "core")
            );
          }
        }

        else if (
          path.includes(
            "updates"
          )
          || path.includes(
            "updater"
          )
        ) {
          this.show(
            "updates"
          );
        }

        else {
          this.show(
            "core"
          );
        }
      }
    );
  }


  async ws(
    type,
    payload = {},
  ) {

    if (!this._hass) {
      throw new Error(
        "Home Assistant indisponível."
      );
    }

    return await this._hass.callWS({
      type,
      ...payload,
    });
  }


  async loadModuleRights(force=false) {
    if(!this._hass)return false;
    if(this._moduleRightsLoading)return false;
    if(this._moduleRightsLoaded&&!force)return true;

    this._moduleRightsLoading=true;

    try{
      /* core/status verifies access; no duplicate refresh. */
      const data=await this.ws("cloudpelizzon/core/status");
      this.updatePaidModules162(data?.modules||[]);
      const rights={};

      for(const item of (data?.modules||[])){
        // CP-TRIAL-ROOT-NAV-BRIDGE-V2: signed Trial state from core/status.
        rights[item.sku]=Boolean((item?.license?.allowed===true ? item?.local_installed===true : false) || (
          item?.trial?.verified===true &&
          item?.trial?.phase==="trial_active" &&
          item?.trial?.paid_confirmed===false
        ));
      }

      const rightsChanged = !this._moduleRightsLoaded
        || JSON.stringify(this._moduleRights) !== JSON.stringify(rights);
      this._moduleRights=rights;
      this._moduleRightsLoaded=true;

      if(this._view==="energy"&&!this.isModuleAllowed("CP-SOLAR")){
        this._view="core";
      }

      if(this._view==="maintenance"&&!this.isModuleAllowed("CP-MAINTENANCE")){
        this._view="core";
      }

      if(this._view==="security"&&!this.isModuleAllowed("CP-SECURITY")){
        this._view="core";
      }

      if(this._view==="automation"&&!this.isModuleAllowed("CP-AUTOMATION")){
        this._view="core";
      }
      if(this._view==="lighting"&&!this.isModuleAllowed("CP-LIGHTING")){
        this._view="core";
      }

      // A license poll must not destroy and recreate a working commercial
      // panel every 30 seconds when nothing actually changed.
      if(rightsChanged){
        this.render();
        this.propagateHass();
      }
      return true;
    }
    catch(error){
      console.warn("CloudPelizzon: não foi possível verificar direitos dos módulos.",error);
      if(force){
        // No stale authorization when online verification itself fails.
        this._moduleRights={};
        this._moduleRightsLoaded=false;
        if(["maintenance","energy","security","automation"].includes(this._view)){
          this._view="core";
        }
        this.render();
      }
      return false;
    }
    finally{
      this._moduleRightsLoading=false;
    }
  }

  async showProtectedView(view){
    const skus={
      maintenance:"CP-MAINTENANCE",
      energy:"CP-SOLAR",
      security:"CP-SECURITY",
      automation:"CP-AUTOMATION",
      lighting:"CP-LIGHTING",
    };
    const sku=skus[view];
    if(!sku){this._nav471=(this._nav471||0)+1;this.show(view);return;}
    const seq=this._nav471=(this._nav471||0)+1;
    const nav=this.shadowRoot.querySelector(`[data-view="${view}"]`);
    nav?.setAttribute('aria-busy','true');
    try{
      const refreshed=await this.loadModuleRights(true);
      if(seq!==this._nav471)return;
      this.show(refreshed && this.isModuleAllowed(sku) ? view : "core");
    }finally{nav?.removeAttribute('aria-busy');}
  }

  isModuleAllowed(sku) {
    return Boolean(this._moduleRights?.[sku]);
  }


  async checkOperator() {

    this._operatorChecked = true;

    try {

      const result = await this.ws(
        "cloudpelizzon/operator/status"
      );

      this._operatorAllowed =
        !!result?.allowed;

    }

    catch (error) {

      this._operatorAllowed = false;
    }

    this.render();

    if (
      this._operatorAllowed
    ) {
      await this.loadLicensing();
    }
  }


  async loadLicensing(
    rerender = true,
  ) {

    if (
      !this._operatorAllowed
      || this._licensingLoading
    ) {
      return;
    }

    this._licensingLoading = true;
    this._licensingError = "";

    if (rerender) {
      this.render();
    }

    try {

      this._licensing =
        await this.ws(
          "cloudpelizzon/operator/licensing"
        );

    }

    catch (error) {

      this._licensingError =
        error?.message
        || String(error);

    }

    finally {

      this._licensingLoading = false;

      this.render();
    }
  }


  esc(value) {

    return String(
      value ?? "—"
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      );
  }


  fmt(value) {

    if (!value) {
      return "—";
    }

    try {

      return new Intl.DateTimeFormat(
        "pt-BR",
        {
          dateStyle: "short",
          timeStyle: "medium",
        }
      ).format(
        new Date(value)
      );

    }

    catch (error) {

      return this.esc(value);
    }
  }


  render() {

    const licensingButton =
      this._operatorAllowed
        ? `
          <button
            data-view="licensing"
            class="operator-button">

            <ha-icon
              icon="mdi:key-variant">
            </ha-icon>

            Licenciamento

          </button>
        `
        : "";


    const licensingView =
      this._operatorAllowed
        ? `
          <section
            id="view-licensing"
            class="view">

            ${this.renderLicensing()}

          </section>
        `
        : "";


    this.shadowRoot.innerHTML = `
      <style>

        :host {
          display:block;
          min-height:100vh;
          background:
            var(
              --primary-background-color
            );
        }


        .topbar {
          position:sticky;
          top:0;
          z-index:100;
          display:flex;
          align-items:center;
          gap:8px;
          padding:10px 16px;
          background:
            var(
              --card-background-color
            );
          border-bottom:
            1px solid
            rgba(127,127,127,.18);
        }


        .brand {
          display:flex;
          align-items:center;
          gap:10px;
          margin-right:18px;
          font-weight:700;
        }


        .brand ha-icon {
          color:#00a9ff;
        }


        .operator-badge {
          display:inline-flex;
          align-items:center;
          gap:5px;
          padding:4px 8px;
          border-radius:999px;
          font-size:10px;
          letter-spacing:.08em;
          font-weight:800;
          background:
            rgba(0,169,255,.12);
          color:#40c4ff;
          border:
            1px solid
            rgba(0,169,255,.30);
        }


        .topbar button {
          border:0;
          background:transparent;
          color:
            var(
              --primary-text-color
            );
          padding:9px 13px;
          border-radius:10px;
          cursor:pointer;
          font-weight:600;
          display:flex;
          align-items:center;
          gap:6px;
        }


        .topbar button:hover {
          background:
            rgba(127,127,127,.12);
        }


        .topbar button.active {
          background:
            rgba(0,169,255,.14);
          color:#00a9ff;
        }


        .topbar .module-request161{margin-left:auto;background:linear-gradient(120deg,#f6a700,#ffe191);color:#071622;border:1px solid #ffd874;box-shadow:0 0 12px #f6a70033;font-size:18px;font-weight:800;white-space:normal;min-width:0}
        .topbar .module-request161[hidden]{display:none!important}
        @media(max-width:600px){.topbar .module-request161{font-size:14px;margin-left:0}}
        .operator-button {
          border:
            1px solid
            rgba(0,169,255,.18)
            !important;
        }


        .view {
          display:none;
        }


        .view.active {
          display:block;
        }


        .license-page {
          max-width:1200px;
          margin:0 auto;
          padding:28px;
        }


        .license-hero {
          position:relative;
          overflow:hidden;
          border:
            1px solid
            rgba(0,169,255,.30);
          border-radius:22px;
          padding:28px;
          background:
            linear-gradient(
              135deg,
              rgba(0,169,255,.12),
              rgba(0,30,55,.05)
            );
        }


        .license-hero:after {
          content:"";
          position:absolute;
          width:300px;
          height:300px;
          border-radius:50%;
          right:-120px;
          top:-150px;
          border:
            1px solid
            rgba(0,169,255,.14);
          box-shadow:
            0 0 90px
            rgba(0,169,255,.08);
        }


        .eyebrow {
          color:#23b9ff;
          font-size:11px;
          font-weight:800;
          letter-spacing:.15em;
        }


        .license-hero h1 {
          margin:
            7px 0 5px;
          font-size:30px;
        }


        .license-hero p {
          margin:0;
          opacity:.72;
        }


        .operator-warning {
          margin-top:18px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:10px;
          background:
            rgba(0,169,255,.10);
          color:#57caff;
          font-size:12px;
          font-weight:700;
        }


        .license-actions {
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:22px;
        }


        .license-actions button {
          border:
            1px solid
            rgba(0,169,255,.28);
          background:
            rgba(0,169,255,.12);
          color:#49c7ff;
          border-radius:10px;
          padding:10px 14px;
          cursor:pointer;
          font-weight:700;
        }


        .grid {
          display:grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0,1fr)
            );
          gap:12px;
          margin-top:18px;
        }


        .card {
          padding:17px;
          border-radius:15px;
          border:
            1px solid
            rgba(127,127,127,.18);
          background:
            var(
              --card-background-color
            );
        }


        .card span {
          display:block;
          opacity:.58;
          text-transform:uppercase;
          font-size:9px;
          font-weight:800;
          letter-spacing:.08em;
          margin-bottom:7px;
        }


        .card b,
        .card code {
          font-size:14px;
          overflow-wrap:anywhere;
        }


        .wide {
          grid-column:
            span 2;
        }


        .section {
          margin-top:18px;
          border:
            1px solid
            rgba(127,127,127,.18);
          border-radius:16px;
          overflow:hidden;
          background:
            var(
              --card-background-color
            );
        }


        .section-head {
          padding:15px 18px;
          border-bottom:
            1px solid
            rgba(127,127,127,.14);
          display:flex;
          align-items:center;
          justify-content:
            space-between;
        }


        .section-head h2 {
          font-size:16px;
          margin:0;
        }


        .module-row {
          display:grid;
          grid-template-columns:
            1.1fr
            1.4fr
            .7fr
            .8fr;
          gap:12px;
          align-items:center;
          padding:13px 18px;
          border-bottom:
            1px solid
            rgba(127,127,127,.10);
        }


        .module-row:last-child {
          border-bottom:0;
        }


        .module-row small {
          opacity:.58;
        }


        .status-ok {
          color:#42d392;
        }


        .status-warn {
          color:#ffbd48;
        }


        .loading,
        .license-error {
          padding:40px;
          text-align:center;
        }


        .license-error {
          color:
            var(--error-color);
        }


        @media (
          max-width:900px
        ) {

          .topbar {
            overflow-x:auto;
          }

          .grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0,1fr)
              );
          }

          .module-row {
            grid-template-columns:
              1fr;
          }
        }


        @media (
          max-width:540px
        ) {

          .license-page {
            padding:14px;
          }

          .grid {
            grid-template-columns:
              1fr;
          }

          .wide {
            grid-column:
              span 1;
          }
        }

      </style>


      <div style="zoom:${window.innerWidth<=1100?1:0.67}" class="topbar ${this._view==='energy'?'solar-compact145':''}">

        <div class="brand">

          <ha-icon
            icon="mdi:cloud-outline">
          </ha-icon>

          <span>
            CloudPelizzon
          </span>

          ${
            this._operatorAllowed
              ? `
                <span
                  class="operator-badge">
                  OPERADOR
                </span>
              `
              : ""
          }

        </div>


        <button
          data-view="core">

          <ha-icon
            icon="mdi:view-dashboard-outline">
          </ha-icon>

          Visão Geral

        </button>


        ${this.isModuleAllowed("CP-MAINTENANCE") ? `
        <button
          data-view="maintenance">

          <ha-icon
            icon="mdi:tools">
          </ha-icon>

          Manutenção

        </button>
        ` : ""}


        ${this.isModuleAllowed("CP-SOLAR") ? `
        <button
          data-view="energy">

          <ha-icon
            icon="mdi:lightning-bolt-outline">
          </ha-icon>

          Solar

        </button>
        ` : ""}


        ${this.isModuleAllowed("CP-SECURITY") ? `
        <button
          data-view="security">

          <ha-icon
            icon="mdi:shield-home-outline">
          </ha-icon>

          Segurança

        </button>
        ` : ""}


        ${this.isModuleAllowed("CP-AUTOMATION") ? `
        <button data-view="automation"><ha-icon icon="mdi:robot-outline"></ha-icon>
          Automações
        </button>` : ""}

        ${this.isModuleAllowed("CP-LIGHTING") ? `
        <button data-view="lighting"><ha-icon icon="mdi:lightbulb-group-outline"></ha-icon>Iluminação</button>
        ` : ""}

        <button
          data-license-nav>

          <ha-icon
            icon="mdi:key-variant">
          </ha-icon>

          Licença

        </button>


        <button
          data-view="updates">

          <ha-icon
            icon="mdi:update">
          </ha-icon>

          Atualizações

        </button>


        <button class="module-request161" data-module-request161 hidden><ha-icon icon="mdi:cart-plus"></ha-icon>Solicitar este módulo</button>
        ${licensingButton}

      </div>


      <section
        id="view-core"
        class="view">

        <cloudpelizzon-core-panel>
        </cloudpelizzon-core-panel>

      </section>


      <section
        id="view-maintenance"
        class="view">

        <cloudpelizzon-module-slot sku="CP-MAINTENANCE">
        </cloudpelizzon-module-slot>

      </section>


      <section
        id="view-energy"
        class="view">

        <cloudpelizzon-module-slot sku="CP-SOLAR">
        </cloudpelizzon-module-slot>

      </section>


      ${this.isModuleAllowed("CP-SECURITY") ? `
      <section
        id="view-security"
        class="view">

        <cloudpelizzon-module-slot sku="CP-SECURITY">
        </cloudpelizzon-module-slot>

      </section>
      ` : ""}


      ${this.isModuleAllowed("CP-AUTOMATION") ? `
      <section id="view-automation" class="view">
        <cloudpelizzon-module-slot sku="CP-AUTOMATION"></cloudpelizzon-module-slot>
      </section>` : ""}

      ${this.isModuleAllowed("CP-LIGHTING") ? `
      <section id="view-lighting" class="view">
        <cloudpelizzon-module-slot sku="CP-LIGHTING"></cloudpelizzon-module-slot>
      </section>
      ` : ""}

      <section
        id="view-updates"
        class="view">

        <cloudpelizzon-updater-panel>
        </cloudpelizzon-updater-panel>

      </section>


      ${licensingView}
    `;


    this.shadowRoot
      .querySelectorAll(
        "[data-view]"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => this.showProtectedView(
            button.dataset.view
          )
        );
      });


    this.shadowRoot.querySelector("[data-module-request161]")?.addEventListener("click",()=>this.openModuleRequest161());
    const licenseNav =
      this.shadowRoot.querySelector(
        "[data-license-nav]"
      );

    if (licenseNav) {
      licenseNav.addEventListener(
        "click",
        () => {
          this.show("core");

          const corePanel =
            this.shadowRoot.querySelector(
              "cloudpelizzon-core-panel"
            );

          if (corePanel && typeof corePanel.showLicense === "function") {
            corePanel.showLicense();
            return;
          }

          const licenseButton =
            corePanel?.shadowRoot?.querySelector(
              "[data-license]"
            );

          if (licenseButton) {
            licenseButton.click();
          }
        }
      );
    }

    this.bindLicensing();

    this.show(
      this._view
    );

    this.propagateHass();

    const securityPanel =
      this.shadowRoot.querySelector(
        "cloudpelizzon-module-slot[sku=\"CP-SECURITY\"]"
      );

    if (
      securityPanel
      && this._hass
    ) {
      securityPanel.hass =
        this._hass;
    }
  }


  renderLicensing() {

    if (
      this._licensingLoading
      && !this._licensing
    ) {

      return `
        <div class="loading">
          Carregando dados de licenciamento...
        </div>
      `;
    }


    if (
      this._licensingError
      && !this._licensing
    ) {

      return `
        <div class="license-error">
          ${this.esc(
            this._licensingError
          )}
        </div>
      `;
    }


    const data =
      this._licensing
      || {};

    const license =
      data.license
      || {};

    const updater =
      data.updater
      || {};

    const modules =
      data.modules
      || [];


    const moduleRows =
      modules.length
        ? modules.map(module => {

            const state =
              module?.license?.status
              || "—";

            const allowed =
              !!module?.license?.allowed;

            return `
              <div class="module-row">

                <div>
                  <b>
                    ${this.esc(
                      module.name
                    )}
                  </b>
                  <br>
                  <small>
                    ${this.esc(
                      module.sku
                    )}
                  </small>
                </div>

                <div>
                  <small>
                    ${
                      module.installed
                        ? "Instalado"
                        : "Não instalado"
                    }
                  </small>
                </div>

                <div
                  class="${
                    allowed
                      ? "status-ok"
                      : "status-warn"
                  }">

                  ${
                    allowed
                      ? "Liberado"
                      : "Bloqueado"
                  }

                </div>

                <div>
                  ${this.esc(state)}
                </div>

              </div>
            `;
          }).join("")
        : `
          <div class="module-row">
            Nenhum módulo encontrado.
          </div>
        `;


    return `
      <main class="license-page">

        <section class="license-hero">

          <span class="eyebrow">
            CLOUDPELIZZON • OPERATOR CONSOLE
          </span>

          <h1>
            Licenciamento
          </h1>

          <p>
            Administração e diagnóstico da licença,
            módulos e canal de distribuição desta instalação.
          </p>

          <div class="operator-warning">

            <ha-icon
              icon="mdi:shield-lock-outline">
            </ha-icon>

            Acesso restrito ao operador CloudPelizzon

          </div>


          <div class="license-actions">

            <button
              id="license-refresh">

              Atualizar dados

            </button>

            <button
              id="license-checkin">

              Validar licença agora

            </button>

            <button
              id="license-updates">

              Abrir Atualizações

            </button>

          </div>

        </section>


        <section class="grid">

          <article class="card">
            <span>Status online</span>
            <b>
              ${this.esc(
                license.online_status
              )}
            </b>
          </article>


          <article class="card">
            <span>Cliente</span>
            <b>
              ${this.esc(
                license.customer
              )}
            </b>
          </article>


          <article class="card">
            <span>Validade CP1</span>
            <b>
              ${this.fmt(
                license.expires_at
              )}
            </b>
          </article>


          <article class="card">
            <span>Lease CP2</span>
            <b>
              ${this.fmt(
                license.lease_valid_until
              )}
            </b>
          </article>


          <article class="card wide">
            <span>Activation ID</span>
            <code>
              ${this.esc(
                license.activation_id
              )}
            </code>
          </article>


          <article class="card wide">
            <span>License ID</span>
            <code>
              ${this.esc(
                license.license_id
              )}
            </code>
          </article>


          <article class="card">
            <span>CloudPelizzon</span>
            <b>
              ${this.esc(
                data.platform_version
              )}
            </b>
          </article>


          <article class="card">
            <span>Core</span>
            <b>
              ${this.esc(
                data.core_version
              )}
            </b>
          </article>


          <article class="card">
            <span>Update Center</span>
            <b>
              ${this.esc(
                updater.version
              )}
            </b>
          </article>


          <article class="card">
            <span>Canal</span>
            <b>
              ${this.esc(
                updater.channel
              )}
            </b>
          </article>


          <article class="card wide">
            <span>Último check-in</span>
            <b>
              ${this.fmt(
                license.last_checkin_at
              )}
            </b>
          </article>


          <article class="card wide">
            <span>Servidor de licenciamento</span>
            <code>
              ${this.esc(
                license.server_url
              )}
            </code>
          </article>

        </section>


        <section class="section">

          <div class="section-head">

            <h2>
              Módulos e permissões
            </h2>

            <small>
              ${modules.length}
              módulos catalogados
            </small>

          </div>

          ${moduleRows}

        </section>


        <section class="section">

          <div class="section-head">

            <h2>
              Release Center
            </h2>

          </div>

          <div class="grid"
               style="margin:0;padding:16px">

            <article class="card">
              <span>Canal</span>
              <b>
                ${this.esc(
                  updater.channel
                )}
              </b>
            </article>

            <article class="card">
              <span>Última consulta</span>
              <b>
                ${this.fmt(
                  updater.last_check_at
                )}
              </b>
            </article>

            <article class="card">
              <span>Backups</span>
              <b>
                ${
                  (
                    updater.backups
                    || []
                  ).length
                }
              </b>
            </article>

            <article class="card">
              <span>Componentes</span>
              <b>
                ${
                  (
                    updater.components
                    || []
                  ).length
                }
              </b>
            </article>

          </div>

        </section>

      </main>
    `;
  }


  bindLicensing() {

    const refresh =
      this.shadowRoot.querySelector(
        "#license-refresh"
      );

    if (refresh) {

      refresh.onclick =
        () => this.loadLicensing();
    }


    const checkin =
      this.shadowRoot.querySelector(
        "#license-checkin"
      );

    if (checkin) {

      checkin.onclick =
        async () => {

          checkin.disabled = true;

          try {

            await this.ws(
              "cloudpelizzon/core/license/checkin"
            );

            await this.loadLicensing();

          }

          catch (error) {

            alert(
              error?.message
              || String(error)
            );
          }

          finally {

            checkin.disabled = false;
          }
        };
    }


    const updates =
      this.shadowRoot.querySelector(
        "#license-updates"
      );

    if (updates) {

      updates.onclick =
        () => this.show(
          "updates"
        );
    }
  }


  disconnectedCallback(){this._requestHost161?.remove();this._requestHost161=null;}

  requestSku161(){return ({maintenance:"CP-MAINTENANCE",energy:"CP-SOLAR",security:"CP-SECURITY",automation:"CP-AUTOMATION",lighting:"CP-LIGHTING"})[this._view]||null;}

  updatePaidModules162(modules){
    this._paidModules162=Object.fromEntries(modules.map(m=>[m.sku,m?.license?.allowed===true]));
    this.updateRequestCTA161();
  }

  updateRequestCTA161(){const button=this.shadowRoot?.querySelector("[data-module-request161]");if(button){button.hidden=!this.requestSku161()||this._paidModules162?.[this.requestSku161()]===true;button.dataset.sku=this.requestSku161()||"";}}

  openModuleRequest161(){
    const sku=this.requestSku161();if(!sku||!this._hass||this._paidModules162?.[sku]===true)return;
    this._requestHost161?.remove();
    const source=this.shadowRoot.querySelector("cloudpelizzon-core-panel");
    const names={"CP-MAINTENANCE":"Manutenção Residencial Preventiva","CP-SOLAR":"Inteligência Solar","CP-SECURITY":"Central de Segurança Pro","CP-AUTOMATION":"Central Inteligente de Automações"};
    const dialog=document.createElement("cloudpelizzon-core-panel");
    dialog.requestOnly161=true;
    dialog.data=source?.data||{modules:[{sku,name:names[sku]}],license:{}};
    dialog.hass=this._hass;
    Object.assign(dialog.style,{position:"fixed",inset:"0",zIndex:"20000",display:"block"});
    dialog.addEventListener("cloudpelizzon-request-close161",()=>{dialog.remove();if(this._requestHost161===dialog)this._requestHost161=null;},{once:true});
    this._requestHost161=dialog;document.body.append(dialog);dialog.showRequest(sku);
  }

  show(view) {

    if (
      view === "licensing"
      && !this._operatorAllowed
    ) {
      view = "core";
    }

    this._view = view;
    this.updateRequestCTA161();
    const bar147=this.shadowRoot.querySelector('.topbar');if(bar147)bar147.style.zoom=window.innerWidth<=1100?'1':'0.67';
    this.shadowRoot.querySelector(".topbar")?.classList.toggle("solar-compact145",view==="energy");


    this.shadowRoot
      .querySelectorAll(
        ".view"
      )
      .forEach(
        element =>
          element.classList.remove(
            "active"
          )
      );


    this.shadowRoot
      .querySelectorAll(
        "[data-view]"
      )
      .forEach(
        element =>
          element.classList.remove(
            "active"
          )
      );


    const target =
      this.shadowRoot.querySelector(
        "#view-" + view
      );

    if (target) {
      target.classList.add(
        "active"
      );
    }

    // Retrying a private panel must not depend on a full browser restart.
    const slot = target?.querySelector("cloudpelizzon-module-slot");
    if (slot) slot.activate();

    // The installed-component list must NEVER stay cached after license
    // revocation. Revalidate on every visit to Update Center.
    if (view === "updates") {
      const updater = target?.querySelector("cloudpelizzon-updater-panel");
      if (updater && typeof updater.activate === "function") {
        updater.activate();
      }
    }


    const button =
      this.shadowRoot.querySelector(
        '[data-view="' +
        view +
        '"]'
      );

    if (button) {
      button.classList.add(
        "active"
      );
    }


    if (
      view === "licensing"
      && !this._licensing
    ) {
      this.loadLicensing();
    }


    this.propagateHass();
  }


  installShellLayoutFix(){
    if(this.shadowRoot.querySelector("#cp-shell-r5-style"))return;
    const style=document.createElement("style");
    style.id="cp-shell-r5-style";
    style.textContent=`
      :host{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;overflow-x:hidden!important}
      .topbar{width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important;display:flex!important;flex-wrap:wrap!important;padding-left:clamp(8px,1vw,18px)!important;padding-right:clamp(8px,1vw,18px)!important}
      .topbar.solar-compact145{zoom:0.67!important;width:100%!important;padding-top:5px!important;padding-bottom:5px!important;gap:6px!important;min-height:44px!important;font-size:14px!important}
      .topbar.solar-compact145 .brand{font-size:14px!important;gap:7px!important;margin-right:12px!important}
      .topbar.solar-compact145 button{font-size:14px!important;padding:7px 10px!important;line-height:20px!important}
      .topbar.solar-compact145 ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
      #view-core{zoom:0.75!important}
      @media(max-width:1100px){#view-core{zoom:1!important}.topbar,.topbar.solar-compact145{zoom:1!important;position:static!important;gap:4px!important}.topbar button{min-height:44px!important;flex:0 0 auto!important}.brand{margin-right:4px!important}}
      .view{width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important;overflow-x:hidden!important}
      cloudpelizzon-core-panel,cloudpelizzon-module-slot,cloudpelizzon-updater-panel{display:block!important;width:100%!important;max-width:none!important;min-width:0!important}
      @media(max-width:800px){.topbar{gap:4px!important}.topbar button{padding-left:8px!important;padding-right:8px!important}}
    `;
    this.shadowRoot.appendChild(style);
  }


  propagateHass() {

    this.installShellLayoutFix();

    if (
      !this.shadowRoot
      || !this._hass
    ) {
      return;
    }


    [
      "cloudpelizzon-core-panel",
      "cloudpelizzon-module-slot",
      "cloudpelizzon-updater-panel",
    ].forEach(selector => {
      // querySelector() updates only the FIRST module slot. With
      // Maintenance before Energy, Energy never receives Home Assistant
      // and remains stuck on "Inicializando módulo...".
      this.shadowRoot.querySelectorAll(selector).forEach(element => {
        const actor=this._hass?.user?.id;
        const active=element.closest('.view')?.classList.contains('active');
        if(active||element.__actor471!==actor){element.hass=this._hass;element.__actor471=actor;}
        else if(element.localName==='cloudpelizzon-module-slot')element._hass=this._hass;
      });
    });
  }
}


if (
  !customElements.get(
    "cloudpelizzon-panel"
  )
) {

  customElements.define(
    "cloudpelizzon-panel",
    CloudPelizzonPanel,
  );
}

/* CP_ROOT_SINGLE_FLIGHT229 */
(()=>{const C=customElements.get('cloudpelizzon-panel');if(!C)return;const p=C.prototype,original=p.loadModuleRights;p.loadModuleRights=function(...args){if(this._rightsFlight229)return this._rightsFlight229;const task=Promise.resolve(original.apply(this,args));this._rightsFlight229=task;return task.finally(()=>{if(this._rightsFlight229===task)this._rightsFlight229=null;});};})();

/* CP_SHELL474: bounded state propagation and immediate navigation feedback. */
(()=>{'use strict';const p=customElements.get('cloudpelizzon-panel').prototype;
 const desc=Object.getOwnPropertyDescriptor(p,'hass');
 Object.defineProperty(p,'hass',{...desc,set(value){
  if(!this._hass||this._hass.user?.id!==value?.user?.id){clearTimeout(this._hassTimer474);this._hassTimer474=0;this._nextHass474=null;desc.set.call(this,value);return;}
  this._hass=value;this._nextHass474=value;
  if(!this._hassTimer474)this._hassTimer474=setTimeout(()=>{this._hassTimer474=0;const latest=this._nextHass474;this._nextHass474=null;if(this.isConnected&&latest)desc.set.call(this,latest);},180);
 }});
 const render=p.render;p.render=function(...args){this._rendering474=true;try{return render.apply(this,args);}finally{this._rendering474=false;}};
 const show=p.show;p.show=function(...args){if(!this._rendering474)this._nav471=(this._nav471||0)+1;this.shadowRoot?.querySelector('#cp-nav474')?.remove();return show.apply(this,args);};
 p.showProtectedView=async function(view){
  const skus={maintenance:'CP-MAINTENANCE',energy:'CP-SOLAR',security:'CP-SECURITY',automation:'CP-AUTOMATION',lighting:'CP-LIGHTING'},sku=skus[view];
  if(!sku){this.show(view);return;}
  const seq=this._nav471=(this._nav471||0)+1,actor=this._hass?.user?.id;
  const title={maintenance:'Manutenção',energy:'Solar',security:'Segurança',automation:'Automações',lighting:'Iluminação'}[view];
  this.shadowRoot.querySelector('#cp-nav474')?.remove();
  this.shadowRoot.querySelectorAll('.view.active').forEach(node=>node.classList.remove('active'));
  const pending=document.createElement('section');pending.id='cp-nav474';pending.setAttribute('role','status');pending.style.cssText='margin:14px;padding:24px;border:1px solid #296582;border-radius:14px;background:linear-gradient(120deg,#0e3042,#061b28);color:#e5f8ff;font:14px system-ui';
  pending.textContent=`Abrindo ${title}… Verificando acesso à instalação.`;this.shadowRoot.append(pending);
  // Yield for the browser to paint navigation feedback before any expensive panel work.
  await new Promise(resolve=>requestAnimationFrame(resolve));
  try{
   const refreshed=await this.loadModuleRights(true);
   if(seq!==this._nav471||actor!==this._hass?.user?.id||!this.isConnected)return;
   this.show(refreshed&&this.isModuleAllowed(sku)?view:'core');
  }catch(_){if(seq===this._nav471&&actor===this._hass?.user?.id)this.show('core');}
 };
})();

/* CP_LICENSE_NAV475: expose the real shell menu; keep its native authorization path. */
(()=>{const p=customElements.get('cloudpelizzon-panel').prototype;
function close(host){host.shadowRoot?.querySelector('cloudpelizzon-core-panel')?.hideLicense?.();}
const show=p.show;p.show=function(...args){if(!this._rendering474)close(this);return show.apply(this,args);};
const protectedView=p.showProtectedView;p.showProtectedView=function(...args){close(this);return protectedView.apply(this,args);};
})();
