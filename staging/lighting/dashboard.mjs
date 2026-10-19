// CP-LIGHTING: public, inactive dashboard presentation. No entitlement or HA services.
// Last updated: 2026-10-19. Private server authorizes every read and device command.
export const LIGHTING_DASHBOARD_THEMES = Object.freeze(['grafite', 'flux', 'neo-soft']);
const SKU = 'CP-LIGHTING';
const ENTITY = /^(?:light|switch)\.[a-z0-9_]{1,128}$/;
const VALID_STATES = new Set(['on', 'off', 'unknown', 'unavailable']);
const LABELS = Object.freeze({
  on: 'Ligada', off: 'Desligada', unknown: 'Desconhecida', unavailable: 'Indisponível',
});
const PER_PAGE = 36;
const html = (value, fallback = '') => String(typeof value === 'string' ? value : fallback)
  .slice(0, 160).replace(/[\u0000-\u001f\u007f]/g, '').replace(/[&<>"']/g,
    char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const text = (value, fallback = '') => String(typeof value === 'string' ? value : fallback).slice(0, 160);
const themeOf = value => LIGHTING_DASHBOARD_THEMES.includes(value) ? value : 'grafite';
const finitePage = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function rows(view) {
  const found = new Map();
  const raw = Array.isArray(view.lights) ? view.lights : [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.entity_id !== 'string'
        || !ENTITY.test(item.entity_id)
        || (item.entity_id.startsWith('switch.') && item.source_kind !== 'configured_switch')) continue;
    const state = VALID_STATES.has(item.state) ? item.state : 'unknown';
    const name = text(item.name, item.entity_id.replace(/^\w+\./, '').replaceAll('_', ' '));
    const area = text(item.area, 'Sem ambiente');
    const pct = item.entity_id.startsWith('light.') && state === 'on'
      && item.capabilities?.brightness === true
      && typeof item.brightness_pct === 'number' && Number.isFinite(item.brightness_pct)
      && item.brightness_pct >= 0 && item.brightness_pct <= 100
      ? Math.round(item.brightness_pct) : null;
    found.set(item.entity_id, {entity_id: item.entity_id, name, area, state, brightness: pct,
      kind: item.entity_id.startsWith('switch.') ? 'relay' : 'light'});
  }
  return [...found.values()].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR',
    {sensitivity:'base',numeric:true}) || a.entity_id.localeCompare(b.entity_id));
}

export const LIGHTING_DASHBOARD_CSS = `
.cp-ld{--fg:#eaf8ff;--sub:#b8d1dd;--line:#2a566c;--base:#08131f;--card:#10283b;--accent:#49e0ff;
  color:var(--fg);background:var(--base);font:500 14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;
  min-height:400px;padding:26px;border:1px solid var(--line);border-radius:26px;isolation:isolate;overflow:hidden}
.cp-ld *{box-sizing:border-box}.cp-ld h2,.cp-ld h3,.cp-ld p{margin:0}
.cp-ld .cp-ld-head{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.cp-ld h2{font-size:clamp(23px,3vw,34px);font-weight:800;letter-spacing:-.035em}
.cp-ld .cp-ld-sub{color:var(--sub);font-size:13px;margin-top:5px}
.cp-ld .cp-ld-eyebrow{color:var(--accent);text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:800}
.cp-ld .cp-ld-status{border:1px solid var(--line);padding:8px 12px;border-radius:99px;color:var(--sub);font-size:12px}
.cp-ld .cp-ld-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:24px 0 20px}
.cp-ld .cp-ld-stat{border:1px solid var(--line);background:color-mix(in srgb,var(--card) 82%,transparent);
  padding:14px;border-radius:17px;min-width:0}
.cp-ld .cp-ld-stat strong{display:block;font-variant-numeric:tabular-nums;font-size:clamp(22px,3vw,32px)}
.cp-ld .cp-ld-stat span{color:var(--sub);font-size:11px}
.cp-ld .cp-ld-tools{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 18px;align-items:end}
.cp-ld .cp-ld-field{display:flex;flex-direction:column;gap:5px;min-width:155px;flex:1}
.cp-ld .cp-ld-field label{font-size:12px;color:var(--sub)}
.cp-ld input,.cp-ld select{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);
  border-radius:12px;padding:11px 12px;width:100%;outline-offset:3px}
.cp-ld input:focus-visible,.cp-ld select:focus-visible,.cp-ld button:focus-visible{outline:2px solid var(--accent)}
.cp-ld .cp-ld-meta{font-size:12px;color:var(--sub);margin-bottom:10px}
.cp-ld .cp-ld-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:13px}
.cp-ld .cp-ld-light{min-width:0;position:relative;padding:17px;background:var(--card);border:1px solid var(--line);
  border-radius:19px;transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease;overflow:hidden}
.cp-ld .cp-ld-light[data-state=on]{border-color:color-mix(in srgb,var(--accent) 65%,var(--line));
  box-shadow:inset 0 0 0 1px #39cce114,0 8px 30px #0004}
.cp-ld .cp-ld-light[data-state=unavailable]{border-style:dashed;border-color:#aa8b69}
.cp-ld .cp-ld-light[data-state=unknown]{border-style:dashed;border-color:#6f8699}
.cp-ld .cp-ld-lamp{width:48px;height:48px;border-radius:15px;border:1px solid var(--line);
  display:grid;place-items:center;background:linear-gradient(140deg,#133650,#081827);margin-bottom:14px}
.cp-ld .cp-ld-lamp:before{content:'';width:19px;height:19px;border-radius:50%;background:#657886;
  box-shadow:inset 0 -4px 5px #0005}
.cp-ld .cp-ld-light[data-state=on] .cp-ld-lamp:before{background:var(--accent);box-shadow:0 0 18px var(--accent)}
.cp-ld .cp-ld-light h3{font-size:16px;font-weight:700;overflow-wrap:anywhere}
.cp-ld .cp-ld-room{color:var(--sub);font-size:12px;overflow-wrap:anywhere;margin:5px 0 15px}
.cp-ld .cp-ld-foot{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}
.cp-ld .cp-ld-indicator{font-size:12px;font-weight:700}
.cp-ld .cp-ld-indicator[data-state=on]{color:var(--accent)}
.cp-ld .cp-ld-indicator[data-state=unavailable]{color:#f0b17b}
.cp-ld .cp-ld-kind{font-size:10px;color:var(--sub);border:1px solid var(--line);border-radius:99px;padding:3px 8px}
.cp-ld .cp-ld-pager{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:20px;font-size:12px}
.cp-ld button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);
  border-radius:12px;min-height:38px;padding:8px 14px;cursor:pointer}
.cp-ld button:disabled{opacity:.42;cursor:not-allowed}
.cp-ld .cp-ld-disclaimer{color:var(--sub);border-top:1px solid var(--line);margin-top:22px;padding-top:14px;font-size:12px}
.cp-ld .cp-ld-locked{margin-top:28px;padding:25px;background:var(--card);border:1px dashed var(--line);
  border-radius:20px;color:var(--sub)}
.cp-ld[data-theme=grafite]{--base:#080d15;--card:#131b28;--line:#324557;--accent:#49e3ff;
  background:radial-gradient(ellipse at 94% 2%,#183342 0%,transparent 38%),#080d15}
.cp-ld[data-theme=flux]{--base:#041b2a;--card:#0a3040;--line:#176a86;--accent:#56f3eb;
  background:radial-gradient(ellipse at 0% 0%,#065a65 0%,transparent 39%),
    linear-gradient(145deg,#04121f,#092a44)}
.cp-ld[data-theme=flux] .cp-ld-light:after{content:'';position:absolute;inset:auto 15px 0 15px;height:2px;
  background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.42}
.cp-ld[data-theme=neo-soft]{--base:#0d1b2a;--card:#1b3448;--line:#547086;--accent:#a2e5ff;
  background:radial-gradient(circle at 74% -15%,#36526a,transparent 50%),#0d1b2a}
.cp-ld[data-theme=neo-soft] .cp-ld-light{border-radius:27px;box-shadow:0 10px 35px #07172580}
.cp-ld[data-theme=neo-soft] .cp-ld-stat{border-radius:25px}
@media (prefers-reduced-motion:no-preference){
 .cp-ld .cp-ld-light:hover{transform:translateY(-3px)}
 .cp-ld .cp-ld-light[data-state=on] .cp-ld-lamp:before{animation:cp-ld-pulse 3.2s ease-in-out infinite}
 @keyframes cp-ld-pulse{50%{box-shadow:0 0 26px var(--accent)}}}
@media (prefers-reduced-motion:reduce){.cp-ld .cp-ld-light{transition:none!important}}
@media (max-width:840px){.cp-ld .cp-ld-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:520px){.cp-ld{padding:16px;border-radius:18px}.cp-ld .cp-ld-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cp-ld .cp-ld-list{grid-template-columns:1fr}.cp-ld .cp-ld-tools{display:grid}}
`;

/** Presentation only. The backend must authorize both configuration and live states. */
export function renderLightingDashboard(view, options = {}) {
  const authorized = view && view.sku === SKU && view.locked === false;
  const selectedTheme = authorized ? themeOf(options.theme ?? view.configuration?.theme) : 'grafite';
  const header = `<header class="cp-ld-head"><div><p class="cp-ld-eyebrow">CloudPelizzon / Iluminacao</p>
    <h2>Central de Ilumina\u00e7\u00e3o</h2><p class="cp-ld-sub">Cada luz, um controle individual no produto homologado</p></div>
    <span class="cp-ld-status">PR\u00c9VIA SOMENTE LEITURA</span></header>`;
  const wrap = body => `<style>${LIGHTING_DASHBOARD_CSS}</style><section class="cp-ld" data-theme="${selectedTheme}" aria-label="Painel CloudPelizzon de ilumina\u00e7\u00e3o">${header}${body}</section>`;
  if (!authorized) return wrap('<div class="cp-ld-locked" role="status"><strong>M\u00f3dulo indispon\u00edvel</strong><p>Somente Vis\u00e3o Geral e contrata\u00e7\u00e3o.</p></div>');
  const all = rows(view);
  const states = {total: all.length, on: 0, off: 0, unavailable: 0, unknown: 0};
  for (const light of all) states[light.state]++;
  const stats = [['Total', 'total'], ['Ligadas', 'on'], ['Desligadas', 'off'],
    ['Indispon\u00edveis', 'unavailable'], ['Desconhecidas', 'unknown']].map(([name,key]) =>
    `<div class="cp-ld-stat"><strong>${states[key]}</strong><span>${name}</span></div>`).join('');
  const query = text(options.query).trim().slice(0,100);
  const rooms = [...new Set(all.map(light => light.area))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  const room = typeof options.room === 'string' && rooms.includes(options.room) ? options.room : '';
  const normalizedQuery = query.toLocaleLowerCase('pt-BR');
  const filtered = all.filter(l => (!room || l.area === room) &&
    (!normalizedQuery || (l.name+' '+l.entity_id+' '+l.area).toLocaleLowerCase('pt-BR').includes(normalizedQuery)));
  const pageCount = Math.max(1,Math.ceil(filtered.length/PER_PAGE));
  const page = Math.min(finitePage(options.page),pageCount-1);
  const cards = filtered.slice(page*PER_PAGE,(page+1)*PER_PAGE).map(l =>
    `<article class="cp-ld-light" data-entity="${l.entity_id}" data-state="${l.state}">
      <div class="cp-ld-lamp" aria-hidden="true"></div><h3>${html(l.name)}</h3><p class="cp-ld-room">${html(l.area)}</p>
      <div class="cp-ld-foot"><span class="cp-ld-indicator" data-state="${l.state}">${LABELS[l.state]}${l.brightness===null?'':` \u00b7 ${l.brightness}%`}</span>
        <span class="cp-ld-kind">${l.kind==='relay'?'Rel\u00e9 confirmado':'Luz HA'}</span></div></article>`).join('');
  const opts = rooms.map(name=>`<option value="${html(name)}"${name===room?' selected':''}>${html(name)}</option>`).join('');
  const selectors = LIGHTING_DASHBOARD_THEMES.map(value=>`<option value="${value}"${value===selectedTheme?' selected':''}>${value==='neo-soft'?'NEO SOFT':value.toUpperCase()}</option>`).join('');
  return wrap(`<div class="cp-ld-stats" aria-label="Resumo da instala\u00e7\u00e3o">${stats}</div>
    <div class="cp-ld-tools">
      <div class="cp-ld-field"><label for="cp-ld-search">Buscar luz</label><input id="cp-ld-search" type="search" data-cp-lighting-search="1" value="${html(query)}" maxlength="100" autocomplete="off" /></div>
      <div class="cp-ld-field"><label for="cp-ld-room">C\u00f4modo</label><select id="cp-ld-room" data-cp-lighting-room="1"><option value="">Todos os c\u00f4modos</option>${opts}</select></div>
      <div class="cp-ld-field"><label for="cp-ld-theme">Pr\u00e9via do tema (n\u00e3o salva)</label><select id="cp-ld-theme" data-cp-lighting-theme="1">${selectors}</select></div>
    </div><p class="cp-ld-meta" aria-live="polite">${filtered.length} luz(es) na busca \u00b7 p\u00e1gina ${page+1} de ${pageCount}</p>
    <div class="cp-ld-list" aria-label="Luzes individuais">${cards||'<p>Nenhuma luz corresponde \u00e0 busca.</p>'}</div>
    <nav class="cp-ld-pager" aria-label="Paginar luzes">
      <button type="button" data-cp-lighting-page="previous" ${page===0?'disabled':''}>Anterior</button>
      <span>P\u00e1gina ${page+1}/${pageCount}</span>
      <button type="button" data-cp-lighting-page="next" ${page>=pageCount-1?'disabled':''}>Pr\u00f3xima</button>
    </nav><footer class="cp-ld-disclaimer">Apresenta\u00e7\u00e3o sem acionamento de dispositivos. Consumo el\u00e9trico somente com sensores reais validados; Trial e permiss\u00f5es pertencem ao servidor.</footer>`);
}

/** Browser preview controller; never touches hass, credentials, licenses or devices. */
export function mountLightingDashboard(root, {getView} = {}) {
  if (!root || typeof root.addEventListener !== 'function' || typeof getView !== 'function') throw new TypeError('host_required');
  const state = {query:'',room:'',page:0,theme:null};
  let disposed = false;
  function update() {
    if (disposed) return;
    // Never cache an unlocked snapshot: the native host owns authorization.
    // A failed getter must erase any previously rendered entity data.
    let view = null;
    try { view = getView(); } catch { view = null; }
    try {
      root.innerHTML = renderLightingDashboard(view,state);
    } catch {
      // Rendering errors must not leave stale authorized device cards visible.
      root.innerHTML = renderLightingDashboard(null);
    }
  }
  function input(event) {
    if (disposed || event?.target?.dataset?.cpLightingSearch === undefined) return;
    state.query = String(event.target.value ?? '').slice(0,100);state.page = 0;
    const caret = event.target.selectionStart;
    update();
    const fresh = root.querySelector?.('[data-cp-lighting-search]');
    fresh?.focus?.();
    if (Number.isSafeInteger(caret)) fresh?.setSelectionRange?.(caret,caret);
  }
  function change(event) {
    if (disposed) return;
    const data = event?.target?.dataset ?? {};
    if (data.cpLightingRoom !== undefined) {state.room = String(event.target.value ?? '');state.page = 0;update();}
    else if (data.cpLightingTheme !== undefined) {state.theme = themeOf(event.target.value);update();}
  }
  function click(event) {
    if (disposed) return;
    const button = event?.target?.closest?.('[data-cp-lighting-page]');
    const action = button?.dataset?.cpLightingPage;
    if (button?.disabled || !['next','previous'].includes(action)) return;
    state.page = Math.max(0,state.page+(action==='next'?1:-1));update();
  }
  root.addEventListener('input',input);
  root.addEventListener('change',change);
  root.addEventListener('click',click);
  update();
  return Object.freeze({update,dispose(){disposed=true;root.removeEventListener?.('input',input);
    root.removeEventListener?.('change',change);root.removeEventListener?.('click',click);root.innerHTML='';}});
}
