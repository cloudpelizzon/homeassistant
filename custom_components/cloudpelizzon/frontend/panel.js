import "/cloudpelizzon/frontend/date-format-r51.js?v=20260928-r51";
import "/cloudpelizzon-core/frontend/panel.js?v=6211-global-commercial-install";
import "/cloudpelizzon/frontend/optional-modules.js?v=20261010-module-lifecycle-r2";
import "/cloudpelizzon-updater/frontend/panel.js?v=20261010-license-filter-r2";


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
    this._moduleRightsLoading = false;
    this._moduleRightsLoaded = false;
    this._lastCommercialRefresh = 0;
  }


  set hass(value) {

    this._hass = value;

    this.propagateHass();

    const securityPanel =
      this.shadowRoot?.querySelector(
        "cloudpelizzon-module-slot[sku=\"CP-SECURITY\"]"
      );

    if (securityPanel) {
      securityPanel.hass = value;
    }

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
    if (value && ["maintenance", "energy", "security"].includes(this._view)
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

        const rights = {};

        for (
          const item
          of (event?.detail?.modules || [])
        ) {
          rights[item.sku] =
            Boolean(
              item?.license?.allowed
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
            "CP-ENERGY"
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
          this.show(this.isModuleAllowed("CP-MAINTENANCE") ? "maintenance" : "core");
        }

        else if (path.includes("energy") || path.includes("energia")) {
          if (this.isModuleAllowed("CP-ENERGY")) {
            this.show("energy");
          } else {
            this.loadModuleRights(true).then(() => {
              this.show(this.isModuleAllowed("CP-ENERGY") ? "energy" : "core");
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
      if(force) await this.ws("cloudpelizzon/core/access/refresh");
      const data=await this.ws("cloudpelizzon/core/status");
      const rights={};

      for(const item of (data?.modules||[])){
        rights[item.sku]=Boolean(item?.license?.allowed);
      }

      const rightsChanged = !this._moduleRightsLoaded
        || JSON.stringify(this._moduleRights) !== JSON.stringify(rights);
      this._moduleRights=rights;
      this._moduleRightsLoaded=true;

      if(this._view==="energy"&&!this.isModuleAllowed("CP-ENERGY")){
        this._view="core";
      }

      if(this._view==="maintenance"&&!this.isModuleAllowed("CP-MAINTENANCE")){
        this._view="core";
      }

      if(this._view==="security"&&!this.isModuleAllowed("CP-SECURITY")){
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
        if(["maintenance","energy","security"].includes(this._view)){
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
      energy:"CP-ENERGY",
      security:"CP-SECURITY",
    };
    const sku=skus[view];
    if(!sku){this.show(view);return;}
    const refreshed=await this.loadModuleRights(true);
    this.show(refreshed && this.isModuleAllowed(sku) ? view : "core");
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


      <div class="topbar">

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


        ${this.isModuleAllowed("CP-ENERGY") ? `
        <button
          data-view="energy">

          <ha-icon
            icon="mdi:lightning-bolt-outline">
          </ha-icon>

          Energia

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

        <cloudpelizzon-module-slot sku="CP-ENERGY">
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


  show(view) {

    if (
      view === "licensing"
      && !this._operatorAllowed
    ) {
      view = "core";
    }

    this._view = view;


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
        element.hass = this._hass;
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
