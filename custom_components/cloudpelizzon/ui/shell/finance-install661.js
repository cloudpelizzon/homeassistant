import "/cloudpelizzon/frontend/finance-panel.js";

class CloudPelizzonFinanceInstall661 extends HTMLElement {
  set hass(value) {
    this._hass = value;
    if (!this.isConnected) return;
    if (!this.firstChild) this.render();
    this.finance.hass = value;
  }

  connectedCallback() {
    if (this._hass && !this.firstChild) this.render();
  }

  render() {
    const toolbar = document.createElement("section");
    toolbar.style.cssText = "padding:12px 16px;background:var(--card-background-color);color:var(--primary-text-color)";
    this.status = document.createElement("div");
    this.status.setAttribute("role", "status");
    this.status.textContent = "Instalação e Trial do Finanças aguardam a revisão do pacote privado assinado.";
    const releaseReady = false;
    if (releaseReady && this._hass.user?.is_admin) {
      for (const [mode, text] of [["paid", "Instalar com minha licença"], ["trial", "Iniciar Trial de 7 dias"]]) {
        const button = document.createElement("button");
        button.textContent = text;
        button.style.cssText = "margin:4px 8px 4px 0;padding:8px 12px";
        button.addEventListener("click", async () => {
          if (!window.confirm(text + "?")) return;
          for (const item of toolbar.querySelectorAll("button")) item.disabled = true;
          this.status.textContent = "Verificando autorização e instalando…";
          try {
            const result = await this._hass.callWS({type:"cloudpelizzon/finance/install", mode, confirmed:true});
            const expiry = result.trial && result.expires_at
              ? " Trial até " + new Date(result.expires_at * 1000).toLocaleString("pt-BR") + "." : "";
            this.status.textContent = "Pacote instalado. Reinicie o Home Assistant para abrir o Finanças." + expiry;
          } catch (error) {
            this.status.textContent = error.message || "Não foi possível instalar o pacote.";
          } finally {
            for (const item of toolbar.querySelectorAll("button")) item.disabled = false;
          }
        });
        toolbar.append(button);
      }
    }
    toolbar.append(this.status);
    this.finance = document.createElement("cloudpelizzon-finance-panel");
    this.append(toolbar, this.finance);
    this.finance.hass = this._hass;
  }
}

if (!customElements.get("cloudpelizzon-finance-install-panel")) {
  customElements.define("cloudpelizzon-finance-install-panel", CloudPelizzonFinanceInstall661);
}
