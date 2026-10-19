// CP-LIGHTING — isolated, read-only UI prototype (not a license or command handler).
// This preview intentionally exports no Home Assistant service calls or writable controls.
export const LIGHTING_PREVIEW_SKU = 'CP-LIGHTING';
const LIGHT_ID = /^light\.[a-z0-9_]+$/;
const STATES = new Set(['on', 'off', 'unavailable', 'unknown']);
const STATE_LABELS = Object.freeze({
  on: 'Ligada', off: 'Desligada', unavailable: 'Indisponível', unknown: 'Desconhecida',
});

function escapeText(value, fallback = '') {
  const text = typeof value === 'string' ? value : fallback;
  return text.slice(0, 160).replace(/[\u0000-\u001f\u007f]/g, '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeLights(raw) {
  if (!Array.isArray(raw)) return [];
  const byId = new Map();
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object' ||
        typeof candidate.entity_id !== 'string' || !LIGHT_ID.test(candidate.entity_id)) continue;
    const id = candidate.entity_id;
    const state = STATES.has(candidate.state) ? candidate.state : 'unknown';
    const brightness = state === 'on' && typeof candidate.brightness_pct === 'number' &&
      Number.isFinite(candidate.brightness_pct) && candidate.brightness_pct >= 0 &&
      candidate.brightness_pct <= 100 ? Math.round(candidate.brightness_pct) : null;
    byId.set(id, {
      id,
      state,
      name: escapeText(candidate.name, id.slice(6).replaceAll('_', ' ')),
      area: escapeText(candidate.area, 'Sem ambiente'),
      brightness,
    });
  }
  return [...byId.values()].sort((a, b) =>
    a.id.localeCompare(b.id, 'pt-BR', {sensitivity: 'base'}));
}

// Self-contained CSS allows an offline HTML preview without pulling remote assets.
export const LIGHTING_PREVIEW_CSS = `
.cp-lighting{box-sizing:border-box;min-height:240px;padding:24px;border:1px solid #193b56;border-radius:24px;
  color:#e5f6ff;background:radial-gradient(circle at 80% 0%,#123d5b 0,#0a1f36 46%,#07111f 100%);
  font:500 15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 16px 48px #020814aa}
.cp-lighting *{box-sizing:border-box}.cp-lighting h2{margin:0;font-size:26px;letter-spacing:.02em}
.cp-lighting p{margin:8px 0 0;color:#b8d6e8}.cp-lighting-header{display:flex;gap:16px;align-items:start;
  justify-content:space-between;flex-wrap:wrap}.cp-lighting-tag{padding:6px 11px;border:1px solid #268bb0;
  border-radius:99px;color:#a7efff;background:#102f49;font-size:12px;font-weight:700;letter-spacing:.05em}
.cp-lighting-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:10px;margin:22px 0}
.cp-lighting-stat{padding:14px;background:#09273c;border:1px solid #23506b;border-radius:15px}
.cp-lighting-stat strong{display:block;font-size:26px;color:#eafbff;font-variant-numeric:tabular-nums}
.cp-lighting-stat span{font-size:12px;color:#b2d3e8}
.cp-lighting-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:13px}
.cp-lighting-card{padding:16px;background:linear-gradient(145deg,#103048,#0a2136);border-radius:18px;
  border:1px solid #285572;min-width:0}
.cp-lighting-card--on{border-color:#19afce;box-shadow:inset 0 0 0 1px #146c8a,0 0 18px #12a9d126}
.cp-lighting-card--unavailable{border-color:#a46b4d}.cp-lighting-card--unknown{border-color:#64788d}
.cp-lighting-card-heading{display:flex;gap:10px;align-items:center;justify-content:space-between}
.cp-lighting-name{margin:0;font-size:16px;overflow-wrap:anywhere}.cp-lighting-dot{flex:none;width:12px;height:12px;
  border-radius:50%;background:#617b90;box-shadow:0 0 0 3px #617b901c}
.cp-lighting-card--on .cp-lighting-dot{background:#6ceaff;box-shadow:0 0 12px #6ceaff99}
.cp-lighting-card--unavailable .cp-lighting-dot{background:#e5a57d}
.cp-lighting-meta{margin-top:9px;color:#b6d3e4;font-size:13px;overflow-wrap:anywhere}
.cp-lighting-status{margin-top:12px;color:#d7f1ff;font-weight:700;font-size:13px}
.cp-lighting-foot{margin-top:18px;color:#aed0e2;font-size:13px;border-top:1px solid #25506b;padding-top:12px}
.cp-lighting-locked{margin-top:24px;padding:22px;border:1px dashed #2c6e91;border-radius:18px;
  background:#0a2b44;color:#e8f8ff}
@media (prefers-reduced-motion:no-preference){.cp-lighting-card--on .cp-lighting-dot{
  animation:cp-lighting-softpulse 3.2s ease-in-out infinite}@keyframes cp-lighting-softpulse{
  50%{box-shadow:0 0 19px #6ceaffb5}}}
@media(max-width:520px){.cp-lighting{padding:16px}.cp-lighting h2{font-size:22px}}
`;

function wrapper(body) {
  return `<style>${LIGHTING_PREVIEW_CSS}</style><section class="cp-lighting" aria-label="CloudPelizzon Iluminação">
  <header class="cp-lighting-header"><div><h2>Iluminação inteligente</h2><p>CloudPelizzon · Visão individual das luzes</p></div>
  <span class="cp-lighting-tag">CP-LIGHTING · PRÉVIA</span></header>${body}</section>`;
}

// Renderable read-only markup. "locked:false" is only a presentation hint, never proof of authorization.
// This function cannot grant access, offer trials or send service calls to physical lights.
export function renderLightingReadonly(view) {
  if (!view || view.sku !== LIGHTING_PREVIEW_SKU || view.locked !== false) {
    return wrapper(`<div class="cp-lighting-locked" role="status"><strong>Módulo indisponível</strong>
      <p>Somente a Visão Geral está disponível. Solicite a contratação no Portal do Cliente.</p></div>`);
  }
  const lights = safeLights(view.lights);
  const counts = {total: lights.length, on: 0, off: 0, unavailable: 0, unknown: 0};
  for (const light of lights) counts[light.state] += 1;
  const stats = [
    ['Total', counts.total], ['Ligadas', counts.on], ['Desligadas', counts.off],
    ['Indisponíveis', counts.unavailable], ['Desconhecidas', counts.unknown],
  ].map(([label, count]) => `<div class="cp-lighting-stat"><strong>${count}</strong><span>${label}</span></div>`).join('');
  const cards = lights.map(light => `<article class="cp-lighting-card cp-lighting-card--${light.state}" data-entity="${light.id}">
    <div class="cp-lighting-card-heading"><h3 class="cp-lighting-name">${light.name}</h3><span class="cp-lighting-dot" aria-hidden="true"></span></div>
    <div class="cp-lighting-meta">${light.area}</div><div class="cp-lighting-status">${STATE_LABELS[light.state]}${light.brightness === null ? '' : ` · ${light.brightness}% de brilho`}</div>
  </article>`).join('');
  return wrapper(`<div class="cp-lighting-stats" aria-label="Resumo das luzes">${stats}</div>
    <div class="cp-lighting-grid" aria-label="Luzes individuais">${cards || '<p>Nenhuma luz disponível no inventário.</p>'}</div>
    <footer class="cp-lighting-foot">Prévia sem comandos. Consumo elétrico será exibido somente após validação de sensores reais e autorização privada.</footer>`);
}
