const OPTIONAL_MODULES = [
  {
    tag: "cloudpelizzon-maintenance-panel",
    title: "Manutenção",
    url: "/cloudpelizzon-maintenance/frontend/panel.js?v=311-notify-ux-r581",
  },
  {
    tag: "cloudpelizzon-energy-panel",
    title: "Energia",
    url: "/cloudpelizzon-energy/frontend/panel.js?v=20260928-energy-r5",
  },
  {
    tag: "cloudpelizzon-security-panel",
    title: "Segurança",
    url: "/cloudpelizzon-security/frontend/panel.js?v=20261007-v0610-final-polish-r1",
  },
];


function definePlaceholder(tag, title) {

  if (customElements.get(tag)) {
    return;
  }

  customElements.define(
    tag,
    class extends HTMLElement {

      set hass(value) {
        this._hass = value;
      }

      connectedCallback() {

        if (this.shadowRoot) {
          return;
        }

        const root = this.attachShadow({
          mode: "open",
        });

        root.innerHTML = `
          <style>
            :host {
              display: block;
              width: 100%;
            }

            .cp-placeholder {
              margin: 18px 0;
              padding: 22px;
              border: 1px solid rgba(45, 190, 255, .28);
              border-radius: 18px;
              background:
                linear-gradient(
                  145deg,
                  rgba(4, 25, 39, .96),
                  rgba(2, 13, 22, .98)
                );
              color: #dff6ff;
              box-shadow:
                0 18px 50px rgba(0, 0, 0, .28);
              font-family:
                var(--paper-font-body1_-_font-family, sans-serif);
            }

            .cp-kicker {
              color: #65d7ff;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: .12em;
              text-transform: uppercase;
            }

            h2 {
              margin: 9px 0 8px;
              font-size: 22px;
            }

            p {
              margin: 0;
              color: #8eb2c2;
              line-height: 1.6;
            }
          </style>

          <div class="cp-placeholder">
            <div class="cp-kicker">
              CloudPelizzon • Módulo comercial
            </div>

            <h2>${title}</h2>

            <p>
              Este módulo não está instalado neste equipamento.
              A disponibilização ocorre pelo CloudPelizzon Update Center
              após validação da licença e da autorização de distribuição.
            </p>
          </div>
        `;
      }
    }
  );
}


for (const module of OPTIONAL_MODULES) {

  import(module.url)
    .catch(() => {
      definePlaceholder(
        module.tag,
        module.title,
      );
    });
}
