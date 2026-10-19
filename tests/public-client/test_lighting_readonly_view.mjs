import assert from 'node:assert/strict';
import test from 'node:test';
import {renderLightingReadonly, LIGHTING_PREVIEW_SKU} from '../../staging/lighting/readonly-view.mjs';

const fixture = {
  sku: LIGHTING_PREVIEW_SKU,
  locked: false,
  lights: [
    {entity_id: 'light.sala', name: 'Sala', area: 'Sala', state: 'on', brightness_pct: 65},
    {entity_id: 'light.cozinha', name: 'Cozinha', area: 'Cozinha', state: 'off'},
    {entity_id: 'light.garagem', name: 'Garagem', area: 'Externo', state: 'unavailable'},
    {entity_id: 'light.quarto', name: 'Quarto', area: 'Piso superior', state: 'unknown'},
  ],
};

test('bloqueia por padrão e não mostra entidades, contadores ou trial', () => {
  for (const invalid of [undefined, null, {}, {...fixture, locked: true}, {...fixture, sku: 'CP-ENERGY'}]) {
    const html = renderLightingReadonly(invalid);
    assert.match(html, /Somente a Visão Geral/);
    assert.doesNotMatch(html, /data-entity=/);
    assert.doesNotMatch(html, /Sala<\/h3>/);
    assert.doesNotMatch(html, /trial_active|Iniciar trial|Ativar teste/);
  }
});

test('lista cada luz individualmente, sem agrupamento ou dispositivo oculto', () => {
  const html = renderLightingReadonly(fixture);
  assert.equal((html.match(/<article /g) || []).length, 4);
  for (const id of ['light.sala', 'light.cozinha', 'light.garagem', 'light.quarto']) {
    assert.ok(html.includes(`data-entity="${id}"`));
  }
  assert.doesNotMatch(html, /<details|<select|class="cp-lighting-group/);
});

test('contagens representam os estados, sem classificar indisponível como desligada', () => {
  const html = renderLightingReadonly(fixture);
  assert.match(html, /<strong>4<\/strong><span>Total/);
  assert.match(html, /<strong>1<\/strong><span>Ligadas/);
  assert.match(html, /<strong>1<\/strong><span>Desligadas/);
  assert.match(html, /<strong>1<\/strong><span>Indisponíveis/);
  assert.match(html, /<strong>1<\/strong><span>Desconhecidas/);
  assert.match(html, /Ligada · 65% de brilho/);
});

test('ignora IDs inválidos e deduplica entidades na apresentação', () => {
  const html = renderLightingReadonly({...fixture, lights: [
    fixture.lights[0], fixture.lights[0], {entity_id: 'switch.garagem', name: 'Outra entidade', state: 'on'},
    {entity_id: 'light.x<script>', name: 'Script malicioso', state: 'on'},
  ]});
  assert.equal((html.match(/<article /g) || []).length, 1);
  assert.doesNotMatch(html, /Script malicioso|Outra entidade/);
});

test('escapa conteúdo não confiável antes de renderizar HTML', () => {
  const html = renderLightingReadonly({...fixture, lights: [{
    entity_id: 'light.alvo', state: 'on', name: '<img src=x onerror=alert(1)>', area: 'A&B "Teste"',
  }]});
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /A&amp;B &quot;Teste&quot;/);
  assert.doesNotMatch(html, /<img|onerror="/);
});

test('não inventa watts, não aciona dispositivos e não oferece controles fictícios', () => {
  const html = renderLightingReadonly({...fixture, measured_power_w: 999999});
  assert.match(html, /validação de sensores reais/);
  assert.doesNotMatch(html, /999999|<button|<input|onclick=|callService|hass\.services/);
});

test('respeita brilho apenas ligado, dentro de zero a cem', () => {
  const html = renderLightingReadonly({...fixture, lights: [
    {entity_id: 'light.off', state: 'off', brightness_pct: 77},
    {entity_id: 'light.on', state: 'on', brightness_pct: Infinity},
    {entity_id: 'light.valid', state: 'on', brightness_pct: 0},
  ]});
  assert.equal((html.match(/% de brilho/g) || []).length, 1);
  assert.match(html, /0% de brilho/);
});

test('acessibilidade básica e movimento reduzido', () => {
  const html = renderLightingReadonly(fixture);
  assert.match(html, /aria-label="Luzes individuais"/);
  assert.match(html, /prefers-reduced-motion:no-preference/);
  assert.match(html, /cp-lighting-card--unavailable/);
});

// Synthetic presentation inputs only: these are not signed backend grants.
import {projectLightingSnapshot} from '../../staging/lighting/projection.mjs';
import {existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../../', import.meta.url);
const states = {
  a: {entity_id: 'light.exemplo_a', state: 'on', attributes: {friendly_name: 'Exemplo A', brightness: 128}},
  b: {entity_id: 'light.exemplo_b', state: 'unavailable', attributes: {friendly_name: 'Exemplo B'}},
};
const displayHint = {sku: LIGHTING_PREVIEW_SKU, gateway_verified: true, license: {allowed: true}};

test('conecta a projeção ao painel sem renomear nem ocultar luzes', () => {
  const snapshot = projectLightingSnapshot(states, displayHint, {'light.exemplo_a': 'Ambiente exemplo'});
  const html = renderLightingReadonly(snapshot);
  assert.equal((html.match(/<article /g) || []).length, 2);
  assert.match(html, /data-entity="light.exemplo_a"/);
  assert.match(html, /data-entity="light.exemplo_b"/);
  assert.match(html, /Ligada · 50% de brilho/);
  assert.match(html, /Ambiente exemplo/);
  assert.match(html, /<strong>1<\/strong><span>Indisponíveis/);
});

test('nova renderização com acesso negado não preserva dados da projeção anterior', () => {
  assert.match(renderLightingReadonly(projectLightingSnapshot(states, displayHint)), /data-entity=/);
  for (const denied of [null, {}, {...displayHint, gateway_verified: false}, {
    sku: LIGHTING_PREVIEW_SKU, gateway_verified: true,
    trial: {verified: true, phase: 'trial_expired', paid_confirmed: false},
  }]) {
    const html = renderLightingReadonly(projectLightingSnapshot(states, denied));
    assert.match(html, /Somente a Visão Geral/);
    assert.doesNotMatch(html, /data-entity=|Exemplo A|Exemplo B|cp-lighting-stats"/);
  }
});

test('mantém os protótipos fora da integração instalada', () => {
  assert.equal(existsSync(new URL('custom_components/cloudpelizzon/ui/lighting', root)), false);
  for (const path of ['staging/lighting/projection.mjs', 'staging/lighting/readonly-view.mjs']) {
    assert.equal(existsSync(new URL(path, root)), true);
  }
});

test('inventaria os arquivos revisados sem reabrir a publicação do módulo', () => {
  const manifest = JSON.parse(readFileSync(new URL('source-manifest.json', root), 'utf8'));
  assert.equal(manifest.release_allowed, false);
  assert.equal(manifest.full_functional_acceptance_complete, false);
  assert.equal('custom_components/cloudpelizzon/ui/lighting/projection.mjs' in manifest.files, false);
  for (const path of ['staging/lighting/projection.mjs', 'staging/lighting/readonly-view.mjs',
    'tests/public-client/test_lighting_readonly_view.mjs', 'docs/lighting-ui-inventory-review.md',
    '.github/workflows/validate.yml']) {
    const digest = createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex');
    assert.equal(manifest.files[path], digest, path);
  }
});

// Run the read lifecycle suite in the existing CI entry point, without changing workflows.
import './test_lighting_read_session.mjs';
