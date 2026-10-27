class CloudPelizzonUpdaterPanel extends HTMLElement{
  set hass(v){this._hass=v;if(!this._loaded){this._loaded=true;this.load(true)}} set panel(v){this._panel=v}
  activate(){if(this._hass)this.load(true)}
  async ws(type,extra={}){return await this._hass.callWS({type,...extra})}
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  fmt(v){if(!v)return '—';try{return new Date(v).toLocaleString('pt-BR')}catch(e){return v}}
  async load(check=false){
    if(this._loading)return;
    this._loading=true;
    this.renderLoading();
    try{
      // A fresh signed entitlement decision is required before showing
      // installed commercial components, old backups or cached releases.
      await this.ws('cloudpelizzon/core/access/refresh');
      this.data=check?await this.ws('cloudpelizzon/updater/check'):await this.ws('cloudpelizzon/updater/status');
      this.render();
    }catch(e){
      this.data=null;
      this.renderError(e.message||String(e));
    }finally{
      this._loading=false;
    }
  }
  renderLoading(){this.innerHTML=`<style>${this.css()}</style><div class="center"><div class="spin"></div><b>Consultando Release Center...</b></div>`}
  isActivationError(error){
    const detail=String(error?.message||error||"");
    return /(?:online_activation_required|installation_id_missing)/.test(detail);
  }
  renderActivationRequired(error){
    const missingId=String(error||"").includes("installation_id_missing");
    const heading=missingId?"Identificação da instalação necessária":"Ativação necessária";
    const summary=missingId
      ?"Não foi possível identificar esta instalação. Confira o licenciamento no Control Center CloudPelizzon antes de consultar atualizações comerciais."
      :"Para consultar atualizações dos módulos comerciais, ative e valide sua licença CloudPelizzon.";
    this.innerHTML=`<style>${this.css()}
      .cp-activation{border:1px solid #165073;border-radius:18px;background:linear-gradient(140deg,#08263c,#041522);padding:22px 26px;margin-top:12px}
      .cp-activation h2{margin:0 0 9px;font-size:20px;color:#e7f8ff}
      .cp-activation p{color:#b9d7e8;line-height:1.6;margin:0 0 14px}
      .cp-activation a{color:#50ccff;font-weight:800;text-decoration:none}
      .cp-activation a:focus-visible,.cp-activation a:hover{text-decoration:underline}
      .cp-activation .cp-safe{color:#82d6ad;font-size:12px;margin-top:12px}
      @media(max-width:760px){.cp-activation{padding:17px}}
      </style><main>
      <section class="hero">
        <div><span>UPDATE CENTER • LICENCIAMENTO</span>
          <h1>Atualizações CloudPelizzon</h1>
          <p>O acesso às atualizações comerciais está protegido.</p>
        </div>
        <div class="heroactions"><button type="button" id="open-license">Gerenciar licença</button></div>
      </section>
      <section class="cp-activation" role="status">
        <h2>${heading}</h2>
        <p>${summary}</p>
        <p>Seus módulos demonstrativos continuam disponíveis no Control Center. As atualizações públicas da integração são gerenciadas separadamente pelo HACS.</p>
        <a href="/hacs">Abrir atualizações públicas no HACS ↗</a>
        <div class="cp-safe">Nenhum módulo comercial foi liberado e nenhuma configuração de segurança foi alterada.</div>
      </section></main>`;
    this.querySelector("#open-license").addEventListener("click",()=>{
      window.location.assign("/cloudpelizzon?cp_open_license=1");
    });
  }
  renderError(e){
    if(this.isActivationError(e)){this.renderActivationRequired(e);return;}
    this.innerHTML=`<style>${this.css()}</style><main><section class="hero"><div><span>UPDATE CENTER</span><h1>Atualizações CloudPelizzon</h1><p>${this.esc(e)}</p></div><button id="retry">Tentar novamente</button></section></main>`;
    this.querySelector("#retry").onclick=()=>this.load(true);
  }
  notes(r){return `<details><summary>Notas da versão</summary><div class="notes"><b>${this.esc(r.title)}</b><p>${this.esc(r.summary||'')}</p><pre>${this.esc(r.release_notes||'Sem notas cadastradas.')}</pre>${r.compatibility_notes?`<small>Compatibilidade: ${this.esc(r.compatibility_notes)}</small>`:''}</div></details>`}
  componentCard(c){
    const r=(this.data.releases||[]).find(x=>x.sku===c.sku);
    const backups=(this.data.backups||[]).filter(x=>x.sku===c.sku);
    const installed=Boolean(c.version);
    let state=installed?'<span class="pill ok">Instalado</span>':'<span class="pill warn">Não instalado</span>';
    let actions='';
    if(r&&r.update_available){
      state=installed
        ? `<span class="pill warn">Desatualizado • ${this.esc(r.version)} disponível</span>`
        : `<span class="pill warn">Disponível para instalação • ${this.esc(r.version)}</span>`;
      actions=`<button data-install="${this.esc(r.release_id)}">${installed?'Instalar atualização':'Instalar módulo'}</button>`;
    }
    if(backups.length){
      actions+=`<button class="secondary" data-rollback="${this.esc(backups[0].backup_id)}">Rollback para ${this.esc(backups[0].from_version||'anterior')}</button>`;
    }
    return `<article class="card"><div class="cardhead"><div><span>${this.esc(c.sku)}</span><h2>${this.esc(c.name)}</h2></div>${state}</div><div class="versions"><div><small>Instalada</small><b>${this.esc(c.version||'—')}</b></div><div><small>Disponível</small><b>${this.esc(r?.version||c.version||'—')}</b></div><div><small>Canal</small><b>${this.esc(r?.channel||this.data.channel||'—')}</b></div></div>${r?this.notes(r):'<p class="muted">Nenhuma versão publicada para este componente no canal atual.</p>'}<div class="actions">${actions}</div></article>`;
  }
  render(){

    const d =
      this.data || {};

    const installedComponents = d.components || [];
    const comps = [...installedComponents];

    // Render only server-authorized, signed release entries returned by the
    // updater, including commercial modules not yet installed on this HA.
    for (const release of (d.releases || [])) {
      if (!release || !release.update_available) continue;
      if (!comps.some(component => component.sku === release.sku)) {
        comps.push({
          sku: release.sku,
          name: release.title || release.sku,
          version: '',
        });
      }
    }

    const updates =
      (d.releases || [])
        .filter(
          x => x.update_available
        )
        .length;

    const DOC_BASE =
      "https://documentacao.cloudpelizzon.com.br";


    const docs = {

      "CP-CORE": {
        title:
          "CloudPelizzon Core",
        description:
          "Arquitetura, baseline e notas da versão do núcleo CloudPelizzon.",
        url:
          `${DOC_BASE}/cliente/sistemas/core/manual-operacao-20261026`,
      },

      "CP-MAINTENANCE": {
        title:
          "Manutenção",
        description:
          "Manual funcional completo do módulo Manutenção.",
        url:
          `${DOC_BASE}/manutencao/manual-operacao-20261026`,
      },

      "CP-UPDATER": {
        title:
          "Central de Atualizações",
        description:
          "Notas, versões e documentação do ecossistema CloudPelizzon.",
        url:
          `${DOC_BASE}/cliente/sistemas/documentacao/manual-operacao-20261026`,
      },

    };


    const documentationRows =
      comps
        .map(
          component => {

            const doc =
              docs[component.sku]
              || {
                title:
                  component.name
                  || component.sku,
                description:
                  "Documentação CloudPelizzon.",
                url:
                  DOC_BASE,
              };

            return `
              <div>

                <code>
                  ${this.esc(
                    component.sku
                  )}
                </code>

                <span>
                  <b>
                    ${this.esc(
                      doc.title
                    )}
                  </b>
                  <br>
                  <small>
                    ${this.esc(
                      doc.description
                    )}
                  </small>
                </span>

                <small>
                  ${this.esc(
                    component.version
                    || "—"
                  )}
                </small>

                <a
                  href="${doc.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="
                    padding:10px 13px;
                    border-radius:10px;
                    border:1px solid #2878a5;
                    background:#0b6fa8;
                    color:white;
                    font-weight:800;
                    text-decoration:none;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    white-space:nowrap;
                  ">
                  Abrir notas da versão ↗
                </a>

              </div>
            `;
          }
        )
        .join("");


    const rollbackDocumentation =
      `${DOC_BASE}/infraestrutura/backup-recuperacao`;


    this.innerHTML = `

      <style>
        ${this.css()}
      </style>

      <main>

        <section class="hero">

          <div>

            <span>
              RELEASE CENTER • CLIENTE
            </span>

            <h1>
              Atualizações CloudPelizzon
            </h1>

            <p>
              Atualize módulos com
              verificação de integridade,
              backup automático e
              rollback controlado.
            </p>

          </div>

          <div class="heroactions">

            <button id="check">
              Verificar atualizações
            </button>

            ${
              d.restart_required
                ? `
                  <button
                    class="restart"
                    id="restart">
                    Reiniciar Home Assistant
                  </button>
                `
                : ""
            }

          </div>

        </section>


        <section class="kpis">

          <article>
            <span>Canal</span>
            <b>
              ${this.esc(
                d.channel || "—"
              )}
            </b>
          </article>

          <article>
            <span>Atualizações</span>
            <b>${updates}</b>
          </article>

          <article>
            <span>Componentes</span>
            <b>${installedComponents.length}</b>
          </article>

          <article>
            <span>Backups</span>
            <b>
              ${
                (d.backups || [])
                  .length
              }
            </b>
          </article>

          <article>
            <span>
              Última consulta
            </span>

            <b class="small">
              ${this.fmt(
                d.last_check_at
              )}
            </b>
          </article>

        </section>


        <section class="grid">

          ${
            comps
              .map(
                x =>
                  this.componentCard(x)
              )
              .join("")
          }

        </section>


        <section class="panel">

          <h2>
            Documentação
          </h2>

          <p class="muted">
            Acesse diretamente os
            manuais e notas oficiais da
            Central de Documentação
            CloudPelizzon.
          </p>

          <div class="table">

            ${documentationRows}

          </div>

          <div class="actions">

            <a
              href="${DOC_BASE}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                padding:10px 13px;
                border-radius:10px;
                border:1px solid #24566f;
                background:#082131;
                color:white;
                font-weight:800;
                text-decoration:none;
                display:inline-flex;
                align-items:center;
              ">
              Abrir Central de Documentação ↗
            </a>

            <a
              href="${DOC_BASE}/notas-de-versao"
              target="_blank"
              rel="noopener noreferrer"
              style="
                padding:10px 13px;
                border-radius:10px;
                border:1px solid #24566f;
                background:#082131;
                color:white;
                font-weight:800;
                text-decoration:none;
                display:inline-flex;
                align-items:center;
              ">
              Ver todas as notas de versão ↗
            </a>

          </div>

        </section>


        <section class="panel">

          <h2>
            Histórico e rollback
          </h2>

          ${
            (d.backups || []).length
              ? `
                <div class="table">

                  ${
                    (d.backups || [])
                      .map(
                        b => `

                          <div>

                            <code>
                              ${this.esc(
                                b.sku
                              )}
                            </code>

                            <span>
                              ${this.esc(
                                b.from_version
                              )}
                              →
                              ${this.esc(
                                b.to_version
                              )}
                            </span>

                            <small>
                              ${this.fmt(
                                b.created_at
                              )}
                            </small>

                            <button
                              class="secondary"
                              data-rollback="${
                                this.esc(
                                  b.backup_id
                                )
                              }">
                              Restaurar
                            </button>

                          </div>

                        `
                      )
                      .join("")
                  }

                </div>
              `
              : `
                <p class="muted">
                  Nenhum backup de
                  atualização ainda.
                </p>
              `
          }

          <div class="actions">

            <a
              href="${rollbackDocumentation}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                padding:10px 13px;
                border-radius:10px;
                border:1px solid #24566f;
                background:#082131;
                color:white;
                font-weight:800;
                text-decoration:none;
                display:inline-flex;
                align-items:center;
              ">
              Documentação de backup e rollback ↗
            </a>

          </div>

        </section>

      </main>
    `;

    this.bind();
  }
  bind(){this.querySelector('#check').onclick=()=>this.load(true);const rr=this.querySelector('#restart');if(rr)rr.onclick=async()=>{if(confirm('Reiniciar o Home Assistant agora para carregar a nova versão?'))await this.ws('cloudpelizzon/updater/restart')};this.querySelectorAll('[data-install]').forEach(b=>b.onclick=async()=>{if(!confirm('A atualização criará um backup automático e substituirá os arquivos do componente. Continuar?'))return;b.disabled=true;b.textContent='Instalando...';try{await this.ws('cloudpelizzon/updater/install',{release_id:b.dataset.install});alert('Atualização instalada. Reinicie o Home Assistant para concluir.');await this.load(false)}catch(e){alert(e.message||e);b.disabled=false}});this.querySelectorAll('[data-rollback]').forEach(b=>b.onclick=async()=>{if(!confirm('Restaurar esta versão anterior? Será necessário reiniciar o Home Assistant.'))return;b.disabled=true;try{await this.ws('cloudpelizzon/updater/rollback',{backup_id:b.dataset.rollback});alert('Rollback preparado. Reinicie o Home Assistant para concluir.');await this.load(false)}catch(e){alert(e.message||e);b.disabled=false}})}
  css(){return `:host{display:block;background:#020913;color:#eefaff;min-height:100vh;font:14px Inter,Segoe UI,Arial}*{box-sizing:border-box}main{width:min(1600px,calc(100vw - 32px));margin:auto;padding:22px 0 40px}.hero,.panel,.card,.kpis article{border:1px solid #174461;background:linear-gradient(150deg,#071d2b,#04131d);border-radius:18px;box-shadow:0 15px 38px rgba(0,0,0,.2)}.hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px 28px}.hero span,.cardhead span{color:#55c8ff;font-size:9px;font-weight:900;letter-spacing:.13em}.hero h1{margin:5px 0;font-size:30px}.hero p,.muted{color:#7fa5b9}.heroactions{display:flex;gap:8px}button{padding:10px 13px;border-radius:10px;border:1px solid #2878a5;background:#0b6fa8;color:white;font-weight:800;cursor:pointer}.secondary{background:#082131;border-color:#24566f}.restart{background:#72510a;border-color:#c89428}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:12px 0}.kpis article{padding:13px}.kpis span,.versions small{display:block;color:#7799aa;font-size:8px;text-transform:uppercase}.kpis b{display:block;margin-top:5px;font-size:20px}.kpis .small{font-size:11px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{padding:17px}.cardhead{display:flex;justify-content:space-between;gap:10px}.card h2{margin:4px 0 0}.pill{height:max-content;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900}.ok{color:#65dab0;border:1px solid #236c55}.warn{color:#ffd775;border:1px solid #89691d;background:#332708}.versions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.versions>div{padding:9px;border:1px solid #153c52;border-radius:10px;background:#04121b}.versions b{display:block;margin-top:4px;font-size:11px}.card details,.panel details{border:1px solid #153c52;border-radius:10px;background:#04121b;margin:8px 0}.card summary,.panel summary{padding:10px;cursor:pointer;font-weight:800}.notes{padding:0 10px 10px}.notes p,.notes small{color:#86a5b4}.notes pre,.panel pre{white-space:pre-wrap;font:10px/1.5 Inter,Segoe UI;color:#b7d4e1}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.panel{padding:18px;margin-top:12px}.panel h2{margin-top:0}.table>div{display:grid;grid-template-columns:150px 1fr 220px auto;gap:10px;align-items:center;padding:10px;border-bottom:1px solid #15384b}.table small{color:#708e9e}.center{min-height:80vh;display:flex;align-items:center;justify-content:center;gap:12px}.spin{width:28px;height:28px;border:3px solid #174461;border-top-color:#27baff;border-radius:50%;animation:r .7s linear infinite}@keyframes r{to{transform:rotate(360deg)}}@media(max-width:900px){.grid{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.hero{align-items:flex-start;flex-direction:column}.table>div{grid-template-columns:1fr 1fr}}`}
}
customElements.define('cloudpelizzon-updater-panel',CloudPelizzonUpdaterPanel);

/* CLOUDPELIZZON_DOC_LINKS_R5_START */
(() => {
  const MAP = {
    core: "https://documentacao.cloudpelizzon.com.br/cliente/sistemas/core/manual-operacao-20261026",
    energy: "https://documentacao.cloudpelizzon.com.br/modulos/solar/manual-operacao-20261026",
    maintenance: "https://documentacao.cloudpelizzon.com.br/manutencao/manual-operacao-20261026",
    updater: "https://documentacao.cloudpelizzon.com.br/cliente/sistemas/documentacao/manual-operacao-20261026"
  };

  function resolveUrl(contextText) {
    const t = String(contextText || "").toLowerCase();
    if (t.includes("cp-core") || t.includes("cloudpelizzon core")) return MAP.core;
    if (t.includes("cp-energy") || t.includes("geração e consumo de energia") || t.includes("geracao e consumo de energia")) return MAP.energy;
    if (t.includes("cp-maintenance") || t.includes("manutenção") || t.includes("manutencao")) return MAP.maintenance;
    if (t.includes("cp-updater") || t.includes("central de atualizações") || t.includes("central de atualizacoes")) return MAP.updater;
    return "";
  }

  function patchButton(btn, url) {
    if (!btn || !url) return;
    if (btn.tagName === "A") {
      btn.setAttribute("href", url);
      btn.setAttribute("target", "_blank");
      btn.setAttribute("rel", "noopener noreferrer");
    } else {
      btn.onclick = (ev) => {
        ev.preventDefault();
        window.open(url, "_blank", "noopener");
      };
    }
    btn.dataset.cpDocsR5 = "1";
  }

  function applyToRoot(root) {
    if (!root) return;
    const nodes = [...root.querySelectorAll("a,button")].filter(el => /abrir notas da versão/i.test(el.textContent || ""));
    nodes.forEach(btn => {
      const context = btn.closest("tr, li, article, section, .row, .item, div");
      const text = [
        context?.textContent || "",
        btn.parentElement?.textContent || "",
        btn.textContent || ""
      ].join(" ");
      const url = resolveUrl(text);
      patchButton(btn, url);
    });
  }

  function installForInstance(el) {
    if (!el || el.__cpDocsObserverR5) return;
    const apply = () => applyToRoot(el.shadowRoot || el);
    const root = el.shadowRoot || el;
    try {
      const mo = new MutationObserver(() => apply());
      mo.observe(root, { childList: true, subtree: true });
      el.__cpDocsObserverR5 = mo;
    } catch (_) {}
    requestAnimationFrame(apply);
    setTimeout(apply, 500);
    setTimeout(apply, 1500);
  }

  function boot() {
    document.querySelectorAll("cloudpelizzon-updater-panel").forEach(installForInstance);
    const C = customElements.get("cloudpelizzon-updater-panel");
    if (C && !C.prototype.__cpDocsR5Wrapped) {
      const origConnected = C.prototype.connectedCallback;
      C.prototype.connectedCallback = function (...args) {
        const out = origConnected ? origConnected.apply(this, args) : undefined;
        requestAnimationFrame(() => installForInstance(this));
        return out;
      };
      const origRender = C.prototype.render;
      if (origRender) {
        C.prototype.render = function (...args) {
          const out = origRender.apply(this, args);
          requestAnimationFrame(() => installForInstance(this));
          return out;
        };
      }
      C.prototype.__cpDocsR5Wrapped = true;
    }
  }

  if (customElements.get("cloudpelizzon-updater-panel")) boot();
  else customElements.whenDefined("cloudpelizzon-updater-panel").then(boot).catch(() => {});
  window.addEventListener("load", () => setTimeout(boot, 200), { once: true });
})();
/* CLOUDPELIZZON_DOC_LINKS_R5_END */


/* CLOUDPELIZZON_STATUS_R52_START */
(() => {
  const K = customElements.get("cloudpelizzon-updater-panel");
  if (!K || K.prototype.__cpStatusR52) return;
  const originalCss = K.prototype.css;
  K.prototype.css = function(...args) {
    const base = originalCss ? originalCss.apply(this,args) : "";
    return `${base}
      .pill.ok{color:#58f28a!important;background:rgba(39,201,99,.14)!important;border-color:rgba(61,232,124,.58)!important;box-shadow:0 0 14px rgba(61,232,124,.12)!important}
      .pill.warn{color:#ffb347!important;background:rgba(255,159,28,.14)!important;border-color:rgba(255,159,28,.62)!important;box-shadow:0 0 14px rgba(255,159,28,.10)!important}
    `;
  };
  K.prototype.__cpStatusR52 = true;
})();
/* CLOUDPELIZZON_STATUS_R52_END */



/*
 * ==========================================================
 * CP_DOC_LINK_ROUTER_V2
 *
 * Direcionamento oficial por SKU.
 * ==========================================================
 */

(() => {

  const ROUTES = {

    "CP-UPDATER":
      "https://documentacao.cloudpelizzon.com.br/"
      + "notas-de-versao/central-de-atualizacoes",

    "CP-SECURITY":
      "https://documentacao.cloudpelizzon.com.br/"
      + "notas-de-versao/seguranca",

  };


  function findButton(
    root,
    skuNode,
  ) {

    let box = skuNode;

    for (
      let level = 0;
      level < 8 && box;
      level += 1
    ) {

      const buttons =
        Array.from(
          box.querySelectorAll(
            "a,button"
          )
        );

      const target =
        buttons.find(
          element =>
            /abrir notas da vers/i.test(
              element.textContent || ""
            )
        );

      if (target) {
        return target;
      }

      box = box.parentElement;
    }

    return null;
  }


  function applyLinks(root) {

    if (!root) {
      return;
    }


    const candidates =
      Array.from(
        root.querySelectorAll(
          "code,span,small,b,strong"
        )
      );


    for (
      const [sku, url]
      of Object.entries(ROUTES)
    ) {

      const skuNode =
        candidates.find(
          node =>
            String(
              node.textContent || ""
            ).trim() === sku
        );


      if (!skuNode) {
        continue;
      }


      const target =
        findButton(
          root,
          skuNode
        );


      if (!target) {
        continue;
      }


      if (
        target.tagName
          .toLowerCase()
        === "a"
      ) {

        target.href = url;

        target.target =
          "_blank";

        target.rel =
          "noopener noreferrer";

      }

      else {

        target.onclick =
          event => {

            event.preventDefault();
            event.stopPropagation();

            window.open(
              url,
              "_blank",
              "noopener,noreferrer"
            );
          };
      }


      target.dataset.cpDocsSku =
        sku;

      target.title =
        "Abrir notas oficiais de "
        + sku;
    }
  }


  const Panel =
    customElements.get(
      "cloudpelizzon-updater-panel"
    );


  if (
    !Panel
    || Panel.prototype
      .__cpDocLinkRouterV2
  ) {
    return;
  }


  Panel.prototype
    .__cpDocLinkRouterV2 =
      true;


  const originalBind =
    Panel.prototype.bind;


  Panel.prototype.bind =
    function (...args) {

      const result =
        originalBind
          ? originalBind.apply(
              this,
              args
            )
          : undefined;


      queueMicrotask(
        () => {
          applyLinks(this);
        }
      );


      return result;
    };

})();

/* CP_UPDATER229 */
/* Signed profile/Release Center reader for locally delivered modules. */
(() => {
 const C=customElements.get('cloudpelizzon-updater-panel');if(!C)return;const p=C.prototype;
 const readable=v=>{let s=String(v??'');for(const [a,b] of [
 ['Manuten??o','Manutenção'],['Manuten��o','Manutenção'],['ManutenÃ§Ã£o','Manutenção'],
 ['Manutencao','Manutenção'],['manutencao','manutenção'],['Correcoes','Correções'],
 ['correcoes','correções'],['reativacao','reativação'],['homologacao','homologação'],
 ['Homologacao','Homologação']])s=s.split(a).join(b);return s;};
 const publicationDate=v=>{if(!v)return '';const s=String(v);if(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))return s.split('-').reverse().join('/');const d=new Date(s);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR');};
 const esc=v=>readable(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 p.load=async function(check=true){
  if(this._loading||!this._hass)return;this._loading=true;this.renderLoading();
  try{this.data=await this.ws(check?'cloudpelizzon/private_updater/check':'cloudpelizzon/private_updater/status');this.render();}
  catch(e){this.data=null;this.renderError(e.message||'Não foi possível consultar as atualizações agora.');}
  finally{this._loading=false;}
 };
 p.render=function(){const d=this.data||{},components=d.components||[],releases=d.catalog_releases||[];
  this.innerHTML=`<style>${this.css()} cloudpelizzon-updater-panel{display:block;min-width:0;width:100%;font:14px Inter,Segoe UI,Arial;color:#eefaff;background:#020913;overflow-x:clip}cloudpelizzon-updater-panel main{zoom:.67;width:100%;max-width:none;min-width:0;margin:0;padding:22px 24px 40px;box-sizing:border-box}cloudpelizzon-updater-panel .hero{min-width:0}cloudpelizzon-updater-panel .hero>div{min-width:0}cloudpelizzon-updater-panel .hero button{flex-shrink:0}cloudpelizzon-updater-panel .versions{grid-template-columns:repeat(2,minmax(0,1fr))}cloudpelizzon-updater-panel .card,cloudpelizzon-updater-panel .cp-published229{min-width:0;overflow-wrap:anywhere}cloudpelizzon-updater-panel .cp-up-components229{grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))}@media(max-width:760px){cloudpelizzon-updater-panel main{zoom:1;width:100%;padding:16px 12px 28px}cloudpelizzon-updater-panel .hero{padding:18px;align-items:flex-start;flex-direction:column}cloudpelizzon-updater-panel .hero h1{font-size:25px}cloudpelizzon-updater-panel button{min-height:44px}cloudpelizzon-updater-panel .versions{grid-template-columns:1fr}} .cp-update-info229{padding:20px;border:1px solid #1a526d;border-radius:14px;background:#082536;color:#a3c9dc;line-height:1.7;margin:20px 0}.cp-up-components229{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}.cp-published229{padding:18px;border-bottom:1px solid #173b50;color:#b4d2e4;line-height:1.7}</style><main><section class="hero"><div><span>RELEASE CENTER · CLOUDPELIZZON</span><h1>Atualizações dos seus módulos</h1><p>Pacotes instalados neste Home Assistant e publicações vinculadas às suas licenças.</p></div><button id="check229">Verificar novamente</button></section><div class="cp-update-info229">Consulta ao servidor concluída em ${esc(new Date(d.checked_at).toLocaleString('pt-BR'))}. As atualizações públicas da integração continuam disponíveis no HACS.</div><div class="cp-up-components229">${components.map(c=>`<article class="card"><div class="cardhead"><div><span>${esc(c.sku)}</span><h2>${esc(c.name)}</h2></div><span class="pill ok">${c.installed&&c.signature_verified?'Instalado localmente':'Licenciado'}</span></div><div class="versions"><div><small>Versão instalada</small><b>${esc(c.version||'Versão local não confirmada')}</b></div><div><small>Pacote</small><b>${c.installed&&c.signature_verified?'Assinatura verificada':'Instalação local não confirmada'}</b></div></div></article>`).join('')||'<div class="cp-update-info229">Nenhum pacote comercial local foi identificado nesta consulta. Instale os módulos contratados pela Visão Geral.</div>'}</div><section class="card" style="margin-top:22px"><h2>Publicações no Release Center</h2>${releases.map(r=>`<div class="cp-published229"><b>${esc(r.title||r.sku)} · ${esc(r.version)}</b><br>${esc(r.summary||'')}<br><small>Canal ${esc(r.channel)} · ${esc(publicationDate(r.published_at))}</small></div>`).join('')||'<p class="muted">Nenhuma publicação disponível para seus módulos nesta consulta.</p>'}<p class="muted">Uma publicação só será oferecida para instalação quando houver um pacote local compatível e autorizado. Nenhum pacote foi baixado ou aplicado por esta consulta.</p></section></main>`;
  this.querySelector('#check229').onclick=()=>this.load(true);
 };
})();

/* CP_DOCUMENTATION233: theme-specific manuals and independent release notes. */
(()=>{const C=customElements.get('cloudpelizzon-updater-panel');if(!C)return;const p=C.prototype,render=p.render,base='https://documentacao.cloudpelizzon.com.br',docs=[["CloudPelizzon Core", "cliente/sistemas/core/manual-operacao-20261026", "notas-de-versao/core/2026-10-26"], ["Inteligência Solar", "modulos/solar/manual-operacao-20261026", "notas-de-versao/energia/2026-10-26"], ["Manutenção Residencial Preventiva", "manutencao/manual-operacao-20261026", "notas-de-versao/manutencao/2026-10-26"], ["Documentação e Atualizações", "cliente/sistemas/documentacao/manual-operacao-20261026", "notas-de-versao/central-de-atualizacoes/2026-10-26"], ["Central de Segurança Pro", "modulos/seguranca/manual-operacao-20261026", "notas-de-versao/seguranca/2026-10-26"], ["Central Inteligente de Automações", "modulos/automacoes/manual-operacao-20261026", "notas-de-versao/automacoes/2026-10-26"], ["Iluminação Inteligente", "modulos/iluminacao/manual-operacao-20261026", "notas-de-versao/iluminacao/2026-10-26"]];
p.render=function(){render.call(this);const main=this.querySelector('main');if(!main)return;const licensed=new Set(Array.isArray(this.data?.licensed_modules)?this.data.licensed_modules:[]);const moduleSkus={'Inteligência Solar':'CP-SOLAR','Manutenção Residencial Preventiva':'CP-MAINTENANCE','Central de Segurança Pro':'CP-SECURITY-PRO','Central Inteligente de Automações':'CP-AUTOMATION','Iluminação Inteligente':'CP-LIGHTING'};const visibleDocs=docs.filter(([name])=>!moduleSkus[name]||licensed.has(moduleSkus[name]));const section=document.createElement('section');section.className='card';section.style.marginTop='22px';section.innerHTML=`<h2>Documentação e notas de versão</h2><p class="muted">Manuais de processo e notas de alteração organizados por produto. Revisão documental de 26/10/2026.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">${visibleDocs.map(([name,manual,notes])=>`<article class="doc488" style="padding:20px;border:1px solid #236583;border-radius:14px;background:#092638"><strong>${name}</strong><p class="muted">Processo, diagnóstico e histórico de alterações.</p><p><a target="_blank" rel="noopener noreferrer" href="${base+'/'+manual}" style="color:#5be4ff">Consultar manual ↗</a></p><a target="_blank" rel="noopener noreferrer" href="${base+'/'+notes}" style="color:#c2eaff">Notas de versão ↗</a></article>`).join('')}</div><p><a href="${base}/modulos" target="_blank" rel="noopener noreferrer" style="color:#4fdaff">Abrir módulos na documentação ↗</a></p>`;main.append(section);};})();
