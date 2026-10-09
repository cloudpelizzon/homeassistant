// CloudPelizzon commercial modules are distributed privately by Release Center.
// Never define a commercial panel tag as a placeholder: customElements.define()
// is irreversible for the life of a browser tab, even after HA restarts.
const OPTIONAL_MODULES = {
  "CP-MAINTENANCE": {
    tag: "cloudpelizzon-maintenance-panel",
    title: "Manutenção",
    url: "/cloudpelizzon-maintenance/frontend/panel.js?v=311-notify-ux-r581",
  },
  "CP-ENERGY": {
    tag: "cloudpelizzon-energy-panel",
    title: "Energia",
    url: "/cloudpelizzon-energy/frontend/panel.js?v=20260928-energy-r5",
  },
  "CP-SECURITY": {
    tag: "cloudpelizzon-security-panel",
    title: "Segurança",
    url: "/cloudpelizzon-security/frontend/panel.js?v=20261007-v0610-final-polish-r1",
  },
};

class CloudPelizzonModuleSlot extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._child = null;
    this._loading = false;
    this._attempt = 0;
    this._lastAttempt = 0;
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.width = "100%";
    if (this.parentElement?.classList.contains("active")) {
      this.load();
    }
  }

  set hass(value) {
    this._hass = value;
    if (this._child) {
      this._child.hass = value;
    } else if (value && this.parentElement?.classList.contains("active")) {
      this.load();
    }
  }

  get hass() {
    return this._hass;
  }

  activate() {
    this.load(true);
  }

  _notice(title, message, retry = false) {
    this.replaceChildren();
    const box = document.createElement("div");
    box.style.cssText = [
      "margin:18px 0",
      "padding:22px",
      "border:1px solid rgba(45,190,255,.28)",
      "border-radius:18px",
      "background:#041927",
      "color:#dff6ff",
      "font-family:sans-serif",
    ].join(";");
    const header = document.createElement("h2");
    header.textContent = title;
    const body = document.createElement("p");
    body.textContent = message;
    box.append(header, body);
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Tentar carregar novamente";
      button.style.cssText = "margin-top:16px;padding:10px 16px;cursor:pointer";
      button.addEventListener("click", () => this.load(true));
      box.append(button);
    }
    this.append(box);
  }

  async load(force = false) {
    const module = OPTIONAL_MODULES[this.getAttribute("sku")];
    if (!module || this._loading || this._child) return;
    // HA updates hass frequently; do not flood requests for uninstalled modules.
    if (!force && this._lastAttempt && Date.now() - this._lastAttempt < 30000) {
      return;
    }
    this._loading = true;
    this._lastAttempt = Date.now();
    this._notice(module.title, "Carregando módulo CloudPelizzon...");

    try {
      if (!customElements.get(module.tag)) {
        // A failed dynamic import is cached by browsers. Retrying must use a
        // new URL, so installation can succeed without reopening the tab.
        const retry = this._attempt++ > 0
          ? "&cp_retry=" + Date.now()
          : "";
        await import(module.url + retry);
      }
      if (!customElements.get(module.tag)) {
        throw new Error("module_frontend_not_registered");
      }

      const panel = document.createElement(module.tag);
      this.replaceChildren(panel);
      this._child = panel;
      if (this._hass) panel.hass = this._hass;
    } catch (error) {
      console.warn("CloudPelizzon: painel comercial indisponível", module.tag, error);
      this._notice(
        module.title,
        "Não foi possível carregar a interface do módulo. " +
        "Caso a instalação tenha acabado de concluir, aguarde o reinício " +
        "do Home Assistant e tente novamente.",
        true,
      );
    } finally {
      this._loading = false;
    }
  }
}

if (!customElements.get("cloudpelizzon-module-slot")) {
  customElements.define("cloudpelizzon-module-slot", CloudPelizzonModuleSlot);
}
