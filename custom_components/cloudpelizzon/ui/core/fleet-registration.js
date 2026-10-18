/* CloudPelizzon Fleet — License Center registration component.
 * The browser gate is UX only. The administrator-only WS API and Fleet server
 * independently reject requests without explicit consent and a valid code.
 * Codes are never stored in browser storage or included in URLs.
 */
const FLEET_CODE_RE = /^CP-[A-Z0-9]{6}(?:-[A-Z0-9]{6}){3}$/;

class CloudPelizzonFleetRegistration extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._busy = false;
    this._ready = false;
    this._registered = false;
    this._refreshing = false;
    this._error = "";
  }

  set hass(value) {
    if (value === this._hass) return;
    this._hass = value;
    if (this.isConnected && !this._ready && !this._refreshing) this.refresh();
  }

  get hass() { return this._hass; }

  connectedCallback() {
    this.draw();
    if (this._hass) this.refresh();
  }

  draw() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; margin:19px 0 2px; color:#eaf7ff; }
        * { box-sizing:border-box; }
        .wrap { border:1px solid rgba(0,185,255,.38); border-radius:16px;
          padding:18px; background:linear-gradient(125deg,#072134,#03111d); }
        .eyebrow { display:block; color:#42cfff; font-size:10px; font-weight:850;
          letter-spacing:.12em; text-transform:uppercase; }
        h3 { margin:7px 0 8px; font-size:19px; }
        p { margin:0 0 13px; font-size:12px; color:#b5d0df; line-height:1.6; }
        label { display:block; margin:12px 0 6px; font-size:12px; font-weight:700; }
        input[type=text] { display:block; width:100%; min-width:0; padding:12px;
          border-radius:10px; border:1px solid #2a6179; outline:0;
          font:600 13px ui-monospace,monospace; letter-spacing:.06em;
          background:#04111c; color:#eefaff; }
        input[type=text]:focus { border-color:#29c3ff; box-shadow:0 0 0 2px rgba(41,195,255,.15); }
        .check { display:flex; align-items:flex-start; gap:9px; margin:14px 0;
          font-size:13px; line-height:1.45; cursor:pointer; }
        .check input { width:17px; height:17px; accent-color:#00b6ff; flex-shrink:0; }
        button { border:0; border-radius:10px; background:#009ce0; color:white;
          padding:12px 17px; font-weight:800; cursor:pointer; }
        button:disabled { opacity:.35; background:#476572; cursor:not-allowed; }
        .status { min-height:18px; margin:10px 0 0; font-size:12px;
          color:#9ee9ff; overflow-wrap:anywhere; }
        .status.error { color:#ff9fa8; }
        .registered { color:#5ff2bb; font-weight:700; }
        .privacy { margin-top:11px; font-size:11px; }
        [hidden] { display:none !important; }
      </style>
      <div class="wrap">
        <span class="eyebrow">Fleet Intelligence • Registro de instalação</span>
        <h3 id="fleet-heading">Registro da instalação</h3>
        <p id="fleet-intro">Este código de registro é utilizado apenas para vincular instalações anteriores.
          Se você já concluiu a configuração do CloudPelizzon, não precisa informar outro código.</p>
        <div id="form" hidden>
          <label for="fleet-code">Código de registro do Portal</label>
          <input id="fleet-code" type="text" maxlength="30"
            autocomplete="off" autocapitalize="characters" spellcheck="false"
            placeholder="CP-XXXXXX-XXXXXX-XXXXXX-XXXXXX" />
          <label class="check" for="fleet-consent">
            <input id="fleet-consent" type="checkbox" />
            <span>Aceito o registro e o reporte técnico</span>
          </label>
          <button type="button" id="fleet-send" disabled>Registrar instalação</button>
          <p class="privacy">O aceite permite o registro do identificador da instalação,
            versões do Home Assistant e CloudPelizzon e informações técnicas de operação.
            Nenhuma licença comercial é emitida ou substituída aqui.</p>
        </div>
        <div class="registered" id="fleet-success" hidden>
          ✓ Registro concluído. Sua instalação está conectada ao CloudPelizzon.
        </div>
        <p class="status" id="fleet-status" role="status" aria-live="polite">
          Consultando o status do registro...
        </p>
      </div>
    `;
    const input = this.shadowRoot.getElementById("fleet-code");
    const consent = this.shadowRoot.getElementById("fleet-consent");
    input.addEventListener("input", () => {
      input.value = input.value.toUpperCase().replace(/\s/g, "");
      this.updateButton();
    });
    consent.addEventListener("change", () => this.updateButton());
    this.shadowRoot.getElementById("fleet-send")
      .addEventListener("click", () => this.submit());
    this.updateButton();
  }

  updateButton() {
    const root = this.shadowRoot;
    const code = root.getElementById("fleet-code")?.value || "";
    const checked = root.getElementById("fleet-consent")?.checked === true;
    const button = root.getElementById("fleet-send");
    if (button) {
      button.disabled = !(this._ready && !this._registered && !this._busy
        && FLEET_CODE_RE.test(code) && checked);
    }

  }

  setStatus(message, isError=false) {
    const el = this.shadowRoot.getElementById("fleet-status");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("error", Boolean(isError));
  }

  showRegistrationState() {
    const root = this.shadowRoot;
    root.getElementById("form").hidden = this._registered;
    root.getElementById("fleet-success").hidden = !this._registered;
    root.getElementById("fleet-intro").hidden = this._registered;
    root.getElementById("fleet-heading").textContent = this._registered
      ? "Instalação conectada"
      : "Registro da instalação";
  }

  async refresh() {
    if (!this._hass || !this.shadowRoot.getElementById("fleet-status")) return;
    if (this._refreshing) return;
    this._refreshing = true;
    this._ready = false;
    this.updateButton();
    try {
      const state = await this._hass.callWS({
        type: "cloudpelizzon/core/fleet/status",
      });
      if (!this.isConnected) return;
      this._registered = state.registered === true;
      this._ready = true;
      this.showRegistrationState();
      this.setStatus(this._registered
        ? "Vínculo confirmado pelo CloudPelizzon."
        : "Aguardando código e aceite.");
    } catch (_err) {
      this.setStatus("Não foi possível consultar o Fleet. Reabra a área Licença.", true);
    }
    this._refreshing = false;
    this.updateButton();
  }

  async submit() {
    this.updateButton();
    const button = this.shadowRoot.getElementById("fleet-send");
    if (!button || button.disabled || !this._hass) return;
    const code = this.shadowRoot.getElementById("fleet-code").value.trim();
    const consent = this.shadowRoot.getElementById("fleet-consent").checked === true;
    if (!FLEET_CODE_RE.test(code) || !consent) return;

    this._busy = true;
    this.updateButton();
    this.setStatus("Validando registro no Fleet...");
    try {
      const result = await this._hass.callWS({
        type: "cloudpelizzon/core/fleet/register",
        code, consent,
      });
      if (result.registered !== true) throw new Error("Resposta inválida do Fleet.");
      this._registered = true;
      this.shadowRoot.getElementById("fleet-code").value = "";
      this.shadowRoot.getElementById("fleet-consent").checked = false;
      this.showRegistrationState();
      this.setStatus("Registro confirmado. Sua licença comercial foi preservada.");
    } catch (err) {
      const codeError = String(err?.code || "");
      const messages = {
        consent_required: "Marque o aceite para continuar.",
        invalid_code: "O código informado é inválido.",
        rejected: "Código inválido, expirado ou já utilizado.",
        unavailable: "O Fleet está indisponível. Tente novamente mais tarde.",
        busy: "Já existe um registro em andamento.",
      };
      this.setStatus(messages[codeError] || "Não foi possível registrar. Confira o código.", true);
    } finally {
      this._busy = false;
      this.updateButton();
    }
  }
}

if (!customElements.get("cloudpelizzon-fleet-registration")) {
  customElements.define("cloudpelizzon-fleet-registration", CloudPelizzonFleetRegistration);
}
